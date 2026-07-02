'use client';

/**
 * @fileOverview ТУРНИР "ЧУГУННЫЙ ЧАЙНИК" v2.0 (Hourly Infinite Cycle).
 * Проводится каждый час: 00-15 рег, 20-50 матчи, 50-59 итоги.
 */

import { useState, useEffect, useMemo, useRef } from 'react';
import { useGameState } from '@/app/lib/store';
import { useUser, useFirestore, useDoc, useMemoFirebase, useCollection } from '@/firebase';
import { doc, updateDoc, collection, query, where, arrayUnion, arrayRemove } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Trophy, Clock, Users, ChevronLeft, 
  Loader2, Swords, CheckCircle2, User, 
  History as HistoryIcon, Coffee, Target
} from 'lucide-react';
import Link from 'next/link';
import { getMoscowTime, getMoscowDateString } from '@/app/lib/time-utils';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { LoadingScreen } from '@/components/game/LoadingScreen';

const TOURNAMENT_FEE = 50000;
const MAX_PARTICIPANTS = 16;
const TOUR_ID = 'iron-kettle';

/**
 * Deterministic helper for Hourly Tournament
 */
function getHourlyTournamentData(
  dateStr: string, 
  hour: number,
  participants: any[], 
  userId: string, 
  mskNow: Date
) {
  const realPlayers = participants?.map(p => ({ id: p.id, name: p.displayName || "Manager", isPlayer: true })) || [];
  const botNeeded = Math.max(0, MAX_PARTICIPANTS - realPlayers.length);
  
  // Seed based on date + hour
  const seedBase = dateStr.split('-').reduce((acc, v) => acc + parseInt(v), 0) + hour;
  
  const bots = Array.from({ length: botNeeded }).map((_, i) => {
    const botIdNum = 5000 + (seedBase % 1000) + (i * 17);
    return { id: `bot${botIdNum}`, name: `bot${botIdNum}`, isPlayer: false };
  });

  const allTeams = [...realPlayers, ...bots].sort((a, b) => a.id.localeCompare(b.id));
  
  // Shuffling
  const shuffled = [...allTeams];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = (seedBase + i) % (i + 1);
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  const groups = [ 
    shuffled.slice(0, 4), 
    shuffled.slice(4, 8), 
    shuffled.slice(8, 12), 
    shuffled.slice(12, 16) 
  ];

  const mins = mskNow.getMinutes();
  const elapsedMins = Math.max(0, mins - 20);
  
  // Rounds: 0-5 (G1), 5-10 (G2), 10-15 (G3), 15-20 (Q), 20-25 (S), 25-30 (F)
  const completedGroupRounds = Math.min(3, Math.floor(elapsedMins / 5));
  const isPlayoffsVisible = elapsedMins >= 15;

  const processedGroups = groups.map((group) => {
    return group.map(t => {
      let pts = 0;
      for (let r = 1; r <= completedGroupRounds; r++) {
        const roundSeed = (t.id.split('').reduce((a, b) => a + b.charCodeAt(0), 0) + seedBase + r) % 10;
        if (roundSeed < 4) pts += 3;
        else if (roundSeed < 7) pts += 1;
      }
      return { ...t, pts };
    }).sort((a, b) => b.pts - a.pts || a.id.localeCompare(b.id));
  });

  let myOpponent = null;
  const myGroupIdx = groups.findIndex(g => g.some(t => t.id === userId));
  if (myGroupIdx !== -1) {
    const myGroup = groups[myGroupIdx];
    const myIdx = myGroup.findIndex(t => t.id === userId);
    myOpponent = myGroup[(myIdx + 1) % 4];
  }

  return { 
    groups: processedGroups, 
    qualifiers: processedGroups.flatMap(g => [g[0], g[1]]), 
    myOpponent, 
    isPlayoffsVisible 
  };
}

