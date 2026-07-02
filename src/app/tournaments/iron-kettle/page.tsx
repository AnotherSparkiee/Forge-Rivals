'use client';

/**
 * @fileOverview ТУРНИР "ЧУГУННЫЙ ЧАЙНИК" v1.1.
 * Исправлен импорт LoadingScreen и оптимизирована логика.
 */

import { useState, useEffect, useMemo, useRef } from 'react';
import { useGameState } from '@/app/lib/store';
import { useUser, useFirestore, useDoc, useMemoFirebase, useCollection } from '@/firebase';
import { doc, updateDoc, collection, query, where, arrayUnion } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Trophy, Clock, Users, Coins, ChevronLeft, 
  ShieldCheck, Loader2, Star, Swords, Medal,
  ArrowRight, CheckCircle2, User, History as HistoryIcon,
  Coffee, Target
} from 'lucide-react';
import Link from 'next/link';
import { getMoscowTime, getMoscowDateString } from '@/app/lib/time-utils';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { getDeterministicTournament } from '../iron-globe/page';
import { LoadingScreen } from '@/components/game/LoadingScreen';

const TOURNAMENT_FEE = 50000;
const START_TIME = "20:05";
const REG_CLOSE_TIME = "19:50"; 
const MAX_PARTICIPANTS = 16;
const TOUR_ID = 'iron-kettle';

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
  const notifiedRef = useRef(false);
  const activeRecordRef = useRef(false);
  const finalResultRef = useRef(false);

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
      const [sh, sm] = START_TIME.split(':').map(Number);
      const startTarget = new Date(mskNow);
      startTarget.setHours(sh, sm, 0, 0);

      const [ch, cm] = REG_CLOSE_TIME.split(':').map(Number);
      const closeTarget = new Date(mskNow);
      closeTarget.setHours(ch, cm, 0, 0);

      const finishTarget = new Date(startTarget);
      finishTarget.setMinutes(finishTarget.getMinutes() + 30); 

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
          toast({ title: language === 'ru' ? "Регистрация завершена" : "Registration Closed" });
          notifiedRef.current = true;
        }
        setCountdown(formatDiff(startTarget.getTime() - mskNow.getTime()));
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
    return getDeterministicTournament(getMoscowDateString(), participants || [], user.uid, getMoscowTime(), START_TIME);
  }, [isRegClosed, participants, user]);

  useEffect(() => {
    if (isRegClosed && isJoined && !hasFinished && !activeRecordRef.current && userRef && profile) {
      const today = getMoscowDateString();
      const alreadyHasActive = (profile.tournamentHistory || []).some(
        (h: any) => h.tournamentId === TOUR_ID && h.status === 'active' && h.startDate.includes(today)
      );

      if (!alreadyHasActive) {
        activeRecordRef.current = true;
        const mskNow = getMoscowTime();
        const startTime = new Date(mskNow); startTime.setHours(20, 5, 0, 0);
        
        const activeRecord = {
          tournamentId: TOUR_ID,
          tournamentName: language === 'ru' ? "Чугунный Чайник" : "Cast Iron Kettle",
          result: language === 'ru' ? "В процессе" : "In Progress",
          startDate: startTime.toISOString(),
          status: 'active'
        };

        updateDoc(userRef, { tournamentHistory: arrayUnion(activeRecord) }).catch(() => {});
      }
    }
  }, [isRegClosed, isJoined, hasFinished, userRef, profile, language]);

  useEffect(() => {
    if (hasFinished && isJoined && !finalResultRef.current && userRef && profile && tournamentData) {
      finalResultRef.current = true;
      const mskNow = getMoscowTime();
      const today = getMoscowDateString();
      
      const opponent = tournamentData.myOpponent;
      const mockResult = {
        scoreA: 1, scoreB: 0,
        matchSummary: "Intense Bo1 struggle in the Kettle Arena.",
        teamStats: { teamA: { kills: 12, towersDestroyed: 4 }, teamB: { kills: 8, towersDestroyed: 2 } },
        heroPerformance: []
      };
      
      recordMatch(profile.displayName || "Manager", mockResult, 0, opponent?.name || "Tournament Rival", 'tournament', mskNow.toISOString());

      const updatedHistory = (profile.tournamentHistory || []).map((h: any) => {
        if (h.tournamentId === TOUR_ID && h.status === 'active' && h.startDate.includes(today)) {
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
        tournaments: (profile.tournaments || []).filter((t: string) => t !== TOUR_ID)
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
    subtitle: language === 'ru' ? "Группы + Плей-офф (Bo1)" : "Groups + Playoffs (Bo1)",
    results: language === 'ru' ? "ИТОГИ ТУРНИРА" : "TOURNAMENT RESULTS",
    participants: language === 'ru' ? "СПИСОК УЧАСТНИКОВ" : "PARTICIPANTS LIST",
    spots: language === 'ru' ? "мест занято" : "spots filled",
    groupStage: language === 'ru' ? "Групповой этап" : "Group Stage",
    playoffs: language === 'ru' ? "Плей-офф" : "Playoffs"
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

      {hasFinished ? (
        <div className="space-y-6 animate-in zoom-in duration-500">
          <Card className="glass-card border-orange-500/30 bg-orange-500/5 text-center p-8">
            <Coffee className="w-16 h-16 text-orange-500 mx-auto mb-4 animate-bounce" />
            <h2 className="text-2xl font-headline font-bold text-white uppercase">{t.results}</h2>
            <div className="grid grid-cols-1 gap-2 mt-6">
              <Link href="/tournaments/history" className="block"><Button className="w-full hero-gradient font-bold uppercase text-[10px]"><HistoryIcon className="w-4 h-4 mr-2" /> ИСТОРИЯ</Button></Link>
              <Link href="/tournaments" className="block"><Button variant="outline" className="w-full uppercase text-[10px] font-bold border-white/10">ВЕРНУТЬСЯ</Button></Link>
            </div>
          </Card>
        </div>
      ) : (
        <>
          <Card className="glass-card mb-6 border-orange-500/30 bg-orange-500/5 overflow-hidden">
            <CardContent className="p-0">
              <div className="p-6 text-center border-b border-white/5">
                <div className="w-20 h-20 rounded-full bg-secondary/50 border-2 border-orange-500 mx-auto mb-4 flex items-center justify-center">
                  <Coffee className={cn("w-10 h-10 text-orange-500", isLive && "animate-pulse")} />
                </div>
                <Badge variant={isLive ? "destructive" : "outline"} className="mb-2 uppercase text-[8px] tracking-widest">
                  {isLive ? 'LIVE' : isRegClosed ? 'REG CLOSED' : 'REG OPEN'}
                </Badge>
                <p className="text-[10px] font-bold text-muted-foreground uppercase">{isLive ? 'BATTLE TIME' : 'STARTS IN'}</p>
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

          {isRegClosed && (
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
                       <p className="text-[8px] font-black text-orange-400 uppercase tracking-widest">LIVE TOURNAMENT ENGINE v1.0</p>
                    </div>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          )}

          {!isRegClosed && (
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
                      <span className="text-[9px] font-black uppercase">RESERVED</span>
                   </div>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
