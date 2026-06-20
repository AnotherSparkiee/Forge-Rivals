'use client';

/**
 * @fileOverview ОФИЦИАЛЬНЫЙ ПЛЕЕР МАТЧЕЙ v4.0.
 * Отображает обоснованную статистику и детальные рейтинги игроков.
 */

import { useState, useEffect, useMemo, Suspense, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useUser, useFirestore } from '@/firebase';
import { useGameState } from '../lib/store';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  ChevronLeft, Check, Swords, Activity, ArrowRight, 
  ShieldCheck, Zap, Target, Trophy, 
  User, ShieldAlert, Info, Users,
  Timer, ChevronRight, Crown,
  Skull, Activity as ActivityIcon, Castle, Radio,
  Package, Sparkles, Flame
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { LoadingScreen } from '@/components/game/LoadingScreen';
import { doc, getDoc } from 'firebase/firestore';

type MatchStep = 'preview' | 'live' | 'stats';

function MatchContent() {
  const { user, isUserLoading } = useUser();
  const router = useRouter();
  const searchParams = useSearchParams();
  const db = useFirestore();
  const { 
    language, isLoaded, markMatchIdAsSeen,
    matchHistory
  } = useGameState();

  const matchIdFromUrl = searchParams.get('id');
  const [step, setStep] = useState<MatchStep>('preview');
  const [matchData, setMatchData] = useState<any | null>(null);
  const [isDataLoading, setIsDataLoading] = useState(true);
  
  const [activeGameIdx, setActiveGameIdx] = useState(0);
  const [visibleEvents, setVisibleEvents] = useState<any[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!matchIdFromUrl) {
      setIsDataLoading(false);
      return;
    }
    const fetchMatch = async () => {
      setIsDataLoading(true);
      try {
        const snap = await getDoc(doc(db, 'matches_v1', matchIdFromUrl));
        if (snap.exists()) {
          setMatchData(snap.data());
        } else {
          const hist = matchHistory.find(m => m.id === matchIdFromUrl);
          if (hist) setMatchData(hist);
        }
      } finally { setIsDataLoading(false); }
    };
    fetchMatch();
  }, [matchIdFromUrl, db, matchHistory]);

  const currentSimulation = useMemo(() => {
    if (!matchData) return null;
    return matchData.simulation || { 
      games: matchData.games || [matchData],
      seriesScore: matchData.seriesScore || `${matchData.scoreA}-${matchData.scoreB}`,
      winner: matchData.winner
    };
  }, [matchData]);

  useEffect(() => {
    if (step !== 'live' || !currentSimulation || !currentSimulation.games) return;
    const game = currentSimulation.games[activeGameIdx];
    if (!game) { setStep('stats'); return; }
    
    const events = (game.timeline || []).filter((e: any) => !!e);
    if (events.length === 0) { setStep('stats'); return; }
    
    setVisibleEvents([]);
    let currentEvt = 0;
    
    const timer = setInterval(() => {
      if (currentEvt < events.length) {
        setVisibleEvents(prev => [...prev, events[currentEvt]]);
        currentEvt++;
        if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      } else {
        clearInterval(timer);
        if (activeGameIdx < currentSimulation.games.length - 1) {
          setTimeout(() => { 
            setActiveGameIdx(prev => prev + 1); 
            setVisibleEvents([]); 
          }, 1000); 
        } else { 
          setTimeout(() => setStep('stats'), 1500); 
        }
      }
    }, 1200);
    return () => clearInterval(timer);
  }, [step, activeGameIdx, currentSimulation]);

  const handleNext = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation(); 
    if (step === 'preview') setStep('live');
    else if (step === 'live') setStep('stats'); 
    else { 
      if (matchIdFromUrl) markMatchIdAsSeen(matchIdFromUrl); 
      router.push('/'); 
    }
  };

  if (isUserLoading || isDataLoading || !isLoaded || !user) return <LoadingScreen />;
  if (!matchData || !currentSimulation) return <div className="p-20 text-center"><p className="text-muted-foreground uppercase text-[10px] font-black">Match data not found</p></div>;

  const t = {
    en: {
      reportTitle: "OFFICIAL MATCH DEBRIEF",
      next: "WATCH TRANSCRIPTION", skip: "SKIP TO STATS", accept: "FINALIZE REVIEW", exit: "EXIT",
      home: "HOME", away: "AWAY", vs: "VS",
      comparison: "TEAM SKILL ANALYSIS",
      compFarm: "Resource Acquisition", compTactics: "Tactical Execution", compTeam: "Strategic Synergy", compRef: "Combat Reflexes"
    },
    ru: {
      reportTitle: "ОФИЦИАЛЬНЫЙ ОТЧЕТ БОЯ",
      next: "СМОТРЕТЬ ПОВТОР", skip: "К СТАТИСТИКЕ", accept: "ЗАВЕРШИТЬ ПРОСМОТР", exit: "ВЫЙТИ",
      home: "ДОМА", away: "В ГОСТЯХ", vs: "ПРОТИВ",
      comparison: "АНАЛИЗ НАВЫКОВ КОМАНД",
      compFarm: "Сбор ресурсов", compTactics: "Тактическая точность", compTeam: "Командная синергия", compRef: "Боевые рефлексы"
    }
  }[language as 'en' | 'ru'] || { reportTitle: "Report" };

  const renderStatsTable = (game: any) => {
    const scoreboard = game.scoreboard || [];
    const homeHeroes = scoreboard.filter((p: any) => p.team === matchData.homeName);
    const awayHeroes = scoreboard.filter((p: any) => p.team === matchData.awayName);

    const renderHeroRow = (p: any, side: 'left' | 'right') => (
      <div key={p.name} className={cn("flex flex-col gap-1.5 p-3 rounded-2xl border border-white/5 bg-secondary/10 shadow-sm", side === 'right' ? "items-end text-right" : "items-start text-left")}>
        <div className={cn("flex items-center gap-3 w-full", side === 'right' && "flex-row-reverse")}>
          <div className="relative shrink-0">
            <div className="w-14 h-14 rounded-2xl overflow-hidden border border-white/10 bg-background flex items-center justify-center shadow-xl">
              {p.image ? <img src={p.image} alt="" className="w-full h-full object-cover" /> : <User className="w-7 h-7 text-muted-foreground" />}
            </div>
            {p.name === game.mvp && <Trophy className="absolute -top-1.5 -right-1.5 w-6 h-6 text-yellow-500 fill-yellow-500 drop-shadow-[0_0_8px_rgba(234,179,8,0.6)]" />}
            <div className="absolute -bottom-1 -left-1 bg-black/90 rounded-lg px-2 py-0.5 border border-white/10 shadow-2xl">
              <span className="text-[10px] font-black text-accent">{p.matchRating?.toFixed(1) || '6.0'}</span>
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[12px] font-black uppercase truncate text-white leading-none mb-1">{p.name}</p>
            <div className={cn("flex items-center gap-2", side === 'right' && "justify-end")}>
               <Badge variant="outline" className="text-[7px] h-4 px-1.5 border-white/10 opacity-70 uppercase font-black">{p.role}</Badge>
               <span className="text-[10px] font-mono font-bold text-primary">{p.kills}/{p.deaths}/{p.assists}</span>
            </div>
          </div>
        </div>
        
        <div className={cn("flex items-center gap-2 mt-1 w-full", side === 'right' && "justify-end")}>
           <div className="flex gap-1 opacity-40">
             <div className="w-5 h-5 rounded-md bg-background border border-white/5 flex items-center justify-center"><Package className="w-3 h-3" /></div>
             <div className="w-5 h-5 rounded-md bg-background border border-white/5 flex items-center justify-center"><Zap className="w-3 h-3" /></div>
           </div>
           <span className="text-[8px] font-black text-muted-foreground/40 uppercase font-mono">{p.cs || 0} CS</span>
        </div>
      </div>
    );

    return (
      <div className="space-y-8">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2.5">
            <p className="text-[9px] font-black uppercase tracking-widest text-primary mb-3 flex items-center gap-2 px-1 border-l-2 border-primary pl-2"><ShieldCheck className="w-3.5 h-3.5" /> {t.home}</p>
            {homeHeroes.map(p => renderHeroRow(p, 'left'))}
          </div>
          <div className="space-y-2.5">
            <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-2 justify-end px-1 border-r-2 border-white/10 pr-2">{t.away} <Swords className="w-3.5 h-3.5" /></p>
            {awayHeroes.map(p => renderHeroRow(p, 'right'))}
          </div>
        </div>

        {game.teamComparison && (
          <section className="space-y-4 pt-4">
            <h3 className="text-[11px] font-black uppercase tracking-widest text-accent text-center flex items-center justify-center gap-2 bg-accent/5 py-2 rounded-xl">
              <ActivityIcon className="w-4 h-4" /> {t.comparison}
            </h3>
            <div className="space-y-6 bg-secondary/20 p-6 rounded-3xl border border-white/5 shadow-inner">
              {[
                { label: t.compFarm, key: 'farm', icon: Zap, color: 'text-yellow-500' },
                { label: t.compTactics, key: 'tactics', icon: Target, color: 'text-blue-500' },
                { label: t.compTeam, key: 'teamwork', icon: Users, color: 'text-green-500' },
                { label: t.compRef, key: 'reflexes', icon: ActivityIcon, color: 'text-red-500' }
              ].map(stat => (
                <div key={stat.key} className="space-y-2.5">
                  <div className="flex justify-between items-center text-[11px] font-black uppercase tracking-tighter">
                    <div className="flex items-center gap-2 min-w-[40px]">
                      <span className="text-primary text-base font-headline">{game.teamComparison[stat.key][0]}</span>
                    </div>
                    <span className="text-muted-foreground flex items-center gap-2 opacity-80 text-[10px]">
                      <stat.icon className={cn("w-4 h-4", stat.color)} /> {stat.label}
                    </span>
                    <div className="flex items-center gap-2 min-w-[40px] justify-end">
                      <span className="text-accent text-base font-headline">{game.teamComparison[stat.key][1]}</span>
                    </div>
                  </div>
                  <div className="h-2 w-full bg-background/50 rounded-full flex overflow-hidden border border-white/5 shadow-inner">
                    <div className="h-full bg-primary shadow-[0_0_12px_rgba(var(--primary),0.5)] transition-all duration-1000" style={{ width: `${(game.teamComparison[stat.key][0] / (game.teamComparison[stat.key][0] + game.teamComparison[stat.key][1])) * 100}%` }} />
                    <div className="h-full bg-accent shadow-[0_0_12px_rgba(var(--accent),0.5)] transition-all duration-1000" style={{ width: `${(game.teamComparison[stat.key][1] / (game.teamComparison[stat.key][0] + game.teamComparison[stat.key][1])) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    );
  };

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'kill': return <Skull className="w-4 h-4 text-red-500" />;
      case 'save': return <ShieldCheck className="w-4 h-4 text-green-400" />;
      case 'objective': return <ActivityIcon className="w-4 h-4 text-accent" />;
      case 'tower': return <Castle className="w-4 h-4 text-yellow-500" />;
      case 'injury': return <ShieldAlert className="w-4 h-4 text-red-600 animate-pulse" />;
      case 'tilt': return <Flame className="w-4 h-4 text-orange-500" />;
      default: return <Info className="w-4 h-4 text-muted-foreground" />;
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground pb-32 relative overflow-hidden" onClick={() => handleNext()}>
      <div className="max-w-md mx-auto relative z-10 px-4 pt-6">
        <header className="text-center space-y-4 mb-8">
          <h1 className="text-sm font-headline font-bold text-white uppercase tracking-tighter">{t.reportTitle}</h1>
          <div className="flex items-center justify-center gap-2 max-w-[240px] mx-auto">
            <div className={cn("h-1 flex-1 rounded-full transition-all duration-500", step === 'preview' ? "bg-primary shadow-[0_0_10px_rgba(var(--primary),0.5)]" : "bg-primary/20")} />
            <div className={cn("h-1 flex-1 rounded-full transition-all duration-500", step === 'live' ? "bg-primary shadow-[0_0_10px_rgba(var(--primary),0.5)]" : "bg-primary/20")} />
            <div className={cn("h-1 flex-1 rounded-full transition-all duration-500", step === 'stats' ? "bg-primary shadow-[0_0_10px_rgba(var(--primary),0.5)]" : "bg-primary/20")} />
          </div>
        </header>

        {step === 'preview' && (
          <div className="space-y-6 animate-in fade-in zoom-in-95">
            <Card className="glass-card border-white/10 bg-gradient-to-br from-primary/10 to-transparent overflow-hidden">
              <div className="grid grid-cols-2 divide-x divide-white/5">
                <div className="p-6 flex flex-col items-center gap-3 text-center">
                  <div className="w-16 h-16 rounded-2xl bg-secondary/50 border border-primary/30 flex items-center justify-center shadow-xl text-3xl">🛡️</div>
                  <h3 className="text-[10px] font-headline font-bold uppercase truncate text-white">{matchData.homeName}</h3>
                </div>
                <div className="p-6 flex flex-col items-center gap-3 text-center">
                  <div className="w-16 h-16 rounded-2xl bg-secondary/50 border border-white/10 flex items-center justify-center shadow-xl text-3xl">⚔️</div>
                  <h3 className="text-[10px] font-headline font-bold uppercase truncate text-white">{matchData.awayName}</h3>
                </div>
              </div>
            </Card>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-secondary/20 p-4 rounded-xl border border-white/5 text-center">
                <Castle className="w-5 h-5 text-yellow-500 mx-auto mb-2" />
                <p className="text-[8px] font-black text-muted-foreground uppercase">TOWER CONTROL</p>
                <p className="text-lg font-headline font-bold text-white">{matchData.towersA || 0} : {matchData.towersB || 0}</p>
              </div>
              <div className="bg-secondary/20 p-4 rounded-xl border border-white/5 text-center">
                <Target className="w-5 h-5 text-accent mx-auto mb-2" />
                <p className="text-[8px] font-black text-muted-foreground uppercase">TOURNAMENT</p>
                <p className="text-lg font-headline font-bold text-white uppercase">{matchData.type || 'league'}</p>
              </div>
            </div>
            <p className="text-[8px] text-center text-muted-foreground uppercase font-black animate-pulse pt-8 tracking-[0.3em]">CLICK ANYWHERE TO START REPLAY</p>
          </div>
        )}

        {step === 'live' && (
          <div className="space-y-4 animate-in slide-in-from-right-4 h-[60vh] flex flex-col">
            <div className="flex justify-between items-center px-1 mb-2">
               <Badge className="bg-blue-600 text-white text-[8px] font-black uppercase px-3">RECORDED STREAM</Badge>
               <span className="text-[10px] font-mono font-bold text-primary">{currentSimulation.seriesScore}</span>
            </div>
            <div className="flex-1 overflow-y-auto space-y-3 pr-2 scrollbar-hide" ref={scrollRef}>
              {visibleEvents.map((event, i) => (
                <Card key={i} className="glass-card border-white/5 bg-secondary/10">
                  <CardContent className="p-3 flex gap-4">
                    <div className="w-12 shrink-0 flex flex-col items-center justify-center border-r border-white/5 pr-2">
                      <div className="mb-1">{getEventIcon(event?.type)}</div>
                      <span className="text-[9px] font-mono font-bold text-accent">{event?.time}</span>
                    </div>
                    <div className="flex-1 space-y-2">
                      <p className="text-xs leading-relaxed text-muted-foreground italic">"{event?.event}"</p>
                      {event?.score && <div className="flex justify-end"><Badge className="bg-black/40 text-[8px] font-mono font-bold text-white border-white/10">{event.score}</Badge></div>}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {step === 'stats' && (
          <div className="space-y-6 animate-in slide-in-from-right-4 pb-20">
            <div className="text-center py-4">
              <div className="text-5xl font-headline font-black italic tracking-tighter flex items-center justify-center gap-4 text-white">
                <span className={cn(matchData.scoreA > matchData.scoreB && "text-primary")}>{matchData.scoreA}</span>
                <span className="opacity-20 text-3xl">:</span>
                <span className={cn(matchData.scoreB > matchData.scoreA && "text-primary")}>{matchData.scoreB}</span>
              </div>
              <Badge className="mt-4 text-[10px] font-black px-8 py-1 uppercase tracking-widest bg-primary/20 text-primary border-none">BATTLE CONCLUDED</Badge>
            </div>
            
            <Tabs defaultValue="map1" className="w-full">
              <TabsList className="bg-secondary/30 w-full grid grid-cols-2 h-12 p-1.5 rounded-2xl mb-6 shadow-lg">
                <TabsTrigger value="map1" className="text-[10px] font-black uppercase rounded-xl">MAP 1</TabsTrigger>
                <TabsTrigger value="map2" disabled={currentSimulation.games.length < 2} className="text-[10px] font-black uppercase rounded-xl">MAP 2</TabsTrigger>
              </TabsList>
              {currentSimulation.games.map((game: any, idx: number) => (
                <TabsContent key={idx} value={`map${idx+1}`} className="space-y-6 animate-in fade-in slide-in-from-bottom-2" onClick={(e) => e.stopPropagation()}>
                  <div className="grid grid-cols-2 gap-3">
                     <div className="bg-background/40 p-4 rounded-2xl border border-white/5 flex flex-col items-center shadow-inner">
                        <Castle className="w-5 h-5 text-yellow-500 mb-1" />
                        <span className="text-[8px] font-black text-muted-foreground uppercase tracking-widest">Destroyed Towers</span>
                        <span className="text-xl font-headline font-bold text-white">{game.towersA} : {game.towersB}</span>
                     </div>
                     <div className="bg-background/40 p-4 rounded-2xl border border-white/5 flex flex-col items-center shadow-inner">
                        <Activity className="w-5 h-5 text-accent mb-1" />
                        <span className="text-[8px] font-black text-muted-foreground uppercase tracking-widest">Forest Objectives</span>
                        <span className="text-xl font-headline font-bold text-white">{game.objectivesA} : {game.objectivesB}</span>
                     </div>
                  </div>
                  {renderStatsTable(game)}
                </TabsContent>
              ))}
            </Tabs>

            <div className="pt-10">
               <Button className="w-full h-16 hero-gradient font-black text-sm tracking-widest uppercase shadow-2xl active:scale-95 transition-all rounded-2xl" onClick={handleNext}>
                 <Check className="w-5 h-5 mr-2" /> {t.accept}
               </Button>
            </div>
          </div>
        )}
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-50 bg-background/90 backdrop-blur-xl border-t border-white/10 h-24 flex items-center px-6">
        <div className="w-full max-md mx-auto flex gap-3">
          <Button variant="outline" className="flex-1 h-12 uppercase font-black text-[10px] border-white/10 rounded-xl" onClick={(e) => { e.stopPropagation(); router.push('/'); }}>{t.exit}</Button>
          <Button className="flex-[2] h-12 hero-gradient font-black text-[10px] uppercase shadow-xl rounded-xl" onClick={handleNext}>
            {step === 'stats' ? <Check className="w-4 h-4 mr-2" /> : <ArrowRight className="w-4 h-4 mr-2" />}
            {step === 'preview' ? t.next : (step === 'live' ? t.skip : t.accept)}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function MatchPage() {
  return <Suspense fallback={<LoadingScreen />}><MatchContent /></Suspense>;
}