export default function IronKettlePage() {
  const { user, isUserLoading } = useUser();
  const db = useFirestore();
  const { credits, addCredits, language, isLoaded, recordMatch } = useGameState();
  const { toast } = useToast();
  
  const [isJoining, setIsJoining] = useState(false);
  const [countdown, setCountdown] = useState('');
  const [isLive, setIsLive] = useState(false);
  const [isRegClosed, setIsRegClosed] = useState(false);
  const [hasFinished, setHasFinished] = useState(false);
  
  const stateRef = useRef({ notified: false, activeRecord: false, finalResult: false, lastHour: -1 });

  const userRef = useMemoFirebase(() => user ? doc(db, 'players_v10', user.uid) : null, [db, user]);
  const { data: profile } = useDoc(userRef);

  const participantsQuery = useMemoFirebase(() => {
    return query(collection(db, 'players_v10'), where('tournaments', 'array-contains', TOUR_ID));
  }, [db]);

  const { data: participants, isLoading: isParticipantsLoading } = useCollection(participantsQuery);

  const isJoined = useMemo(() => profile?.tournaments?.includes(TOUR_ID), [profile]);
  const currentCount = participants?.length || 0;

  useEffect(() => {
    const updateTime = () => {
      const mskNow = getMoscowTime();
      const mins = mskNow.getMinutes();
      const currentHour = mskNow.getHours();

      // Reset state if hour changed
      if (stateRef.current.lastHour !== currentHour) {
        stateRef.current = { notified: false, activeRecord: false, finalResult: false, lastHour: currentHour };
      }

      if (mins < 15) {
        // REG OPEN
        setIsLive(false);
        setIsRegClosed(false);
        setHasFinished(false);
        const diff = (15 - mins) * 60 - mskNow.getSeconds();
        setCountdown(formatSeconds(diff));
      } else if (mins < 20) {
        // REG CLOSED / PREPARING
        setIsLive(false);
        setIsRegClosed(true);
        setHasFinished(false);
        const diff = (20 - mins) * 60 - mskNow.getSeconds();
        setCountdown(formatSeconds(diff));
      } else if (mins < 50) {
        // LIVE
        setIsLive(true);
        setIsRegClosed(true);
        setHasFinished(false);
        setCountdown('LIVE');
      } else {
        // FINISHED
        setIsLive(false);
        setIsRegClosed(true);
        setHasFinished(true);
        const diff = (60 - mins) * 60 - mskNow.getSeconds();
        setCountdown(formatSeconds(diff));
      }
    };

    const formatSeconds = (s: number) => {
      const mm = Math.floor(s / 60);
      const ss = s % 60;
      return `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
    };

    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  const tournamentData = useMemo(() => {
    if (!isRegClosed || !user) return null;
    const now = getMoscowTime();
    return getHourlyTournamentData(getMoscowDateString(), now.getHours(), participants || [], user.uid, now);
  }, [isRegClosed, participants, user]);

  // Handle Active Record
  useEffect(() => {
    if (isLive && isJoined && !stateRef.current.activeRecord && userRef && profile) {
      stateRef.current.activeRecord = true;
      const today = getMoscowDateString();
      const mskNow = getMoscowTime();
      const hour = mskNow.getHours();
      
      const activeRecord = {
        tournamentId: `${TOUR_ID}_h${hour}`,
        tournamentName: `${language === 'ru' ? "Чугунный Чайник" : "Cast Iron Kettle"} (${hour}:00)`,
        result: language === 'ru' ? "В процессе" : "In Progress",
        startDate: mskNow.toISOString(),
        status: 'active'
      };

      updateDoc(userRef, {
        tournamentHistory: arrayUnion(activeRecord)
      }).catch(e => console.error(e));
    }
  }, [isLive, isJoined, userRef, profile, language]);

  // Handle Final Result
  useEffect(() => {
    if (hasFinished && isJoined && !stateRef.current.finalResult && userRef && profile && tournamentData) {
      stateRef.current.finalResult = true;
      const mskNow = getMoscowTime();
      const today = getMoscowDateString();
      const hour = mskNow.getHours();
      
      const opponent = tournamentData.myOpponent;
      const mockResult = {
        scoreA: 1, scoreB: 0,
        matchSummary: "Intense Bo1 struggle in the hourly Kettle Arena.",
        teamStats: { teamA: { kills: 12, towersDestroyed: 4 }, teamB: { kills: 8, towersDestroyed: 2 } },
        heroPerformance: []
      };
      
      recordMatch(profile.displayName || "Manager", mockResult, 0, opponent?.name || "Tournament Rival", 'tournament', mskNow.toISOString());

      const updatedHistory = (profile.tournamentHistory || []).map((h: any) => {
        if (h.tournamentId === `${TOUR_ID}_h${hour}` && h.status === 'active') {
          return {
            ...h,
            status: 'completed',
            endDate: mskNow.toISOString(),
            result: language === 'ru' ? "Завершено" : "Completed"
          };
        }
        return h;
      });

      updateDoc(userRef, {
        tournamentHistory: updatedHistory,
        tournaments: arrayRemove(TOUR_ID)
      });

      toast({ title: language === 'ru' ? "Турнир окончен" : "Tournament Ended" });
    }
  }, [hasFinished, isJoined, userRef, profile, language, toast, recordMatch, tournamentData]);

  const handleJoin = async () => {
    if (!user || !profile || isJoining || isRegClosed || credits < TOURNAMENT_FEE) return;
    setIsJoining(true);
    try {
      await updateDoc(userRef!, {
        tournaments: arrayUnion(TOUR_ID)
      });
      addCredits(-TOURNAMENT_FEE);
      toast({ title: language === 'ru' ? "Вы зарегистрированы!" : "Successfully registered!" });
    } finally { setIsJoining(false); }
  };

  const t = {
    title: language === 'ru' ? "ЧУГУННЫЙ ЧАЙНИК" : "CAST IRON KETTLE",
    subtitle: language === 'ru' ? "Часовой цикл (Группы + Плей-офф)" : "Hourly Cycle (Groups + Playoffs)",
    results: language === 'ru' ? "ИТОГИ ТУРНИРА" : "TOURNAMENT RESULTS",
    participants: language === 'ru' ? "СПИСОК УЧАСТНИКОВ" : "PARTICIPANTS LIST",
    spots: language === 'ru' ? "мест занято" : "spots filled",
    groupStage: language === 'ru' ? "Групповой этап" : "Group Stage",
    playoffs: language === 'ru' ? "Плей-офф" : "Playoffs",
    regOpen: language === 'ru' ? "РЕГИСТРАЦИЯ ОТКРЫТА" : "REG OPEN",
    regClosed: language === 'ru' ? "РЕГИСТРАЦИЯ ЗАКРЫТА" : "REG CLOSED",
    live: language === 'ru' ? "В ЭФИРЕ" : "LIVE",
    nextCycle: language === 'ru' ? "ДО СЛЕДУЮЩЕГО ЦИКЛА" : "NEXT CYCLE IN"
  };

  if (isParticipantsLoading || isUserLoading || !isLoaded) return <LoadingScreen />;

  return (
    <div className="max-w-md mx-auto px-4 pt-8 pb-24">
      <header className="mb-6 flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/tournaments">
            <Button variant="ghost" size="icon" className="rounded-full"><ChevronLeft className="w-6 h-6" /></Button>
          </Link>
          <div>
            <h1 className="text-2xl font-headline font-bold uppercase tracking-tighter text-orange-500">{t.title}</h1>
            <p className="text-muted-foreground text-[10px] uppercase tracking-widest">{t.subtitle}</p>
          </div>
        </div>
      </header>

      <Card className={cn(
        "glass-card mb-6 border-orange-500/30 overflow-hidden",
        isLive && "bg-orange-500/5"
      )}>
        <CardContent className="p-0">
          <div className="p-6 text-center border-b border-white/5">
            <div className="w-20 h-20 rounded-full bg-secondary/50 border-2 border-orange-500 mx-auto mb-4 flex items-center justify-center">
              <Coffee className={cn("w-10 h-10 text-orange-500", isLive && "animate-pulse")} />
            </div>
            <Badge variant={isLive ? "destructive" : "outline"} className="mb-2 uppercase text-[8px] tracking-widest">
              {isLive ? t.live : isRegClosed ? (hasFinished ? t.nextCycle : t.regClosed) : t.regOpen}
            </Badge>
            <p className="text-[10px] font-bold text-muted-foreground uppercase">{isLive ? 'BATTLE TIME' : 'TIMER'}</p>
            <p className="text-4xl font-headline font-bold text-orange-500">{countdown}</p>
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

      {(isRegClosed || isLive || hasFinished) && (
        <Tabs defaultValue="groups" className="w-full">
          <TabsList className="w-full bg-secondary/50 grid grid-cols-2 h-12 p-1 rounded-xl">
            <TabsTrigger value="groups" className="uppercase text-[10px] font-black rounded-lg">{t.groupStage}</TabsTrigger>
            <TabsTrigger value="playoffs" className="uppercase text-[10px] font-black rounded-lg">{t.playoffs}</TabsTrigger>
          </TabsList>
          
          <TabsContent value="groups" className="mt-4 space-y-3">
            <div className="grid grid-cols-1 gap-3">
              {tournamentData?.groups.map((group, idx) => (
                <Card key={idx} className="glass-card border-white/5 bg-secondary/10 overflow-hidden">
                  <CardHeader className="py-2 px-4 bg-orange-500/10 border-b border-white/5">
                    <CardTitle className="text-[10px] font-black uppercase text-orange-400 tracking-widest">Group {String.fromCharCode(65 + idx)}</CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    {group.map((team, tIdx) => (
                      <div key={team.id} className={cn(
                        "flex items-center justify-between p-3 border-b border-white/5 last:border-0",
                        team.id === user?.uid && "bg-primary/10 border-l-2 border-l-primary"
                      )}>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-black text-muted-foreground w-3">{tIdx + 1}</span>
                          <span className="text-xs font-bold uppercase text-white truncate max-w-[150px]">{team.name}</span>
                        </div>
                        <span className="text-[10px] font-mono text-accent font-black">{team.pts} PTS</span>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="playoffs" className="mt-4">
            {!tournamentData?.isPlayoffsVisible ? (
              <div className="py-20 text-center opacity-40 border border-dashed border-white/10 rounded-3xl p-10">
                 <Target className="w-12 h-12 mx-auto mb-4 animate-pulse" />
                 <p className="uppercase text-[10px] font-black tracking-widest leading-relaxed">Awaiting completion of<br/>group stage engagements</p>
              </div>
            ) : (
              <div className="space-y-6">
                <section className="space-y-3">
                  <h3 className="text-[10px] font-black text-accent uppercase tracking-[0.2em] px-1">Quarter-Finals (1/4)</h3>
                  <div className="grid gap-2">
                    {[0, 1, 2, 3].map(i => (
                      <div key={i} className="bg-secondary/30 p-4 rounded-2xl border border-white/5 flex items-center justify-between shadow-inner">
                        <span className="text-[10px] font-bold text-white uppercase truncate flex-1">{tournamentData?.qualifiers[i*2].name}</span>
                        <div className="px-3 text-[10px] font-black italic text-primary">VS</div>
                        <span className="text-[10px] font-bold text-white uppercase truncate flex-1 text-right">{tournamentData?.qualifiers[i*2+1].name}</span>
                      </div>
                    ))}
                  </div>
                </section>
                
                <div className="p-4 bg-orange-500/5 rounded-2xl border border-orange-500/20 text-center">
                   <p className="text-[8px] font-black text-orange-400 uppercase tracking-widest">LIVE HOURLY ENGINE v2.0</p>
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>
      )}

      {!isRegClosed && !isLive && (
        <section className="space-y-3 mt-8">
          <h2 className="text-[10px] font-black uppercase tracking-widest text-accent px-1 flex items-center gap-2">
            <Users className="w-3.5 h-3.5" /> {t.participants}
          </h2>
          <div className="grid grid-cols-2 gap-2">
            {participants?.map((p) => (
              <div key={p.id} className={cn(
                "flex items-center gap-2 p-2 rounded-xl border border-white/5 bg-secondary/20",
                p.id === user?.uid && "border-primary/30 bg-primary/5"
              )}>
                <div className="w-6 h-6 rounded-full bg-background flex items-center justify-center border border-white/10 shrink-0">
                  <User className="w-3 h-3 text-muted-foreground" />
                </div>
                <span className="text-[10px] font-bold uppercase truncate">{p.displayName}</span>
              </div>
            ))}
            {Array.from({ length: Math.max(0, MAX_PARTICIPANTS - currentCount) }).map((_, i) => (
               <div key={i} className="flex items-center gap-2 p-2 rounded-xl border border-dashed border-white/5 opacity-30">
                  <div className="w-6 h-6 rounded-full bg-background flex items-center justify-center border border-white/10">
                    <Users className="w-3 h-3" />
                  </div>
                  <span className="text-[9px] font-black uppercase">BOT SLOT</span>
               </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
