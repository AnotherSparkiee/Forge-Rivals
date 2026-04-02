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
  Star, Box, Undo2, Info,
  TrendingUp, Eye, Target, Brain, Map, Users, AlertCircle, Award
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Hero } from '../../lib/moba-data';
import Link from 'next/link';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogPortal
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
    selectHero: language === 'ru' ? "Выберите игрока" : "Select player",
    availableHeroes: language === 'ru' ? "Подходящие герои" : "Compatible Heroes",
    assigned: language === 'ru' ? "ЗАНЯТ" : "ASSIGNED",
    cancel: language === 'ru' ? "ОТМЕНА" : "CANCEL",
    wrongRole: language === 'ru' ? "Нет героев с этой ролью" : "No heroes with this role",
    profile: {
      title: language === 'ru' ? "ДОСЬЕ ИГРОКА" : "PLAYER DOSSIER",
      age: language === 'ru' ? "Возраст" : "Age",
      talent: language === 'ru' ? "Пределы таланта" : "Talent Limits",
      salary: language === 'ru' ? "Зарплата" : "Salary",
      form: language === 'ru' ? "Форма" : "Form",
      fatigue: language === 'ru' ? "Усталость" : "Fatigue",
      country: language === 'ru' ? "Страна" : "Country",
      status: language === 'ru' ? "Статус" : "Status",
      healthy: language === 'ru' ? "Здоров" : "Healthy",
      injured: language === 'ru' ? "Травмирован" : "Injured",
      stats: language === 'ru' ? "Текущие навыки" : "Current Skills",
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
      support: { label: language === 'ru' ? "Четверка" : "Support", icon: Zap, color: "text-yellow-400" },
      full_support: { label: language === 'ru' ? "Пятерка" : "Full Support", icon: HeartPulse, color: "text-green-400" },
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

  const roleMapping: Record<LineupSlot, string[]> = {
    carry: ['Carry'],
    mid: ['Midlaner'],
    offlane: ['Tank'],
    support: ['Jungler'],
    full_support: ['Support'],
    sub1: ['Carry', 'Midlaner', 'Tank', 'Jungler', 'Support'],
    sub2: ['Carry', 'Midlaner', 'Tank', 'Jungler', 'Support'],
  };

  const getHeroById = (id: string | null) => ownedHeroes.find(h => h.id === id);

  const teamOvr = useMemo(() => {
    const activeSlots: LineupSlot[] = ['carry', 'mid', 'offlane', 'support', 'full_support'];
    const activeHeroes = activeSlots.map(slot => getHeroById(lineup[slot])).filter(Boolean) as Hero[];
    if (activeHeroes.length === 0) return 0;
    const sum = activeHeroes.reduce((acc, h) => acc + h.overallRating, 0);
    return Math.round(sum / activeHeroes.length);
  }, [lineup, ownedHeroes]);

  const handleCancelPress = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const handleStartPress = (hero: Hero | undefined) => {
    if (!hero) return;
    handleCancelPress();
    longPressTimer.current = setTimeout(() => {
      setProfileHero(hero);
      longPressTimer.current = null;
    }, 600);
  };

  const handleTouchMove = () => {
    handleCancelPress();
  };

  const handleSlotClick = (slotKey: LineupSlot) => {
    if (!profileHero) {
      setSelectingSlot(prev => prev === slotKey ? null : slotKey);
    }
  };

  const handleHeroAssign = (hero: Hero) => {
    if (selectingSlot) {
      const allowedRoles = roleMapping[selectingSlot];
      if (allowedRoles.includes(hero.role)) {
        assignToRole(selectingSlot, hero.id);
        setSelectingSlot(null);
      }
    }
  };

  const filteredHeroes = useMemo(() => {
    if (!selectingSlot) return [];
    const allowedRoles = roleMapping[selectingSlot];
    return ownedHeroes.filter(h => allowedRoles.includes(h.role));
  }, [selectingSlot, ownedHeroes]);

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
              {filteredHeroes.length > 0 ? (
                filteredHeroes.map((hero) => {
                  const currentRoleKey = Object.keys(lineup).find(k => lineup[k as LineupSlot] === hero.id) as LineupSlot | undefined;
                  const isAssignedToThisSlot = hero.id === lineup[selectingSlot];
                  const isAssignedElsewhere = !!currentRoleKey && currentRoleKey !== selectingSlot;

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
                        isAssignedToThisSlot ? "ring-1 ring-primary bg-primary/10" : (isAssignedElsewhere ? "bg-accent/5 border-accent/20" : "bg-primary/5")
                      )}
                      onClick={() => handleHeroAssign(hero)}
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
                            {isAssignedElsewhere && (
                              <Badge className="bg-accent/20 text-accent text-[6px] h-3 px-1 border-none font-black uppercase">
                                {t.assigned}: {t.roles[currentRoleKey].label}
                              </Badge>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 pr-1">
                          <div className={cn(
                            "w-6 h-6 rounded-full flex items-center justify-center border",
                            isAssignedElsewhere ? "bg-accent/10 border-accent/20 text-accent" : "bg-primary/10 border-primary/20 text-primary"
                          )}>
                            {isAssignedElsewhere ? <ChevronRight className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })
              ) : (
                <div className="py-8 text-center bg-secondary/20 rounded-xl border border-dashed border-white/10">
                  <p className="text-[10px] uppercase font-bold text-muted-foreground">{t.wrongRole}</p>
                </div>
              )}
            </div>
          </section>
        )}
      </div>

      <Dialog open={!!profileHero} onOpenChange={() => setProfileHero(null)}>
        <DialogPortal>
          <DialogContent className="fixed inset-0 z-[100] max-w-none w-full h-full m-0 p-0 bg-background border-none flex flex-col rounded-none sm:rounded-none overflow-hidden outline-none translate-x-0 translate-y-0 top-0 left-0 animate-in fade-in zoom-in duration-300">
            {profileHero && (
              <>
                <DialogHeader className="sr-only">
                  <DialogTitle>{profileHero.name}</DialogTitle>
                  <DialogDescription>Detailed player profile and statistics</DialogDescription>
                </DialogHeader>

                {/* Unified Scrolling Container */}
                <div className="flex-1 overflow-y-auto scrollbar-hide pb-32">
                  {/* Header info - Scrolling part */}
                  <div className="p-4 pt-12 pb-8 bg-gradient-to-br from-primary/20 via-background to-accent/5 border-b border-white/5 flex flex-col items-center text-center gap-4">
                    <div className="relative">
                      <div className="w-24 h-24 rounded-2xl overflow-hidden border border-primary/50 shadow-[0_0_30px_rgba(var(--primary),0.3)] bg-secondary/50">
                        <img src={profileHero.image} alt={profileHero.name} className="w-full h-full object-cover" />
                      </div>
                      <div className="absolute -bottom-1 -right-1 w-8 h-8 rounded-lg bg-background border border-white/10 flex items-center justify-center shadow-xl">
                        <span className="text-base">{profileHero.country?.flag || '🏳️'}</span>
                      </div>
                    </div>
                    
                    <div className="space-y-1">
                      <h2 className="text-2xl font-headline font-bold uppercase text-white tracking-tight leading-none">{profileHero.name}</h2>
                      <div className="flex items-center justify-center gap-2">
                        <Badge className="bg-primary text-primary-foreground text-[10px] font-black uppercase px-2 h-5">{profileHero.role}</Badge>
                        <div className="flex items-center gap-0.5">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Star key={i} className={cn("w-3.5 h-3.5", i < profileHero.talent ? "text-yellow-500 fill-yellow-500" : "text-muted-foreground/30")} />
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="w-full grid grid-cols-2 gap-3 max-w-[300px] mx-auto">
                      <div className="bg-background/40 p-3 rounded-xl border border-white/10">
                        <p className="text-[8px] font-black text-muted-foreground uppercase tracking-widest">{t.overall}</p>
                        <p className="text-xl font-headline font-bold text-accent italic leading-none">{profileHero.overallRating}</p>
                      </div>
                      <div className="bg-background/40 p-3 rounded-xl border border-white/10">
                        <p className="text-[8px] font-black text-muted-foreground uppercase tracking-widest">{t.profile.salary}</p>
                        <p className="text-sm font-headline font-bold text-primary">€{(profileHero.salary || 0).toLocaleString()}</p>
                      </div>
                    </div>
                  </div>

                  {/* Body Content */}
                  <div className="p-4 space-y-8">
                    {/* Status Section */}
                    <section>
                      <h3 className="text-[9px] font-black text-primary uppercase tracking-[0.2em] mb-4 flex items-center gap-2 opacity-80 px-1">
                        <Info className="w-3.5 h-3.5" /> BIOMETRICS & STATUS
                      </h3>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-secondary/20 p-3 rounded-xl border border-white/5 space-y-0.5">
                          <p className="text-[7px] font-black text-muted-foreground uppercase">{t.profile.age}</p>
                          <p className="text-xs font-bold">{profileHero.age || 0} {t.profile.years}</p>
                        </div>
                        <div className="bg-secondary/20 p-3 rounded-xl border border-white/5 space-y-0.5">
                          <p className="text-[7px] font-black text-muted-foreground uppercase">{t.profile.status}</p>
                          <p className={cn("text-[10px] font-bold flex items-center gap-1.5", profileHero.isInjured ? "text-red-400" : "text-green-400")}>
                            {profileHero.isInjured ? <AlertCircle className="w-3 h-3" /> : <ShieldCheck className="w-3 h-3" />}
                            {profileHero.isInjured ? t.profile.injured : t.profile.healthy}
                          </p>
                        </div>
                        <div className="bg-secondary/20 p-3 rounded-xl border border-white/5 space-y-2">
                          <div className="flex justify-between items-center">
                            <p className="text-[7px] font-black text-muted-foreground uppercase">{t.profile.form}</p>
                            <p className="text-[9px] font-bold text-primary">{profileHero.form || 0}%</p>
                          </div>
                          <Progress value={profileHero.form || 0} className="h-1" />
                        </div>
                        <div className="bg-secondary/20 p-3 rounded-xl border border-white/5 space-y-2">
                          <div className="flex justify-between items-center">
                            <p className="text-[7px] font-black text-muted-foreground uppercase">{t.profile.fatigue}</p>
                            <p className="text-[9px] font-bold text-accent">{profileHero.fatigue || 0}%</p>
                          </div>
                          <Progress value={profileHero.fatigue || 0} className="h-1 bg-accent/20" />
                        </div>
                      </div>
                    </section>

                    {/* Talent Limits Section */}
                    <section>
                      <h3 className="text-[9px] font-black text-yellow-500 uppercase tracking-[0.2em] mb-4 flex items-center gap-2 opacity-80 px-1">
                        <Sparkles className="w-3.5 h-3.5" /> {t.profile.talent}
                      </h3>
                      <div className="bg-secondary/20 p-4 rounded-xl border border-yellow-500/20 flex flex-col items-center gap-3">
                        <div className="flex gap-1">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Star key={i} className={cn("w-6 h-6", i < profileHero.talent ? "text-yellow-500 fill-yellow-500" : "text-muted-foreground/20")} />
                          ))}
                        </div>
                        <p className="text-[9px] text-center text-muted-foreground uppercase font-bold max-w-[200px] leading-relaxed">
                          {language === 'ru' ? 'Этот предел определяет максимально возможный уровень развития навыков игрока.' : 'This limit defines the maximum possible level of the player\'s skill development.'}
                        </p>
                      </div>
                    </section>

                    {/* Pro Skills Section */}
                    <section>
                      <h3 className="text-[9px] font-black text-accent uppercase tracking-[0.2em] mb-4 flex items-center gap-2 opacity-80 px-1">
                        <Award className="w-3.5 h-3.5" /> {t.profile.stats}
                      </h3>
                      <div className="grid grid-cols-1 gap-4">
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
                              <div className="flex justify-between items-center px-0.5">
                                <div className="flex items-center gap-2">
                                  <Icon className="w-3.5 h-3.5 text-muted-foreground/60" />
                                  <span className="text-[10px] font-bold uppercase tracking-widest">{t.proStatsLabels[key as keyof typeof t.proStatsLabels]}</span>
                                </div>
                                <span className="text-[10px] font-mono font-bold text-primary">{value as number}</span>
                              </div>
                              <Progress value={value as number} className="h-1.5 rounded-full bg-secondary/40" />
                            </div>
                          );
                        })}
                      </div>
                    </section>
                  </div>
                </div>

                {/* Fixed Footer for closure */}
                <div className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-background via-background/95 to-transparent pt-12 flex-shrink-0 z-[110]">
                  <Button 
                    className="w-full h-14 hero-gradient font-black text-[11px] tracking-[0.2em] shadow-xl rounded-xl active:scale-95 transition-transform uppercase" 
                    onClick={() => setProfileHero(null)}
                  >
                    {language === 'ru' ? 'ЗАКРЫТЬ ДОСЬЕ' : 'CLOSE DOSSIER'}
                  </Button>
                </div>
              </>
            )}
          </DialogContent>
        </DialogPortal>
      </Dialog>
    </div>
  );
}
