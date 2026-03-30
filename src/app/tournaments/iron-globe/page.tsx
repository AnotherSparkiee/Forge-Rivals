
'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useGameState } from '@/app/lib/store';
import { useUser, useFirestore, useDoc, useMemoFirebase, useCollection } from '@/firebase';
import { doc, updateDoc, collection, query, where, arrayUnion } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Trophy, Clock, Users, Coins, ChevronLeft, 
  ShieldCheck, Loader2, Star, Swords, Medal,
  ArrowRight, CheckCircle2, User, UserCheck, AlertCircle,
  LogOut, History as HistoryIcon
} from 'lucide-react';
import Link from 'next/link';
import { getMoscowTime, getMoscowDateString } from '@/app/lib/time-utils';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { LEAGUES } from '@/app/lib/leagues-data';

const TOURNAMENT_FEE = 90000;
const START_TIME = "21:05";
const REG_CLOSE_TIME = "20:50"; 
const MAX_PARTICIPANTS = 16;

/**
 * Deterministic helper to get tournament structure based on date and participants
 */
export function getDeterministicTournament(dateStr: string, participants: any[], userId: string, showResults: boolean = false) {
  const realPlayers = participants?.map(p => ({ id: p.id, name: p.displayName || "Manager", isPlayer: true })) || [];
  const botNeeded = Math.max(0, MAX_PARTICIPANTS - realPlayers.length);
  
  // Seed based on date to keep IDs stable for the day
  const dateSeed = dateStr.split('-').reduce((acc, v) => acc + parseInt(v), 0);

  // Generate unique ID like bot4481
  const bots = Array.from({ length: botNeeded }).map((_, i) => {
    // Deterministic unique ID for the bot
    const botIdNum = 4000 + (dateSeed % 500) + (i * 31);
    const botName = `bot${botIdNum}`;
    
    return { 
      id: botName, 
      name: botName, 
      isPlayer: false 
    };
  });
  
  // Sort by ID to have a base stable order
  const allTeams = [...realPlayers, ...bots].sort((a, b) => a.id.localeCompare(b.id));
  
  // Shuffle groups based on date seed (very simple LCG-like)
  const seed = dateStr.split('-').reduce((acc, v) => acc + parseInt(v), 0);
  const shuffled = [...allTeams];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = (seed + i) % (i + 1);
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  const groups = [ shuffled.slice(0, 4), shuffled.slice(4, 8), shuffled.slice(8, 12), shuffled.slice(12, 16) ];
  
  // Find player's group and opponent
  let myGroupIdx = -1;
  let myOpponent = null;

  const processedGroups = groups.map((group, idx) => {
    const isMyGroup = group.some(t => t.id === userId);
    if (isMyGroup) myGroupIdx = idx;

    const groupResult = group.map(t => {
      if (!showResults) {
        return { ...t, pts: 0, w: 0, d: 0, l: 0 };
      }
      // Deterministic points based on ID and date
      const ptsSeed = (t.id.split('').reduce((a, b) => a + b.charCodeAt(0), 0) + seed) % 10;
      return { ...t, pts: ptsSeed, w: Math.floor(ptsSeed/3), d: ptsSeed % 3, l: Math.max(0, 3 - Math.floor(ptsSeed/3)) };
    }).sort((a, b) => b.pts - a.pts || a.id.localeCompare(b.id));

    return groupResult;
  });

  if (myGroupIdx !== -1) {
    const myGroup = groups[myGroupIdx];
    const myIdx = myGroup.findIndex(t => t.id === userId);
    myOpponent = myGroup[(myIdx + 1) % 4];
  }

  return { 
    groups: processedGroups, 
    qualifiers: processedGroups.flatMap(g => [g[0], g[1]]),
    myOpponent
  };
}

