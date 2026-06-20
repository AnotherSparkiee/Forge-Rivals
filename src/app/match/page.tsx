'use client';

import { useState, useEffect, useMemo, Suspense, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { useGameState } from '../lib/store';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  ChevronLeft, Check, Swords, Activity, ArrowRight, 
  ShieldCheck, Zap, Target, FileText,
  Users, Trophy, Clock, Medal,
  ShieldAlert, User, MapPin, Info,
  TrendingUp, Timer, ChevronRight, Loader2, Crown, X,
  Skull, Activity as ActivityIcon
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { LoadingScreen } from '@/components/game/LoadingScreen';
import { doc, getDoc } from 'firebase/firestore';
import { Progress } from '@/components/ui/progress';

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
  const [globalMatchData, setGlobalMatchData] = useState<any | null>(null);
  const [isGlobalLoading, setIsGlobalLoading] = useState(true);
  
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
        if (snap.exists()) setGlobalMatchData(snap.data());
      } finally { setIsGlobalLoading(false); }
    };
    fetchMatch();
  }, [matchIdFromUrl, db]);

  const currentResult = useMemo(() => {
    if (isGlobalLoading) return null;
    if (globalMatchData && globalMatchData.status === 'finished') {
      const isHome = globalMatchData.homeId === user?.uid;
      return {
        id: globalMatchData.id,
        isHome,
        homeName: globalMatchData.homeName,
        awayName: globalMatchData.awayName,
        scoreA: globalMatchData.scoreA,
        scoreB: globalMatchData.scoreB,
        type: globalMatchData.type || 'league',
        day: globalMatchData.day,
        playedAt: globalMatchData.finishedAt || globalMatchData.startTime,
        games: globalMatchData.simulation?.games || [globalMatchData.simulation],
        seriesScore: globalMatchData.simulation?.seriesScore || `${globalMatchData.scoreA}-${globalMatchData.scoreB}`
      };
    }
    const fromHistory = matchHistory.find(m => m.id === matchIdFromUrl);
    if (fromHistory) return { ...fromHistory, isHome: fromHistory.homeName?.includes(profile?.displayName || 'XYZ') };
    return null;
  }, [matchHistory, globalMatchData, isGlobalLoading, user?.uid, profile?.displayName]);

  useEffect(() => {
    if (step !== 'live' || !currentResult || !currentResult.games) return;
    const game = currentResult.games[activeGameIdx];
    if (!game) return;
    const events = (game.timeline || []).filter((e: any) => !!e);
    if (events.length === 0) { setStep('stats'); return; }
    
    setVisibleEvents([]);
    let currentEvt = 0;
    const intervalMs = 15000 / Math.max(1, events.length);
    
    const timer = setInterval(() => {
      if (currentEvt < events.length) {
        setVisibleEvents(prev => [...prev, events[currentEvt]]);
        currentEvt++;
        if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      } else {
        clearInterval(timer);
        if (activeGameIdx < currentResult.games.length - 1) {
          setTimeout(() => { 
            setIsTransitioning(true); 
            setTimeout(() => { 
              setActiveGameIdx(prev => prev + 1); 
              setVisibleEvents([]); 
              setIsTransitioning(false); 
            }, 1000); 
          }, 1000);
        } else { 
          setTimeout(() => setStep('stats'), 1500); 
        }
      }
    }, intervalMs);
    return () => clearInterval(timer);
  }, [step, activeGameIdx, currentResult]);

  const handleNext = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation(); 
    if (step === 'preview') setStep('live');
    else if (step === 'live') setStep('stats'); 
    else { 
      if (currentResult) markMatchIdAsSeen(currentResult.id); 
      router.push('/'); 
    }
  };

  if (isUserLoading || isGlobalLoading || !isLoaded || !user) return <LoadingScreen />;
  if (!currentResult) return <div className="p-20 text-center"><p className="text-muted-foreground uppercase text-[10px] font-black">Data error</p></div>;

  const t = {
    en: {
      reportTitle: "OFFICIAL MATCH DEBRIEF",
      next: "INITIATE LIVE", skip: "SKIP TO STATS", accept: "FINALIZE REVIEW", exit: "EXIT",
      home: "HOME", away: "AWAY", vs: "VS",
      comparison: "TEAM SKILL ANALYSIS",
      compFarm: "Resource Acquisition", compTactics: "Tactical Execution", compTeam: "Strategic Synergy", compRef: "Combat Reflexes"
    },
    ru: {
      reportTitle: "ОФИЦИАЛЬНЫЙ ОТЧЕТ",
      next: "В ЭФИР", skip: "К СТАТИСТИКЕ", accept: "ЗАВЕРШИТЬ ПРОСМОТР", exit: "ВЫЙТИ",
      home: "ДОМА", away: "В ГОСТЯХ", vs: "ПРОТИВ",
      comparison: "АНАЛИЗ НАВЫКОВ КОМАНД",
      compFarm: "Сбор ресурсов", compTactics: "Тактическая точность", compTeam: "Командная синергия", compRef: "Боевые рефлексы"
    }
  }[language as 'en' | 'ru'] || { reportTitle: "Report" };

  const renderStatsTable = (game: any) => {
    const scoreboard = game.scoreboard || [];
    const hName = currentResult.homeName;
    const aName = currentResult.awayName;
    const homeHeroes = scoreboard.filter((p: any) => p.team === hName);
    const awayHeroes = scoreboard.filter((p: any) => p.team === aName);

    const renderHeroRow = (p: any, side: 'left' | 'right') => (
      <div key={p.name} className={cn("flex items-center gap-3 p-2.5 rounded-lg border border-white/5 bg-secondary/10", p.isPro && "border-yellow-500/30 shadow-[0_0_10px_rgba(234,179,8,0.1)]", side === 'right' ? "flex-row-reverse text-right" : "text-left")}>
        <div className="relative shrink-0">
          <div className="w-10 h-10 rounded-lg overflow-hidden border border-white/10 bg-background flex items-center justify-center">
            {p.image ? <img src={p.image} alt="" className="w-full h-full object-cover" /> : <User className="w-5 h-5 text-muted-foreground" />}
          </div>
          {p.name === game.mvp && <Trophy className="absolute -top-1 -right-1 w-4 h-4 text-yellow-500 fill-yellow-500" />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-black uppercase truncate text-white">{p.name}</p>
          <div className={cn("flex items-center gap-2 mt-0.5", side === 'right' && "justify-end")}>
            <span className="text-[9px] font-mono font-bold text-primary">{p.kills}/{p.deaths}/{p.assists}</span>
            <span className="text-[8px] text-muted-foreground font-black">{p.cs} CS</span>
          </div>
        </div>
      </div>
    );

    return (
      <div className="space-y-8">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <p className="text-[8px] font-black uppercase tracking-widest text-primary mb-2 flex items-center gap-2 px-1"><ShieldCheck className="w-3 h-3" /> {t.home}</p>
            {homeHeroes.map(p => renderHeroRow(p, 'left'))}
          </div>
          <div className="space-y-2">
            <p className="text-[8px] font-black uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-2 justify-end px-1">{t.away} <Swords className="w-3 h-3" /></p>
            {awayHeroes.map(p => renderHeroRow(p, 'right'))}
          </div>
        </div>

        {game.teamComparison && (
          <section className="space-y-4">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-accent text-center">{t.comparison}</h3>
            <div className="space-y-4 bg-secondary/20 p-5 rounded-2xl border border-white/5">
              {[
                { label: t.compFarm, key: 'farm', icon: Coins },
                { label: t.compTactics, key: 'tactics', icon: Target },
                { label: t.compTeam, key: 'teamwork', icon: Users },
                { label: t.compRef, key: 'reflexes', icon: Zap }
              ].map(stat => (
                <div key={stat.key} className="space-y-1.5">
                  <div className="flex justify-between items-center text-[8px] font-black uppercase tracking-tighter">
                    <span className="text-primary">TEAM A: {game.teamComparison[stat.key][0]}%</span>
                    <span className="text-muted-foreground flex items-center gap-1"><stat.icon className="w-2.5 h-2.5" /> {stat.label}</span>
                    <span className="text-accent">TEAM B: {game.teamComparison[stat.key][1]}%</span>
                  </div>
                  <div className="h-1.5 w-full bg-secondary/50 rounded-full flex overflow-hidden">
                    <div className="h-full bg-primary" style={{ width: `${(game.teamComparison[stat.key][0] / (game.teamComparison[stat.key][0] + game.teamComparison[stat.key][1])) * 100}%` }} />
                    <div className="h-full bg-accent" style={{ width: `${(game.teamComparison[stat.key][1] / (game.teamComparison[stat.key][0] + game.teamComparison[stat.key][1])) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    );
  };

  const Coins = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><circle cx="8" cy="8" r="6"/><path d="M18.09 10.37A6 6 0 1 1 10.34 18.06"/><path d="M7 6h1v4"/><path d="m16.71 13.88.7.71-2.82 2.82"/></svg>
  );

  return (
    <div 
      className="min-h-screen bg-background text-foreground pb-32 relative overflow-hidden" 
      onClick={() => { if (step !== 'stats') handleNext(); }}
    >
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
          <div className="space-y-6 animate-in fade-in zoom-in-95 duration-500">
            <Card className="glass-card border-white/10 bg-gradient-to-br from-primary/10 to-transparent overflow-hidden">
              <div className="grid grid-cols-2 divide-x divide-white/5">
                <div className="p-6 flex flex-col items-center gap-3 text-center">
                  <div className="w-16 h-16 rounded-2xl bg-secondary/50 border border-primary/30 flex items-center justify-center shadow-xl text-3xl">🛡️</div>
                  <h3 className="text-[10px] font-headline font-bold uppercase truncate text-white">{currentResult.homeName}</h3>
                </div>
                <div className="p-6 flex flex-col items-center gap-3 text-center">
                  <div className="w-16 h-16 rounded-2xl bg-secondary/50 border border-white/10 flex items-center justify-center shadow-xl text-3xl">⚔️</div>
                  <h3 className="text-[10px] font-headline font-bold uppercase truncate text-white">{currentResult.awayName}</h3>
                </div>
              </div>
            </Card>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-secondary/20 p-4 rounded-xl border border-white/5 text-center">
                <Clock className="w-5 h-5 text-primary mx-auto mb-2" />
                <p className="text-[8px] font-black text-muted-foreground uppercase">PLAYED AT</p>
                <p className="text-lg font-headline font-bold text-white">{new Date(currentResult.playedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
              </div>
              <div className="bg-secondary/20 p-4 rounded-xl border border-white/5 text-center">
                <Target className="w-5 h-5 text-accent mx-auto mb-2" />
                <p className="text-[8px] font-black text-muted-foreground uppercase">TOURNAMENT</p>
                <p className="text-lg font-headline font-bold text-white uppercase">{currentResult.type}</p>
              </div>
            </div>
            <p className="text-[8px] text-center text-muted-foreground uppercase font-black animate-pulse pt-8 tracking-[0.3em]">CLICK ANYWHERE TO CONTINUE</p>
          </div>
        )}

        {step === 'live' && (
          <div className="space-y-4 animate-in slide-in-from-right-4 h-[60vh] flex flex-col duration-500">
            <div className="flex justify-between items-center px-1 mb-2">
               <Badge className="bg-red-600 text-white animate-pulse text-[8px] font-black uppercase px-3">LIVE: MAP {activeGameIdx + 1}</Badge>
               <span className="text-[10px] font-mono font-bold text-primary">{currentResult.seriesScore}</span>
            </div>
            <div className="flex-1 overflow-y-auto space-y-3 pr-2 scrollbar-hide" ref={scrollRef}>
              {visibleEvents.map((event, i) => (
                <Card key={i} className="glass-card border-white/5 bg-secondary/10 animate-in fade-in slide-in-from-bottom-1">
                  <CardContent className="p-3 flex gap-4">
                    <div className="w-12 shrink-0 flex flex-col items-center justify-center border-r border-white/5 pr-2">
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
          <div className="space-y-6 animate-in slide-in-from-right-4 pb-20 duration-500">
            <div className="text-center py-4">
              <div className="text-5xl font-headline font-black italic tracking-tighter flex items-center justify-center gap-4 text-white">
                <span className={cn(currentResult.scoreA > currentResult.scoreB && "text-primary")}>{currentResult.scoreA}</span>
                <span className="opacity-20 text-3xl">:</span>
                <span className={cn(currentResult.scoreB > currentResult.scoreA && "text-primary")}>{currentResult.scoreB}</span>
              </div>
              <Badge className="mt-4 text-[10px] font-black px-8 py-1 uppercase tracking-widest bg-primary/20 text-primary border-none">BATTLE CONCLUDED</Badge>
            </div>
            
            <Tabs defaultValue="map1" className="w-full">
              <TabsList className="bg-secondary/30 w-full grid grid-cols-2 h-12 p-1.5 rounded-2xl mb-6">
                <TabsTrigger value="map1" className="text-[10px] font-black uppercase rounded-xl">MAP 1</TabsTrigger>
                <TabsTrigger value="map2" disabled={currentResult.games.length < 2} className="text-[10px] font-black uppercase rounded-xl">MAP 2</TabsTrigger>
              </TabsList>
              {currentResult.games.map((game: any, idx: number) => (
                <TabsContent key={idx} value={`map${idx+1}`} className="space-y-6" onClick={(e) => e.stopPropagation()}>
                  <div className="p-4 bg-primary/5 border border-primary/20 rounded-2xl text-center">
                    <p className="text-[9px] text-primary/60 italic leading-relaxed">"{game.matchSummary}"</p>
                  </div>
                  {renderStatsTable(game)}
                </TabsContent>
              ))}
            </Tabs>

            <div className="pt-10">
               <Button 
                className="w-full h-14 hero-gradient font-black text-xs tracking-widest uppercase shadow-2xl active:scale-95 transition-all"
                onClick={handleNext}
               >
                 <Check className="w-4 h-4 mr-2" />
                 {t.accept}
               </Button>
            </div>
          </div>
        )}
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-50 bg-background/90 backdrop-blur-xl border-t border-white/10 h-24 flex items-center px-6">
        <div className="w-full max-md mx-auto flex gap-3">
          <Button variant="outline" className="flex-1 h-12 uppercase font-black text-[10px] border-white/10" onClick={(e) => { e.stopPropagation(); router.push('/'); }}>{t.exit}</Button>
          <Button className="flex-[2] h-12 hero-gradient font-black text-[10px] uppercase shadow-xl" onClick={handleNext}>
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
