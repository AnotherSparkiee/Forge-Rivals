'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@/firebase';
import { useGameState } from '../lib/store';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Swords, Loader2, Trophy, Skull, Crosshair, ChevronLeft, CalendarClock } from 'lucide-react';
import { simulateMobaMatch, SimulateMobaMatchOutput } from '@/ai/flows/simulate-moba-match';
import { INITIAL_HEROES } from '../lib/moba-data';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { LoadingScreen } from '@/components/game/LoadingScreen';

export default function MatchPage() {
  const { user, isUserLoading } = useUser();
  const router = useRouter();
  const { team, strategy, recordMatch, matchHistory, language, isLoaded } = useGameState();
  const [isSimulating, setIsSimulating] = useState(false);
  const [matchResult, setMatchResult] = useState<SimulateMobaMatchOutput | null>(null);
  const [showSetup, setShowSetup] = useState(false);

  useEffect(() => {
    if (!isUserLoading && !user) {
      router.push('/auth/login');
    }
  }, [user, isUserLoading, router]);

  if (isUserLoading || !isLoaded || !user) {
    return <LoadingScreen />;
  }

  const runSimulation = async () => {
    setIsSimulating(true);
    setMatchResult(null);
    try {
      const opponentTeam = {
        name: "Shadow Realm Challengers",
        strategy: "All-in Aggression",
        heroes: INITIAL_HEROES.map(h => ({
          ...h,
          baseStats: { ...h.baseStats, attack: h.baseStats.attack + 5 }
        }))
      };

      const result = await simulateMobaMatch({
        teamA: {
          name: "My Team",
          strategy: strategy,
          heroes: team
        },
        teamB: opponentTeam,
        includeRandomEvents: true,
        isBo2: true
      });

      setMatchResult(result);
      recordMatch(result.winner, result);
      setShowSetup(false);
    } catch (error) {
      console.error(error);
    } finally {
      setIsSimulating(false);
    }
  };

  const labels = {
    en: {
      title: "WAR ROOM",
      subtitle: "Tactical match analysis",
      setupTitle: "New Deployment",
      setupDesc: "Configure and start a training simulation",
      startBtn: "START SIMULATION",
      lastReport: "LATEST MATCH REPORT",
      noHistory: "No match reports available. Start your first simulation.",
      newMatch: "NEW SIMULATION",
      summary: "Match Summary",
      victory: "VICTORY",
      draw: "DRAW",
      defeat: "DEFEAT",
      return: "RETURN TO HUB"
    },
    ru: {
      title: "КОМАНДНЫЙ ЦЕНТР",
      subtitle: "Тактический анализ матчей",
      setupTitle: "Новое развертывание",
      setupDesc: "Настройте и запустите тренировочный бой",
      startBtn: "НАЧАТЬ СИМУЛЯЦИЮ",
      lastReport: "ОТЧЕТ ПОСЛЕДНЕГО МАТЧА",
      noHistory: "История матчей пуста. Запустите свою первую симуляцию.",
      newMatch: "НОВОЕ РАЗВЕРТЫВАНИЕ",
      summary: "Обзор матча",
      victory: "ПОБЕДА",
      draw: "НИЧЬЯ",
      defeat: "ПОРАЖЕНИЕ",
      return: "В ГЛАВНЫЙ ХАБ"
    }
  };

  const t = labels[language as keyof typeof labels] || labels.ru;

  // If we have a fresh simulation result, show it. Otherwise show the latest from history.
  const currentResult = matchResult || (matchHistory.length > 0 ? matchHistory[0] as SimulateMobaMatchOutput : null);

  if (isSimulating) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] space-y-6">
        <div className="relative">
          <Loader2 className="w-20 h-20 text-primary animate-spin" />
          <Swords className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 text-accent animate-pulse" />
        </div>
        <div className="text-center space-y-2">
          <h2 className="text-xl font-headline font-bold animate-pulse text-accent uppercase tracking-widest">
            {language === 'ru' ? 'РАСЧЕТ ИСХОДА...' : 'CALCULATING OUTCOME...'}
          </h2>
          <p className="text-sm text-muted-foreground italic max-w-xs mx-auto">
            {language === 'ru' ? '"Анализ траекторий и синергии героев"' : '"Analyzing jungle pathing and teamfight synergies"'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto px-4 pt-8 pb-12">
      <header className="mb-6 flex items-center gap-4">
        <Link href="/">
          <Button variant="ghost" size="icon" className="rounded-full">
            <ChevronLeft className="w-6 h-6" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-headline font-bold uppercase tracking-tighter">{t.title}</h1>
          <p className="text-muted-foreground text-[10px] uppercase tracking-widest">{t.subtitle}</p>
        </div>
      </header>

      {/* SETUP VIEW */}
      {(showSetup || !currentResult) && (
        <div className="space-y-6 animate-in fade-in duration-500">
          <Card className="glass-card border-accent/20">
            <CardHeader>
              <CardTitle className="text-base uppercase tracking-wider font-headline text-accent">{t.setupTitle}</CardTitle>
              <p className="text-[10px] text-muted-foreground">{t.setupDesc}</p>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide mb-4">
                {team.map((hero) => (
                  <div key={hero.id} className="w-14 flex-shrink-0">
                    <div className="aspect-[3/4] rounded-md overflow-hidden bg-muted border border-white/5">
                      <img src={hero.image} alt={hero.name} className="w-full h-full object-cover" />
                    </div>
                  </div>
                ))}
              </div>
              <div className="space-y-3 pt-3 border-t border-white/5">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-muted-foreground">Active Strategy</span>
                  <Badge variant="secondary" className="text-[9px] uppercase">{strategy}</Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          <Button 
            onClick={runSimulation} 
            disabled={team.length === 0}
            className="w-full h-16 hero-gradient font-headline font-bold text-lg shadow-lg hover:opacity-90 transition-all"
          >
            <Swords className="mr-2 w-6 h-6" />
            {t.startBtn}
          </Button>

          {matchHistory.length > 0 && (
            <Button 
              variant="ghost" 
              onClick={() => setShowSetup(false)} 
              className="w-full text-xs text-muted-foreground"
            >
              Cancel
            </Button>
          )}
        </div>
      )}

      {/* REPORT VIEW */}
      {currentResult && !showSetup && (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="flex items-center justify-between mb-4 px-1">
            <h2 className="text-xs font-bold uppercase tracking-widest text-accent flex items-center gap-2">
              <CalendarClock className="w-4 h-4" /> {t.lastReport}
            </h2>
            <Button size="sm" variant="outline" className="h-7 text-[9px] uppercase font-bold border-white/10" onClick={() => setShowSetup(true)}>
              {t.newMatch}
            </Button>
          </div>

          <div className={cn(
            "rounded-xl p-6 text-center mb-6 border",
            currentResult.scoreA > currentResult.scoreB ? "bg-primary/10 border-primary/50" : (currentResult.scoreA === currentResult.scoreB ? "bg-accent/10 border-accent/20" : "bg-destructive/10 border-destructive/50")
          )}>
            <Trophy className={cn("w-16 h-16 mx-auto mb-3", currentResult.scoreA > currentResult.scoreB ? "text-primary" : "text-muted-foreground")} />
            <h2 className="text-3xl font-headline font-bold mb-1">
              {currentResult.scoreA > currentResult.scoreB ? t.victory : (currentResult.scoreA === currentResult.scoreB ? t.draw : t.defeat)}
            </h2>
            <div className="flex items-center justify-center gap-4 text-3xl font-headline font-bold my-2">
              <span className={cn(currentResult.scoreA > currentResult.scoreB && "text-primary")}>{currentResult.scoreA}</span>
              <span className="opacity-30">:</span>
              <span className={cn(currentResult.scoreB > currentResult.scoreA && "text-red-400")}>{currentResult.scoreB}</span>
            </div>
            <p className="text-[10px] opacity-80 uppercase tracking-widest font-bold">
              {currentResult.winner === "Draw" ? "Equal Performance" : `${currentResult.winner} DOMINATION`}
            </p>
          </div>

          <Card className="glass-card mb-6">
            <CardHeader className="pb-2">
              <CardTitle className="text-[10px] font-bold uppercase text-accent tracking-widest">{t.summary}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs leading-relaxed text-muted-foreground italic">"{currentResult.matchSummary}"</p>
            </CardContent>
          </Card>

          <div className="grid grid-cols-2 gap-4 mb-8">
            <Card className="bg-secondary/20 border-white/5">
              <CardContent className="p-4 flex flex-col items-center">
                <Skull className="w-5 h-5 text-red-400 mb-2" />
                <span className="text-xl font-bold">{currentResult.teamStats.teamA.kills}</span>
                <span className="text-[8px] text-muted-foreground uppercase font-bold">Kills</span>
              </CardContent>
            </Card>
            <Card className="bg-secondary/20 border-white/5">
              <CardContent className="p-4 flex flex-col items-center">
                <Crosshair className="w-5 h-5 text-blue-400 mb-2" />
                <span className="text-xl font-bold">{currentResult.teamStats.teamA.towersDestroyed}</span>
                <span className="text-[8px] text-muted-foreground uppercase font-bold">Towers</span>
              </CardContent>
            </div>

          <Link href="/">
            <Button variant="outline" className="w-full text-xs font-bold uppercase border-white/5 h-12">
              {t.return}
            </Button>
          </Link>
        </div>
      )}
    </div>
  );
}
