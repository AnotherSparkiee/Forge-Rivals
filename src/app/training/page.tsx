
'use client';

import { useState } from 'react';
import { useGameState } from '../lib/store';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Zap, ChevronLeft, Sword, Shield, 
  Activity, Sparkles, Loader2, Wallet 
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Hero } from '../lib/moba-data';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';

export default function TrainingPage() {
  const { ownedHeroes, credits, upgradeHero, language, isLoaded } = useGameState();
  const { toast } = useToast();
  const [selectedHeroId, setSelectedHeroId] = useState<string | null>(null);
  const [isUpgrading, setIsUpgrading] = useState(false);

  const labels = {
    en: {
      title: "TRAINING BASE",
      subtitle: "Enhance your roster capabilities",
      balance: "Available Funds",
      selectHero: "Select a hero to train",
      cost: "Training Cost",
      success: "Training Successful!",
      insufficient: "Insufficient Credits",
      stats: {
        attack: "Attack Power",
        defense: "Defense Rating",
        health: "Health Points",
        abilityPower: "Ability Power"
      }
    },
    ru: {
      title: "ТРЕНИРОВОЧНАЯ БАЗА",
      subtitle: "Повышение боевой эффективности",
      balance: "Доступные средства",
      selectHero: "Выберите героя для тренировки",
      cost: "Стоимость тренировки",
      success: "Тренировка завершена!",
      insufficient: "Недостаточно кредитов",
      stats: {
        attack: "Сила атаки",
        defense: "Защита",
        health: "Очки здоровья",
        abilityPower: "Магическая сила"
      }
    }
  };

  const t = labels[language as keyof typeof labels] || labels.ru;
  const UPGRADE_COST = 500;
  const UPGRADE_AMOUNT = 5;

  if (!isLoaded) return null;

  const selectedHero = ownedHeroes.find(h => h.id === selectedHeroId);

  const handleUpgrade = async (stat: keyof Hero['baseStats']) => {
    if (!selectedHeroId) return;
    setIsUpgrading(true);

    const success = upgradeHero(selectedHeroId, stat, UPGRADE_AMOUNT, UPGRADE_COST);

    if (success) {
      toast({
        title: t.success,
        description: `+${UPGRADE_AMOUNT} ${stat.toUpperCase()} for ${selectedHero?.name}`,
      });
    } else {
      toast({
        variant: "destructive",
        title: t.insufficient,
        description: `You need ${UPGRADE_COST} credits for this training.`,
      });
    }
    setIsUpgrading(false);
  };

  return (
    <div className="max-w-md mx-auto px-4 pt-8 pb-20">
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

      <Card className="glass-card mb-6 border-yellow-500/20 bg-yellow-500/5">
        <CardContent className="p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Wallet className="w-5 h-5 text-yellow-500" />
            <span className="text-xs uppercase font-bold text-muted-foreground">{t.balance}</span>
          </div>
          <span className="text-xl font-headline font-bold text-yellow-500">{credits.toLocaleString()} €</span>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <h2 className="text-xs font-bold uppercase tracking-widest text-accent px-1">{t.selectHero}</h2>
        <div className="flex gap-3 overflow-x-auto pb-4 scrollbar-hide">
          {ownedHeroes.map((hero) => (
            <div 
              key={hero.id} 
              className={cn(
                "w-20 flex-shrink-0 cursor-pointer transition-all",
                selectedHeroId === hero.id ? "scale-105" : "opacity-60 grayscale-[0.5]"
              )}
              onClick={() => setSelectedHeroId(hero.id)}
            >
              <div className={cn(
                "aspect-[3/4] rounded-lg overflow-hidden border-2 mb-2",
                selectedHeroId === hero.id ? "border-primary shadow-[0_0_15px_rgba(var(--primary),0.3)]" : "border-white/5"
              )}>
                <img src={hero.image} alt={hero.name} className="w-full h-full object-cover" />
              </div>
              <p className="text-[8px] font-bold text-center uppercase truncate">{hero.name}</p>
            </div>
          ))}
        </div>

        {selectedHero && (
          <div className="space-y-3 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="grid grid-cols-2 gap-3">
              {[
                { id: 'attack', label: t.stats.attack, icon: Sword, color: 'text-red-400', val: selectedHero.baseStats.attack },
                { id: 'defense', label: t.stats.defense, icon: Shield, color: 'text-blue-400', val: selectedHero.baseStats.defense },
                { id: 'health', label: t.stats.health, icon: Activity, color: 'text-green-400', val: selectedHero.baseStats.health },
                { id: 'abilityPower', label: t.stats.abilityPower, icon: Sparkles, color: 'text-accent', val: selectedHero.baseStats.abilityPower },
              ].map((stat) => (
                <Card key={stat.id} className="glass-card bg-secondary/20">
                  <CardContent className="p-4 flex flex-col items-center gap-2">
                    <stat.icon className={cn("w-5 h-5", stat.color)} />
                    <div className="text-center">
                      <p className="text-[8px] uppercase text-muted-foreground font-bold mb-1">{stat.label}</p>
                      <p className="text-lg font-headline font-bold">{stat.val}</p>
                    </div>
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className="w-full h-8 text-[9px] font-bold border-white/5 hover:bg-white/5"
                      onClick={() => handleUpgrade(stat.id as keyof Hero['baseStats'])}
                      disabled={isUpgrading}
                    >
                      <Zap className="w-3 h-3 mr-1 text-yellow-500" />
                      {UPGRADE_COST} €
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
            
            <p className="text-[9px] text-center text-muted-foreground uppercase italic mt-4">
              * Each session grants +{UPGRADE_AMOUNT} to the selected characteristic.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
