
'use client';

import { useState, useMemo } from 'react';
import { useGameState, LineupSlot } from '../../lib/store';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { 
  Sword, Shield, Activity, Sparkles, Plus, 
  Check, ChevronLeft, User, UserPlus, X,
  ShieldCheck, Zap, Crosshair, HeartPulse,
  TrendingUp, Star, Users, Trophy, Box
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Hero } from '../../lib/moba-data';
import Link from 'next/link';

export default function SquadPage() {
  const { ownedHeroes, lineup, assignToRole, isLoaded, language } = useGameState();
  const [selectingSlot, setSelectingSlot] = useState<LineupSlot | null>(null);

  const t = {
    title: language === 'ru' ? "АКТИВНЫЙ СОСТАВ" : "ACTIVE LINEUP",
    subtitle: language === 'ru' ? "Прямое управление ростером без окон" : "Direct roster management without popups",
    activeLabel: language === 'ru' ? "Основа (5)" : "Core (5)",
    subsLabel: language === 'ru' ? "Замены (2)" : "Subs (2)",
    reserveLabel: language === 'ru' ? "Тактический резерв" : "Tactical Reserve",
    emptySlot: language === 'ru' ? "Назначить" : "Assign",
    overall: language === 'ru' ? "ОБЩ" : "OVR",
    teamOverall: language === 'ru' ? "ОБЩ" : "OVR",
    selectHero: language === 'ru' ? "Выберите героя ниже" : "Select hero below",
    roles: {
      carry: { label: language === 'ru' ? "Керри" : "Carry", icon: Sword, color: "text-red-400" },
      mid: { label: language === 'ru' ? "Мидер" : "Midlaner", icon: Sparkles, color: "text-blue-400" },
      offlane: { label: language === 'ru' ? "Оффлейнер" : "Offlaner", icon: Shield, color: "text-orange-400" },
      support: { label: language === 'ru' ? "Поддержка" : "Support", icon: Zap, color: "text-yellow-400" },
      full_support: { label: language === 'ru' ? "Полная поддержка" : "Full Support", icon: HeartPulse, color: "text-green-400" },
      sub1: { label: language === 'ru' ? "Запасной 1" : "Sub 1", icon: UserPlus, color: "text-muted-foreground" },
      sub2: { label: language === 'ru' ? "Запасной 2" : "Sub 2", icon: UserPlus, color: "text-muted-foreground" },
    },
    heroRoles: {
      'Carry': { icon: Sword, color: "text-red-400" },
      'Midlaner': { icon: Sparkles, color: "text-blue-400" },
      'Tank': { icon: Shield, color: "text-orange-400" },
      'Jungler': { icon: Crosshair, color: "text-purple-400" },
      'Support': { icon: Zap, color: "text-yellow-400" },
    }
  };

  const getHeroById = (id: string | null) => ownedHeroes.find(h => h.id === id);

  // Calculate Team Overall
  const teamOvr = useMemo(() => {
    const activeSlots: LineupSlot[] = ['carry', 'mid', 'offlane', 'support', 'full_support'];
    const activeHeroes = activeSlots.map(slot => getHeroById(lineup[slot])).filter(Boolean) as Hero[];
    if (activeHeroes.length === 0) return 0;
    const sum = activeHeroes.reduce((acc, h) => acc + h.overallRating, 0);
    return Math.round(sum / 5);
  }, [lineup, ownedHeroes]);

  const handleSlotClick = (slotKey: LineupSlot) => {
    if (selectingSlot === slotKey) {
      setSelectingSlot(null);
    } else {
      setSelectingSlot(slotKey);
    }
  };

  const handleHeroAssign = (heroId: string) => {
    if (selectingSlot) {
      assignToRole(selectingSlot, heroId);
      setSelectingSlot(null);
    }
  };

  const renderSlot = (slotKey: LineupSlot) => {
    const heroId = lineup[slotKey];
    const hero = getHeroById(heroId);
    const isSub = slotKey === 'sub1' || slotKey === 'sub2';
    const isSelected = selectingSlot === slotKey;
    
    let roleInfo = t.roles[slotKey];
    if (isSub && hero) {
      const heroRoleData = t.heroRoles[hero.role as keyof typeof t.heroRoles];
      if (heroRoleData) {
        roleInfo = { ...roleInfo, icon: heroRoleData.icon, color: heroRoleData.color };
      }
    }

    return (
      <Card 
        key={slotKey}
        onClick={() => handleSlotClick(slotKey)}
        className={cn(
          "glass-card border-white/5 overflow-hidden transition-all cursor-pointer active:scale-[0.98]",
          hero ? "bg-primary/5 border-primary/10" : "hover:border-white/20",
          isSelected && "ring-2 ring-primary border-primary shadow-[0_0_25px_rgba(var(--primary),0.4)] bg-primary/20 scale-[1.02] z-10"
        )}
      >
        <CardContent className="p-3 flex items-center gap-4 relative">
          <div className="relative flex-shrink-0">
            <div className={cn(
              "w-12 h-12 rounded-full border flex items-center justify-center bg-secondary/50 overflow-hidden transition-all",
              hero ? "border-primary/50" : "border-dashed border-muted",
              isSelected && "border-primary"
            )}>
              {hero ? (
                <img src={hero.image} alt={hero.name} className="w-full h-full object-cover" />
              ) : (
                <roleInfo.icon className={cn("w-5 h-5", isSelected ? "text-primary animate-pulse" : roleInfo.color)} />
              )}
            </div>
            {hero && (
              <div className="absolute -bottom-1 -right-1 bg-background rounded-full p-1 border border-white/10 shadow-lg">
                <roleInfo.icon className={cn("w-2.5 h-2.5", roleInfo.color)} />
              </div>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <p className={cn(
                "text-[8px] uppercase font-black tracking-widest",
                isSelected ? "text-primary" : "text-muted-foreground"
              )}>
                {roleInfo.label}
              </p>
              {isSelected && <Badge variant="outline" className="text-[6px] h-3 border-primary text-primary px-1 animate-pulse">ACTIVE</Badge>}
            </div>
            <h3 className={cn("text-xs font-bold leading-tight truncate", !hero && "text-muted-foreground italic")}>
              {hero ? hero.name : (isSelected ? t.selectHero : t.emptySlot)}
            </h3>
          </div>

          <div className="flex items-center gap-3 flex-shrink-0">
            {hero ? (
              <div className="flex flex-col items-center justify-center min-w-[45px] border-l border-white/5 pl-3">
                <p className="text-[7px] font-black text-accent uppercase tracking-tighter mb-0.5">{t.overall}</p>
                <span className="text-xl font-headline font-bold text-accent italic leading-none">
                  {hero.overallRating}
                </span>
              </div>
            ) : (
              <div className={cn(
                "w-8 h-8 rounded-lg flex items-center justify-center border transition-colors",
                isSelected ? "bg-primary border-primary text-primary-foreground" : "bg-primary/10 border-primary/20 text-primary"
              )}>
                <Plus className="w-4 h-4" />
              </div>
            )}
          </div>

          {hero && isSelected && (
            <button 
              onClick={(e) => {
                e.stopPropagation();
                assignToRole(slotKey, null);
                setSelectingSlot(null);
              }}
              className="absolute top-1 right-1 p-1 text-red-400 hover:text-red-500 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </CardContent>
      </Card>
    );
  };

  if (!isLoaded) return null;

  return (
    <div className="max-w-md mx-auto px-4 pt-8 pb-32">
      <header className="mb-6 flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/roster">
            <Button variant="ghost" size="icon" className="rounded-full">
              <ChevronLeft className="w-6 h-6" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-headline font-bold uppercase tracking-tighter">{t.title}</h1>
            <p className="text-muted-foreground text-[10px] uppercase tracking-widest">{t.subtitle}</p>
          </div>
        </div>
        
        <div className="flex flex-col items-center justify-center min-w-[60px]">
          <p className="text-[9px] font-black text-primary tracking-widest uppercase leading-none mb-1">{t.teamOverall}</p>
          <div className="relative flex items-center justify-center">
            <Shield className="w-10 h-10 text-primary fill-primary/10" strokeWidth={2} />
            <span className="absolute inset-0 flex items-center justify-center text-lg font-headline font-bold text-accent italic pt-0.5">
              {teamOvr}
            </span>
          </div>
        </div>
      </header>

      <div className="space-y-6">
        <section className="space-y-2">
          <h2 className="text-[10px] font-bold uppercase tracking-[0.2em] text-accent px-1 flex items-center gap-2">
            <ShieldCheck className="w-3.5 h-3.5" /> {t.activeLabel}
          </h2>
          <div className="space-y-2">
            {(['carry', 'mid', 'offlane', 'support', 'full_support'] as LineupSlot[]).map(renderSlot)}
          </div>
        </section>

        <section className="space-y-2">
          <h2 className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground px-1 flex items-center gap-2">
            <UserPlus className="w-3.5 h-3.5" /> {t.subsLabel}
          </h2>
          <div className="space-y-2">
            {(['sub1', 'sub2'] as LineupSlot[]).map(renderSlot)}
          </div>
        </section>

        <section className="space-y-3 pt-4 border-t border-white/5">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary flex items-center gap-2">
              <Box className="w-3.5 h-3.5" /> {t.reserveLabel}
            </h2>
            <Badge variant="outline" className="text-[8px] opacity-50 uppercase">{ownedHeroes.length} {language === 'ru' ? 'ГЕРОЕВ' : 'HEROES'}</Badge>
          </div>
          
          <div className="grid grid-cols-1 gap-2">
            {ownedHeroes.map((hero) => {
              const currentSlot = Object.keys(lineup).find(k => lineup[k as LineupSlot] === hero.id);
              const isAssigned = !!currentSlot;
              const isHeroSelectedForSwap = selectingSlot && lineup[selectingSlot] === hero.id;

              return (
                <Card 
                  key={hero.id}
                  className={cn(
                    "glass-card border-white/5 transition-all overflow-hidden",
                    selectingSlot ? "cursor-pointer hover:border-primary/50 active:scale-[0.98]" : "opacity-90",
                    isAssigned && "bg-secondary/30",
                    isHeroSelectedForSwap && "border-accent ring-1 ring-accent"
                  )}
                  onClick={() => selectingSlot && handleHeroAssign(hero.id)}
                >
                  <CardContent className="p-2 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg overflow-hidden bg-muted flex-shrink-0 relative">
                      <img src={hero.image} alt={hero.name} className="w-full h-full object-cover" />
                      {isAssigned && (
                        <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                          <Check className="w-5 h-5 text-primary drop-shadow-md" />
                        </div>
                      )}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-[11px] truncate">{hero.name}</h4>
                        <span className="text-[7px] text-muted-foreground font-black uppercase">{hero.role}</span>
                      </div>
                      <div className="flex items-center gap-3 mt-0.5">
                        <span className="text-[9px] font-bold text-accent flex items-center gap-1">
                          <Star className="w-2.5 h-2.5 fill-accent/20" /> {hero.overallRating}
                        </span>
                        {isAssigned && (
                          <span className="text-[7px] font-black text-primary uppercase bg-primary/10 px-1 rounded">
                            {t.roles[currentSlot as LineupSlot].label}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 pr-1">
                      {selectingSlot ? (
                        <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center border border-primary/20">
                          <Plus className="w-3 h-3 text-primary" />
                        </div>
                      ) : (
                        <div className="w-6 h-6 rounded-full bg-white/5 flex items-center justify-center">
                          <ChevronRight className="w-3 h-3 text-muted-foreground opacity-30" />
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
