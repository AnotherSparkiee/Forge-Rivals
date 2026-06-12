
'use client';

import { useState, useEffect, useMemo, Suspense, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useUser, useFirestore, useDoc, useMemoFirebase, useCollection } from '@/firebase';
import { useGameState } from '../lib/store';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { 
  ChevronLeft, Check, Swords, Activity, ArrowRight, 
  ShieldCheck, Zap, Target, FileText,
  Users, Trophy, Clock, Medal,
  ShieldAlert, User, MapPin, Info,
  TrendingUp, Timer, ChevronRight
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
    language, isLoaded, markMatchIdAsSeen,
    matchHistory, selectedLeagueId, leagueLevel, groupId,
    arena, id: myId
  } = useGameState();

  const matchIdFromUrl = searchParams.get('id');
  const [step, setStep] = useState<MatchStep>('preview');
  
  // Live Simulation State
  const [activeGameIdx, setActiveGameIdx] = useState(0);
  const [visibleEvents, setVisibleEvents] = useState<any[]>([]);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [gameTime, setGameTime] = useState(0); // 0 to 120 seconds
  const scrollRef = useRef<HTMLDivElement>(null);

  const userRef = useMemoFirebase(() => user ? doc(db, 'players_v10', user.uid) : null, [db, user]);
  const { data: profile } = useDoc(userRef);

  const fanclubRef = useMemoFirebase(() => {
    if (!user || !selectedLeagueId) return null;
    return doc(db, 'leagues_v2', selectedLeagueId, 'divisions', leagueLevel.toString(), 'groups', groupId.toString(), 'teams', user.uid, 'fanclub', 'stats');
  }, [db, user, selectedLeagueId, leagueLevel, groupId]);
  const { data: fanData } = useDoc(fanclubRef);

  const groupMatchesQuery = useMemoFirebase(() => {
    if (!selectedLeagueId || !matchIdFromUrl) return null;
    return query(
      collection(db, 'matches_v1'),
      where('id', '==', matchIdFromUrl)
    );
  }, [db, selectedLeagueId, matchIdFromUrl]);

  const { data: dbMatches } = useCollection(groupMatchesQuery);

  const currentResult = useMemo(() => {
    if (!profile) return null;
    
    // Check DB first for rich data
    const fromDb = dbMatches?.[0];
    if (fromDb && fromDb.status === 'finished') {
      const isHome = fromDb.homeId === user?.uid;
      return {
        id: fromDb.id,
        isHome,
        homeName: fromDb.homeName,
        awayName: fromDb.awayName,
        opponentName: isHome ? fromDb.awayName : fromDb.homeName,
        scoreA: isHome ? fromDb.scoreA : fromDb.scoreB,
        scoreB: isHome ? fromDb.scoreB : fromDb.scoreA,
        type: fromDb.type,
        day: fromDb.day,
        playedAt: fromDb.finishedAt || fromDb.startTime,
        games: fromDb.simulation?.games || [fromDb.simulation], // Support multi-game Bo2
        seriesScore: fromDb.simulation?.seriesScore || `${fromDb.scoreA}-${fromDb.scoreB}`,
        winner: fromDb.simulation?.winner
      };
    }

    const fromHistory = matchHistory.find(m => m.id === matchIdFromUrl);
    if (fromHistory) return { ...fromHistory, isHome: fromHistory.opponentName !== fromHistory.homeName };

    return null;
  }, [matchHistory, dbMatches, matchIdFromUrl, user?.uid, profile]);

  // Attendance Logic
  const attendance = useMemo(() => {
    if (!arena || !currentResult) return 0;
    if (!currentResult.isHome) return Math.floor((arena.capacity || 5000) * 0.85); // Estimated away stadium
    const fanCount = fanData?.fanCount || 5000;
    const baseCap = arena.capacity || 5000;
    const fillingFactor = 0.7 + (Math.random() * 0.3);
    return Math.min(baseCap, Math.floor(fanCount * fillingFactor));
  }, [arena, fanData, currentResult]);

  // LIVE SIMULATION EFFECT
  useEffect(() => {
    if (step !== 'live' || !currentResult || !currentResult.games) return;

    const game = currentResult.games[activeGameIdx];
    if (!game) return;

    const events = game.timeline || [];
    const totalRealTime = 120; // 2 minutes per game
    const intervalMs = (totalRealTime * 1000) / Math.max(1, events.length);

    let currentEvt = 0;
    const timer = setInterval(() => {
      if (currentEvt < events.length) {
        setVisibleEvents(prev => [...prev, events[currentEvt]]);
        currentEvt++;
        if (scrollRef.current) {
          scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
      } else {
        clearInterval(timer);
        // Map Finished
        if (activeGameIdx < currentResult.games.length - 1) {
          setTimeout(() => {
            setIsTransitioning(true);
            setTimeout(() => {
              setActiveGameIdx(prev => prev + 1);
              setVisibleEvents([]);
              setIsTransitioning(false);
            }, 10000); // 10s pause between maps
          }, 3000);
        } else {
          // All games finished
          setTimeout(() => setStep('stats'), 5000);
        }
      }
    }, intervalMs);

    return () => clearInterval(timer);
  }, [step, activeGameIdx, currentResult]);

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
    else if (step === 'live') { /* Live proceeds automatically or via skipping? Let's allow skip to stats */ setStep('stats'); }
    else handleAcknowledgeMatch();
  };

  const userCountry = COUNTRIES.find(c => c.name === profile?.country);
  const myFlag = userCountry?.flag || '🏳️';

  const labels = {
    en: {
      reportTitle: "OFFICIAL MATCH DEBRIEF",
      next: "INITIATE LIVE", accept: "FINALIZE", exit: "EXIT",
      preview: "Strategic Preview", live: "Operational Feed", stats: "Final Dossier",
      vs: "VS", winProb: "Win Probability", attendance: "Spectators",
      timeline: "Tactical Log", scoreboard: "Unit Performance",
      duration: "Duration", mvp: "Combat MVP", home: "HOME", away: "AWAY",
      mapTransition: "Switching to next tactical map...",
      mapScore: "Series Standings",
      round: "Round", stage: "Stage", tournament: "Tournament",
      tournamentTypes: { league: "PRO LEAGUE", cup: "PYRAMID CUP", friendly: "FRIENDLY", basket: "CW BASKET" }
    },
    ru: {
      reportTitle: "ОФИЦИАЛЬНЫЙ ОТЧЕТ",
      next: "В ЭФИР", accept: "ЗАВЕРШИТЬ", exit: "ВЫЙТИ",
      preview: "Стратегический обзор", live: "Оперативная лента", stats: "Итоговое досье",
      vs: "ПРОТИВ", winProb: "Вероятность победы", attendance: "Зрители",
      timeline: "Лог операций", scoreboard: "Эффективность отряда",
      duration: "Длительность", mvp: "MVP матча", home: "ДОМА", away: "В ГОСТЯХ",
      mapTransition: "Подготовка к следующей карте...",
      mapScore: "Счет в серии",
      round: "Тур", stage: "Стадия", tournament: "Турнир",
      tournamentTypes: { league: "ПРОФ. ЛИГА", cup: "КУБОК ПИРАМИДЫ", friendly: "ТОВ. МАТЧ", basket: "КВ КОРЗИНА" }
    }
  };

  const t = labels[language as keyof typeof labels] || labels.ru;

  const renderStatsTable = (game: any) => {
    const scoreboard = game.scoreboard || [];
    const isHome = currentResult?.isHome;
    
    // Separate teams
    const homeHeroes = scoreboard.filter((p: any) => p.team === currentResult?.homeName);
    const awayHeroes = scoreboard.filter((p: any) => p.team === currentResult?.awayName);

    const renderHeroRow = (p: any, side: 'left' | 'right') => (
      <div key={p.name} className={cn(
        "flex items-center gap-3 p-2.5 rounded-lg border border-white/5 bg-secondary/10",
        side === 'right' ? "flex-row-reverse text-right" : "text-left"
      )}>
        <div className="relative shrink-0">
          <div className="w-10 h-10 rounded-lg overflow-hidden border border-white/10 bg-background flex items-center justify-center">
            {p.name === game.mvp ? <Trophy className="w-5 h-5 text-yellow-500" /> : <User className="w-5 h-5 text-muted-foreground" />}
          </div>
          <Badge className="absolute -bottom-1 -right-1 bg-black/80 text-[6px] px-1 h-3 border-white/20">{p.role || 'PRO'}</Badge>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-black uppercase truncate text-white">{p.name}</p>
          <div className={cn("flex items-center gap-2 mt-0.5", side === 'right' && "justify-end")}>
            <span className="text-[9px] font-mono font-bold text-primary">{p.kills}/{p.deaths}/{p.assists}</span>
            <span className="text-[8px] text-muted-foreground uppercase font-black">{p.cs} CS</span>
          </div>
        </div>
        <div className="hidden sm:block text-right">
          <p className="text-[7px] text-muted-foreground uppercase font-black">GPM</p>
          <p className="text-[10px] font-mono font-bold text-accent">{Math.floor(p.cs * 15 + p.kills * 150) / 40}</p>
        </div>
      </div>
    );

    return (
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <p className="text-[8px] font-black uppercase tracking-widest text-primary mb-2 flex items-center gap-2">
             <ShieldCheck className="w-3 h-3" /> {isHome ? t.home : t.away}
          </p>
          {homeHeroes.map(p => renderHeroRow(p, 'left'))}
        </div>
        <div className="space-y-2">
          <p className="text-[8px] font-black uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-2 justify-end">
             {isHome ? t.away : t.home} <Swords className="w-3 h-3" />
          </p>
          {awayHeroes.map(p => renderHeroRow(p, 'right'))}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background text-foreground pb-32 select-none relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none opacity-5 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:30px_30px]" />

      <div className="max-w-md mx-auto relative z-10 px-4 pt-6">
        <header className="text-center space-y-4 mb-8">
          <div className="flex flex-col items-center gap-2">
            <Badge variant="outline" className="bg-primary/5 border-primary/20 text-primary text-[8px] font-black uppercase tracking-[0.2em] px-3">
              {t.tournamentTypes[currentResult.type as keyof typeof t.tournamentTypes] || "ENGAGEMENT"}
            </Badge>
            <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">
              {currentResult.type === 'league' ? `${t.round} ${currentResult.day}` : 
               currentResult.type === 'cup' ? `${t.stage} 1/${Math.pow(2, 9 - leagueLevel)}` : t.tournament}
            </p>
          </div>
          <h1 className="text-sm font-headline font-bold text-white uppercase tracking-tighter">{t.reportTitle}</h1>
          <div className="flex items-center justify-center gap-2 max-w-[240px] mx-auto">
            <div className={cn("h-1 flex-1 rounded-full transition-all", step === 'preview' ? "bg-primary shadow-[0_0_10px_rgba(var(--primary),0.5)]" : "bg-primary/20")} />
            <div className={cn("h-1 flex-1 rounded-full transition-all", step === 'live' ? "bg-primary shadow-[0_0_10px_rgba(var(--primary),0.5)]" : "bg-primary/20")} />
            <div className={cn("h-1 flex-1 rounded-full transition-all", step === 'stats' ? "bg-primary shadow-[0_0_10px_rgba(var(--primary),0.5)]" : "bg-primary/20")} />
          </div>
        </header>

        {step === 'preview' && (
          <div className="space-y-6 animate-in fade-in zoom-in-95 duration-500">
            <Card className="glass-card border-white/10 bg-gradient-to-br from-primary/10 to-transparent overflow-hidden">
              <div className="grid grid-cols-2 divide-x divide-white/5">
                <div className="p-6 flex flex-col items-center gap-3 text-center">
                  <div className="relative">
                    <div className="w-20 h-20 rounded-2xl bg-secondary/50 border border-primary/30 flex items-center justify-center shadow-xl">
                      <span className="text-4xl">{myFlag}</span>
                    </div>
                    <Badge className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-[7px] font-black uppercase px-2 h-4 border-none">{t.home}</Badge>
                  </div>
                  <h3 className="text-xs font-headline font-bold uppercase tracking-tight text-white mt-2 italic">{currentResult.homeName}</h3>
                </div>
                <div className="p-6 flex flex-col items-center gap-3 text-center">
                  <div className="relative">
                    <div className="w-20 h-20 rounded-2xl bg-secondary/50 border-white/10 flex items-center justify-center shadow-xl">
                      <span className="text-4xl">🏳️</span>
                    </div>
                    <Badge variant="outline" className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-background border-white/20 text-muted-foreground text-[7px] font-black uppercase px-2 h-4">{t.away}</Badge>
                  </div>
                  <h3 className="text-xs font-headline font-bold uppercase tracking-tight text-white mt-2 italic">{currentResult.awayName}</h3>
                </div>
              </div>
            </Card>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-secondary/20 p-4 rounded-xl border border-white/5 flex flex-col items-center text-center">
                <Users className="w-5 h-5 text-accent mb-2" />
                <p className="text-[8px] font-black text-muted-foreground uppercase">{t.attendance}</p>
                <p className="text-lg font-headline font-bold text-white">{attendance.toLocaleString()}</p>
              </div>
              <div className="bg-secondary/20 p-4 rounded-xl border border-white/5 flex flex-col items-center text-center">
                <Clock className="w-5 h-5 text-primary mb-2" />
                <p className="text-[8px] font-black text-muted-foreground uppercase">{language === 'ru' ? 'ВРЕМЯ МАТЧА' : 'MATCH TIME'}</p>
                <p className="text-lg font-headline font-bold text-white">{new Date(currentResult.playedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
              </div>
            </div>
          </div>
        )}

        {step === 'live' && (
          <div className="space-y-4 animate-in slide-in-from-right-4 duration-500 h-[60vh] flex flex-col">
            <div className="flex justify-between items-center px-1 mb-2">
               <Badge className="bg-red-600 text-white animate-pulse text-[8px] font-black uppercase">LIVE: MAP {activeGameIdx + 1}</Badge>
               <span className="text-[10px] font-mono font-bold text-primary">{currentResult.seriesScore}</span>
            </div>

            {isTransitioning ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-8 space-y-4 bg-primary/5 rounded-2xl border border-dashed border-primary/20">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                <div className="space-y-1">
                  <h3 className="text-sm font-black uppercase text-white">{t.mapTransition}</h3>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-widest">{t.mapScore}: {currentResult.seriesScore}</p>
                </div>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto space-y-3 pr-2 scrollbar-hide" ref={scrollRef}>
                {visibleEvents.map((event, i) => (
                  <Card key={i} className="glass-card border-white/5 bg-secondary/10 animate-in slide-in-from-bottom-2">
                    <CardContent className="p-3 flex gap-4">
                      <div className="w-12 shrink-0 flex flex-col items-center justify-center border-r border-white/5 pr-2">
                        <span className="text-[9px] font-mono font-bold text-accent">{event.time}</span>
                      </div>
                      <div className="flex-1 space-y-2">
                        <p className="text-xs leading-relaxed text-muted-foreground">{event.event}</p>
                        {event.score && (
                          <div className="flex justify-end">
                             <Badge className="bg-black/40 text-[8px] font-mono font-bold text-white border-white/10">{event.score}</Badge>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {step === 'stats' && (
          <div className="space-y-6 animate-in slide-in-from-right-4 duration-500 pb-10">
            <div className="text-center py-4">
              <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-2">Final Series Outcome</p>
              <div className="text-5xl font-headline font-black italic tracking-tighter flex items-center justify-center gap-4 text-white">
                <span className={cn(currentResult.scoreA > currentResult.scoreB && "text-primary")}>{currentResult.scoreA}</span>
                <span className="opacity-20 text-3xl">:</span>
                <span className={cn(currentResult.scoreB > currentResult.scoreA && "text-primary")}>{currentResult.scoreB}</span>
              </div>
              <Badge className={cn(
                "mt-4 text-[10px] font-black px-8 py-1 uppercase tracking-widest", 
                currentResult.scoreA > currentResult.scoreB ? "bg-green-500/20 text-green-400" : (currentResult.scoreA === currentResult.scoreB ? "bg-accent/20 text-accent" : "bg-red-500/20 text-red-400")
              )}>
                {currentResult.scoreA > currentResult.scoreB ? "VICTORY" : (currentResult.scoreA === currentResult.scoreB ? "DRAW" : "DEFEAT")}
              </Badge>
            </div>
            
            <Tabs defaultValue="map1" className="w-full">
              <TabsList className="bg-secondary/30 w-full grid grid-cols-2 h-12 p-1.5 rounded-2xl mb-6">
                <TabsTrigger value="map1" className="text-[10px] font-black uppercase rounded-xl">MAP 1</TabsTrigger>
                <TabsTrigger value="map2" disabled={currentResult.games.length < 2} className="text-[10px] font-black uppercase rounded-xl">MAP 2</TabsTrigger>
              </TabsList>
              
              {currentResult.games.map((game: any, idx: number) => (
                <TabsContent key={idx} value={`map${idx+1}`} className="space-y-6">
                  <div className="p-4 bg-primary/5 border border-primary/20 rounded-2xl text-center">
                    <p className="text-[9px] text-primary/60 italic leading-relaxed">
                      "{game.matchSummary}"
                    </p>
                  </div>
                  
                  <div className="space-y-4">
                    <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-1 flex items-center gap-2">
                       <FileText className="w-3.5 h-3.5" /> {t.scoreboard}
                    </h3>
                    {renderStatsTable(game)}
                  </div>
                </TabsContent>
              ))}
            </Tabs>
          </div>
        )}
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-50 bg-background/90 backdrop-blur-xl border-t border-white/10 h-24 flex items-center px-6 shadow-[0_-10px_30px_rgba(0,0,0,0.5)]">
        <div className="w-full max-md mx-auto flex gap-3">
          <Button variant="outline" className="flex-1 h-12 uppercase font-black text-[10px] tracking-widest" onClick={() => router.back()}>{t.exit}</Button>
          <Button className="flex-[2] h-12 hero-gradient border-none font-black text-[10px] uppercase shadow-lg shadow-primary/20" onClick={handleNext}>
            {step === 'stats' ? <Check className="w-4 h-4 mr-2" /> : <ArrowRight className="w-4 h-4 mr-2" />}
            {step === 'preview' ? t.next : (step === 'live' ? 'SKIP TO STATS' : t.accept)}
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
