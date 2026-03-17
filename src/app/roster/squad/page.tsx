'use client';

import { useState } from 'react';
import { useGameState, LineupSlot } from '../../lib/store';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { 
  Sword, Shield, Activity, Sparkles, Plus, 
  Check, ChevronLeft, User, UserPlus, X,
  ShieldCheck, Zap, Crosshair, HeartPulse,
  TrendingUp, Star, Users
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Hero } from '../../lib/moba-data';
import Link from 'next/link';
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription 
} from '@/components/ui/dialog';

export default function SquadPage() {
  const { ownedHeroes, lineup, assignToRole, isLoaded, language } = useGameState();
  const [selectingSlot, setSelectingSlot] = useState<LineupSlot | null>(null);

  if (!isLoaded) return null;

  const t = {
    title: language === 'ru' ? "АКТИВНЫЙ СОСТАВ" : "ACTIVE LINEUP",
    subtitle: language === 'ru' ? "Управляйте основой и заменами вашего клуба." : "Manage your club's core and substitutes.",
    activeLabel: language === 'ru' ? "Основа (5)" : "Core (5)",
    subsLabel: language === 'ru' ? "Замены (2)" : "Subs (2)",
    emptySlot: language === 'ru' ? "Назначить" : "Assign",
    heroSelection: language === 'ru' ? "Выбор героя" : "Hero Selection",
    heroSelectionDesc: language === 'ru' ? "Выберите героя для этой позиции." : "Select a hero for this position.",
    overall: language === 'ru' ? "ОБЩ" : "OVR",
    roles: {
      carry: { label: language === 'ru' ? "Керри" : "Carry", icon: Sword, color: "text-red-400" },
      mid: { label: language === 'ru' ? "Мидер" : "Midlaner", icon: Sparkles, color: "text-blue-400" },
      offlane: { label: language === 'ru' ? "Оффлейнер" : "Offlaner", icon: Shield, color: "text-orange-400" },
      support: { label: language === 'ru' ? "Поддержка" : "Support", icon: Zap, color: "text-yellow-400" },
      full_support: { label: language === 'ru' ? "Полная поддержка" : "Full Support", icon: HeartPulse, color: "text-green-400" },
      sub1: { label: language === 'ru' ? "Запасной 1" : "Sub 1", icon: UserPlus, color: "text-muted-foreground" },
      sub2: { label: language === 'ru' ? "Запасной 2" : "Sub 2", icon: UserPlus, color: "text-muted-foreground" },
    }
  };

  const getHeroById = (id: string | null) => ownedHeroes.find(h => h.id === id);

  const renderSlot = (slotKey: LineupSlot) => {
    const heroId = lineup[slotKey];
    const hero = getHeroById(heroId);
    const roleInfo = t.roles[slotKey];

    return (
      <Card 
        key={slotKey}
        className={cn(
          "glass-card border-white/5 overflow-hidden transition-all",
          hero ? "bg-primary/5 border-primary/20 shadow-[0_0_15px_rgba(var(--primary),0.05)]" : "hover:border-white/20"
        )}
      >
        <CardContent className="p-3 flex items-center gap-4">
          <div className="relative flex-shrink-0">
            <div className={cn(
              "w-14 h-14 rounded-full border flex items-center justify-center bg-secondary/50",
              hero ? "border-primary/50" : "border-dashed border-muted"
            )}>
              {hero ? (
                <img src={hero.image} alt={hero.name} className="w-full h-full object-cover rounded-full" />
              ) : (
                <roleInfo.icon className={cn("w-6 h-6", roleInfo.color)} />
              )}
            </div>
            {hero && (
              <div className="absolute -bottom-1 -right-1 bg-background rounded-full p-1.5 border border-white/10 shadow-lg">
                <roleInfo.icon className={cn("w-3 h-3", roleInfo.color)} />
              </div>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <p className="text-[9px] uppercase font-black text-muted-foreground tracking-widest">{roleInfo.label}</p>
              {hero && (
                <div className="flex items-center gap-1 bg-accent/20 px-1.5 rounded text-accent font-mono font-bold text-[10px]">
                  {t.overall} {hero.overallRating}
                </div>
              )}
            </div>
            <h3 className={cn("text-sm font-bold leading-tight break-words", !hero && "text-muted-foreground italic")}>
              {hero ? hero.name : t.emptySlot}
            </h3>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {hero && (
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                onClick={(e) => {
                  e.stopPropagation();
                  assignToRole(slotKey, null);
                }}
              >
                <X className="w-4 h-4" />
              </Button>
            )}
            <Button 
              variant={hero ? "secondary" : "default"} 
              size="sm" 
              className="h-9 text-[10px] uppercase font-bold px-3"
              onClick={() => setSelectingSlot(slotKey)}
            >
              {hero ? (language === 'ru' ? "СМЕНИТЬ" : "SWAP") : t.emptySlot}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  };

  const activeSlots: LineupSlot[] = ['carry', 'mid', 'offlane', 'support', 'full_support'];
  const subSlots: LineupSlot[] = ['sub1', 'sub2'];

  return (
    <div className="max-w-md mx-auto px-4 pt-8 pb-24">
      <header className="mb-6 flex items-center gap-4">
        <Link href="/roster">
          <Button variant="ghost" size="icon" className="rounded-full">
            <ChevronLeft className="w-6 h-6" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-headline font-bold uppercase tracking-tighter">{t.title}</h1>
          <p className="text-muted-foreground text-[10px] uppercase tracking-widest">{t.subtitle}</p>
        </div>
      </header>

      <div className="space-y-6">
        <section className="space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-accent px-1 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4" /> {t.activeLabel}
          </h2>
          <div className="space-y-2">
            {activeSlots.map(renderSlot)}
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground px-1 flex items-center gap-2">
            <UserPlus className="w-4 h-4" /> {t.subsLabel}
          </h2>
          <div className="space-y-2">
            {subSlots.map(renderSlot)}
          </div>
        </section>
      </div>

      <Dialog open={!!selectingSlot} onOpenChange={() => setSelectingSlot(null)}>
        <DialogContent className="max-w-md h-[85vh] flex flex-col p-0 bg-background border-white/5">
          <DialogHeader className="p-6 pb-2 border-b border-white/5">
            <DialogTitle className="text-xl font-headline font-bold uppercase flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" /> {t.heroSelection}
            </DialogTitle>
            <DialogDescription className="text-xs">{t.heroSelectionDesc}</DialogDescription>
          </DialogHeader>
          
          <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-hide">
            {ownedHeroes.map((hero) => {
              const currentSlot = Object.keys(lineup).find(k => lineup[k as LineupSlot] === hero.id);
              const isAssigned = !!currentSlot;
              const isCurrentSlot = currentSlot === selectingSlot;

              return (
                <Card 
                  key={hero.id}
                  className={cn(
                    "glass-card transition-all cursor-pointer overflow-hidden",
                    isCurrentSlot ? "border-primary bg-primary/10" : "hover:border-white/20",
                    isAssigned && !isCurrentSlot && "opacity-50 grayscale"
                  )}
                  onClick={() => {
                    if (selectingSlot) {
                      assignToRole(selectingSlot, hero.id);
                      setSelectingSlot(null);
                    }
                  }}
                >
                  <CardContent className="p-0 flex h-32">
                    <div className="w-24 h-full bg-muted flex-shrink-0 relative">
                      <img src={hero.image} alt={hero.name} className="w-full h-full object-cover" />
                      <div className="absolute top-2 right-2 bg-background/90 rounded px-1.5 py-0.5 border border-white/10">
                        <span className="text-[10px] font-mono font-black text-accent">{hero.overallRating}</span>
                      </div>
                    </div>
                    <div className="flex-1 min-w-0 p-3 flex flex-col">
                      <div className="flex items-center justify-between mb-1 gap-2">
                        <h4 className="font-bold text-sm leading-tight break-words flex-1">{hero.name}</h4>
                        <Badge variant="secondary" className="text-[7px] h-4 uppercase shrink-0">{hero.role}</Badge>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 mt-1">
                        <div className="flex items-center gap-1.5 text-[9px] text-muted-foreground font-bold">
                          <Sword className="w-3 h-3 text-red-400" /> {hero.baseStats.attack}
                        </div>
                        <div className="flex items-center gap-1.5 text-[9px] text-muted-foreground font-bold">
                          <Activity className="w-3 h-3 text-green-400" /> {hero.baseStats.health}
                        </div>
                        <div className="flex items-center gap-1.5 text-[9px] text-muted-foreground font-bold">
                          <Shield className="w-3 h-3 text-orange-400" /> {hero.baseStats.defense}
                        </div>
                        <div className="flex items-center gap-1.5 text-[9px] text-muted-foreground font-bold">
                          <Zap className="w-3 h-3 text-blue-400" /> {hero.baseStats.abilityPower}
                        </div>
                      </div>

                      {isAssigned && (
                        <div className="mt-auto pt-2 flex items-center gap-1">
                          <Badge variant="outline" className="text-[8px] uppercase border-primary/30 text-primary py-0 h-4">
                            {isCurrentSlot ? (language === 'ru' ? "ВЫБРАН" : "SELECTED") : (language === 'ru' ? `ПОЗИЦИЯ: ${t.roles[currentSlot as LineupSlot].label}` : `ROLE: ${t.roles[currentSlot as LineupSlot].label}`)}
                          </Badge>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}