export default function IronGlobePage() {
  const { user, isUserLoading } = useUser();
  const db = useFirestore();
  const { credits, addCredits, language, isLoaded, recordMatch } = useGameState();
  const { toast } = useToast();
  
  const [isJoining, setIsJoining] = useState(false);
  const [countdown, setCountdown] = useState('');
  const [isLive, setIsLive] = useState(false);
  const [isRegClosed, setIsRegClosed] = useState(false);
  const [hasFinished, setHasFinished] = useState(false);
  const notifiedRef = useRef(false);
  const activeRecordRef = useRef(false);
  const finalResultRef = useRef(false);

  const userRef = useMemoFirebase(() => user ? doc(db, 'players_v5', user.uid) : null, [db, user]);
  const { data: profile } = useDoc(userRef);

  const participantsQuery = useMemoFirebase(() => {
    return query(collection(db, 'players_v5'), where('tournaments', 'array-contains', 'iron-globe'));
  }, [db]);

  const { data: participants, isLoading: isParticipantsLoading } = useCollection(participantsQuery);

  const isJoined = useMemo(() => {
    if (!profile?.tournaments?.includes('iron-globe')) return false;
    return true;
  }, [profile]);

  const currentCount = participants?.length || 0;
  const spotsLeft = Math.max(0, MAX_PARTICIPANTS - currentCount);

  useEffect(() => {
    const updateTime = () => {
      const mskNow = getMoscowTime();
      const [sh, sm] = START_TIME.split(':').map(Number);
      const startTarget = new Date(mskNow);
      startTarget.setHours(sh, sm, 0, 0);

      const [ch, cm] = REG_CLOSE_TIME.split(':').map(Number);
      const closeTarget = new Date(mskNow);
      closeTarget.setHours(ch, cm, 0, 0);

      const finishTarget = new Date(startTarget);
      finishTarget.setMinutes(finishTarget.getMinutes() + 35); 

      if (mskNow.getTime() >= finishTarget.getTime()) {
        setHasFinished(true);
        setIsLive(false);
        setCountdown('00:00:00');
      } else if (mskNow.getTime() >= startTarget.getTime()) {
        setIsLive(true);
        setIsRegClosed(true);
        setCountdown('00:00:00');
      } else if (mskNow.getTime() >= closeTarget.getTime()) {
        setIsLive(false);
        setIsRegClosed(true);
        if (!notifiedRef.current && isJoined) {
          toast({
            title: language === 'ru' ? "Регистрация завершена" : "Registration Closed",
            description: language === 'ru' ? "Группы сформированы! Изучите соперников." : "Groups are formed! Check your rivals.",
          });
          notifiedRef.current = true;
        }
        const diff = startTarget.getTime() - mskNow.getTime();
        setCountdown(formatDiff(diff));
      } else {
        setIsLive(false);
        setIsRegClosed(false);
        const diff = closeTarget.getTime() - mskNow.getTime();
        setCountdown(formatDiff(diff));
      }
    };

    const formatDiff = (diff: number) => {
      const hh = Math.floor(diff / 3600000);
      const mm = Math.floor((diff % 3600000) / 60000);
      const ss = Math.floor((diff % 60000) / 1000);
      return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
    };

    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, [isJoined, language, toast]);

  const tournamentData = useMemo(() => {
    if (!isRegClosed || !user) return null;
    return getDeterministicTournament(getMoscowDateString(), participants || [], user.uid, isLive);
  }, [isRegClosed, participants, user, isLive]);

  // Record Active status immediately after registration ends
  useEffect(() => {
    if (isRegClosed && isJoined && !hasFinished && !activeRecordRef.current && userRef && profile) {
      const today = getMoscowDateString();
      const alreadyHasActive = (profile.tournamentHistory || []).some(
        (h: any) => h.tournamentId === 'iron-globe' && h.status === 'active' && h.startDate.includes(today)
      );

      if (!alreadyHasActive) {
        activeRecordRef.current = true;
        const mskNow = getMoscowTime();
        const startTime = new Date(mskNow); startTime.setHours(21, 5, 0, 0);
        
        const activeRecord = {
          tournamentId: 'iron-globe',
          tournamentName: language === 'ru' ? "Чугунный Глобус" : "Cast Iron Globe",
          result: language === 'ru' ? "В процессе" : "In Progress",
          startDate: startTime.toISOString(),
          status: 'active'
        };

        updateDoc(userRef, {
          tournamentHistory: arrayUnion(activeRecord)
        }).catch(e => console.error("Failed to add active tour record", e));
      }
    }
  }, [isRegClosed, isJoined, hasFinished, userRef, profile, language]);

  // Finalize tournament: update active record to completed
  useEffect(() => {
    if (hasFinished && isJoined && !finalResultRef.current && userRef && profile && tournamentData) {
      finalResultRef.current = true;
      const mskNow = getMoscowTime();
      const today = getMoscowDateString();
      
      const opponent = tournamentData.myOpponent;
      const mockResult = {
        scoreA: 2, scoreB: 1,
        matchSummary: "Intense tournament battle.",
        teamStats: { teamA: { kills: 25, towersDestroyed: 11 }, teamB: { kills: 20, towersDestroyed: 8 } },
        heroPerformance: []
      };
      
      recordMatch(profile.displayName || "Manager", mockResult, 0, opponent?.name || "Tournament Rival", 'tournament', mskNow.toISOString());

      const updatedHistory = (profile.tournamentHistory || []).map((h: any) => {
        if (h.tournamentId === 'iron-globe' && h.status === 'active' && h.startDate.includes(today)) {
          return {
            ...h,
            status: 'completed',
            endDate: mskNow.toISOString(),
            result: language === 'ru' ? "Завершено" : "Completed"
          };
        }
        return h;
      });

      const updatedTours = (profile.tournaments || []).filter((t: string) => t !== 'iron-globe');

      updateDoc(userRef, {
        tournamentHistory: updatedHistory,
        tournaments: updatedTours
      });

      toast({
        title: language === 'ru' ? "Турнир окончен" : "Tournament Ended",
        description: language === 'ru' ? "Итоги сохранены в историю." : "Results saved to history.",
      });
    }
  }, [hasFinished, isJoined, userRef, profile, language, toast, recordMatch, tournamentData]);

  const handleJoin = async () => {
    if (!user || !profile || isJoining) return;
    if (isRegClosed) return;
    if (credits < TOURNAMENT_FEE) {
      toast({ title: language === 'ru' ? "Недостаточно средств" : "Insufficient credits", variant: "destructive" });
      return;
    }
    setIsJoining(true);
    try {
      await updateDoc(userRef!, {
        inGameCurrency: credits - TOURNAMENT_FEE,
        tournaments: arrayUnion('iron-globe')
      });
      addCredits(-TOURNAMENT_FEE);
      toast({ title: language === 'ru' ? "Вы зарегистрированы!" : "Successfully registered!" });
    } catch (e) {
      console.error(e);
    } finally {
      setIsJoining(false);
    }
  };

  const handleLeave = async () => {
    if (!user || !profile || !isJoined) return;
    try {
      const mskNow = getMoscowTime();
      const today = getMoscowDateString();
      
      const updatedHistory = (profile.tournamentHistory || []).map((h: any) => {
        if (h.tournamentId === 'iron-globe' && h.status === 'active' && h.startDate.includes(today)) {
          return {
            ...h,
            status: 'abandoned',
            endDate: mskNow.toISOString(),
            result: language === 'ru' ? "DQ (Дезертирство)" : "DQ (Abandoned)"
          };
        }
        return h;
      });

      const updatedTours = (profile.tournaments || []).filter((t: string) => t !== 'iron-globe');

      await updateDoc(userRef!, {
        tournamentHistory: updatedHistory,
        tournaments: updatedTours
      });

      toast({
        variant: "destructive",
        title: language === 'ru' ? "ВНИМАНИЕ: Вы покинули турнир" : "WARNING: You left the tournament",
        description: language === 'ru' ? "Команда дисквалифицирована за отход от боя." : "Team disqualified for abandoning the field.",
      });
    } catch (e) {
      console.error(e);
    }
  };

  const t = {
    title: language === 'ru' ? "ЧУГУННЫЙ ГЛОБУС" : "CHUGUNNY GLOBE",
    subtitle: language === 'ru' ? "Элитное соревнование 16-ти лучших" : "Elite 16-team competition",
    leaveBtn: language === 'ru' ? "ПОКИНУТЬ ТУРНИР" : "LEAVE TOURNAMENT",
    results: language === 'ru' ? "ИТОГИ ТУРНИРА" : "TOURNAMENT RESULTS",
    participants: language === 'ru' ? "СПИСОК УЧАСТНИКОВ" : "PARTICIPANTS LIST",
    spots: language === 'ru' ? "мест занято" : "spots filled"
  };

  if (isParticipantsLoading || isUserLoading) return <Loader2 className="w-8 h-8 animate-spin mx-auto mt-20" />;

  return (
    <div className="max-w-md mx-auto px-4 pt-8 pb-24">
      <header className="mb-6 flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/tournaments/history">
            <Button variant="ghost" size="icon" className="rounded-full"><ChevronLeft className="w-6 h-6" /></Button>
          </Link>
          <div>
            <h1 className="text-2xl font-headline font-bold uppercase tracking-tighter text-primary">{t.title}</h1>
            <p className="text-muted-foreground text-[10px] uppercase tracking-widest">{t.subtitle}</p>
          </div>
        </div>
        {isJoined && isRegClosed && !hasFinished && (
          <Button variant="outline" size="sm" className="border-red-500/20 text-red-400 text-[8px] font-black h-8 px-2" onClick={handleLeave}>
            <LogOut className="w-3 h-3 mr-1" /> {t.leaveBtn}
          </Button>
        )}
      </header>

      {hasFinished ? (
        <div className="space-y-6 animate-in zoom-in duration-500">
          <Card className="glass-card border-yellow-500/30 bg-yellow-500/5 text-center p-8">
            <Trophy className="w-16 h-16 text-yellow-500 mx-auto mb-4 animate-bounce" />
            <h2 className="text-2xl font-headline font-bold text-white uppercase">{t.results}</h2>
            <p className="text-xs text-muted-foreground mt-2 uppercase tracking-widest font-bold">Турнир успешно завершен</p>
            <div className="grid grid-cols-1 gap-2 mt-6">
              <Link href="/tournaments/history" className="block">
                <Button className="w-full hero-gradient font-bold uppercase text-[10px] flex items-center justify-center gap-2">
                  <HistoryIcon className="w-4 h-4" /> СМОТРЕТЬ ИСТОРИЮ
                </Button>
              </Link>
              <Link href="/tournaments" className="block">
                <Button variant="outline" className="w-full uppercase text-[10px] font-bold border-white/10">Вернуться в хаб</Button>
              </Link>
            </div>
          </Card>
        </div>
      ) : (
        <>
          <Card className="glass-card mb-6 border-primary/30 bg-primary/5 overflow-hidden">
            <CardContent className="p-0">
              <div className="p-6 text-center border-b border-white/5">
                <div className="w-20 h-20 rounded-full bg-secondary/50 border-2 border-primary mx-auto mb-4 flex items-center justify-center">
                  <Trophy className={cn("w-10 h-10 text-primary", isLive && "animate-pulse")} />
                </div>
                <Badge variant={isLive ? "destructive" : "outline"} className="mb-2 uppercase text-[8px] tracking-widest">
                  {isLive ? 'LIVE' : isRegClosed ? 'REG CLOSED' : 'REG OPEN'}
                </Badge>
                <p className="text-[10px] font-bold text-muted-foreground uppercase">{isLive ? 'BATTLE TIME' : 'STARTS IN'}</p>
                <p className="text-4xl font-headline font-bold text-primary">{countdown}</p>
              </div>
              
              {!isRegClosed && (
                <div className="p-4 bg-secondary/20">
                  <div className="flex justify-between text-[8px] font-bold uppercase mb-1">
                    <span>{t.participants}</span>
                    <span>{currentCount} / {MAX_PARTICIPANTS} {t.spots}</span>
                  </div>
                  <Progress value={(currentCount / MAX_PARTICIPANTS) * 100} className="h-1 mb-4" />
                  
                  {!isJoined ? (
                    <Button className="w-full h-12 hero-gradient font-bold" onClick={handleJoin} disabled={isJoining || credits < TOURNAMENT_FEE || currentCount >= MAX_PARTICIPANTS}>
                      {isJoining ? <Loader2 className="animate-spin mr-2" /> : <Swords className="w-4 h-4 mr-2" />} REGISTER ({TOURNAMENT_FEE.toLocaleString()} €)
                    </Button>
                  ) : (
                    <div className="p-3 bg-green-500/10 text-green-400 text-center text-xs font-bold uppercase tracking-widest border border-green-500/20 rounded-xl">
                      <CheckCircle2 className="w-4 h-4 inline mr-2" /> REGISTERED
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {!isRegClosed && (
            <section className="space-y-3">
              <h2 className="text-xs font-bold uppercase tracking-widest text-accent px-1">{t.participants}</h2>
              <div className="grid grid-cols-1 gap-2">
                {participants?.map((p) => (
                  <div key={p.id} className={cn("flex items-center gap-3 p-3 rounded-xl border border-white/5 bg-secondary/20", p.id === user?.uid && "border-primary/30 bg-primary/5")}>
                    <div className="w-8 h-8 rounded-full bg-background flex items-center justify-center border border-white/10">
                      <User className="w-4 h-4 text-muted-foreground" />
                    </div>
                    <span className="text-xs font-bold uppercase">{p.displayName}</span>
                    {p.id === user?.uid && <Badge className="ml-auto text-[7px] uppercase">YOU</Badge>}
                  </div>
                ))}
              </div>
            </section>
          )}

          {isRegClosed && (
            <Tabs defaultValue="groups" className="w-full">
              <TabsList className="w-full bg-secondary/50 grid grid-cols-2">
                <TabsTrigger value="groups" className="uppercase text-[10px] font-bold">Group Stage</TabsTrigger>
                <TabsTrigger value="playoffs" className="uppercase text-[10px] font-bold">Playoffs</TabsTrigger>
              </TabsList>
              <TabsContent value="groups" className="mt-4 space-y-4">
                {tournamentData?.groups.map((group, idx) => (
                  <Card key={idx} className="glass-card border-white/5">
                    <CardHeader className="py-2 px-4 bg-primary/10 border-b border-white/5 flex flex-row justify-between">
                      <CardTitle className="text-[10px] font-bold uppercase">Group {String.fromCharCode(65 + idx)}</CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                      {group.map((team, tIdx) => (
                        <div key={team.id} className={cn("flex items-center justify-between p-3 border-b border-white/5 last:border-0", team.id === user?.uid && "bg-primary/5")}>
                          <span className="text-xs font-bold uppercase">{team.name}</span>
                          <span className="text-[10px] font-mono text-accent font-bold">{team.pts} PTS</span>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                ))}
              </TabsContent>
              <TabsContent value="playoffs" className="mt-4">
                {!isLive ? (
                  <div className="py-20 text-center opacity-40 uppercase text-[10px] font-bold tracking-widest">Awaiting Battle Start</div>
                ) : (
                  <div className="space-y-4">
                    <h3 className="text-[10px] font-bold text-accent uppercase">Quarter-Finals</h3>
                    <div className="grid gap-2">
                      {[0, 1, 2, 3].map(i => (
                        <div key={i} className="bg-secondary/30 p-3 rounded-lg border border-white/5 flex justify-between text-[10px] font-bold">
                          <span>{tournamentData?.qualifiers[i*2].name}</span>
                          <span className="text-primary italic">VS</span>
                          <span>{tournamentData?.qualifiers[i*2+1].name}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          )}
        </>
      )}
    </div>
  );
}
