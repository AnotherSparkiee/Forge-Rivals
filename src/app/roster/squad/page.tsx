'use client';

import { useState, useMemo, useRef } from 'react';
import { useGameState, LineupSlot } from '../../lib/store';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { 
  Sword, Shield, Sparkles, Plus, 
  ChevronLeft, ChevronRight, UserPlus, X,
  ShieldCheck, Zap, Crosshair, HeartPulse,
  Star, Box, Undo2, Heart, Flag, Coins, Info,
  TrendingUp, Eye, Target, Brain, Map, Users, AlertCircle, Award,
  Dumbbell
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Hero } from '../../moba-data';
import Link from 'next/link';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

export default function SquadPage() {
  const { ownedHeroes, lineup, assignToRole, isLoaded, language } = useGameState();
  const [selectingSlot, setSelectingSlot] = useState<LineupSlot | null>(null);
  const [profileHero, setProfileHero] = useState<Hero | null>(null);
  
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);

  const t = {
    title: language === 'ru' ? "АКТИВНЫЙ СОСТАВ" : "ACTIVE LINEUP",
    subtitle: language === 'ru' ? "Прямое управление ростером" : "Direct roster management",
    activeLabel: language === 'ru' ? "Основа (5)" : "Core (5)",
    subsLabel: language === 'ru' ? "Замены (2)" : "Subs (2)",
    emptySlot: language === 'ru' ? "Назначить" : "Assign",
    overall: language === 'ru' ? "ОБЩ" : "OVR",
    teamOverall: language === 'ru' ? "ОБЩ" : "OVR",
    selectHero: language === 'ru' ? "Выберите замену" : "Select replacement",
    availableHeroes: language === 'ru' ? "Доступные герои" : "Available Heroes",
    assigned: language === 'ru' ? "ЗАНЯТ" : "ASSIGNED",
    cancel: language === 'ru' ? "ОТМЕНА" : "CANCEL",
    profile: {
      title: language === 'ru' ? "ДОСЬЕ ИГРОКА" : "PLAYER DOSSIER",
      age: language === 'ru' ? "Возраст" : "Age",
      talent: language === 'ru' ? "Талант" : "Talent",
      salary: language === 'ru' ? "Зарплата" : "Salary",
      form: language === 'ru' ? "Форма" : "Form",
      fatigue: language === 'ru' ? "Усталость" : "Fatigue",
      country: language === 'ru' ? "Страна" : "Country",
      status: language === 'ru' ? "Статус" : "Status",
      healthy: language === 'ru' ? "Здоров" : "Healthy",
      injured: language === 'ru' ? "Травмирован" : "Injured",
      stats: language === 'ru' ? "Профессиональные данные" : "Professional Data",
      years: language === 'ru' ? "лет" : "yrs",
    },
    proStatsLabels: {
      lastHitting: language === 'ru' ? "Добив крипов" : "Last Hitting",
      mapAwareness: language === 'ru' ? "Контроль карты" : "Map Awareness",
      positioning: language === 'ru' ? "Позиционка" : "Positioning",
      reflexes: language === 'ru' ? "Рефлексы" : "Reflexes",
      manaManagement: language === 'ru' ? "Менеджмент маны" : "Mana Management",
      objectiveControl: language === 'ru' ? "Объекты" : "Objective Control",
      communication: language === 'ru' ? "Коммуникация" : "Communication",
      tiltResistance: language === 'ru' ? "Стрессоустойчивость" : "Tilt Resistance",
      versatility: language === 'ru' ? "Универсальность" : "Versatility",
      ganking: language === 'ru' ? "Ганкинг" : "Ganking",
    },
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

  const teamOvr = useMemo(() => {
    const activeSlots: LineupSlot[] = ['carry', 'mid', 'offlane', 'support', 'full_support'];
    const activeHeroes = activeSlots.map(slot => getHeroById(lineup[slot])).filter(Boolean) as Hero[];
    if (activeHeroes.length === 0) return 0;
    const sum = activeHeroes.reduce((acc, h) => acc + h.overallRating, 0);
    return Math.round(sum / activeHeroes.length);
  }, [lineup, ownedHeroes]);

  const availableForSelection = useMemo(() => {
    // Show all owned heroes to allow swapping positions
    const currentHeroId = selectingSlot ? lineup[selectingSlot] : null;
    return ownedHeroes.filter(h => h.id !== currentHeroId);
  }, [ownedHeroes, lineup, selectingSlot]);

  const handleStartPress = (hero: Hero | undefined) => {
    if (!hero) return;
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
    
    longPressTimer.current = setTimeout(() => {
      setProfileHero(hero);
      longPressTimer.current = null;
    }, 600);
  };

  const handleCancelPress = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  // NEW: Scroll protection - if finger moves, cancel the long press
  const handleTouchMove = () => {
    handleCancelPress();
  };

  const handleSlotClick = (slotKey: LineupSlot) => {
    if (!profileHero) {
      setSelectingSlot(prev => prev === slotKey ? null : slotKey);
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
        onMouseDown={() => handleStartPress(hero)}
        onMouseUp={handleCancelPress}
        onMouseLeave={handleCancelPress}
        onTouchStart={() => handleStartPress(hero)}
        onTouchEnd={handleCancelPress}
        onTouchMove={handleTouchMove}
        onClick={() => handleSlotClick(slotKey)}
        className={cn(
          "glass-card border-white/5 overflow-hidden transition-all cursor-pointer select-none",
          hero ? "bg-primary/5 border-primary/10" : "hover:border-white/20",
          isSelected && "ring-2 ring-primary border-primary shadow-[0_0_25px_rgba(var(--primary),0.4)] bg-primary/20 scale-[1.02] z-10"
        )}
      >
        <CardContent className="p-3 flex items-center gap-4 relative">
          <div className="relative flex-shrink-0">
            <div className={cn(
              "w-12 h-12 rounded-xl border flex items-center justify-center bg-secondary/50 overflow-hidden transition-all",
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
              {isSelected && <Badge variant="outline" className="text-[6px] h-3 border-primary text-primary px-1 animate-pulse">EDITING</Badge>}
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

        {selectingSlot && (
          <section className="space-y-3 pt-6 border-t border-primary/20 animate-in slide-in-from-bottom-4 duration-300">
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <Box className="w-4 h-4 text-primary" />
                <h2 className="text-sm font-bold uppercase tracking-tight text-primary">
                  {t.availableHeroes}
                </h2>
              </div>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setSelectingSlot(null)}
                className="h-7 text-[10px] font-bold text-muted-foreground hover:text-white"
              >
                <Undo2 className="w-3 h-3 mr-1" /> {t.cancel}
              </Button>
            </div>
            
            <div className="grid grid-cols-1 gap-2">
              {availableForSelection.length > 0 ? (
                availableForSelection.map((hero) => {
                  const currentRoleKey = Object.keys(lineup).find(k => lineup[k as LineupSlot] === hero.id) as LineupSlot | undefined;
                  const isAssigned = !!currentRoleKey;

                  return (
                    <Card 
                      key={hero.id}
                      onMouseDown={() => handleStartPress(hero)}
                      onMouseUp={handleCancelPress}
                      onMouseLeave={handleCancelPress}
                      onTouchStart={() => handleStartPress(hero)}
                      onTouchEnd={handleCancelPress}
                      onTouchMove={handleTouchMove}
                      className={cn(
                        "glass-card border-white/10 hover:border-primary/50 transition-all overflow-hidden cursor-pointer active:scale-[0.98]",
                        isAssigned ? "bg-accent/5 border-accent/20" : "bg-primary/5"
                      )}
                      onClick={() => handleHeroAssign(hero.id)}
                    >
                      <CardContent className="p-2 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl overflow-hidden bg-muted flex-shrink-0">
                          <img src={hero.image} alt={hero.name} className="w-full h-full object-cover" />
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
                              <Badge className="bg-accent/20 text-accent text-[6px] h-3 px-1 border-none font-black uppercase">
                                {t.assigned}: {t.roles[currentRoleKey].label}
                              </Badge>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 pr-1">
                          <div className={cn(
                            "w-6 h-6 rounded-full flex items-center justify-center border",
                            isAssigned ? "bg-accent/10 border-accent/20 text-accent" : "bg-primary/10 border-primary/20 text-primary"
                          )}>
                            {isAssigned ? <ChevronRight className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })
              ) : (
                <div className="py-8 text-center bg-secondary/10 rounded-xl border border-dashed border-white/5">
                  <p className="text-[10px] uppercase font-bold text-muted-foreground italic">
                    No heroes in roster
                  </p>
                </div>
              )}
            </div>
          </section>
        )}
      </div>

      <Dialog open={!!profileHero} onOpenChange={() => setProfileHero(null)}>
        <DialogContent className="max-w-md p-0 overflow-hidden bg-card border-white/10 h-[90vh] flex flex-col">
          {profileHero && (
            <>
              <DialogHeader className="sr-only">
                <DialogTitle>{profileHero.name}</DialogTitle>
                <DialogDescription>Detailed player profile and statistics</DialogDescription>
              </DialogHeader>

              <div className="p-6 bg-gradient-to-br from-primary/20 via-card to-accent/10 border-b border-white/5 relative flex-shrink-0">
                <div className="flex items-center gap-6">
                  <div className="w-24 h-24 rounded-2xl overflow-hidden border-2 border-primary shadow-[0_0_25px_rgba(var(--primary),0.3)]">
                    <img src={profileHero.image} alt={profileHero.name} className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h2 className="text-2xl font-headline font-bold uppercase text-white truncate leading-none">{profileHero.name}</h2>
                      <div className="w-6 h-6 rounded bg-secondary/50 flex items-center justify-center border border-white/10 shrink-0">
                        <span className="text-xs">{profileHero.country?.flag || '🏳️'}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge className="bg-primary text-primary-foreground text-[10px] font-black uppercase">{profileHero.role}</Badge>
                      <div className="flex items-center gap-1">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star key={i} className={cn("w-3 h-3", i < profileHero.talent ? "text-yellow-500 fill-yellow-500" : "text-muted-foreground")} />
                        ))}
                      </div>
                    </div>
                    <div className="mt-3 flex items-center gap-4">
                      <div className="text-center bg-background/40 p-1.5 rounded-lg border border-white/5 min-w-[50px]">
                        <p className="text-[7px] font-black text-muted-foreground uppercase">{t.overall}</p>
                        <p className="text-lg font-headline font-bold text-accent italic leading-none">{profileHero.overallRating}</p>
                      </div>
                      <div className="text-left">
                        <p className="text-[8px] font-black text-muted-foreground uppercase">{t.profile.salary}</p>
                        <p className="text-sm font-headline font-bold text-primary">€ {(profileHero.salary || 0).toLocaleString()}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-8 scrollbar-hide">
                <section>
                  <h3 className="text-[10px] font-black text-primary uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                    <Info className="w-3.5 h-3.5" /> Portfolio
                  </h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-secondary/20 p-3 rounded-xl border border-white/5 space-y-1">
                      <p className="text-[8px] font-black text-muted-foreground uppercase">{t.profile.age}</p>
                      <p className="text-xs font-bold">{profileHero.age || 0} {t.profile.years}</p>
                    </div>
                    <div className="bg-secondary/20 p-3 rounded-xl border border-white/5 space-y-1">
                      <p className="text-[8px] font-black text-muted-foreground uppercase">{t.profile.status}</p>
                      <p className={cn("text-xs font-bold flex items-center gap-1", profileHero.isInjured ? "text-red-400" : "text-green-400")}>
                        {profileHero.isInjured ? <AlertCircle className="w-3 h-3" /> : <ShieldCheck className="w-3 h-3" />}
                        {profileHero.isInjured ? t.profile.injured : t.profile.healthy}
                      </p>
                    </div>
                    <div className="bg-secondary/20 p-3 rounded-xl border border-white/5 space-y-2">
                      <div className="flex justify-between items-center">
                        <p className="text-[8px] font-black text-muted-foreground uppercase">{t.profile.form}</p>
                        <p className="text-[9px] font-bold text-primary">{profileHero.form || 0}%</p>
                      </div>
                      <Progress value={profileHero.form || 0} className="h-1" />
                    </div>
                    <div className="bg-secondary/20 p-3 rounded-xl border border-white/5 space-y-2">
                      <div className="flex justify-between items-center">
                        <p className="text-[8px] font-black text-muted-foreground uppercase">{t.profile.fatigue}</p>
                        <p className="text-[9px] font-bold text-accent">{profileHero.fatigue || 0}%</p>
                      </div>
                      <Progress value={profileHero.fatigue || 0} className="h-1 bg-accent/20" />
                    </div>
                  </div>
                </section>

                <section className="pb-6">
                  <h3 className="text-[10px] font-black text-accent uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                    <Award className="w-3.5 h-3.5" /> {t.profile.stats}
                  </h3>
                  <div className="space-y-4">
                    {profileHero.proStats && Object.entries(profileHero.proStats).map(([key, value]) => {
                      const icons: Record<string, any> = {
                        lastHitting: Target,
                        mapAwareness: Eye,
                        positioning: Map,
                        reflexes: Zap,
                        manaManagement: Sparkles,
                        objectiveControl: Sword,
                        communication: Users,
                        tiltResistance: Brain,
                        versatility: TrendingUp,
                        ganking: Crosshair,
                      };
                      const Icon = icons[key] || Info;
                      
                      return (
                        <div key={key} className="space-y-1.5">
                          <div className="flex justify-between items-center px-1">
                            <div className="flex items-center gap-2">
                              <Icon className="w-3 h-3 text-muted-foreground" />
                              <span className="text-[10px] font-bold uppercase tracking-tight">{t.proStatsLabels[key as keyof typeof t.proStatsLabels]}</span>
                            </div>
                            <span className="text-[10px] font-mono font-bold text-primary">{value as number}</span>
                          </div>
                          <Progress value={value as number} className="h-1.5" />
                        </div>
                      );
                    })}
                  </div>
                </section>
              </div>

              <div className="p-4 bg-secondary/20 border-t border-white/5 flex-shrink-0">
                <Button variant="outline" className="w-full h-12 uppercase font-black text-[10px] border-white/10" onClick={() => setProfileHero(null)}>
                  {language === 'ru' ? 'ЗАКРЫТЬ ДОСЬЕ' : 'CLOSE DOSSIER'}
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
