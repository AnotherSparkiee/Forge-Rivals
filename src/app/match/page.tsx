'use client';

import { useState, useEffect, useMemo, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { useGameState } from '../lib/store';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { 
  ChevronLeft, Check, Swords, Activity, Map, ArrowRight, TrendingUp,
  ShieldCheck, Brain, Zap, Target, FileText,
  Users, Signal, EyeOff, Calendar, MapPin, Trophy, Clock, Medal,
  ShieldAlert, RefreshCw, MousePointer2
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { LoadingScreen } from '@/components/game/LoadingScreen';
import { doc } from 'firebase/firestore';
import { COUNTRIES } from '../lib/countries-data';

type MatchStep = 'preview' | 'live' | 'stats';

function MatchContent() {
  const { user, isUserLoading } = useUser();
  const router = useRouter();
  const searchParams = useSearchParams();
  const db = useFirestore();
  const { 
    language, isLoaded, markMatchAsSeen, lastSeenMatchDay,
    matchHistory
  } = useGameState();

  const matchId = searchParams.get('id');
  const [step, setStep] = useState<MatchStep>('preview');

  const userRef = useMemoFirebase(() => user ? doc(db, 'players_v5', user.uid) : null, [db, user]);
  const { data: profile } = useDoc(userRef);

  useEffect(() => {
    if (!isUserLoading && !user) {
      router.push('/auth/login');
    }
  }, [user, isUserLoading, router]);

  // Logic to pick the correct match to display
  const currentResult = useMemo(() => {
    // 1. If explicit ID provided (historical view)
    if (matchId) {
      const match = matchHistory.find(m => m.id === matchId);
      if (match) return match;
    }
    
    // 2. If no ID, find the OLDEST unseen league match (sequential progression)
    const unseenLeagueMatches = matchHistory
      .filter(m => m.type === 'league' && m.day > lastSeenMatchDay)
      .sort((a, b) => a.day - b.day);

    if (unseenLeagueMatches.length > 0) {
      return unseenLeagueMatches[0];
    }

    // 3. Fallback: pick the latest match that has data
    const sortedHistory = [...matchHistory].sort((a, b) => {
      const timeA = new Date(a.playedAt).getTime();
      const timeB = new Date(b.playedAt).getTime();
      return timeB - timeA;
    });

    return sortedHistory.find(m => m.preview !== undefined) || sortedHistory[0] || null;
  }, [matchHistory, matchId, lastSeenMatchDay]);

  const isHistoricalViewing = !!matchId;

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [step]);

  const handleAcknowledgeMatch = () => {
    if (currentResult && !isHistoricalViewing) {
      // Mark as seen. This unlocks the next match in the sequence.
      markMatchAsSeen(currentResult.day);
      router.push('/');
    } else {
      router.push('/matches');
    }
  };

  const handleNext = () => {
    if (!currentResult) return;

    const isTechnicalResult = currentResult.opponentName === 'WAITING' || currentResult.opponentName === 'SEEDED';
    
    // Technical matches skip the Live stage
    if (isTechnicalResult) {
      if (step === 'stats') {
        handleAcknowledgeMatch();
      } else {
        setStep('stats');
      }
      return;
    }

    if (step === 'preview') setStep('live');
    else if (step === 'live') setStep('stats');
    else handleAcknowledgeMatch();
  };

  const handleButtonClick = (e: React.MouseEvent, action: () => void) => {
    e.stopPropagation();
    action();
  };

  if (isUserLoading || !isLoaded || !user) {
    return <LoadingScreen />;
  }

  const userCountry = COUNTRIES.find(c => c.name === profile?.country);
  const myFlag = userCountry?.flag || '🏳️';

  const labels = {
    en: {
      reportTitle: "TACTICAL AFTER-ACTION REPORT",
      next: "NEXT",
      accept: "CONFIRM",
      exit: "EXIT",
      preview: "Match Preview",
      live: "2D Field Review",
      stats: "Post-Match Dossier",
      vs: "VS",
      winProb: "Win Probability",
      keyMatchup: "Key Tactical Matchup",
      timeline: "Tactical Timeline",
      analysis: "Architectural Analysis",
      scoreboard: "Scoreboard",
      duration: "Duration",
      mvp: "Unit MVP",
      orv: "AVG OVR",
      legacyMsg: "Deciphering match data...",
      home: "HOME",
      away: "AWAY",
      arena: "ARENA",
      spectators: "SPECTATORS",
      technicalWin: "TECHNICAL PROGRESSION",
      technicalDesc: "Automatic victory due to seeded bracket position or lack of qualifiers. Tactical data not generated for non-combat encounters.",
      clickToContinue: "TAP ANYWHERE TO CONTINUE",
      tournamentTypes: {
        league: "PRO LEAGUE",
        tournament: "PYRAMID CUP",
        friendly: "FRIENDLY MATCH",
        basket: "CW BASKET"
      }
    },
    ru: {
      reportTitle: "ТАКТИЧЕСКИЙ ОТЧЕТ ПОСЛЕ БОЯ",
      next: "ДАЛЕЕ",
      accept: "ПОДТВЕРДИТЬ",
      exit: "ВЫЙТИ",
      preview: "Превью матча",
      live: "2D Обзор игры",
      stats: "Итоговая статистика",
      vs: "ПРОТИВ",
      winProb: "Вероятность победы",
      keyMatchup: "Ключевое противостояние",
      timeline: "Хронология боя",
      analysis: "Архитектурный анализ",
      scoreboard: "Таблица игроков",
      duration: "Длительность",
      mvp: "MVP отряда",
      orv: "Средний OVR",
      legacyMsg: "Дешифровка данных матча...",
      home: "ДОМА",
      away: "В ГОСТЯХ",
      arena: "АРЕНА",
      spectators: "ЗРИТЕЛИ",
      technicalWin: "ТЕХНИЧЕСКАЯ ПРОГРЕССИЯ",
      technicalDesc: "Автоматическая победа из-за позиции в сетке или отсутствия квалифицированного соперника. Тактический отчет для небоевых вылетов не формируется.",
      clickToContinue: "НАЖМИТЕ В ЛЮБОМ МЕСТЕ ДЛЯ ПРОДОЛЖЕНИЯ",
      tournamentTypes: {
        league: "ПРОФ. ЛИГА",
        tournament: "КУБОК ПИРАМИДЫ",
        friendly: "ТОВ. МАТЧ",
        basket: "КВ КОРЗИНА"
      }
    }
  };

  const t = labels[language as keyof typeof labels] || labels.ru;

  const isTechnicalResult = currentResult?.opponentName === 'WAITING' || currentResult?.opponentName === 'SEEDED';

  const renderPreview = () => {
    if (isTechnicalResult) {
      return (
        <div className="py-12 space-y-6 animate-in fade-in duration-500">
          <Card className="glass-card border-accent/20 bg-accent/5 p-8 text-center">
            <ShieldCheck className="w-16 h-16 text-accent mx-auto mb-4 animate-pulse" />
            <h2 className="text-xl font-headline font-bold text-white uppercase">{t.technicalWin}</h2>
            <p className="text-xs text-muted-foreground mt-4 leading-relaxed italic">{t.technicalDesc}</p>
            <Badge className="mt-6 bg-accent text-accent-foreground text-[8px] font-black uppercase tracking-widest h-5">
              AUTOMATIC ADVANCEMENT
            </Badge>
          </Card>
        </div>
      );
    }

    const preview = (currentResult as any)?.preview;
    if (!preview) return (
      <div className="py-20 text-center opacity-50 space-y-4">
        <Activity className="w-12 h-12 mx-auto text-muted-foreground animate-pulse" />
        <p className="text-[10px] uppercase font-black tracking-widest px-10">{t.legacyMsg}</p>
      </div>
    );

    const tourLabel = t.tournamentTypes[currentResult?.type as keyof typeof t.tournamentTypes] || currentResult?.type?.toUpperCase();
    const playedDate = currentResult?.playedAt ? new Date(currentResult.playedAt).toLocaleDateString(language === 'ru' ? 'ru-RU' : 'en-US', { day: 'numeric', month: 'long', year: 'numeric' }) : '--';
    const arenaCapacity = profile?.arena?.capacity || 5000;
    const spectators = Math.floor(arenaCapacity * (0.85 + Math.random() * 0.15));

    return (
      <div className="space-y-6 animate-in fade-in duration-500">
        <div className="bg-secondary/30 rounded-xl border border-white/5 p-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="w-3.5 h-3.5 text-primary" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{playedDate}</span>
          </div>
          <Badge variant="outline" className="border-primary/30 text-primary text-[8px] font-black uppercase tracking-widest px-2">
            {tourLabel}
          </Badge>
        </div>

        <Card className="glass-card border-white/10 bg-gradient-to-br from-primary/10 to-transparent overflow-hidden">
          <CardContent className="p-0">
            <div className="grid grid-cols-2 divide-x divide-white/5">
              <div className="p-6 flex flex-col items-center gap-3 text-center">
                <div className="relative">
                  <div className="w-16 h-16 rounded-2xl bg-secondary/50 border border-primary/30 flex items-center justify-center shadow-xl">
                    <span className="text-3xl">{myFlag}</span>
                  </div>
                  <Badge className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-[7px] font-black uppercase px-2 h-4 border-none">
                    {t.home}
                  </Badge>
                </div>
                <h3 className="text-xs font-headline font-bold uppercase tracking-tight text-white mt-1">
                  {profile?.displayName || "MY TEAM"}
                </h3>
              </div>

              <div className="p-6 flex flex-col items-center gap-3 text-center">
                <div className="relative">
                  <div className="w-16 h-16 rounded-2xl bg-secondary/50 border-white/10 flex items-center justify-center shadow-xl">
                    <span className="text-3xl">🏳️</span>
                  </div>
                  <Badge variant="outline" className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-background border-white/20 text-muted-foreground text-[7px] font-black uppercase px-2 h-4">
                    {t.away}
                  </Badge>
                </div>
                <h3 className="text-xs font-headline font-bold uppercase tracking-tight text-white mt-1">
                  {currentResult?.opponentName}
                </h3>
              </div>
            </div>

            <div className="bg-black/40 border-t border-white/5 p-3 flex items-center justify-around">
              <div className="flex items-center gap-2">
                <MapPin className="w-3 h-3 text-accent" />
                <div>
                  <p className="text-[7px] font-black text-muted-foreground uppercase">{t.arena}</p>
                  <p className="text-[9px] font-bold text-accent uppercase">Operational HQ</p>
                </div>
              </div>
              <div className="h-6 w-px bg-white/5"></div>
              <div className="flex items-center gap-2">
                <Users className="w-3 h-3 text-primary" />
                <div>
                  <p className="text-[7px] font-black text-muted-foreground uppercase">{t.spectators}</p>
                  <p className="text-[9px] font-bold text-primary tabular-nums">{spectators.toLocaleString()}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-2 gap-4">
          <Card className="bg-primary/5 border-primary/20 p-4 text-center">
            <p className="text-[10px] uppercase font-black text-muted-foreground mb-1">{t.orv}</p>
            <p className="text-2xl font-headline font-bold text-primary">{preview.teamAOrv}</p>
          </Card>
          <Card className="bg-accent/5 border-accent/20 p-4 text-center">
            <p className="text-[10px] uppercase font-black text-muted-foreground mb-1">{t.orv}</p>
            <p className="text-2xl font-headline font-bold text-accent">{preview.teamBOrv}</p>
          </Card>
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-2 px-1">
            <TrendingUp className="w-4 h-4 text-primary" />
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">{t.winProb}</h3>
          </div>
          <Card className="glass-card p-6 flex flex-col items-center">
            <div className="w-full flex justify-between text-[10px] font-bold uppercase mb-2">
              <span className="text-primary">{profile?.displayName || 'YOU'} {preview.winProbabilityA}%</span>
              <span className="text-accent">{currentResult?.opponentName} {100 - preview.winProbabilityA}%</span>
            </div>
            <div className="w-full h-2 bg-secondary rounded-full overflow-hidden flex">
              <div className="h-full bg-primary" style={{ width: `${preview.winProbabilityA}%` }}></div>
              <div className="h-full bg-accent" style={{ width: `${100 - preview.winProbabilityA}%` }}></div>
            </div>
          </Card>
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-2 px-1">
            <Target className="w-4 h-4 text-accent" />
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-accent">{t.keyMatchup}</h3>
          </div>
          <Card className="glass-card p-6 bg-accent/5 border-accent/10">
            <p className="text-xs leading-relaxed text-blue-100 italic text-center">
              "{preview.keyMatchup}"
            </p>
          </Card>
        </div>
      </div>
    );
  };

  const renderLive = () => {
    if (isTechnicalResult) {
      return (
        <div className="py-20 text-center opacity-30 flex flex-col items-center gap-4">
          <Signal className="w-16 h-16 text-muted-foreground" />
          <p className="text-[10px] uppercase font-black tracking-widest">LIVE SIGNAL UNAVAILABLE FOR TECHNICAL PROCEEDING</p>
        </div>
      );
    }

    const timeline = (currentResult as any)?.timeline;
    if (!timeline || timeline.length === 0) return (
      <div className="py-20 text-center opacity-50 space-y-4">
        <Map className="w-12 h-12 mx-auto text-muted-foreground animate-pulse" />
        <p className="text-[10px] uppercase font-black tracking-widest px-10">{t.legacyMsg}</p>
      </div>
    );

    return (
      <div className="space-y-4 animate-in slide-in-from-right-4 duration-500">
        <div className="flex items-center gap-2 px-1">
          <Map className="w-4 h-4 text-primary" />
          <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">{t.timeline}</h3>
        </div>
        <div className="space-y-3">
          {timeline.map((event: any, i: number) => (
            <Card key={i} className="glass-card border-white/5 bg-secondary/20">
              <CardContent className="p-4 flex gap-4">
                <div className="flex flex-col items-center gap-1 shrink-0 w-12 border-r border-white/5">
                  <span className="text-[10px] font-mono font-bold text-accent">{event.time}</span>
                  <Badge variant="outline" className="text-[7px] px-1 py-0 border-primary/30 text-primary">{event.phase}</Badge>
                </div>
                <div className="flex-1 space-y-2">
                  <p className="text-sm leading-relaxed text-muted-foreground">{event.event}</p>
                  <div className="flex justify-end">
                    <Badge className="bg-black/40 text-[9px] font-mono font-bold text-white border-white/10">{event.score}</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  };

  const renderStats = () => {
    const post = (currentResult as any)?.postMatch;
    if (isTechnicalResult || !post) return (
      <div className="space-y-6 animate-in slide-in-from-right-4 duration-500">
        <div className="text-center py-12">
          <Badge className="bg-green-500/20 text-green-400 font-black italic text-lg px-6 h-10 mb-4">
            {currentResult?.scoreA} : {currentResult?.scoreB}
          </Badge>
          <p className="text-xs text-muted-foreground uppercase font-black tracking-widest">{t.technicalWin}</p>
        </div>
        <Card className="glass-card p-6 bg-primary/5">
          <p className="text-xs leading-relaxed italic">{currentResult?.matchSummary}</p>
        </Card>
      </div>
    );

    return (
      <div className="space-y-6 animate-in slide-in-from-right-4 duration-500 pb-10">
        <div className="grid grid-cols-2 gap-3">
          <Card className="glass-card bg-primary/5 border-primary/20 p-4 text-center">
            <Medal className="w-5 h-5 text-yellow-500 mx-auto mb-2 animate-bounce" />
            <p className="text-[8px] uppercase font-black text-muted-foreground">{t.mvp}</p>
            <p className="text-sm font-headline font-bold text-primary uppercase truncate">{currentResult?.mvp || 'UNKNOWN'}</p>
          </Card>
          <Card className="glass-card bg-accent/5 border-accent/20 p-4 text-center">
            <Clock className="w-5 h-5 text-accent mx-auto mb-2" />
            <p className="text-[8px] uppercase font-black text-muted-foreground">{t.duration}</p>
            <p className="text-sm font-headline font-bold text-accent">{currentResult?.duration || '35:00'}</p>
          </Card>
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-2 px-1">
            <Activity className="w-4 h-4 text-accent" />
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-accent">Unit Performance Indices</h3>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: 'Laning', icon: Swords, a: post.lineRatings?.laning?.a || 0, b: post.lineRatings?.laning?.b || 0 },
              { label: 'Teamfight', icon: Users, a: post.lineRatings?.teamfight?.a || 0, b: post.lineRatings?.teamfight?.b || 0 },
              { label: 'Macro', icon: Signal, a: post.lineRatings?.macro?.a || 0, b: post.lineRatings?.macro?.b || 0 },
              { label: 'Mental', icon: Brain, a: post.lineRatings?.mental?.a || 0, b: post.lineRatings?.mental?.b || 0 },
            ].map(r => (
              <Card key={r.label} className="bg-secondary/20 border-white/5 p-3 flex flex-col items-center">
                <r.icon className="w-3 h-3 text-muted-foreground mb-1" />
                <p className="text-[8px] uppercase font-black text-muted-foreground mb-2">{r.label}</p>
                <div className="flex items-center gap-3 w-full justify-center">
                  <span className="text-[10px] font-bold text-primary">{r.a}</span>
                  <div className="h-1 flex-1 bg-secondary rounded-full overflow-hidden flex max-w-[40px]">
                    <div className="h-full bg-primary" style={{ width: `${(r.a / (r.a + r.b + 0.1)) * 100}%` }}></div>
                    <div className="h-full bg-accent" style={{ width: `${(r.b / (r.a + r.b + 0.1)) * 100}%` }}></div>
                  </div>
                  <span className="text-[10px] font-bold text-accent">{r.b}</span>
                </div>
              </Card>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-2 px-1">
            <FileText className="w-4 h-4 text-primary" />
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">{t.scoreboard}</h3>
          </div>
          <Card className="glass-card border-white/5 bg-secondary/10 overflow-hidden">
            <div className="p-2 border-b border-white/5 bg-black/20 grid grid-cols-12 text-[7px] font-black uppercase text-muted-foreground tracking-widest text-center">
              <div className="col-span-6 text-left pl-2">Personnel</div>
              <div className="col-span-3">K/D/A</div>
              <div className="col-span-3">GPM</div>
            </div>
            <div className="divide-y divide-white/5">
              {(post.scoreboard || []).map((row: any, i: number) => (
                <div key={i} className={cn(
                  "p-2 grid grid-cols-12 items-center text-[9px] font-bold uppercase",
                  row.team === 'A' ? "text-primary/80" : "text-accent/80"
                )}>
                  <div className="col-span-6 truncate flex items-center gap-2">
                    <div className={cn("w-1 h-1 rounded-full", row.team === 'A' ? "bg-primary" : "bg-accent")} />
                    {row.name}
                  </div>
                  <div className="col-span-3 text-center font-mono">{row.kda}</div>
                  <div className="col-span-3 text-center text-yellow-500/80">€{row.gpm}</div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-2 px-1">
            <ShieldCheck className="w-4 h-4 text-green-400" />
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-green-400">{t.analysis}</h3>
          </div>
          <Card className="glass-card border-green-500/20 bg-green-500/5 p-6 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-0.5 bg-green-500/20 animate-pulse"></div>
            <p className="text-sm leading-relaxed text-green-100 italic whitespace-pre-wrap">
              {post.analysis}
            </p>
          </Card>
        </div>
      </div>
    );
  };

  if (!currentResult) return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center space-y-4">
      <Zap className="w-12 h-12 text-primary animate-pulse" />
      <h2 className="text-xl font-headline font-bold uppercase">Awaiting Data Feed</h2>
      <p className="text-xs text-muted-foreground uppercase tracking-widest">Tactical history not yet established.</p>
      <Button onClick={() => router.push('/')} variant="outline" className="mt-4 border-white/10 uppercase font-black text-[10px]">Back to HQ</Button>
    </div>
  );

  return (
    <div 
      className="min-h-screen bg-background text-foreground pb-32 cursor-pointer select-none"
      onClick={handleNext}
    >
      <div className="fixed inset-0 pointer-events-none opacity-5 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:30px_30px]"></div>

      <div className="max-w-md mx-auto relative z-10 px-4 pt-6">
        <header className="text-center space-y-4 mb-8">
          <div className="flex flex-col items-center gap-2">
            <Badge variant="outline" className="bg-primary/5 border-primary/20 text-primary text-[8px] font-black uppercase tracking-[0.2em] px-3">
              {currentResult.type.toUpperCase()} ENGAGEMENT
            </Badge>
            <h1 className="text-sm font-headline font-bold text-white uppercase tracking-tighter">
              {t.reportTitle}
            </h1>
          </div>

          <div className="flex items-center justify-center gap-2 max-w-[240px] mx-auto">
            <div className={cn("h-1 flex-1 rounded-full transition-all duration-500", step === 'preview' ? "bg-primary shadow-[0_0_10px_rgba(var(--primary),0.5)]" : "bg-primary/20")} />
            <div className={cn("h-1 flex-1 rounded-full transition-all duration-500", step === 'live' ? "bg-primary shadow-[0_0_10px_rgba(var(--primary),0.5)]" : "bg-primary/20")} />
            <div className={cn("h-1 flex-1 rounded-full transition-all duration-500", step === 'stats' ? "bg-primary shadow-[0_0_10px_rgba(var(--primary),0.5)]" : "bg-primary/20")} />
          </div>
          <p className="text-[10px] font-black text-accent uppercase tracking-widest">{step === 'preview' ? t.preview : step === 'live' ? t.live : t.stats}</p>
        </header>

        <Card className="glass-card border-primary/20 bg-gradient-to-b from-primary/10 to-transparent overflow-hidden mb-8">
          <CardContent className="p-0">
            <div className="grid grid-cols-3 items-center p-6">
              <div className="flex flex-col items-center gap-3 text-center min-w-0">
                <div className="w-12 h-12 rounded-xl bg-secondary/50 border border-white/5 flex items-center justify-center shadow-xl">
                  <span className="text-2xl">{myFlag}</span>
                </div>
                <p className="text-[9px] font-headline font-bold uppercase truncate w-full text-white">
                  {profile?.displayName || "MY TEAM"}
                </p>
              </div>

              <div className="flex flex-col items-center justify-center">
                {step === 'stats' ? (
                  <>
                    <div className="text-3xl font-headline font-black italic tracking-tighter flex items-center gap-3 animate-in zoom-in duration-500">
                      <span className={cn(currentResult.scoreA > currentResult.scoreB && "text-primary")}>{currentResult.scoreA}</span>
                      <span className="opacity-20">:</span>
                      <span className={cn(currentResult.scoreB > currentResult.scoreA && "text-primary")}>{currentResult.scoreB}</span>
                    </div>
                    <Badge className={cn(
                      "mt-3 text-[7px] font-black tracking-widest",
                      currentResult.scoreA > currentResult.scoreB ? "bg-green-500/20 text-green-400" : (currentResult.scoreA === currentResult.scoreB ? "bg-accent/20 text-accent" : "bg-red-500/20 text-red-400")
                    )}>
                      {currentResult.scoreA > currentResult.scoreB ? "VICTORY" : (currentResult.scoreA === currentResult.scoreB ? "DRAW" : "DEFEAT")}
                    </Badge>
                  </>
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <div className="text-3xl font-headline font-black italic tracking-tighter opacity-40">
                      {t.vs}
                    </div>
                    <Badge variant="outline" className="text-[6px] font-black tracking-widest border-primary/20 text-primary uppercase">
                      {step === 'preview' ? 'PRE-GAME' : 'LIVE FEED'}
                    </Badge>
                  </div>
                )}
              </div>

              <div className="flex flex-col items-center gap-3 text-center min-w-0">
                <div className="w-12 h-12 rounded-xl bg-secondary/50 border border-white/5 flex items-center justify-center shadow-xl">
                  <span className="text-2xl">🏳️</span>
                </div>
                <p className="text-[9px] font-headline font-bold uppercase truncate w-full text-white">
                  {currentResult.opponentName}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="min-h-[400px]">
          {step === 'preview' && renderPreview()}
          {step === 'live' && renderLive()}
          {step === 'stats' && renderStats()}
        </div>

        {step !== 'stats' && (
          <div className="mt-8 flex flex-col items-center gap-2 animate-bounce opacity-40">
            <MousePointer2 className="w-4 h-4 text-muted-foreground" />
            <p className="text-[8px] font-black uppercase tracking-widest">{t.clickToContinue}</p>
          </div>
        )}
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-50 bg-background/90 backdrop-blur-xl border-t border-white/10 h-24 flex items-center shadow-[0_-15px_40px_rgba(0,0,0,0.6)]">
        <div className="w-full max-w-lg mx-auto px-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 w-full">
            <Button 
              type="button"
              onClick={(e) => handleButtonClick(e, () => router.back())}
              variant="outline"
              className="h-12 flex-1 border-white/10 font-black text-[10px] uppercase tracking-widest"
            >
              {t.exit}
            </Button>
            <Button 
              type="button"
              onClick={(e) => handleButtonClick(e, handleNext)}
              className="h-12 flex-[2] hero-gradient border-none font-black text-[10px] uppercase tracking-widest shadow-lg shadow-primary/20 group"
            >
              {step === 'stats' ? <Check className="w-4 h-4 mr-2" /> : <ArrowRight className="w-4 h-4 mr-2 group-hover:translate-x-1 transition-transform" />}
              {step === 'stats' ? t.accept : t.next}
            </Button>
          </div>
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
