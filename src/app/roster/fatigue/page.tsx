'use client';

import { useGameState } from '../../lib/store';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { 
  ChevronLeft, HeartPulse, Zap, Coins, 
  Gem, Info, CheckCircle2, ShieldAlert,
  Loader2, Star, Sparkles
} from 'lucide-react';
import { cn, formatCurrency } from '@/lib/utils';
import Link from 'next/link';
import { LoadingScreen } from '@/components/game/LoadingScreen';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { useMemo } from 'react';

export default function RecoverFatiguePage() {
  const { ownedPlayers, lineup, language, isLoaded, credits, crystals, recoverAllFatigue } = useGameState();
  const { toast } = useToast();

  // Фильтруем игроков: только те, кто назначен в любой слот состава (основа, запас или резерв)
  const squadPlayers = useMemo(() => {
    const assignedIds = new Set(Object.values(lineup || {}).filter(id => !!id));
    return ownedPlayers.filter(p => assignedIds.has(p.id));
  }, [ownedPlayers, lineup]);

  const avgFatigue = useMemo(() => {
    if (squadPlayers.length === 0) return 0;
    return Math.round(squadPlayers.reduce((acc, h) => acc + h.fatigue, 0) / squadPlayers.length);
  }, [squadPlayers]);

  if (!isLoaded) return <LoadingScreen />;

  const t = {
    title: language === 'ru' ? "ВОССТАНОВЛЕНИЕ" : "RECOVER FATIGUE",
    subtitle: language === 'ru' ? "Снятие усталости активного состава" : "Active squad stamina restoration",
    massRecover: language === 'ru' ? "МАССОВОЕ ВОССТАНОВЛЕНИЕ" : "MASS RECOVERY",
    totalHeroes: language === 'ru' ? "Игроков в составе" : "Squad Size",
    avgFatigue: language === 'ru' ? "Средняя усталость" : "Avg Fatigue",
    insufficient: language === 'ru' ? "Недостаточно средств" : "Insufficient funds",
    success: language === 'ru' ? "Состав полностью восстановлен!" : "Squad fully recovered!",
    options: {
      euro: {
        label: language === 'ru' ? "Энергетический буст" : "Energy Boost",
        desc: language === 'ru' ? "Сброс усталости всех игроков до 0%" : "Reset squad fatigue to 0%",
        cost: "75,000 €"
      },
      gems: {
        label: language === 'ru' ? "Полная регенерация" : "Full Regeneration",
        desc: language === 'ru' ? "Мгновенное восстановление сил всех игроков" : "Instant squad-wide stamina reset",
        cost: "150 Gems"
      }
    },
    desc: language === 'ru' 
      ? "Усталость снижает боевую эффективность в матчах. Только игроки, назначенные в состав, подвержены износу."
      : "Fatigue reduces combat efficiency. Only players assigned to the squad are subject to physical wear."
  };

  const handleRecover = (type: 'credits' | 'crystals') => {
    if (recoverAllFatigue(type)) {
      toast({
        title: t.success,
        description: language === 'ru' ? "Все игроки готовы к новым сражениям." : "All players are ready for new battles.",
      });
    } else {
      toast({
        variant: "destructive",
        title: t.insufficient,
      });
    }
  };

  return (
    <div className="max-w-md mx-auto px-4 pt-8 pb-32">
      <header className="mb-6 flex items-center gap-4">
        <Link href="/roster">
          <Button variant="ghost" size="icon" className="rounded-full">
            <ChevronLeft className="w-6 h-6" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-headline font-bold uppercase tracking-tighter flex items-center gap-2">
            <HeartPulse className="w-6 h-6 text-primary" />
            {t.title}
          </h1>
          <p className="text-muted-foreground text-[10px] uppercase tracking-widest">{t.subtitle}</p>
        </div>
      </header>

      <div className="space-y-6">
        {/* STATS OVERVIEW */}
        <div className="grid grid-cols-2 gap-3">
          <Card className="glass-card bg-primary/5 border-primary/20">
            <CardContent className="p-4 text-center">
              <p className="text-[8px] text-muted-foreground uppercase font-black tracking-widest mb-1">{t.totalHeroes}</p>
              <p className="text-2xl font-headline font-bold text-primary">{squadPlayers.length}</p>
            </CardContent>
          </Card>
          <Card className="glass-card bg-accent/5 border-accent/20">
            <CardContent className="p-4 text-center">
              <p className="text-[8px] text-muted-foreground uppercase font-black tracking-widest mb-1">{t.avgFatigue}</p>
              <p className={cn("text-2xl font-headline font-bold", avgFatigue > 50 ? "text-red-400" : "text-accent")}>
                {avgFatigue}%
              </p>
            </CardContent>
          </Card>
        </div>

        {/* INFO */}
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="p-4 flex gap-4">
            <Info className="w-5 h-5 text-primary shrink-0" />
            <p className="text-[10px] text-muted-foreground leading-relaxed italic">
              "{t.desc}"
            </p>
          </CardContent>
        </Card>

        {/* OPTIONS */}
        <div className="space-y-3">
          <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-accent px-1 flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5" /> {t.massRecover}
          </h2>

          <Card className="glass-card border-white/5 hover:border-primary/30 transition-all cursor-pointer overflow-hidden" onClick={() => handleRecover('credits')}>
            <CardContent className="p-5 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-yellow-500/10 border border-yellow-500/20">
                  <Coins className="w-6 h-6 text-yellow-500" />
                </div>
                <div>
                  <h3 className="text-sm font-bold uppercase">{t.options.euro.label}</h3>
                  <p className="text-[10px] text-muted-foreground">{t.options.euro.desc}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-lg font-headline font-bold text-primary">{t.options.euro.cost}</p>
              </div>
            </CardContent>
          </Card>

          <Card className="glass-card border-white/5 hover:border-accent/30 transition-all cursor-pointer overflow-hidden" onClick={() => handleRecover('crystals')}>
            <CardContent className="p-5 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20">
                  <Gem className="w-6 h-6 text-blue-400" />
                </div>
                <div>
                  <h3 className="text-sm font-bold uppercase">{t.options.gems.label}</h3>
                  <p className="text-[10px] text-muted-foreground">{t.options.gems.desc}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-lg font-headline font-bold text-accent">{t.options.gems.cost}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* CURRENT SQUAD LIST MINI */}
        <div className="space-y-2">
          <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground px-1">Status Report</h2>
          {squadPlayers.length > 0 ? squadPlayers.map(player => (
            <div key={player.id} className="flex items-center gap-3 bg-secondary/20 p-2 rounded-lg border border-white/5">
              <div className="w-8 h-8 rounded overflow-hidden bg-secondary/50 shrink-0">
                <img src={player.image} alt={player.name} className="w-full h-full object-cover" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[9px] font-bold uppercase truncate">{player.name}</p>
                <div className="flex items-center gap-2">
                  <Progress value={player.fatigue} className="h-1 flex-1 bg-white/5" />
                  <span className={cn("text-[8px] font-mono font-bold w-6 text-right", player.fatigue > 50 ? "text-red-400" : "text-accent")}>
                    {player.fatigue}%
                  </span>
                </div>
              </div>
            </div>
          )) : (
            <div className="py-10 text-center opacity-30 border border-dashed border-white/10 rounded-xl">
               <p className="text-[8px] font-black uppercase tracking-widest">No players assigned to squad</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
