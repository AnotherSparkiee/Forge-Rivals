
'use client';

/**
 * @fileOverview ОФИЦИАЛЬНЫЙ ПЛЕЕР МАТЧЕЙ v130 (V2 COLLECTIONS).
 * Работает с матчами из matches_v2 и игроками v14.
 */

import { useState, useEffect, useMemo, Suspense, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { useGameState } from '../lib/store';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  ChevronLeft, Swords, Activity, ArrowRight, 
  ShieldCheck, Zap, Target, Trophy, 
  User, ShieldAlert, Info, Users,
  Timer, ChevronRight, Crown,
  Skull, Activity as ActivityIcon, Castle, Radio,
  Package, Sparkles, Flame, HeartPulse, GraduationCap,
  Microscope, X, Shield
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { LoadingScreen } from '@/components/game/LoadingScreen';
import { doc, getDoc, collection, query, where } from 'firebase/firestore';

type MatchStep = 'preview' | 'live' | 'stats';

function MatchContent() {
  const { user, isUserLoading } = useUser();
  const router = useRouter();
  const searchParams = useSearchParams();
  const db = useFirestore();
  const { 
    language, isLoaded, markMatchIdAsSeen,
    matchHistory, clubLogo: myClubLogo, selectedLeagueId, leagueLevel, groupId, rank
  } = useGameState();

  const matchIdFromUrl = searchParams.get('id');
  const [step, setStep] = useState<MatchStep>('preview');
  const [matchData, setMatchData] = useState<any | null>(null);
  const [isDataLoading, setIsDataLoading] = useState(true);
  
  const [activeGameIdx, setActiveGameIdx] = useState(0);
  const [visibleEvents, setVisibleEvents] = useState<any[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  const groupPlayersQuery = useMemoFirebase(() => {
    if (!db || !selectedLeagueId) return null;
    return query(collection(db, 'players_v14'), 
      where('selectedLeagueId', '==', selectedLeagueId),
      where('leagueLevel', '==', leagueLevel),
      where('groupId', '==', groupId)
    );
  }, [db, selectedLeagueId, leagueLevel, groupId]);

  const { data: groupPlayers } = useCollection(groupPlayersQuery);

  const nameMap = useMemo(() => {
    const names: Record<number, string> = {};
    const logos: Record<number, string> = {};
    if (groupPlayers) {
      groupPlayers.forEach(p => {
        names[p.rank] = p.clubName || p.displayName;
        logos[p.rank] = p.clubLogo;
      });
    }
    return { names, logos };
  }, [groupPlayers]);

  useEffect(() => {
    if (!matchIdFromUrl || !db) {
      if (!matchIdFromUrl) setIsDataLoading(false);
      return;
    }

    const fetchMatch = async () => {
      setIsDataLoading(true);
      try {
        let snap = await getDoc(doc(db, 'matches_v2', matchIdFromUrl));
        
        if (snap.exists()) {
          setMatchData({ ...snap.data(), id: snap.id });
        } else {
          const hist = (matchHistory || []).find(m => m.id === matchIdFromUrl);
          if (hist) setMatchData(hist);
        }
      } catch (e) {
        console.error("Match fetch failed", e);
      } finally { setIsDataLoading(false); }
    };
    fetchMatch();
  }, [matchIdFromUrl, db, matchHistory]);

  const currentSimulation = useMemo(() => {
    if (!matchData) return null;
    return matchData.simulation || { 
      games: matchData.games || [matchData],
      seriesScore: matchData.seriesScore || `${matchData.scoreA}-${matchData.scoreB}`,
      winner: matchData.winner,
      isTbdWin: matchData.isTbdWin
    };
  }, [matchData]);

  const resolvedMatchData = useMemo(() => {
    if (!matchData) return null;
    
    if (matchData.homeRank && matchData.awayRank) {
      const hRank = Number(matchData.homeRank);
      const aRank = Number(matchData.awayRank);
      
      const botHome = `BOT_ALPHA_L${leagueLevel}_G${groupId}_R${hRank}`;
      const botAway = `BOT_ALPHA_L${leagueLevel}_G${groupId}_R${aRank}`;

      return {
        ...matchData,
        homeName: nameMap.names[hRank] || matchData.homeName || botHome,
        awayName: nameMap.names[aRank] || matchData.awayName || botAway,
        homeLogo: nameMap.logos[hRank] || matchData.homeLogo || null,
        awayLogo: nameMap.logos[aRank] || matchData.awayLogo || null,
      };
    }
    
    return matchData;
  }, [matchData, nameMap, leagueLevel, groupId]);

  useEffect(() => {
    if (step !== 'live' || !currentSimulation || !currentSimulation.games) return;
    if (currentSimulation.isTbdWin) { setStep('stats'); return; }
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
          setTimeout(() => { setActiveGameIdx(prev => prev + 1); setVisibleEvents([]); }, 1000); 
        } else { setTimeout(() => setStep('stats'), 1500); }
      }
    }, 400); 
    return () => clearInterval(timer);
  }, [step, activeGameIdx, currentSimulation]);

  const handleNext = (e?: React.MouseEvent) => {
    if (e && (e.target as HTMLElement).closest('[data-stop-propagation]')) return;
    if (step === 'preview') { if (currentSimulation?.isTbdWin) setStep('stats'); else setStep('live'); }
    else if (step === 'live') setStep('stats'); 
    else { if (matchIdFromUrl) markMatchIdAsSeen(matchIdFromUrl); router.push('/reports'); }
  };

  if (isUserLoading || isDataLoading || !isLoaded || !user) return <LoadingScreen />;
  if (!resolvedMatchData || !currentSimulation) return <div className="p-20 text-center"><p className="text-muted-foreground uppercase text-[10px] font-black">Match data not found</p></div>;

  const t = {
    en: {
      reportTitle: "OFFICIAL MATCH DEBRIEF",
      next: "WATCH TRANSCRIPTION", skip: "SKIP TO STATS", accept: "FINALIZE REVIEW", exit: "EXIT",
      home: "HOME", away: "AWAY", vs: "VS",
      comparison: "TEAM CUMULATIVE SKILL ANALYSIS",
      staffInfluence: "STAFF PERFORMANCE CONTRIBUTION",
      compFarm: "Total Resource Farm", compTactics: "Tactical Execution", compTeam: "Strategic Unity", compRef: "Combat Reflexes",
      tbdTitle: "TECHNICAL WIN SECURED",
      tbdDesc: "Opponent (TBD) failed to deploy for tactical engagement.",
      victory: "VICTORY:", draw: "MATCH DRAWN", map: "MAP"
    },
    ru: {
      reportTitle: "ОФИЦИАЛЬНЫЙ ОТЧЕТ БОЯ",
      next: "СМОТРЕТЬ ПОВТОР", skip: "К СТАТИСТИКЕ", accept: "ЗАВЕРШИТЬ ПРОСМОТР", exit: "ВЫЙТИ",
      home: "ДОМА", away: "В ГОСТЯХ", vs: "ПРОТИВ",
      comparison: "АНАЛИЗ СУММАРНЫХ НАВЫКОВ КОМАНД",
      staffInfluence: "ВКЛАД ПЕРСОНАЛА КЛУБА",
      compFarm: "Суммарный фарм", compTactics: "Тактическая точность", compTeam: "Стратегическое единство", compRef: "Боевые рефлексы",
      tbdTitle: "ТЕХНИЧЕСКАЯ ПОБЕДА",
      tbdDesc: "Соперник (TBD) не явился на поле боя.",
      victory: "ПОБЕДА:", draw: "НИЧЬЯ В СЕРИИ", map: "КАРТА"
    }
  }[language === 'ru' ? 'ru' : 'en'];

  const renderStatsTable = (game: any) => {
    if (currentSimulation.isTbdWin) {
      return (
        <div className="py-12 text-center animate-in zoom-in duration-700">
           <ShieldCheck className="w-20 h-20 text-green-500 mx-auto mb-6 drop-shadow-[0_0_15px_rgba(34,197,94,0.4)]" />
           <h2 className="text-2xl font-headline font-bold text-white uppercase mb-2">{t.tbdTitle}</h2>
           <p className="text-xs text-muted-foreground px-10 italic">"{t.tbdDesc}"</p>
        </div>
      );
    }

    const scoreboard = game.scoreboard || [];
    const homeHeroes = scoreboard.filter((p: any) => p.team === resolvedMatchData.homeName);
    const awayHeroes = scoreboard.filter((p: any) => p.team === resolvedMatchData.awayName);

    const renderHeroRow = (p: any, side: 'left' | 'right') => (
      <div key={p.name} className={cn("flex flex-col gap-1.5 p-3 rounded-2xl border border-white/5 bg-secondary/10 shadow-sm", side === 'right' ? "items-end text-right" : "items-start text-left")}>
        <div className={cn("flex items-center gap-3 w-full", side === 'right' && "flex-row-reverse")}>
          <div className="relative shrink-0">
            <div className="w-14 h-14 rounded-2xl overflow-hidden border border-white/10 bg-background flex items-center justify-center shadow-xl">
              {p.image ? <img src={p.image} alt="" className="w-full h-full object-cover" /> : <User className="w-7 h-7 text-muted-foreground" />}
            </div>
            {p.name === game.mvp && <Trophy className="absolute -top-1.5 -right-1.5 w-6 h-6 text-yellow-500 fill-yellow-500" />}
            <div className="absolute -bottom-1 -left-1 bg-black/90 rounded-lg px-2 py-0.5 border border-white/10 shadow-2xl">
              <span className="text-[10px] font-black text-accent">{Number(p.matchRating || 6.0).toFixed(1)}</span>
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[12px] font-black uppercase truncate text-white leading-none mb-1">{p.name}</p>
            <div className={cn("flex items-center gap-2", side === 'right' && "justify-end")}>
               <Badge variant="outline" className="text-[7px] h-4 px-1.5 border-white/10 opacity-70 uppercase font-black">{p.role}</Badge>
               <span className="text-10px] font-mono font-bold text-primary">{p.kills}/{p.deaths}/{p.assists}</span>
            </div>
          </div>
        </div>
      </div>
    );

    return (
      <div className="space-y-8" data-stop-propagation="true" onClick={(e) => e.stopPropagation()}>
        {game.teamComparison && (
          <section className="space-y-4">
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
                    <span className="text-primary text-base font-headline">{game.teamComparison[stat.key][0]}</span>
                    <span className="text-muted-foreground flex items-center gap-2 opacity-80 text-[10px]"><stat.icon className={cn("w-4 h-4", stat.color)} /> {stat.label}</span>
                    <span className="text-accent text-base font-headline">{game.teamComparison[stat.key][1]}</span>
                  </div>
                  <div className="h-2 w-full bg-background/50 rounded-full flex overflow-hidden border border-white/5">
                    <div className="h-full bg-primary" style={{ width: `${(game.teamComparison[stat.key][0] / Math.max(1, (game.teamComparison[stat.key][0] + game.teamComparison[stat.key][1]))) * 100}%` }} />
                    <div className="h-full bg-accent" style={{ width: `${(game.teamComparison[stat.key][1] / Math.max(1, (game.teamComparison[stat.key][0] + game.teamComparison[stat.key][1]))) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2.5"><p className="text-[9px] font-black uppercase tracking-widest text-primary mb-3">{t.home}</p>{homeHeroes.map(p => renderHeroRow(p, 'left'))}</div>
          <div className="space-y-2.5"><p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mb-3 text-right">{t.away}</p>{awayHeroes.map(p => renderHeroRow(p, 'right'))}</div>
        </div>
      </div>
    );
  };

  const isMeHome = resolvedMatchData.homeId === user?.uid || Number(resolvedMatchData.homeRank) === Number(rank);
  const isMeAway = resolvedMatchData.awayId === user?.uid || Number(resolvedMatchData.awayRank) === Number(rank);
  const isDraw = currentSimulation.winner === "Ничья" || currentSimulation.winner === "Draw";

  return (
    <div className="min-h-screen bg-background text-foreground pb-32 relative overflow-hidden" onClick={handleNext}>
      <div className="max-w-md mx-auto relative z-10 px-4 pt-6">
        <header className="text-center space-y-4 mb-8">
          <h1 className="text-sm font-headline font-bold text-white uppercase tracking-tighter">{t.reportTitle}</h1>
          <div className="flex items-center justify-center gap-2 max-w-[240px] mx-auto">
            <div className={cn("h-1 flex-1 rounded-full", step === 'preview' ? "bg-primary shadow-[0_0_10px_rgba(var(--primary),0.5)]" : "bg-primary/20")} />
            <div className={cn("h-1 flex-1 rounded-full", step === 'live' ? "bg-primary" : "bg-primary/20")} />
            <div className={cn("h-1 flex-1 rounded-full", step === 'stats' ? "bg-primary" : "bg-primary/20")} />
          </div>
        </header>

        {step === 'preview' && (
          <Card className="glass-card border-white/10 bg-gradient-to-br from-primary/10 to-transparent overflow-hidden">
            <div className="grid grid-cols-2 divide-x divide-white/5">
              <div className="p-6 flex flex-col items-center gap-4 text-center">
                <div className="w-20 h-20 rounded-2xl bg-secondary/50 border border-primary/30 flex items-center justify-center overflow-hidden p-2">
                  {isMeHome && myClubLogo ? <img src={myClubLogo} alt="" className="w-full h-full object-contain" /> : <div className="text-4xl">🛡️</div>}
                </div>
                <h3 className="text-[11px] font-headline font-bold uppercase truncate text-white leading-tight">{resolvedMatchData.homeName}</h3>
              </div>
              <div className="p-6 flex flex-col items-center gap-4 text-center">
                <div className="w-20 h-20 rounded-2xl bg-secondary/50 border border-white/10 flex items-center justify-center overflow-hidden p-2">
                  {isMeAway && myClubLogo ? <img src={myClubLogo} alt="" className="w-full h-full object-contain" /> : <div className="text-4xl">⚔️</div>}
                </div>
                <h3 className="text-[11px] font-headline font-bold uppercase truncate text-white leading-tight">{resolvedMatchData.awayName}</h3>
              </div>
            </div>
          </Card>
        )}

        {step === 'stats' && (
          <div className="space-y-6 animate-in slide-in-from-right-4 pb-20">
            <div className="text-center py-6">
              <div className="flex items-center justify-center gap-2 mb-4 px-2">
                <span className="text-4xl font-headline font-black italic text-white">{resolvedMatchData.scoreA} : {resolvedMatchData.scoreB}</span>
              </div>
              <Badge className={cn("mt-2 text-[10px] font-black px-8 py-1 uppercase tracking-widest", currentSimulation.isTbdWin ? "bg-green-500/20 text-green-400" : (isDraw ? "bg-secondary" : "bg-primary/20 text-primary"))}>
                {currentSimulation.isTbdWin ? 'TECHNICAL VICTORY' : (isDraw ? t.draw : `${t.victory} ${currentSimulation.winner}`)}
              </Badge>
            </div>
            {currentSimulation.games.map((game: any, idx: number) => (
              <div key={idx} className="mt-4">{renderStatsTable(game)}</div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function MatchPage() { return <Suspense fallback={<LoadingScreen />}><MatchContent /></Suspense>; }
