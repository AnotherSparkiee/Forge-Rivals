'use client';

import { useState, useEffect, useMemo, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useUser, useFirestore, useDoc, useMemoFirebase, useCollection } from '@/firebase';
import { useGameState } from '../lib/store';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { 
  ChevronLeft, Check, Swords, Activity, Map as MapIcon, ArrowRight, TrendingUp,
  ShieldCheck, Brain, Zap, Target, FileText,
  Users, Signal, EyeOff, Calendar, MapPin, Trophy, Clock, Medal,
  ShieldAlert, RefreshCw, MousePointer2, User
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { LoadingScreen } from '@/components/game/LoadingScreen';
import { doc, collection, query, where } from 'firebase/firestore';
import { COUNTRIES } from '../lib/countries-data';

type MatchStep = 'preview' | 'live' | 'stats';

function MatchContent() {
  const { user, isUserLoading } = useUser();
  const router = useRouter();
  const searchParams = useSearchParams();
  const db = useFirestore();
  const { 
    language, isLoaded, markMatchAsSeen, markMatchIdAsSeen, lastSeenMatchDay,
    matchHistory, selectedLeagueId, leagueLevel, groupId
  } = useGameState();

  const matchIdFromUrl = searchParams.get('id');
  const [step, setStep] = useState<MatchStep>('preview');

  const userRef = useMemoFirebase(() => user ? doc(db, 'players_v10', user.uid) : null, [db, user]);
  const { data: profile } = useDoc(userRef);

  // Пытаемся найти матч в истории или напрямую в БД
  const groupMatchesQuery = useMemoFirebase(() => {
    if (!selectedLeagueId || !matchIdFromUrl) return null;
    return query(
      collection(db, 'matches_v1'),
      where('leagueId', '==', selectedLeagueId),
      where('divisionId', '==', leagueLevel),
      where('groupId', '==', groupId)
    );
  }, [db, selectedLeagueId, leagueLevel, groupId, matchIdFromUrl]);

  const { data: dbMatches } = useCollection(groupMatchesQuery);

  const currentResult = useMemo(() => {
    if (!profile) return null;
    
    // 1. Если есть ID в URL, ищем в БД или истории
    if (matchIdFromUrl) {
      const fromDb = dbMatches?.find(m => m.id === matchIdFromUrl);
      if (fromDb && fromDb.status === 'finished') {
        const isHome = fromDb.homeId === user?.uid;
        return {
          id: fromDb.id,
          opponentName: isHome ? fromDb.awayName : fromDb.homeName,
          scoreA: isHome ? fromDb.scoreA : fromDb.scoreB,
          scoreB: isHome ? fromDb.scoreB : fromDb.scoreA,
          type: fromDb.type,
          playedAt: fromDb.finishedAt || fromDb.startTime,
          timeline: fromDb.simulation?.timeline || [],
          matchSummary: fromDb.simulation?.matchSummary || "Match finalized.",
          scoreboard: fromDb.simulation?.scoreboard || [],
          mvp: fromDb.simulation?.mvp,
          duration: fromDb.simulation?.duration
        };
      }
      const fromHistory = matchHistory.find(m => m.id === matchIdFromUrl);
      if (fromHistory) return fromHistory;
    }
    
    // 2. Иначе берем последний несмотренный из истории
    const unseenMatch = matchHistory.find(m => m.seen === false);
    if (unseenMatch) return unseenMatch;

    return matchHistory[matchHistory.length - 1] || null;
  }, [matchHistory, dbMatches, matchIdFromUrl, user?.uid, profile]);

  useEffect(() => {
    if (!isUserLoading && !user) {
      router.push('/auth/login');
    }
  }, [user, isUserLoading, router]);

  if (isUserLoading || !isLoaded || !user) return <LoadingScreen />;

  const handleAcknowledgeMatch = () => {
    if (currentResult) {
      markMatchIdAsSeen(currentResult.id);
      router.push('/');
    } else {
      router.push('/');
    }
  };

  const handleNext = () => {
    if (!currentResult) return;
    if (step === 'preview') setStep('live');
    else if (step === 'live') setStep('stats');
    else handleAcknowledgeMatch();
  };

  const userCountry = COUNTRIES.find(c => c.name === profile?.country);
  const myFlag = userCountry?.flag || '🏳️';

  const labels = {
    en: {
      reportTitle: "TACTICAL AFTER-ACTION REPORT",
      next: "NEXT", accept: "CONFIRM", exit: "EXIT",
      preview: "Match Preview", live: "2D Field Review", stats: "Post-Match Dossier",
      vs: "VS", winProb: "Win Probability", keyMatchup: "Key Tactical Matchup",
      timeline: "Tactical Timeline", analysis: "Architectural Analysis", scoreboard: "Scoreboard",
      duration: "Duration", mvp: "Unit MVP", orv: "AVG OVR",
      home: "HOME", away: "AWAY", arena: "ARENA", spectators: "SPECTATORS",
      technicalWin: "TECHNICAL PROGRESSION", clickToContinue: "TAP ANYWHERE TO CONTINUE",
      tournamentTypes: { 
        league: "PRO LEAGUE", 
        cup: "PYRAMID CUP", 
        friendly: "FRIENDLY MATCH", 
        basket: "CW BASKET"
      }
    },
    ru: {
      reportTitle: "ТАКТИЧЕСКИЙ ОТЧЕТ ПОСЛЕ БОЯ",
      next: "ДАЛЕЕ", accept: "ПОДТВЕРДИТЬ", exit: "ВЫЙТИ",
      preview: "Превью матча", live: "2D Обзор игры", stats: "Итоговая статистика",
      vs: "ПРОТИВ", winProb: "Вероятность победы", keyMatchup: "Ключевое противостояние",
      timeline: "Хронология боя", analysis: "Архитектурный анализ", scoreboard: "Таблица игроков",
      duration: "Длительность", mvp: "MVP отряда", orv: "Средний OVR",
      home: "ДОМА", away: "В ГОСТЯХ", arena: "АРЕНА", spectators: "ЗРИТЕЛИ",
      technicalWin: "ТЕХНИЧЕСКАЯ ПРОГРЕССИЯ", clickToContinue: "НАЖМИТЕ В ЛЮБОМ МЕСТЕ ДЛЯ ПРОДОЛЖЕНИЯ",
      tournamentTypes: { 
        league: "ПРОФ. ЛИГА", 
        cup: "КУБОК ПИРАМИДЫ", 
        friendly: "ТОВ. МАТЧ", 
        basket: "КВ КОРЗИНА"
      }
    }
  };

  const t = labels[language as keyof typeof labels] || labels.ru;

  if (!currentResult) return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center space-y-4">
      <ShieldAlert className="w-16 h-16 text-muted-foreground opacity-20" />
      <p className="text-xs uppercase font-black text-muted-foreground tracking-widest">No combat data available</p>
      <Button variant="outline" size="sm" onClick={() => router.push('/')} className="h-10 border-white/10 uppercase text-[9px] font-bold">Return to Hub</Button>
    </div>
  );

  return (
    <div className="min-h-screen bg-background text-foreground pb-32 cursor-pointer select-none" onClick={handleNext}>
      <div className="fixed inset-0 pointer-events-none opacity-5 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:30px_30px]"></div>

      <div className="max-w-md mx-auto relative z-10 px-4 pt-6">
        <header className="text-center space-y-4 mb-8">
          <Badge variant="outline" className="bg-primary/5 border-primary/20 text-primary text-[8px] font-black uppercase tracking-[0.2em] px-3">
            {t.tournamentTypes[currentResult.type as keyof typeof t.tournamentTypes] || "ENGAGEMENT"}
          </Badge>
          <h1 className="text-sm font-headline font-bold text-white uppercase tracking-tighter">{t.reportTitle}</h1>
          <div className="flex items-center justify-center gap-2 max-w-[240px] mx-auto">
            <div className={cn("h-1 flex-1 rounded-full", step === 'preview' ? "bg-primary" : "bg-primary/20")} />
            <div className={cn("h-1 flex-1 rounded-full", step === 'live' ? "bg-primary" : "bg-primary/20")} />
            <div className={cn("h-1 flex-1 rounded-full", step === 'stats' ? "bg-primary" : "bg-primary/20")} />
          </div>
          <p className="text-[10px] font-black text-accent uppercase tracking-widest">{step === 'preview' ? t.preview : step === 'live' ? t.live : t.stats}</p>
        </header>

        {step === 'preview' && (
          <div className="space-y-6 animate-in fade-in duration-500">
            <Card className="glass-card border-white/10 bg-gradient-to-br from-primary/10 to-transparent overflow-hidden">
              <div className="grid grid-cols-2 divide-x divide-white/5">
                <div className="p-6 flex flex-col items-center gap-3 text-center">
                  <div className="relative">
                    <div className="w-16 h-16 rounded-2xl bg-secondary/50 border border-primary/30 flex items-center justify-center shadow-xl"><span className="text-3xl">{myFlag}</span></div>
                    <Badge className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-[7px] font-black uppercase px-2 h-4 border-none">{t.home}</Badge>
                  </div>
                  <h3 className="text-xs font-headline font-bold uppercase tracking-tight text-white mt-1">{profile?.displayName || "MY TEAM"}</h3>
                </div>
                <div className="p-6 flex flex-col items-center gap-3 text-center">
                  <div className="relative">
                    <div className="w-16 h-16 rounded-2xl bg-secondary/50 border-white/10 flex items-center justify-center shadow-xl"><span className="text-3xl">🏳️</span></div>
                    <Badge variant="outline" className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-background border-white/20 text-muted-foreground text-[7px] font-black uppercase px-2 h-4">{t.away}</Badge>
                  </div>
                  <h3 className="text-xs font-headline font-bold uppercase tracking-tight text-white mt-1">{currentResult.opponentName}</h3>
                </div>
              </div>
            </Card>
          </div>
        )}

        {step === 'live' && (
          <div className="space-y-4 animate-in slide-in-from-right-4 duration-500">
            {(currentResult.timeline || []).map((event: any, i: number) => (
              <Card key={i} className="glass-card border-white/5 bg-secondary/20">
                <CardContent className="p-4 flex gap-4">
                  <div className="w-12 border-r border-white/5 pr-2">
                    <span className="text-[10px] font-mono font-bold text-accent">{event.time}</span>
                  </div>
                  <div className="flex-1 space-y-2">
                    <p className="text-sm leading-relaxed text-muted-foreground">{event.event}</p>
                    <Badge className="bg-black/40 text-[9px] font-mono font-bold text-white ml-auto block w-fit">{event.score}</Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {step === 'stats' && (
          <div className="space-y-6 animate-in slide-in-from-right-4 duration-500 pb-10">
            <div className="text-center py-6">
              <div className="text-3xl font-headline font-black italic tracking-tighter flex items-center justify-center gap-3">
                <span className={cn(currentResult.scoreA > currentResult.scoreB && "text-primary")}>{currentResult.scoreA}</span>
                <span className="opacity-20">:</span>
                <span className={cn(currentResult.scoreB > currentResult.scoreA && "text-primary")}>{currentResult.scoreB}</span>
              </div>
              <Badge className={cn("mt-4 text-[10px] font-black px-6", currentResult.scoreA > currentResult.scoreB ? "bg-green-500/20 text-green-400" : (currentResult.scoreA === currentResult.scoreB ? "bg-accent/20 text-accent" : "bg-red-500/20 text-red-400"))}>
                {currentResult.scoreA > currentResult.scoreB ? "VICTORY" : (currentResult.scoreA === currentResult.scoreB ? "DRAW" : "DEFEAT")}
              </Badge>
            </div>
            
            <Card className="glass-card p-6 bg-primary/5 border-primary/20">
              <p className="text-xs leading-relaxed italic text-center text-primary-foreground/80">
                "{currentResult.matchSummary}"
              </p>
            </Card>

            <div className="space-y-3">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-1">{t.scoreboard}</h3>
              <div className="grid gap-2">
                {(currentResult.scoreboard || []).map((p: any, i: number) => (
                  <div key={i} className="bg-secondary/20 p-3 rounded-xl border border-white/5 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-background flex items-center justify-center border border-white/10">
                        {p.name === currentResult.mvp ? <Trophy className="w-4 h-4 text-yellow-500" /> : <User className="w-4 h-4 text-muted-foreground" />}
                      </div>
                      <span className="text-[11px] font-bold uppercase">{p.name}</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-[10px] font-mono font-bold text-primary">{p.kills}/{p.deaths}/{p.assists}</span>
                      <Badge variant="outline" className="text-[8px] font-mono border-white/10">{p.cs} CS</Badge>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {step !== 'stats' && (
          <div className="mt-12 flex flex-col items-center gap-2 animate-bounce opacity-40">
            <MousePointer2 className="w-4 h-4 text-muted-foreground" />
            <p className="text-[8px] font-black uppercase tracking-widest">{t.clickToContinue}</p>
          </div>
        )}
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-50 bg-background/90 backdrop-blur-xl border-t border-white/10 h-24 flex items-center px-6">
        <div className="w-full max-md mx-auto flex gap-3">
          <Button variant="outline" className="flex-1 h-12 uppercase font-black text-[10px]" onClick={(e) => { e.stopPropagation(); router.back(); }}>{t.exit}</Button>
          <Button className="flex-[2] h-12 hero-gradient border-none font-black text-[10px] uppercase shadow-lg shadow-primary/20" onClick={(e) => { e.stopPropagation(); handleNext(); }}>
            {step === 'stats' ? <Check className="w-4 h-4 mr-2" /> : <ArrowRight className="w-4 h-4 mr-2" />}
            {step === 'stats' ? t.accept : t.next}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function MatchPage() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <MatchContent />
    </Suspense>
  );
}
