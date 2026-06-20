'use client';

import { useState, useEffect, useMemo, Suspense, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { useGameState, checkIsMatchFinished } from '../lib/store';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  ChevronLeft, Check, Swords, Activity, ArrowRight, 
  ShieldCheck, Zap, Target, FileText,
  Users, Trophy, Clock, Medal,
  ShieldAlert, User, MapPin, Info,
  TrendingUp, Timer, ChevronRight, Loader2, Crown, X
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { LoadingScreen } from '@/components/game/LoadingScreen';
import { doc, getDoc } from 'firebase/firestore';
import { COUNTRIES } from '../lib/countries-data';

type MatchStep = 'preview' | 'live' | 'stats';

function MatchContent() {
  const { user, isUserLoading } = useUser();
  const router = useRouter();
  const searchParams = useSearchParams();
  const db = useFirestore();
  const { 
    language, isLoaded, markMatchIdAsSeen,
    matchHistory, id: myId, arena, ownedHeroes
  } = useGameState();

  const matchIdFromUrl = searchParams.get('id');
  const [step, setStep] = useState<MatchStep>('preview');
  const [globalMatchData, setGlobalMatchData] = useState<any | null>(null);
  const [isGlobalLoading, setIsGlobalLoading] = useState(true);
  
  // Live Simulation State
  const [activeGameIdx, setActiveGameIdx] = useState(0);
  const [visibleEvents, setVisibleEvents] = useState<any[]>([]);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const userRef = useMemoFirebase(() => user ? doc(db, 'players_v10', user.uid) : null, [db, user]);
  const { data: profile } = useDoc(userRef);

  useEffect(() => {
    if (!matchIdFromUrl) {
      setIsGlobalLoading(false);
      return;
    }

    const fetchMatch = async () => {
      setIsGlobalLoading(true);
      try {
        const matchRef = doc(db, 'matches_v1', matchIdFromUrl);
        const snap = await getDoc(matchRef);
        if (snap.exists()) {
          setGlobalMatchData(snap.data());
        }
      } catch (e) {
        console.error("Failed to fetch global match", e);
      } finally {
        setIsGlobalLoading(false);
      }
    };
    fetchMatch();
  }, [matchIdFromUrl, db]);

  const currentResult = useMemo(() => {
    if (isGlobalLoading) return null;
    
    // 1. Try from global DB (for league matches)
    if (globalMatchData && globalMatchData.status === 'finished') {
      const isHome = globalMatchData.homeId === user?.uid;
      return {
        id: globalMatchData.id,
        isHome,
        homeName: globalMatchData.homeName,
        awayName: globalMatchData.awayName,
        opponentName: isHome ? globalMatchData.awayName : globalMatchData.homeName,
        scoreA: globalMatchData.scoreA,
        scoreB: globalMatchData.scoreB,
        type: globalMatchData.type || 'league',
        day: globalMatchData.day,
        playedAt: globalMatchData.finishedAt || globalMatchData.startTime,
        games: globalMatchData.simulation?.games || [globalMatchData.simulation],
        seriesScore: globalMatchData.simulation?.seriesScore || `${globalMatchData.scoreA}-${globalMatchData.scoreB}`,
        winner: globalMatchData.simulation?.winner
      };
    }

    // 2. Try from local match history (for trials/friendlies)
    const fromHistory = matchHistory.find(m => m.id === matchIdFromUrl);
    if (fromHistory) {
      return { 
        ...fromHistory, 
        isHome: fromHistory.homeName?.includes(profile?.displayName || 'XYZ') 
      };
    }

    return null;
  }, [matchHistory, globalMatchData, isGlobalLoading, user?.uid, profile?.displayName]);

  const attendance = useMemo(() => {
    if (!arena || !currentResult) return 0;
    const baseCap = arena.capacity || 5000;
    const proUnitsCount = ownedHeroes.filter(h => h.isPro).length;
    const proMultiplier = currentResult.isHome ? (1 + (proUnitsCount * 0.07)) : 1.0;
    if (!currentResult.isHome) return Math.floor(baseCap * 0.85); 
    const fillingFactor = (0.7 + (Math.random() * 0.3)) * proMultiplier;
    return Math.min(baseCap, Math.floor(baseCap * fillingFactor));
  }, [arena, currentResult, ownedHeroes]);

  // Handle auto-scrolling events in LIVE mode
  useEffect(() => {
    if (step !== 'live' || !currentResult || !currentResult.games) return;

    const game = currentResult.games[activeGameIdx];
    if (!game) return;

    const events = (game.timeline || []).filter((e: any) => e && typeof e === 'object');
    if (events.length === 0) {
      setTimeout(() => setStep('stats'), 1000);
      return;
    }

    // Clear previous if any
    setVisibleEvents([]);

    const totalRealTime = 15; // Faster simulation logs
    const intervalMs = (totalRealTime * 1000) / Math.max(1, events.length);

    let currentEvt = 0;
    const timer = setInterval(() => {
      if (currentEvt < events.length) {
        const eventToAdd = events[currentEvt];
        if (eventToAdd) {
          setVisibleEvents(prev => [...prev, eventToAdd]);
        }
        currentEvt++;
        if (scrollRef.current) {
          scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
      } else {
        clearInterval(timer);
        if (activeGameIdx < currentResult.games.length - 1) {
          setTimeout(() => {
            setIsTransitioning(true);
            setTimeout(() => {
              setActiveGameIdx(prev => prev + 1);
              setVisibleEvents([]);
              setIsTransitioning(false);
            }, 1500); 
          }, 1000);
        } else {
          setTimeout(() => setStep('stats'), 1500);
        }
      }
    }, intervalMs);

    return () => clearInterval(timer);
  }, [step, activeGameIdx, currentResult]);

  const handleAcknowledgeMatch = () => {
    if (currentResult) markMatchIdAsSeen(currentResult.id);
    router.push('/');
  };

  const handleNext = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation(); 
    if (step === 'preview') setStep('live');
    else if (step === 'live') setStep('stats'); 
    else handleAcknowledgeMatch();
  };

  const handleGlobalClick = () => {
    if (step === 'preview') setStep('live');
    else if (step === 'live') setStep('stats');
  };

  if (isUserLoading || isGlobalLoading || !isLoaded || !user) return <LoadingScreen />;
  if (!currentResult) return <div className="p-20 text-center"><p className="text-muted-foreground uppercase text-[10px] font-black">Match data not found</p><Button className="mt-4" onClick={() => router.push('/')}>Return</Button></div>;

  const userCountry = COUNTRIES.find(c => c.name === profile?.country);
  const myFlag = userCountry?.flag || '🏳️';

  const labels = {
    en: {
      reportTitle: "OFFICIAL MATCH DEBRIEF",
      next: "INITIATE LIVE", skip: "SKIP TO STATS", accept: "FINALIZE", exit: "EXIT",
      vs: "VS", attendance: "Spectators",
      duration: "Duration", mvp: "Combat MVP", home: "HOME", away: "AWAY",
      mapTransition: "Switching to next tactical map...",
      mapScore: "Series Standings",
      round: "Round", stage: "Stage", tournament: "Tournament",
      tournamentTypes: { league: "PRO LEAGUE", cup: "PYRAMID CUP", friendly: "FRIENDLY", trial: "TRIAL", basket: "CW BASKET" }
    },
    ru: {
      reportTitle: "ОФИЦИАЛЬНЫЙ ОТЧЕТ",
      next: "В ЭФИР", skip: "К СТАТИСТИКЕ", accept: "ЗАВЕРШИТЬ", exit: "ВЫЙТИ",
      vs: "ПРОТИВ", attendance: "Зрители",
      duration: "Длительность", mvp: "MVP матча", home: "ДОМА", away: "В ГОСТЯХ",
      mapTransition: "Подготовка к следующей карте...",
      mapScore: "Счет в серии",
      round: "Тур", stage: "Стадия", tournament: "Турнир",
      tournamentTypes: { league: "ПРОФ. ЛИГА", cup: "КУБОК ПИРАМИДЫ", friendly: "ТОВ. МАТЧ", trial: "ПРОБНЫЙ МАТЧ", basket: "КВ КОРЗИНА" }
    }
  };

  const t = labels[language as keyof typeof labels] || labels.ru;

  const renderStatsTable = (game: any) => {
    const scoreboard = game.scoreboard || [];
    const hName = currentResult.homeName;
    const aName = currentResult.awayName;
    
    const homeHeroes = scoreboard.filter((p: any) => p.team === hName);
    const awayHeroes = scoreboard.filter((p: any) => p.team === aName);

    const renderHeroRow = (p: any, side: 'left' | 'right') => (
      <div key={p.name} className={cn(
        "flex items-center gap-3 p-2.5 rounded-lg border border-white/5 bg-secondary/10",
        p.isPro && "border-yellow-500/30 bg-yellow-500/5",
        side === 'right' ? "flex-row-reverse text-right" : "text-left"
      )}>
        <div className="relative shrink-0">
          <div className={cn(
            "w-10 h-10 rounded-lg overflow-hidden border border-white/10 bg-background flex items-center justify-center",
            p.isPro && "border-yellow-500/50 shadow-[0_0_10px_rgba(234,179,8,0.2)]"
          )}>
            {p.name === game.mvp ? <Trophy className="w-5 h-5 text-yellow-500" /> : (p.isPro ? <Crown className="w-5 h-5 text-yellow-500" /> : <User className="w-4 h-4 text-muted-foreground" />)}
          </div>
          <Badge className={cn(
            "absolute -bottom-1 -right-1 bg-black/80 text-[6px] px-1 h-3 border-white/20",
            p.isPro && "bg-yellow-500 text-black border-none"
          )}>{p.isPro ? 'PRO' : (p.role || 'UNIT')}</Badge>
        </div>
        <div className="flex-1 min-w-0">
          <p className={cn("text-[10px] font-black uppercase truncate", p.isPro ? "text-yellow-500" : "text-white")}>{p.name}</p>
          <div className={cn("flex items-center gap-2 mt-0.5", side === 'right' && "justify-end")}>
            <span className="text-[9px] font-mono font-bold text-primary">{p.kills}/{p.deaths}/{p.assists}</span>
            <span className="text-[8px] text-muted-foreground uppercase font-black">{p.cs} CS</span>
          </div>
        </div>
      </div>
    );

    return (
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <p className="text-[8px] font-black uppercase tracking-widest text-primary mb-2 flex items-center gap-2">
             <ShieldCheck className="w-3 h-3" /> {t.home}
          </p>
          {homeHeroes.length > 0 ? homeHeroes.map(p => renderHeroRow(p, 'left')) : <p className="text-[8px] opacity-30 italic">No data</p>}
        </div>
        <div className="space-y-2">
          <p className="text-[8px] font-black uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-2 justify-end">
             {t.away} <Swords className="w-3 h-3" />
          </p>
          {awayHeroes.length > 0 ? awayHeroes.map(p => renderHeroRow(p, 'right')) : <p className="text-[8px] text-right opacity-30 italic">No data</p>}
        </div>
      </div>
    );
  };

  return (
    <div 
      className="min-h-screen bg-background text-foreground pb-32 select-none relative overflow-hidden"
      onClick={handleGlobalClick}
    >
      <div className="absolute inset-0 pointer-events-none opacity-5 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:30px_30px]" />

      <div className="max-w-md mx-auto relative z-10 px-4 pt-6">
        <header className="text-center space-y-4 mb-8">
          <div className="flex flex-col items-center gap-2">
            <Badge variant="outline" className="bg-primary/5 border-primary/20 text-primary text-[8px] font-black uppercase tracking-[0.2em] px-3">
              {t.tournamentTypes[currentResult.type as keyof typeof t.tournamentTypes] || "ENGAGEMENT"}
            </Badge>
            <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">
              {currentResult.type === 'league' ? `${t.round} ${currentResult.day}` : t.tournament}
            </p>
          </div>
          <h1 className="text-sm font-headline font-bold text-white uppercase tracking-tighter">{t.reportTitle}</h1>
          <div className="flex items-center justify-center gap-2 max-w-[240px] mx-auto">
            <div className={cn("h-1 flex-1 rounded-full transition-all duration-500", step === 'preview' ? "bg-primary shadow-[0_0_10px_rgba(var(--primary),0.5)]" : "bg-primary/20")} />
            <div className={cn("h-1 flex-1 rounded-full transition-all duration-500", step === 'live' ? "bg-primary shadow-[0_0_10px_rgba(var(--primary),0.5)]" : "bg-primary/20")} />
            <div className={cn("h-1 flex-1 rounded-full transition-all duration-500", step === 'stats' ? "bg-primary shadow-[0_0_10px_rgba(var(--primary),0.5)]" : "bg-primary/20")} />
          </div>
        </header>

        {step === 'preview' && (
          <div className="space-y-6 animate-in fade-in zoom-in-95 duration-500">
            <Card className="glass-card border-white/10 bg-gradient-to-br from-primary/10 to-transparent overflow-hidden">
              <div className="grid grid-cols-2 divide-x divide-white/5">
                <div className="p-6 flex flex-col items-center gap-3 text-center">
                  <div className="relative">
                    <div className="w-20 h-20 rounded-2xl bg-secondary/50 border border-primary/30 flex items-center justify-center shadow-xl text-4xl">
                      {currentResult.homeName?.includes(profile?.displayName || 'XYZ') ? myFlag : '🏳️'}
                    </div>
                    <Badge className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-[7px] font-black uppercase px-2 h-4 border-none">HOME</Badge>
                  </div>
                  <h3 className="text-xs font-headline font-bold uppercase tracking-tight text-white mt-2 italic">{currentResult.homeName}</h3>
                </div>
                <div className="p-6 flex flex-col items-center gap-3 text-center">
                  <div className="relative">
                    <div className="w-20 h-20 rounded-2xl bg-secondary/50 border-white/10 flex items-center justify-center shadow-xl text-4xl">
                      {!currentResult.homeName?.includes(profile?.displayName || 'XYZ') ? myFlag : '🏳️'}
                    </div>
                    <Badge variant="outline" className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-background border-white/20 text-muted-foreground text-[7px] font-black uppercase px-2 h-4">AWAY</Badge>
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
            
            <p className="text-[8px] text-center text-muted-foreground uppercase font-black animate-pulse mt-8">{language === 'ru' ? 'НАЖМИТЕ ДЛЯ ПРОДОЛЖЕНИЯ' : 'CLICK ANYWHERE TO CONTINUE'}</p>
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
                {visibleEvents.map((event, i) => {
                  if (!event) return null;
                  return (
                    <Card key={`event-${i}`} className="glass-card border-white/5 bg-secondary/10 animate-in slide-in-from-bottom-2">
                      <CardContent className="p-3 flex gap-4">
                        <div className="w-12 shrink-0 flex flex-col items-center justify-center border-r border-white/5 pr-2">
                          <span className="text-[9px] font-mono font-bold text-accent">{event.time || '--:--'}</span>
                        </div>
                        <div className="flex-1 space-y-2">
                          <p className="text-xs leading-relaxed text-muted-foreground">{event.event || 'Unknown tactical activity.'}</p>
                          {event.score && (
                            <div className="flex justify-end">
                               <Badge className="bg-black/40 text-[8px] font-mono font-bold text-white border-white/10">{event.score}</Badge>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
            <p className="text-[7px] text-center text-muted-foreground uppercase font-black opacity-40">{language === 'ru' ? 'КЛИКНИТЕ ДЛЯ ПРОПУСКА ЛОГОВ' : 'CLICK TO SKIP TO STATS'}</p>
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
                <TabsContent key={`game-stats-${idx}`} value={`map${idx+1}`} className="space-y-6" onClick={(e) => e.stopPropagation()}>
                  <div className="p-4 bg-primary/5 border border-primary/20 rounded-2xl text-center">
                    <p className="text-[9px] text-primary/60 italic leading-relaxed">
                      "{game.matchSummary || 'Standard tactical protocol executed.'}"
                    </p>
                  </div>
                  
                  <div className="space-y-4">
                    <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-1 flex items-center gap-2">
                       <FileText className="w-3.5 h-3.5" /> Unit Performance
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
          <Button variant="outline" className="flex-1 h-12 uppercase font-black text-[10px] tracking-widest border-white/10" onClick={(e) => { e.stopPropagation(); router.push('/'); }}>{t.exit}</Button>
          <Button className="flex-[2] h-12 hero-gradient border-none font-black text-[10px] uppercase shadow-lg shadow-primary/20" onClick={handleNext}>
            {step === 'stats' ? <Check className="w-4 h-4 mr-2" /> : <ArrowRight className="w-4 h-4 mr-2" />}
            {step === 'preview' ? t.next : (step === 'live' ? t.skip : t.accept)}
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
