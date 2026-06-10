'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import { useGameState, LineupSlot } from '../../lib/store';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { 
  Sword, Shield, Sparkles, Plus, 
  ChevronLeft, UserPlus, X,
  ShieldCheck, Zap, HeartPulse,
  Star, Box, Undo2, Info, ShoppingCart, Loader2,
  Award, Clock, Users, Brain, TrendingUp, Crosshair,
  Target, Eye, Map
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Hero } from '../../lib/moba-data';
import Link from 'next/link';
import { calculateLiveAge, getMoscowDateString, getMoscowTime } from '@/app/lib/time-utils';
import { useToast } from '@/hooks/use-toast';
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc, setDoc } from 'firebase/firestore';

export default function SquadPage() {
  const { ownedHeroes, lineup, assignToRole, isLoaded, language, updateHero, isPremium, activeLicenseTier } = useGameState();
  const { user } = useUser();
  const db = useFirestore();
  const { toast } = useToast();
  const [selectingSlot, setSelectingSlot] = useState<LineupSlot | null>(null);
  const [profileHero, setProfileHero] = useState<Hero | null>(null);
  const [isTransferring, setIsTransferring] = useState(false);
  const [now, setNow] = useState(Date.now());
  
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const userRef = useMemoFirebase(() => (user?.uid ? doc(db, 'players_v10', user.uid) : null), [db, user?.uid]);
  const { data: profile } = useDoc(userRef);

  const squadLimit = useMemo(() => {
    if (isPremium) return 15;
    const tier = activeLicenseTier || 4;
    if (tier === 4) return 7;
    if (tier === 3) return 8;
    if (tier === 2) return 10;
    if (tier === 1) return 12;
    return 7;
  }, [isPremium, activeLicenseTier]);

  const t = {
    title: language === 'ru' ? "АКТИВНЫЙ СОСТАВ" : "ACTIVE LINEUP",
    subtitle: language === 'ru' ? "Прямое управление ростером" : "Direct roster management",
    activeLabel: language === 'ru' ? "Основа (5)" : "Core (5)",
    subsLabel: language === 'ru' ? "Замены (2)" : "Subs (2)",
    reservesLabel: language === 'ru' ? `Резерв (${squadLimit - 7})` : `Reserves (${squadLimit - 7})`,
    emptySlot: language === 'ru' ? "Назначить" : "Assign",
    overall: language === 'ru' ? "ОБЩ" : "OVR",
    teamOverall: language === 'ru' ? "ОБЩ" : "OVR",
    selectHero: language === 'ru' ? "Выберите игрока" : "Select player",
    availableHeroes: language === 'ru' ? "Подходящие герои" : "Compatible Heroes",
    assigned: language === 'ru' ? "ЗАНЯТ" : "ASSIGNED",
    cancel: language === 'ru' ? "ОТМЕНА" : "CANCEL",
    tooYoung: language === 'ru' ? "Игрок слишком молод! Мин. возраст — 18.0" : "Player is too young! Min age — 18.0",
    onAuction: language === 'ru' ? "ИГРОК НА АУКЦИОНЕ" : "PLAYER ON AUCTION",
    putOnTransfer: language === 'ru' ? "ВЫСТАВИТЬ НА ТРАНСФЕР" : "PUT ON TRANSFER",
    profile: {
      title: language === 'ru' ? "ДОСЬЕ ИГРОКА" : "PLAYER DOSSIER",
      age: language === 'ru' ? "Возраст" : "Age",
      talent: language === 'ru' ? "Пределы таланта" : "Talent Limits",
      salary: language === 'ru' ? "Зарплата" : "Salary",
      status: language === 'ru' ? "Статус" : "Status",
      healthy: language === 'ru' ? "Здоров" : "Healthy",
      injured: language === 'ru' ? "Травмирован" : "Injured",
      stats: language === 'ru' ? "Навыки и таланты" : "Skills & Talents",
      years: language === 'ru' ? "лет" : "yrs",
      close: language === 'ru' ? "ВЕРНУТЬСЯ" : "BACK",
    },
    roles: {
      carry: { label: language === 'ru' ? "Керри" : "Carry", icon: Sword, color: "text-red-400" },
      mid: { label: language === 'ru' ? "Мидер" : "Midlaner", icon: Sparkles, color: "text-blue-400" },
      offlane: { label: language === 'ru' ? "Оффлейнер" : "Offlaner", icon: Shield, color: "text-orange-400" },
      support: { label: language === 'ru' ? "Четверка" : "Support", icon: Zap, color: "text-yellow-400" },
      full_support: { label: language === 'ru' ? "Пятерка" : "Full Support", icon: HeartPulse, color: "text-green-400" },
      sub1: { label: language === 'ru' ? "Запасной 1" : "Sub 1", icon: UserPlus, color: "text-muted-foreground" },
      sub2: { label: language === 'ru' ? "Запасной 2" : "Sub 2", icon: UserPlus, color: "text-muted-foreground" },
      res1: { label: language === 'ru' ? "Резерв 1" : "Res 1", icon: Users, color: "text-muted-foreground/50" },
      res2: { label: language === 'ru' ? "Резерв 2" : "Res 2", icon: Users, color: "text-muted-foreground/50" },
      res3: { label: language === 'ru' ? "Резерв 3" : "Res 3", icon: Users, color: "text-muted-foreground/50" },
      res4: { label: "Res 4", icon: Users, color: "text-muted-foreground/40" },
      res5: { label: "Res 5", icon: Users, color: "text-muted-foreground/40" },
      res6: { label: "Res 6", icon: Users, color: "text-muted-foreground/40" },
      res7: { label: "Res 7", icon: Users, color: "text-muted-foreground/40" },
      res8: { label: "Res 8", icon: Users, color: "text-muted-foreground/40" },
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
    }
  };

  const roleMapping: Record<LineupSlot, string[]> = {
    carry: ['Carry'], mid: ['Midlaner'], offlane: ['Tank'], support: ['Jungler'], full_support: ['Support'],
    sub1: ['Carry', 'Midlaner', 'Tank', 'Jungler', 'Support'], sub2: ['Carry', 'Midlaner', 'Tank', 'Jungler', 'Support'],
    res1: ['Carry', 'Midlaner', 'Tank', 'Jungler', 'Support'], res2: ['Carry', 'Midlaner', 'Tank', 'Jungler', 'Support'], res3: ['Carry', 'Midlaner', 'Tank', 'Jungler', 'Support'],
    res4: ['Carry', 'Midlaner', 'Tank', 'Jungler', 'Support'], res5: ['Carry', 'Midlaner', 'Tank', 'Jungler', 'Support'], res6: ['Carry', 'Midlaner', 'Tank', 'Jungler', 'Support'],
    res7: ['Carry', 'Midlaner', 'Tank', 'Jungler', 'Support'], res8: ['Carry', 'Midlaner', 'Tank', 'Jungler', 'Support'],
  };

  const getHeroById = (id: string | null) => ownedHeroes.find(h => h.id === id);

  const teamOvr = useMemo(() => {
    const activeSlots: LineupSlot[] = ['carry', 'mid', 'offlane', 'support', 'full_support'];
    const activeHeroes = activeSlots.map(slot => getHeroById(lineup[slot])).filter(Boolean) as Hero[];
    if (activeHeroes.length === 0) return 0;
    const sum = activeHeroes.reduce((acc, h) => acc + h.overallRating, 0);
    return Math.round(sum / activeHeroes.length);
  }, [lineup, ownedHeroes]);

  const handleStartPress = (hero: Hero | undefined) => {
    if (!hero) return;
    longPressTimer.current = setTimeout(() => {
      setProfileHero(hero);
    }, 600);
  };

  const handleCancelPress = () => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
  };

  const handleHeroAssign = (hero: Hero) => {
    if (!selectingSlot) return;
    if (hero.onTransferUntil && new Date(hero.onTransferUntil) > new Date()) {
      toast({ variant: "destructive", title: t.onAuction });
      return;
    }
    const liveAge = calculateLiveAge(hero.baseAge, hero.hiredAt);
    if (liveAge.numeric < 18) {
      toast({ variant: "destructive", title: t.tooYoung });
      return;
    }
    assignToRole(selectingSlot, hero.id);
    setSelectingSlot(null);
  };

  const handlePutOnTransfer = async () => {
    if (!profileHero || !user || !profile || isTransferring) return;
    const liveAge = calculateLiveAge(profileHero.baseAge, profileHero.hiredAt);
    if (liveAge.numeric < 18) {
      toast({ variant: "destructive", title: t.tooYoung });
      return;
    }
    setIsTransferring(true);
    try {
      const today = getMoscowDateString();
      const mskNow = getMoscowTime();
      const expiryTime = new Date(mskNow.getTime() + 12 * 60 * 60 * 1000);
      const startPrice = (profileHero.overallRating * 15000) + 100000;
      const agentId = `user_${user.uid}_${Date.now()}`;
      const agentData = { id: agentId, heroData: JSON.parse(JSON.stringify(profileHero)), currentBid: startPrice, startingPrice: startPrice, highestBidderId: null, highestBidderName: null, bidders: [], sellerId: user.uid, sellerName: profile.displayName || "Manager", expiresAt: expiryTime.toISOString(), dropDate: today, dropTime: mskNow.toISOString() };
      await setDoc(doc(db, 'market_v7', agentId), agentData);
      updateHero(profileHero.id, { onTransferUntil: expiryTime.toISOString(), transferMarketId: agentId });
      toast({ title: language === 'ru' ? "Выставлен на аукцион!" : "Listed for Auction!" });
      setProfileHero(null);
    } catch (e: any) {
      toast({ variant: "destructive", title: "Transfer Failed", description: e.message });
    } finally {
      setIsTransferring(false);
    }
  };

  const renderSlot = (slotKey: LineupSlot) => {
    const hero = getHeroById(lineup[slotKey]);
    const isSelected = selectingSlot === slotKey;
    const roleInfo = (t.roles as any)[slotKey];

    return (
      <Card 
        key={slotKey}
        onMouseDown={() => handleStartPress(hero)}
        onMouseUp={handleCancelPress}
        onTouchStart={() => handleStartPress(hero)}
        onTouchEnd={handleCancelPress}
        onClick={() => !profileHero && setSelectingSlot(prev => prev === slotKey ? null : slotKey)}
        className={cn(
          "glass-card border-white/5 overflow-hidden transition-all cursor-pointer select-none",
          hero ? "bg-primary/5 border-primary/10" : "hover:border-white/20",
          isSelected && "ring-2 ring-primary border-primary bg-primary/20 scale-[1.02] z-10"
        )}
      >
        <CardContent className="p-3 flex items-center gap-4 relative">
          <div className="relative">
            <div className={cn("w-12 h-12 rounded-xl border flex items-center justify-center bg-secondary/50 overflow-hidden", hero ? "border-primary/50" : "border-dashed border-muted")}>
              {hero ? <img src={hero.image} alt="" className="w-full h-full object-cover" /> : <roleInfo.icon className={cn("w-5 h-5", roleInfo.color)} />}
            </div>
            {hero && <div className="absolute -bottom-1 -right-1 bg-background rounded-full p-1 border border-white/10 shadow-lg"><roleInfo.icon className={cn("w-2.5 h-2.5", roleInfo.color)} /></div>}
          </div>
          <div className="flex-1 min-w-0">
            <p className={cn("text-[8px] uppercase font-black tracking-widest", isSelected ? "text-primary" : "text-muted-foreground")}>{roleInfo.label}</p>
            <h3 className="text-xs font-bold leading-tight truncate">{hero ? hero.name : (isSelected ? t.selectHero : t.emptySlot)}</h3>
            {hero && <p className="text-[8px] text-muted-foreground uppercase font-black tracking-tighter">{calculateLiveAge(hero.baseAge, hero.hiredAt).display} {t.profile.years}</p>}
          </div>
          <div className="flex items-center gap-3">
            {hero ? <div className="flex flex-col items-center justify-center min-w-[45px] border-l border-white/5 pl-3"><p className="text-[7px] font-black text-accent uppercase tracking-tighter mb-0.5">{t.overall}</p><span className="text-xl font-headline font-bold text-accent italic leading-none">{hero.overallRating}</span></div> : <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-primary/10 border border-primary/20 text-primary"><Plus className="w-4 h-4" /></div>}
          </div>
          {hero && isSelected && (
            <button onClick={(e) => { e.stopPropagation(); assignToRole(slotKey, null); setSelectingSlot(null); }} className="absolute top-1 right-1 p-1 text-red-400"><X className="w-3.5 h-3.5" /></button>
          )}
        </CardContent>
      </Card>
    );
  };

  const renderStars = (rating: number) => (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => {
        const fill = Math.min(Math.max(rating - i, 0), 1);
        return (
          <div key={i} className="relative w-2.5 h-2.5">
            <Star className="absolute inset-0 w-2.5 h-2.5 text-muted-foreground/20" />
            <div className="absolute inset-0 overflow-hidden" style={{ width: `${fill * 100}%` }}><Star className="w-2.5 h-2.5 text-yellow-500 fill-yellow-500" /></div>
          </div>
        );
      })}
    </div>
  );

  if (!isLoaded) return null;

  if (profileHero) {
    return (
      <div className="min-h-screen bg-background text-foreground animate-in fade-in slide-in-from-right-4 duration-300 overflow-y-auto scrollbar-hide pb-6">
        <div className="p-4 pt-12 pb-8 bg-gradient-to-br from-primary/20 via-background to-accent/10 border-b border-white/5 flex flex-col items-center text-center gap-4 relative">
          <Button variant="ghost" size="icon" className="absolute left-4 top-10 rounded-full" onClick={() => setProfileHero(null)}>
            <ChevronLeft className="w-6 h-6" />
          </Button>
          
          <div className="relative">
            <div className="w-24 h-24 rounded-2xl overflow-hidden border border-primary/50 shadow-2xl bg-secondary/50">
              <img src={profileHero.image} alt={profileHero.name} className="w-full h-full object-cover" />
            </div>
            <div className="absolute -bottom-1 -right-1 w-8 h-8 rounded-lg bg-background border border-white/10 flex items-center justify-center shadow-xl">
              <span className="text-base">{profileHero.country?.flag || '🏳️'}</span>
            </div>
          </div>
          
          <div className="space-y-1">
            <h1 className="text-2xl font-headline font-bold uppercase text-white tracking-tight leading-none">{profileHero.name}</h1>
            <div className="flex items-center justify-center gap-2">
              <Badge className="bg-primary text-primary-foreground text-[10px] font-black uppercase px-2 h-5">{profileHero.role}</Badge>
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
        
        <div className="p-4 space-y-8">
            <section>
              <h3 className="text-[9px] font-black text-primary uppercase tracking-[0.2em] mb-4 flex items-center gap-2 opacity-80 px-1">
                <Info className="w-3.5 h-3.5" /> BIOMETRICS & STATUS
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-secondary/20 p-3 rounded-xl border border-white/5 space-y-0.5">
                  <p className="text-[7px] font-black text-muted-foreground uppercase">{t.profile.age}</p>
                  <p className="text-xs font-bold">{calculateLiveAge(profileHero.baseAge, profileHero.hiredAt).display} {t.profile.years}</p>
                </div>
                <div className="bg-secondary/20 p-3 rounded-xl border border-white/5 space-y-0.5">
                  <p className="text-[7px] font-black text-muted-foreground uppercase">{t.profile.status}</p>
                  <p className={cn("text-[10px] font-bold flex items-center gap-1.5", profileHero.isInjured ? "text-red-400" : "text-green-400")}>
                    {profileHero.isInjured ? t.profile.injured : t.profile.healthy}
                  </p>
                </div>
              </div>
            </section>

            <section>
              <h3 className="text-[9px] font-black text-accent uppercase tracking-[0.2em] mb-4 flex items-center gap-2 opacity-80 px-1">
                <Award className="w-3.5 h-3.5" /> {t.profile.stats}
              </h3>
              <div className="space-y-3">
                {Object.entries(profileHero.proStats).map(([key, value]) => { 
                  const talent = profileHero.proTalents ? (profileHero.proTalents as any)[key] : 3.0; 
                  const icons: Record<string, any> = {
                    lastHitting: Target, mapAwareness: Eye, positioning: Map, reflexes: Zap,
                    manaManagement: Sparkles, objectiveControl: Sword, communication: Users,
                    tiltResistance: Brain, versatility: TrendingUp, ganking: Crosshair,
                  };
                  const Icon = icons[key] || Info;
                  return (
                    <div key={key} className="space-y-2 p-3 rounded-xl border border-white/5 bg-secondary/10 transition-all">
                      <div className="flex justify-between items-center px-0.5">
                        <div className="flex items-center gap-2">
                          <Icon className="w-3.5 h-3.5 text-muted-foreground/60" />
                          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                            {t.proStatsLabels[key as keyof typeof t.proStatsLabels]}
                          </span>
                        </div>
                        <div className="flex flex-col items-end">
                          <span className="text-[10px] font-mono font-bold text-primary">{value} / 50</span>
                          {renderStars(talent)}
                        </div>
                      </div>
                      <Progress value={value} max={50} className="h-1 rounded-full bg-secondary/40" />
                    </div>
                  ); 
                })}
              </div>
            </section>

            <div className="pt-4 flex flex-col gap-2">
              <Button 
                className="w-full h-14 bg-orange-600 hover:bg-orange-700 text-white font-black text-[11px] tracking-widest uppercase shadow-xl" 
                onClick={handlePutOnTransfer}
                disabled={isTransferring || (profileHero.onTransferUntil !== null && new Date(profileHero.onTransferUntil).getTime() > now)}
              >
                {isTransferring ? <Loader2 className="animate-spin mr-2" /> : <ShoppingCart className="w-4 h-4 mr-2" />}
                {profileHero.onTransferUntil && new Date(profileHero.onTransferUntil).getTime() > now ? t.onAuction : t.putOnTransfer}
              </Button>
              <Button variant="ghost" className="w-full h-12 text-[9px] font-black uppercase tracking-widest text-muted-foreground" onClick={() => setProfileHero(null)}>
                {t.profile.close}
              </Button>
            </div>
        </div>
      </div>
    );
  }

  const reserveSlots: LineupSlot[] = [];
  const maxReserves = squadLimit - 7;
  for (let i = 1; i <= maxReserves; i++) {
    reserveSlots.push(`res${i}` as LineupSlot);
  }

  return (
    <div className="max-w-md mx-auto px-4 pt-8 pb-6">
      <header className="mb-6 flex items-center justify-between gap-4">
        <div className="flex items-center gap-4 flex-1 min-w-0">
          <Link href="/roster"><Button variant="ghost" size="icon" className="rounded-full shrink-0"><ChevronLeft className="w-6 h-6" /></Button></Link>
          <div className="min-w-0 flex-1">
            {isPremium ? (
              <div className="relative inline-flex items-center min-w-0 max-w-full">
                <div className="absolute inset-0 bg-gradient-to-r from-accent/25 via-accent/5 to-transparent border-l-2 border-accent -z-10" />
                <h1 className="px-3 py-1 text-2xl font-headline font-black uppercase tracking-tighter truncate text-white">
                  {profile?.displayName || t.title}
                </h1>
              </div>
            ) : (
              <h1 className="text-2xl font-headline font-black uppercase tracking-tighter truncate text-white">
                {profile?.displayName || t.title}
              </h1>
            )}
            <p className="text-muted-foreground text-[10px] uppercase tracking-widest">{t.subtitle}</p>
          </div>
        </div>
        <div className="flex flex-col items-center justify-center min-w-[60px] shrink-0">
          <p className="text-[9px] font-black text-primary tracking-widest uppercase mb-1">{t.teamOverall}</p>
          <div className="relative flex items-center justify-center"><Shield className="w-10 h-10 text-primary fill-primary/10" strokeWidth={2} /><span className="absolute inset-0 flex items-center justify-center text-lg font-headline font-bold text-accent italic pt-0.5">{teamOvr}</span></div>
        </div>
      </header>

      <div className="space-y-8">
        <section className="space-y-2">
          <h2 className="text-[10px] font-bold uppercase tracking-[0.2em] text-accent px-1 flex items-center gap-2"><ShieldCheck className="w-3.5 h-3.5" /> {t.activeLabel}</h2>
          <div className="space-y-2">{(['carry', 'mid', 'offlane', 'support', 'full_support'] as LineupSlot[]).map(renderSlot)}</div>
        </section>
        <section className="space-y-2">
          <h2 className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground px-1 flex items-center gap-2"><UserPlus className="w-3.5 h-3.5" /> {t.subsLabel}</h2>
          <div className="space-y-2">{(['sub1', 'sub2'] as LineupSlot[]).map(renderSlot)}</div>
        </section>
        <section className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/50 flex items-center gap-2">
              <Users className="w-3.5 h-3.5" /> {t.reservesLabel}
            </h2>
          </div>
          <div className="space-y-2">{reserveSlots.map(renderSlot)}</div>
          {activeLicenseTier === 4 && !isPremium && (
            <Link href="/shop" className="block p-4 mt-2 bg-primary/5 border border-dashed border-primary/20 rounded-xl text-center group hover:bg-primary/10 transition-all">
              <p className="text-[8px] font-black text-primary uppercase tracking-widest">Upgrade License for more Reserve Slots</p>
            </Link>
          )}
        </section>

        {selectingSlot && (
          <section className="space-y-3 pt-6 border-t border-primary/20 animate-in slide-in-from-bottom-4">
            <div className="flex items-center justify-between px-1"><div className="flex items-center gap-2"><Box className="w-4 h-4 text-primary" /><h2 className="text-sm font-bold uppercase tracking-tight text-primary">{t.availableHeroes}</h2></div><Button variant="ghost" size="sm" onClick={() => setSelectingSlot(null)} className="h-7 text-[10px] font-bold text-muted-foreground"><Undo2 className="w-3 h-3 mr-1" /> {t.cancel}</Button></div>
            <div className="grid grid-cols-1 gap-2">
              {ownedHeroes.filter(h => roleMapping[selectingSlot].includes(h.role)).map((hero) => {
                const liveAge = calculateLiveAge(hero.baseAge, hero.hiredAt);
                const onAuction = hero.onTransferUntil && new Date(hero.onTransferUntil).getTime() > now;
                return (
                  <Card key={hero.id} className={cn("glass-card border-white/10 overflow-hidden cursor-pointer", (liveAge.numeric < 18 || onAuction) && "opacity-60 grayscale cursor-not-allowed")} onClick={() => hero.onTransferUntil && new Date(hero.onTransferUntil).getTime() > now ? null : handleHeroAssign(hero)}>
                    <CardContent className="p-2 flex items-center gap-3"><div className="w-10 h-10 rounded-xl overflow-hidden bg-muted"><img src={hero.image} alt="" className="w-full h-full object-cover" /></div><div className="flex-1 min-w-0"><div className="flex items-center gap-2"><h4 className="font-bold text-[11px] truncate">{hero.name}</h4><span className="text-[7px] text-muted-foreground font-black uppercase">{hero.role}</span></div><div className="flex items-center gap-3 mt-0.5"><span className="text-[9px] font-bold text-accent flex items-center gap-1"><Star className="w-2.5 h-2.5 fill-accent/20" /> {hero.overallRating}</span><span className={cn("text-[8px] font-black uppercase tracking-tighter", liveAge.numeric < 18 ? "text-red-400" : "text-muted-foreground")}>{liveAge.display} {t.profile.years}</span>{onAuction && <Badge className="bg-yellow-500/20 text-yellow-500 text-[6px] h-3 px-1 border-none font-black uppercase">AUCTION</Badge>}</div></div><div className="w-6 h-6 rounded-full flex items-center justify-center bg-primary/10 border border-primary/20 text-primary"><Plus className="w-3 h-3" /></div></CardContent>
                  </Card>
                );
              })}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
