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
  Box, Undo2, Info, ShoppingCart, Loader2,
  Users, Target, Eye, Map, Star, Activity, User, ShieldAlert, Gem, Timer, Activity as ActivityIcon
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Player } from '../../lib/moba-data';
import Link from 'next/link';
import { calculateLiveAge, getMoscowDateString, getMoscowTime } from '@/app/lib/time-utils';
import { useToast } from '@/hooks/use-toast';
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { renderStars, STAT_KEYS } from '@/app/transfers/quick-search/page';

const normTalent = (val: any) => {
  const n = Number(val);
  if (isNaN(n)) return 0;
  return n < 10 ? Math.round(n * 10) : Math.round(n);
};

export default function SquadPage() {
  const { 
    ownedPlayers, youthAcademyPlayers, lineup, assignToRole, isLoaded, 
    language, updatePlayer, isPremium, activeLicenseTier, displayName 
  } = useGameState();
  const { user } = useUser();
  const db = useFirestore();
  const { toast } = useToast();
  const [selectingSlot, setSelectingSlot] = useState<LineupSlot | null>(null);
  const [profilePlayer, setProfilePlayer] = useState<Player | null>(null);
  const [isTransferring, setIsTransferring] = useState(false);
  const [now, setNow] = useState(Date.now());
  
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);

  const allAvailablePlayers = useMemo(() => {
    return [...ownedPlayers, ...youthAcademyPlayers];
  }, [ownedPlayers, youthAcademyPlayers]);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const userRef = useMemoFirebase(() => (user?.uid ? doc(db, 'players_v10', user.uid) : null), [db, user?.uid]);
  const { data: profile } = useDoc(userRef);

  const squadLimit = useMemo(() => {
    if (isPremium) return 15;
    const tier = activeLicenseTier || 4;
    if (tier === 1) return 12;
    if (tier === 2) return 10;
    if (tier === 3) return 8;
    return 7;
  }, [isPremium, activeLicenseTier]);

  const t = {
    title: language === 'ru' ? "СОСТАВ ИГРОКОВ" : "PLAYER ROSTER",
    subtitle: language === 'ru' ? "Управление активным ростером" : "Direct roster management",
    activeLabel: language === 'ru' ? "Основа (5)" : "Core (5)",
    subsLabel: language === 'ru' ? "Запас (2)" : "Subs (2)",
    reservesLabel: language === 'ru' ? `Резерв (${squadLimit - 7})` : `Reserves (${squadLimit - 7})`,
    emptySlot: language === 'ru' ? "Назначить" : "Assign",
    teamOverall: language === 'ru' ? "ОБЩ" : "OVR",
    selectPlayer: language === 'ru' ? "Выберите игрока" : "Select player",
    availablePlayers: language === 'ru' ? "Подходящие игроки" : "Compatible Players",
    assigned: language === 'ru' ? "ЗАНЯТ" : "ASSIGNED",
    cancel: language === 'ru' ? "ОТМЕНА" : "CANCEL",
    tooYoung: language === 'ru' ? "Игрок в Академии! Нужно 18 лет." : "In Academy! Needs age 18.",
    onAuction: language === 'ru' ? "ИГРОК НА АУКЦИОНЕ" : "PLAYER ON AUCTION",
    putOnTransfer: language === 'ru' ? "ВЫСТАВИТЬ НА ТРАНСФЕР" : "PUT ON TRANSFER",
    profile: {
      title: language === 'ru' ? "ДОСЬЕ ИГРОКА" : "PLAYER DOSSIER",
      age: language === 'ru' ? "Возраст" : "Age",
      talent: language === 'ru' ? "Талант" : "Talent",
      years: language === 'ru' ? "лет" : "yrs",
      close: language === 'ru' ? "ВЕРНУТЬСЯ" : "BACK",
      owner: language === 'ru' ? "ВЛАДЕЛЕЦ" : "OWNER",
      sale: language === 'ru' ? "ПРОДАЖА" : "SALE",
      priceTitle: language === 'ru' ? "ЦЕНА ИГРОКА" : "UNIT PRICE",
      skills: language === 'ru' ? "НАВЫКИ" : "SKILLS"
    },
    roles: {
      carry: { label: language === 'ru' ? "Керри" : "Carry", icon: Sword, color: "text-red-400" },
      mid: { label: language === 'ru' ? "Мидер" : "Midlaner", icon: Sparkles, color: "text-blue-400" },
      offlane: { label: language === 'ru' ? "Оффлейнер" : "Offlaner", icon: Shield, color: "text-orange-400" },
      support: { label: language === 'ru' ? "Четверка" : "Support", icon: Zap, color: "text-yellow-400" },
      full_support: { label: language === 'ru' ? "Пятерка" : "Full Support", icon: HeartPulse, color: "text-green-400" },
      sub1: { label: language === 'ru' ? "Запасной 1" : "Sub 1", icon: UserPlus, color: "text-muted-foreground" },
      sub2: { label: language === 'ru' ? "Запасной 2" : "Sub 2", icon: UserPlus, color: "text-muted-foreground" },
      res1: { label: "Res 1", icon: Users, color: "text-muted-foreground/50" },
      res2: { label: "Res 2", icon: Users, color: "text-muted-foreground/50" },
      res3: { label: "Res 3", icon: Users, color: "text-muted-foreground/50" },
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
      communication: language === 'ru' ? "Конмуникация" : "Communication",
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

  const icons: Record<string, any> = {
    lastHitting: Target, mapAwareness: Eye, positioning: Map, reflexes: Zap,
    manaManagement: Sparkles, objectiveControl: Sword, communication: Users,
    tiltResistance: Brain, versatility: TrendingUp, ganking: Crosshair,
  };

  const getPlayerById = (id: string | null) => allAvailablePlayers.find(p => p.id === id);

  const teamOvr = useMemo(() => {
    const activeSlots: LineupSlot[] = ['carry', 'mid', 'offlane', 'support', 'full_support'];
    const activePlayers = activeSlots.map(slot => getPlayerById(lineup[slot])).filter(Boolean) as Player[];
    if (activePlayers.length === 0) return 0;
    return Math.round(activePlayers.reduce((acc, p) => acc + p.overallRating, 0) / activePlayers.length);
  }, [lineup, allAvailablePlayers]);

  const handleStartPress = (player: Player | undefined) => {
    if (!player) return;
    longPressTimer.current = setTimeout(() => setProfilePlayer(player), 600);
  };

  const handleCancelPress = () => { if (longPressTimer.current) clearTimeout(longPressTimer.current); };

  const handlePlayerAssign = (player: Player) => {
    if (!selectingSlot) return;
    if (player.onTransferUntil && new Date(player.onTransferUntil) > new Date()) {
      toast({ variant: "destructive", title: t.onAuction }); return;
    }
    if (player.isYouth) {
      toast({ variant: "destructive", title: t.tooYoung }); return;
    }
    assignToRole(selectingSlot, player.id);
    setSelectingSlot(null);
  };

  const renderSlot = (slotKey: LineupSlot) => {
    const player = getPlayerById(lineup[slotKey]);
    const isSelected = selectingSlot === slotKey;
    const roleInfo = (t.roles as any)[slotKey];

    return (
      <Card 
        key={slotKey}
        onMouseDown={() => handleStartPress(player)}
        onMouseUp={handleCancelPress}
        onTouchStart={() => handleStartPress(player)}
        onTouchEnd={handleCancelPress}
        onClick={() => !profilePlayer && setSelectingSlot(prev => prev === slotKey ? null : slotKey)}
        className={cn("glass-card border-white/5 overflow-hidden transition-all cursor-pointer select-none", player ? "bg-primary/5" : "hover:bg-white/5", isSelected && "ring-2 ring-primary bg-primary/20 scale-[1.02] z-10")}
      >
        <CardContent className="p-2 flex items-center gap-3 relative">
          <div className="relative shrink-0">
            <div className={cn("w-10 h-10 rounded-lg border flex items-center justify-center bg-secondary/50 overflow-hidden", player ? "border-primary/50" : "border-dashed border-muted")}>
              {player ? <img src={player.image} alt="" className="w-full h-full object-cover" /> : <roleInfo.icon className={cn("w-4 h-4", roleInfo.color)} />}
            </div>
            {player && <div className="absolute -bottom-1 -right-1 bg-background rounded-full p-0.5 border border-white/10 shadow-lg"><roleInfo.icon className={cn("w-2 h-2", roleInfo.color)} /></div>}
          </div>
          <div className="flex-1 min-w-0">
            <p className={cn("text-[7px] uppercase font-black tracking-widest", isSelected ? "text-primary" : "text-muted-foreground")}>{roleInfo.label}</p>
            <h3 className="text-[11px] font-bold leading-tight truncate">{player ? player.name : (isSelected ? t.selectPlayer : t.emptySlot)}</h3>
          </div>
          {player && <div className="flex flex-col items-center justify-center min-w-[35px] border-l border-white/5 pl-2">
            <p className="text-[6px] font-black text-primary uppercase tracking-widest mb-0.5">ОБЩ</p>
            <span className="text-lg font-headline font-bold text-accent italic leading-none">{player.overallRating}</span>
          </div>}
        </CardContent>
      </Card>
    );
  };

  const reserveSlots: LineupSlot[] = [];
  for (let i = 1; i <= squadLimit - 7; i++) { reserveSlots.push(`res${i}` as LineupSlot); }

  if (!isLoaded) return <LoadingScreen />;

  return (
    <div className="max-w-md mx-auto px-4 pt-8 pb-6">
      <header className="mb-6 flex items-center justify-between gap-4">
        <div className="flex items-center gap-4 flex-1 min-w-0">
          <Link href="/roster"><Button variant="ghost" size="icon" className="rounded-full shrink-0"><ChevronLeft className="w-6 h-6" /></Button></Link>
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-headline font-black uppercase tracking-tighter truncate text-white">{profile?.displayName || t.title}</h1>
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
          <div className="space-y-1.5">{ (['carry', 'mid', 'offlane', 'support', 'full_support'] as LineupSlot[]).map(renderSlot) }</div>
        </section>
        <section className="space-y-2">
          <h2 className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground px-1 flex items-center gap-2"><UserPlus className="w-3.5 h-3.5" /> {t.subsLabel}</h2>
          <div className="space-y-1.5">{ (['sub1', 'sub2'] as LineupSlot[]).map(renderSlot) }</div>
        </section>
        <section className="space-y-2">
          <h2 className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/50 px-1 flex items-center gap-2"><Users className="w-3.5 h-3.5" /> {t.reservesLabel}</h2>
          <div className="space-y-1.5">{ reserveSlots.map(renderSlot) }</div>
        </section>

        {selectingSlot && (
          <section className="space-y-3 pt-6 border-t border-primary/20 animate-in slide-in-from-bottom-4">
            <div className="flex items-center justify-between px-1"><div className="flex items-center gap-2"><Box className="w-4 h-4 text-primary" /><h2 className="text-sm font-bold uppercase tracking-tight text-primary">{t.availablePlayers}</h2></div><Button variant="ghost" size="sm" onClick={() => setSelectingSlot(null)} className="h-7 text-[10px] font-bold text-muted-foreground"><Undo2 className="w-3 h-3 mr-1" /> {t.cancel}</Button></div>
            <div className="grid grid-cols-1 gap-1.5">
              {allAvailablePlayers.filter(p => roleMapping[selectingSlot].includes(p.role)).map((player) => {
                const liveAge = calculateLiveAge(player.baseAge, player.hiredAt);
                const onAuction = player.onTransferUntil && new Date(player.onTransferUntil).getTime() > now;
                return (
                  <Card key={player.id} className={cn("glass-card border-white/10 overflow-hidden cursor-pointer", (player.isYouth || onAuction) && "opacity-60 grayscale")} onClick={() => (onAuction || player.isYouth) ? null : handlePlayerAssign(player)}>
                    <CardContent className="p-2 flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg overflow-hidden bg-muted"><img src={player.image} alt="" className="w-full h-full object-cover" /></div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-[11px] truncate">{player.name}</h4>
                          <span className="text-[7px] text-muted-foreground font-black uppercase">{player.role}</span>
                        </div>
                        <div className="flex items-center gap-3 mt-0.5">
                          <span className="text-[9px] font-bold text-accent flex items-center gap-1"><Star className="w-2.5 h-2.5 fill-accent/20" /> {player.overallRating}</span>
                          <span className="text-[8px] font-black uppercase text-muted-foreground">{liveAge.display} {t.profile.years}</span>
                          {player.isYouth && <Badge className="text-[6px] h-3 px-1 border-none bg-orange-500/20 text-orange-400">В АКАДЕМИИ</Badge>}
                        </div>
                      </div>
                    </CardContent>
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
