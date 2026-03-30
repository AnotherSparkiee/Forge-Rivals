
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
  LogOut
} from 'lucide-react';
import Link from 'next/link';
import { getMoscowTime } from '@/app/lib/time-utils';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';

const TOURNAMENT_FEE = 90000;
const START_TIME = "21:05";
const REG_CLOSE_TIME = "20:50"; 
const MAX_PARTICIPANTS = 16;

export default function IronGlobePage() {
  const { user, isUserLoading } = useUser();
  const db = useFirestore();
  const { credits, addCredits, language, isLoaded } = useGameState();
  const { toast } = useToast();
  
  const [isJoining, setIsJoining] = useState(false);
  const [countdown, setCountdown] = useState('');
  const [isLive, setIsLive] = useState(false);
  const [isRegClosed, setIsRegClosed] = useState(false);
  const [hasFinished, setHasFinished] = useState(false);
  const notifiedRef = useRef(false);
  const finalResultRef = useRef(false);

  const userRef = useMemoFirebase(() => user ? doc(db, 'players_v5', user.uid) : null, [db, user]);
  const { data: profile } = useDoc(userRef);

  const participantsQuery = useMemoFirebase(() => {
    return query(collection(db, 'players_v5'), where('tournaments', 'array-contains', 'iron-globe'));
  }, [db]);

  const { data: participants, isLoading: isParticipantsLoading } = useCollection(participantsQuery);

  const isJoined = profile?.tournaments?.includes('iron-globe') || false;
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
      finishTarget.setMinutes(finishTarget.getMinutes() + 30); // Assume tournament lasts 30 mins

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

  // Record history when tournament finishes
  useEffect(() => {
    if (hasFinished && isJoined && !finalResultRef.current && userRef) {
      finalResultRef.current = true;
      const mskNow = getMoscowTime();
      const startTime = new Date(mskNow); startTime.setHours(21, 5, 0);
      
      const record = {
        tournamentId: 'iron-globe',
        tournamentName: language === 'ru' ? "Чугунный Глобус" : "Cast Iron Globe",
        result: language === 'ru' ? "Завершено" : "Completed",
        startDate: startTime.toISOString(),
        endDate: mskNow.toISOString(),
        status: 'completed'
      };

      updateDoc(userRef, {
        tournamentHistory: arrayUnion(record),
        tournaments: profile.tournaments.filter((t: string) => t !== 'iron-globe')
      });

      toast({
        title: language === 'ru' ? "Турнир окончен" : "Tournament Ended",
        description: language === 'ru' ? "Итоги сохранены в историю." : "Results saved to history.",
      });
    }
  }, [hasFinished, isJoined, userRef, profile, language, toast]);

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
      const startTime = new Date(mskNow); startTime.setHours(21, 5, 0);
      
      const record = {
        tournamentId: 'iron-globe',
        tournamentName: language === 'ru' ? "Чугунный Глобус" : "Cast Iron Globe",
        result: language === 'ru' ? "DQ (Дезертирство)" : "DQ (Abandoned)",
        startDate: startTime.toISOString(),
        endDate: mskNow.toISOString(),
        status: 'abandoned'
      };

      await updateDoc(userRef!, {
        tournamentHistory: arrayUnion(record),
        tournaments: profile.tournaments.filter((t: string) => t !== 'iron-globe')
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

  const tournamentData = useMemo(() => {
    if (!isRegClosed) return null;
    const realPlayers = participants?.map(p => ({ id: p.id, name: p.displayName || "Manager", isPlayer: true })) || [];
    const botNeeded = Math.max(0, MAX_PARTICIPANTS - realPlayers.length);
    const botNames = ["AlphaBot", "ZetaUnit", "CyberLink", "VoidRunner", "SteelGear", "NexusPrime", "EchoTeam", "Quantum", "ShadowOps", "Blitz", "Titan", "Vanguard", "Rogue", "Omega", "Spectre", "Ghost"];
    const bots = botNames.slice(0, botNeeded).map((n, i) => ({ id: `bot-${i}`, name: n, isPlayer: false }));
    const teams = [...realPlayers, ...bots].sort((a, b) => a.id.localeCompare(b.id));
    const groups = [ teams.slice(0, 4), teams.slice(4, 8), teams.slice(8, 12), teams.slice(12, 16) ];
    const groupResults = groups.map(group => group.map(t => {
      const pts = (isLive || hasFinished) ? Math.floor(Math.random() * 10) : 0;
      return { ...t, pts, w: Math.floor(pts/3), d: pts % 3, l: Math.max(0, 3 - Math.floor(pts/3)) };
    }).sort((a, b) => b.pts - a.pts));
    return { groups: groupResults, qualifiers: groupResults.flatMap(g => [g[0], g[1]]) };
  }, [isRegClosed, isLive, hasFinished, participants]);

  const t = {
    title: language === 'ru' ? "ЧУГУННЫЙ ГЛОБУС" : "CAST IRON GLOBE",
    subtitle: language === 'ru' ? "Элитное соревнование 16-ти лучших" : "Elite 16-team competition",
    leaveBtn: language === 'ru' ? "ПОКИНУТЬ ТУРНИР" : "LEAVE TOURNAMENT",
    results: language === 'ru' ? "ИТОГИ ТУРНИРА" : "TOURNAMENT RESULTS"
  };

  return (
    <div className="max-w-md mx-auto px-4 pt-8 pb-24">
      <header className="mb-6 flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/tournaments/open">
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
            <Link href="/tournaments/history" className="block mt-6">
              <Button className="w-full hero-gradient font-bold uppercase text-[10px]">Смотреть историю</Button>
            </Link>
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
              {!isRegClosed && !isJoined && (
                <div className="p-4">
                  <Button className="w-full h-12 hero-gradient font-bold" onClick={handleJoin} disabled={isJoining || credits < TOURNAMENT_FEE}>
                    {isJoining ? <Loader2 className="animate-spin mr-2" /> : <Swords className="w-4 h-4 mr-2" />} REGISTER
                  </Button>
                </div>
              )}
              {isJoined && !isRegClosed && (
                <div className="p-4 bg-green-500/10 text-green-400 text-center text-xs font-bold uppercase tracking-widest border-t border-green-500/20">
                  <CheckCircle2 className="w-4 h-4 inline mr-2" /> REGISTERED
                </div>
              )}
            </CardContent>
          </Card>

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
