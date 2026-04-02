'use client';

import { useGameState } from '../../lib/store';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { 
  Link as LinkIcon, ChevronLeft, ShieldCheck, 
  Info, History, Swords, Trophy, Target, AlertTriangle,
  Zap, Star, Award, ShieldAlert
} from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { useMemo } from 'react';
import { LoadingScreen } from '@/components/game/LoadingScreen';

export default function SynergyPage() {
  const { matchHistory, language, isLoaded } = useGameState();

  const officialMatches = useMemo(() => {
    return matchHistory.filter(m => m.type === 'league' || m.type === 'tournament');
  }, [matchHistory]);

  const matchCount = officialMatches.length;
  
  // Synergy calculation based on 50 games being 100% (Elite level)
  const synergyScore = Math.min(100, Math.floor((matchCount / 50) * 100));

  const t = {
    title: language === 'ru' ? "СЫГРАННОСТЬ" : "TEAM SYNERGY",
    subtitle: language === 'ru' ? "Протокол командного взаимодействия" : "Tactical cohesion protocol",
    mainCard: language === 'ru' ? "УРОВЕНЬ СВЯЗИ ОСНОВЫ" : "CORE COHESION LEVEL",
    officialOnly: language === 'ru' ? "Учитываются только 5 основных игроков" : "Only core 5 players considered",
    league: language === 'ru' ? "Матчи Лиги" : "League Matches",
    cup: language === 'ru' ? "Матчи Кубка" : "Cup Matches",
    total: language === 'ru' ? "Всего оф. игр" : "Total Official Games",
    desc: language === 'ru' 
      ? "Сыгранность рассчитывается на основе совместных официальных выступлений основной пятерки. Тренировки и товарищеские матчи не влияют на этот показатель."
      : "Synergy is calculated based on official appearances of the core five. Training and friendlies do not influence this metric.",
    levels: [
      { min: 0, games: 0, label: language === 'ru' ? "Начальный" : "Initial", color: "text-muted-foreground" },
      { min: 10, games: 5, label: language === 'ru' ? "Низкий" : "Low", color: "text-red-400" },
      { min: 20, games: 10, label: language === 'ru' ? "Средний" : "Medium", color: "text-yellow-400" },
      { min: 50, games: 25, label: language === 'ru' ? "Высокий" : "High", color: "text-primary" },
      { min: 100, games: 50, label: language === 'ru' ? "Элитный" : "Elite", color: "text-accent" },
    ]
  };

  const currentLevel = [...t.levels].reverse().find(l => synergyScore >= l.min) || t.levels[0];

  if (!isLoaded) return <LoadingScreen />;

  return (
    <div className="max-w-md mx-auto px-4 pt-8 pb-24">
      <header className="mb-6 flex items-center gap-4">
        <Link href="/roster">
          <Button variant="ghost" size="icon" className="rounded-full">
            <ChevronLeft className="w-6 h-6" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-headline font-bold uppercase tracking-tighter flex items-center gap-2">
            <LinkIcon className="w-6 h-6 text-primary" />
            {t.title}
          </h1>
          <p className="text-muted-foreground text-[10px] uppercase tracking-widest">{t.subtitle}</p>
        </div>
      </header>

      <div className="space-y-6">
        <Card className="glass-card border-primary/20 bg-gradient-to-br from-primary/10 to-transparent overflow-hidden">
          <CardContent className="p-8 text-center flex flex-col items-center">
            <div className="relative mb-6">
              <div className="w-32 h-32 rounded-full border-4 border-white/5 flex items-center justify-center relative">
                <div className="absolute inset-0 rounded-full border-4 border-primary border-t-transparent animate-spin duration-[4s]" />
                <span className="text-5xl font-headline font-bold italic text-primary">{synergyScore}%</span>
              </div>
              <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-background px-4 py-1 rounded-full border border-white/10 shadow-xl">
                <p className={cn("text-[10px] font-black uppercase tracking-widest whitespace-nowrap", currentLevel.color)}>
                  {currentLevel.label}
                </p>
              </div>
            </div>
            
            <h2 className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground mb-4">
              {t.mainCard}
            </h2>

            <div className="w-full space-y-4">
              <div className="bg-secondary/30 p-4 rounded-xl border border-white/5 grid grid-cols-3 gap-2">
                <div className="text-center">
                  <p className="text-[7px] font-black text-muted-foreground uppercase mb-1">{t.league}</p>
                  <p className="text-lg font-headline font-bold text-primary">{officialMatches.filter(m => m.type === 'league').length}</p>
                </div>
                <div className="text-center border-x border-white/5">
                  <p className="text-[7px] font-black text-muted-foreground uppercase mb-1">{t.cup}</p>
                  <p className="text-lg font-headline font-bold text-accent">{officialMatches.filter(m => m.type === 'tournament').length}</p>
                </div>
                <div className="text-center">
                  <p className="text-[7px] font-black text-muted-foreground uppercase mb-1">{t.total}</p>
                  <p className="text-lg font-headline font-bold text-white">{matchCount}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <section className="space-y-3">
          <div className="flex items-center gap-2 px-1">
            <ShieldCheck className="w-4 h-4 text-accent" />
            <h3 className="text-[10px] font-black uppercase tracking-widest text-accent">Protocol Intelligence</h3>
          </div>
          
          <Card className="glass-card bg-secondary/20 border-white/5">
            <CardContent className="p-4 space-y-4">
              <div className="flex gap-4">
                <div className="p-2 rounded-lg bg-accent/10 flex-shrink-0 h-fit">
                  <Info className="w-4 h-4 text-accent" />
                </div>
                <p className="text-xs leading-relaxed text-muted-foreground italic">
                  "{t.desc}"
                </p>
              </div>

              <div className="p-3 bg-primary/5 rounded-lg border border-primary/20 flex items-center gap-3">
                <Zap className="w-4 h-4 text-primary shrink-0" />
                <p className="text-[9px] font-bold text-primary uppercase tracking-tight">
                  {t.officialOnly}
                </p>
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Synergy Thresholds</h3>
            <span className="text-[8px] font-mono text-primary">UNIT_LIMIT: 50 GAMES</span>
          </div>
          
          <div className="grid grid-cols-1 gap-2">
            {t.levels.filter(l => l.games > 0).map((lvl) => (
              <div key={lvl.label} className={cn(
                "p-3 rounded-xl border flex items-center justify-between transition-all",
                matchCount >= lvl.games ? "bg-white/5 border-white/10" : "bg-transparent border-dashed border-white/5 opacity-30"
              )}>
                <div className="flex items-center gap-3">
                  <div className={cn("w-2 h-2 rounded-full", matchCount >= lvl.games ? "bg-primary shadow-[0_0_8px_rgba(var(--primary),0.5)]" : "bg-muted")} />
                  <div className="flex flex-col">
                    <span className="text-[10px] font-bold uppercase">{lvl.label} Protocol</span>
                    <span className="text-[7px] text-muted-foreground uppercase">Stability Level {lvl.games === 50 ? 'MAX' : 'INCREMENT'}</span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-[9px] font-mono font-bold text-white">{lvl.games} GAMES</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
