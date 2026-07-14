'use client';

import { useState, useMemo, useEffect } from 'react';
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
  Users, Target, Eye, Map, Star, Activity, User, ShieldAlert, Gem, Timer, 
  Activity as ActivityIcon, Brain, TrendingUp, Crosshair, Search
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Player } from '../../lib/moba-data';
import Link from 'next/link';
import { calculateLiveAge, getMoscowDateString, getMoscowTime } from '@/app/lib/time-utils';
import { useToast } from '@/hooks/use-toast';
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { LoadingScreen } from '@/components/game/LoadingScreen';
import { renderStars, STAT_KEYS } from '@/app/transfers/quick-search/page';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

const normTalent = (val: any) => {
  const n = Number(val);
  if (isNaN(n)) return 0;
  return n < 10 ? Math.round(n * 10) : Math.round(n);
};

export default function SquadPage() {
  const { 
    ownedPlayers, youthAcademyPlayers, lineup, assignToRole, updateLineup, isLoaded, 
    language, updatePlayer, isPremium, activeLicenseTier, displayName, credits, crystals
  } = useGameState();
  const { user } = useUser();
  const db = useFirestore();
  const { toast } = useToast();
  
  const [managedSlot, setManagedSlot] = useState<LineupSlot | null>(null);
  const [profilePlayer, setProfilePlayer] = useState<Player | null>(null);
  const [isTransferring, setIsTransferring] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [draggedSlot, setDraggedSlot] = useState<LineupSlot | null>(null);

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
    unassign: language === 'ru' ? "ОСВОБОДИТЬ СЛОТ" : "UNASSIGN SLOT",
    noAvailable: language === 'ru' ? "Нет подходящих свободных игроков" : "No suitable free players available",
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

  const getPlayerById = (id: string | null) => allAvailablePlayers.find(p => p.id === id);

  const teamOvr = useMemo(() => {
    const activeSlots: LineupSlot[] = ['carry', 'mid', 'offlane', 'support', 'full_support'];
    const activePlayers = activeSlots.map(slot => getPlayerById(lineup[slot])).filter(Boolean) as Player[];
    if (activePlayers.length === 0) return 0;
    return Math.round(activePlayers.reduce((acc, p) => acc + p.overallRating, 0) / activePlayers.length);
  }, [lineup, allAvailablePlayers]);

  const handlePlayerAssign = (player: Player) => {
    if (!managedSlot) return;
    if (player.onTransferUntil && new Date(player.onTransferUntil) > new Date()) {
      toast({ variant: "destructive", title: t.onAuction }); return;
    }
    if (player.isYouth) {
      toast({ variant: "destructive", title: t.tooYoung }); return;
    }
    assignToRole(managedSlot, player.id);
    setManagedSlot(null);
    toast({ title: language === 'ru' ? "Состав обновлен" : "Squad Updated" });
  };

  const handleUnassign = () => {
    if (!managedSlot) return;
    assignToRole(managedSlot, null);
    setManagedSlot(null);
    toast({ title: language === 'ru' ? "Слот освобожден" : "Slot Unassigned" });
  };

  // Drag and Drop handlers
  const handleDragStart = (e: React.DragEvent, slot: LineupSlot) => {
    setDraggedSlot(slot);
    e.dataTransfer.setData('sourceSlot', slot);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault(); // Allow drop
  };

  const handleDrop = async (e: React.DragEvent, targetSlot: LineupSlot) => {
    e.preventDefault();
    const sourceSlot = e.dataTransfer.getData('sourceSlot') as LineupSlot;
    if (!sourceSlot || sourceSlot === targetSlot) return;

    const sourcePlayerId = lineup[sourceSlot];
    const targetPlayerId = lineup[targetSlot];

    // Swapping players in the lineup
    updateLineup({
      [sourceSlot]: targetPlayerId,
      [targetSlot]: sourcePlayerId
    });

    toast({ title: language === 'ru' ? "Позиции изменены" : "Positions Swapped" });
    setDraggedSlot(null);
  };

  const handleTransferListing = async (player: Player) => {
    if (!player || !user || !profile || isTransferring) return;
    setIsTransferring(true);
    try {
      const today = getMoscowDateString();
      const mskNow = getMoscowTime();
      const expiryTime = new Date(mskNow.getTime() + 12 * 60 * 60 * 1000); 
      const startPrice = Math.floor((player.overallRating * 15000) + 100000);
      
      const agentId = `p_${user.uid}_${Date.now()}`;
      const agentData = {
        id: agentId,
        heroData: JSON.parse(JSON.stringify(player)),
        currentBid: startPrice,
        startingPrice: startPrice,
        highestBidderId: null,
        highestBidderName: null,
        bidders: [],
        sellerId: user.uid,
        sellerName: profile.displayName || "Manager",
        expiresAt: expiryTime.toISOString(),
        dropDate: today,
        createdAt: serverTimestamp(),
        isYouth: player.isYouth || false,
        isPro: player.isPro || false,
        currency: 'credits'
      };

      await setDoc(doc(db, 'market_v7', agentId), agentData);
      updatePlayer(player.id, { 
        onTransferUntil: expiryTime.toISOString(),
        transferMarketId: agentId 
      });

      toast({ title: language === 'ru' ? "Игрок выставлен на аукцион!" : "Player listed on auction!" });
      setProfilePlayer(null);
    } catch (e: any) {
      console.error(e);
      toast({ variant: "destructive", title: "Action Failed", description: e.message });
    } finally {
      setIsTransferring(false);
    }
  };

  const renderSlot = (slotKey: LineupSlot) => {
    const player = getPlayerById(lineup[slotKey]);
    const roleInfo = (t.roles as any)[slotKey];

    return (
      <div key={slotKey} className="group relative">
        <Card 
          draggable={!!player}
          onDragStart={(e) => handleDragStart(e, slotKey)}
          onDragOver={handleDragOver}
          onDrop={(e) => handleDrop(e, slotKey)}
          onClick={() => {
            if (player) {
              setProfilePlayer(player);
            } else {
              setManagedSlot(slotKey);
            }
          }}
          className={cn(
            "glass-card border-white/5 overflow-hidden transition-all cursor-pointer select-none", 
            player ? "bg-primary/5 border-primary/20 hover:border-primary/40" : "hover:bg-white/5",
            draggedSlot === slotKey && "opacity-50 border-accent/50"
          )}
        >
          <CardContent className="p-2 flex items-center gap-3 relative">
            <div className="relative shrink-0">
              <div className={cn("w-10 h-10 rounded-lg border flex items-center justify-center bg-secondary/50 overflow-hidden", player ? "border-primary/50" : "border-dashed border-muted")}>
                {player ? <img src={player.image} alt="" className="w-full h-full object-cover" /> : <roleInfo.icon className={cn("w-4 h-4", roleInfo.color)} />}
              </div>
              {player && <div className="absolute -bottom-1 -right-1 bg-background rounded-full p-0.5 border border-white/10 shadow-lg"><roleInfo.icon className={cn("w-2 h-2", roleInfo.color)} /></div>}
            </div>
            <div className="flex-1 min-w-0">
              <p className={cn("text-[7px] uppercase font-black tracking-widest", player ? "text-primary" : "text-muted-foreground")}>{roleInfo.label}</p>
              <h3 className="text-[11px] font-bold leading-tight truncate">{player ? player.name : t.emptySlot}</h3>
            </div>
            
            {player && (
              <div className="flex items-center gap-2">
                <div className="flex flex-col items-center justify-center min-w-[35px] border-l border-white/5 pl-2">
                  <p className="text-[6px] font-black text-primary uppercase tracking-widest mb-0.5">ОБЩ</p>
                  <span className="text-lg font-headline font-bold text-accent italic leading-none">{player.overallRating}</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  };

  const reserveSlots: LineupSlot[] = [];
  for (let i = 1; i <= squadLimit - 7; i++) { reserveSlots.push(`res${i}` as LineupSlot); }

  if (!isLoaded) return <LoadingScreen />;

  const managedSlotInfo = managedSlot ? (t.roles as any)[managedSlot] : null;
  const currentOccupant = managedSlot ? getPlayerById(lineup[managedSlot]) : null;
  const compatiblePlayers = managedSlot ? allAvailablePlayers.filter(p => 
    roleMapping[managedSlot].includes(p.role) && 
    !Object.values(lineup).includes(p.id) &&
    !p.isYouth
  ) : [];

  return (
    <div className="max-w-md mx-auto px-4 pt-8 pb-20">
      <header className="mb-6 flex items-center justify-between gap-4">
        <div className="flex items-center gap-4 flex-1 min-w-0">
          <Link href="/roster"><Button variant="ghost" size="icon" className="rounded-full shrink-0"><ChevronLeft className="w-6 h-6" /></Button></Link>
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-headline font-black uppercase tracking-tighter truncate text-white">{profile?.clubName || t.title}</h1>
            <p className="text-muted-foreground text-[10px] uppercase tracking-widest">{t.subtitle}</p>
          </div>
        </div>
        <div className="flex flex-col items-center justify-center min-w-[60px] shrink-0">
          <p className="text-[9px] font-black text-primary tracking-widest uppercase mb-1">{t.teamOverall}</p>
          <div className="relative flex items-center justify-center">
            <Shield className="w-10 h-10 text-primary fill-primary/10" strokeWidth={2} />
            <span className="absolute inset-0 flex items-center justify-center text-lg font-headline font-bold text-accent italic pt-0.5">{teamOvr}</span>
          </div>
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
      </div>

      {/* SLOT MANAGEMENT DIALOG (Quick Assign for Empty Slots) */}
      <Dialog open={!!managedSlot} onOpenChange={() => setManagedSlot(null)}>
        <DialogContent className="max-w-md bg-background border-white/10 p-0 overflow-hidden shadow-2xl h-[85vh] flex flex-col">
          <DialogHeader className="p-6 bg-gradient-to-br from-primary/10 to-transparent border-b border-white/5 shrink-0">
             <div className="flex items-center gap-4">
                <div className={cn("w-14 h-14 rounded-2xl bg-secondary/50 flex items-center justify-center border border-white/10 shadow-xl", managedSlotInfo?.color)}>
                  {managedSlotInfo?.icon && <managedSlotInfo.icon className="w-7 h-7" />}
                </div>
                <div>
                   <DialogTitle className="text-xl font-headline font-bold uppercase tracking-tight text-white">{managedSlotInfo?.label}</DialogTitle>
                   <DialogDescription className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">{language === 'ru' ? 'УПРАВЛЕНИЕ ПОЗИЦИЕЙ' : 'POSITION MANAGEMENT'}</DialogDescription>
                </div>
             </div>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto p-4 space-y-6 scrollbar-hide">
            <section className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <h3 className="text-[9px] font-black uppercase text-accent tracking-widest">{t.availablePlayers}</h3>
                <Badge variant="outline" className="text-[7px] border-white/10 opacity-50 uppercase">{compatiblePlayers.length} UNIT(S)</Badge>
              </div>

              {compatiblePlayers.length > 0 ? (
                <div className="grid grid-cols-1 gap-2">
                  {compatiblePlayers.map((player) => (
                    <Card key={player.id} className="glass-card border-white/5 hover:bg-white/5 cursor-pointer transition-all active:scale-[0.98]" onClick={() => handlePlayerAssign(player)}>
                      <CardContent className="p-3 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                           <div className="w-10 h-10 rounded-lg overflow-hidden border border-white/10 bg-secondary/30">
                             <img src={player.image} alt="" className="w-full h-full object-cover" />
                           </div>
                           <div>
                             <h4 className="text-xs font-bold uppercase text-white truncate max-w-[120px]">{player.name}</h4>
                             <p className="text-[8px] text-muted-foreground uppercase font-black">{player.overallRating} OVR • {player.role}</p>
                           </div>
                        </div>
                        <Button size="sm" variant="ghost" className="h-8 px-3 text-[8px] font-black uppercase text-primary">
                          <Plus className="w-3 h-3 mr-1" /> {language === 'ru' ? 'ВЫБРАТЬ' : 'SELECT'}
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="py-12 text-center opacity-30 border border-dashed border-white/5 rounded-2xl flex flex-col items-center gap-3">
                   <Users className="w-8 h-8" />
                   <p className="text-[9px] font-bold uppercase tracking-widest max-w-[160px] mx-auto">{t.noAvailable}</p>
                </div>
              )}
            </section>
          </div>

          <div className="p-4 bg-secondary/20 border-t border-white/5 shrink-0">
             <Button variant="outline" className="w-full h-12 uppercase font-black text-[10px] border-white/10" onClick={() => setManagedSlot(null)}>
               {language === 'ru' ? 'ЗАКРЫТЬ' : 'CLOSE'}
             </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* PLAYER DOSSIER DIALOG (Portfolio) */}
      <Dialog open={!!profilePlayer} onOpenChange={() => setProfilePlayer(null)}>
        {profilePlayer && (
          <DialogContent className="max-w-md bg-background border-white/10 p-0 overflow-y-auto overflow-x-hidden shadow-2xl h-full flex flex-col">
            <div className="p-4 pt-12 pb-8 bg-gradient-to-br from-primary/20 via-background to-accent/10 border-b border-white/5 flex flex-col items-center text-center gap-4 relative shrink-0">
              <Button variant="ghost" size="icon" className="absolute left-4 top-10 rounded-full bg-black/20" onClick={() => setProfilePlayer(null)}><X className="w-5 h-5" /></Button>
              <div className="relative mx-auto w-24 h-24 mb-4">
                <div className={cn("w-full h-full rounded-2xl overflow-hidden border-2 border-primary/50 shadow-2xl bg-secondary/50", profilePlayer.isPro ? "border-yellow-500" : "border-primary/50")}>
                  <img src={profilePlayer.image} alt={profilePlayer.name} className="w-full h-full object-cover" />
                </div>
                <div className="absolute -bottom-1 -right-1 w-8 h-8 rounded-lg bg-background border border-white/10 flex items-center justify-center shadow-xl"><span className="text-base">{profilePlayer.country?.flag}</span></div>
              </div>
              <div className="space-y-1">
                <DialogTitle className="text-2xl font-headline font-bold uppercase text-white tracking-tight leading-none">{profilePlayer.name}</DialogTitle>
                <DialogDescription className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest mt-1">
                  {language === 'ru' ? 'ЛИЧНОЕ ДОСЬЕ ИГРОКА' : 'PLAYER OPERATIONAL DOSSIER'}
                </DialogDescription>
                <div className="flex items-center justify-center gap-2 mt-2">
                  <Badge className="bg-primary text-primary-foreground text-[10px] font-black uppercase px-2 h-5">{profilePlayer.role}</Badge>
                </div>
              </div>
            </div>

            <div className="p-4 space-y-8 flex-1 scrollbar-hide">
                <section className="grid grid-cols-2 gap-3">
                  <div className="bg-secondary/20 p-3 rounded-xl border border-white/5 space-y-1">
                    <p className="text-[8px] font-black text-muted-foreground uppercase tracking-widest">{language === 'ru' ? 'ВЛАДЕЛЕЦ' : 'OWNER'}</p>
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="w-3 h-3 text-primary" />
                      <p className="text-[10px] font-bold uppercase truncate">{displayName || "Manager"}</p>
                    </div>
                  </div>
                  <div className="bg-secondary/20 p-3 rounded-xl border border-white/5 space-y-1">
                    <p className="text-[8px] font-black text-muted-foreground uppercase tracking-widest">{language === 'ru' ? 'ПРОДАЖА' : 'SALE'}</p>
                    <div className="flex items-center gap-2">
                      <Timer className="w-3 h-3 text-accent animate-pulse" />
                      <p className="text-[10px] font-mono font-bold text-accent">
                        {profilePlayer.onTransferUntil ? new Date(profilePlayer.onTransferUntil).toLocaleTimeString() : 'OFF MARKET'}
                      </p>
                    </div>
                  </div>
                </section>

                <section className="space-y-3">
                  <h3 className="text-[9px] font-black text-primary uppercase tracking-[0.2em] mb-4 flex items-center gap-2 opacity-80 px-1">
                    <Info className="w-3.5 h-3.5" /> {language === 'ru' ? 'ОБЩИЕ ДАННЫЕ' : 'GENERAL INTEL'}
                  </h3>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="flex items-center justify-between p-3 bg-secondary/10 rounded-xl border border-white/5 min-h-[64px]">
                       <span className="text-[9px] font-bold text-muted-foreground uppercase">{language === 'ru' ? 'Возраст' : 'Age'}</span>
                       <span className="text-[10px] font-bold">{calculateLiveAge(profilePlayer.baseAge, profilePlayer.hiredAt).display} {language === 'ru' ? 'лет' : 'yrs'}</span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-secondary/10 rounded-xl border border-white/5 min-h-[64px]">
                       <span className="text-[9px] font-bold text-muted-foreground uppercase whitespace-nowrap">{language === 'ru' ? 'Талант' : 'Talent'}</span>
                       <div className="flex items-center">
                         {renderStars(Math.max(...Object.values(profilePlayer.proTalents || {}).map(v => normTalent(v))))}
                       </div>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-secondary/10 rounded-xl border border-white/5 min-h-[64px]">
                       <span className="text-[9px] font-bold text-muted-foreground uppercase">{language === 'ru' ? 'Зарплата' : 'Salary'}</span>
                       <span className="text-[10px] font-bold text-primary">€{(profilePlayer.salary || 0).toLocaleString()}</span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-secondary/10 rounded-xl border border-white/5 min-h-[64px]">
                       <span className="text-[9px] font-bold text-muted-foreground uppercase">{language === 'ru' ? 'Роль' : 'Role'}</span>
                       <span className="text-[10px] font-bold uppercase">{profilePlayer.role}</span>
                    </div>
                  </div>
                </section>

                <section>
                  <h3 className="text-[9px] font-black text-primary uppercase tracking-[0.2em] mb-4 flex items-center gap-2 opacity-80 px-1">
                    <ActivityIcon className="w-3.5 h-3.5" /> {language === 'ru' ? 'НАВЫКИ' : 'SKILLS'}
                  </h3>
                  <div className="space-y-3">
                    {STAT_KEYS.map((key) => { 
                      const Icon = icons[key] || Info;
                      const displayValue = Math.round(Number((profilePlayer.proStats as any)[key]));
                      const talentLimit = normTalent((profilePlayer.proTalents as any)[key] || 10);

                      return (
                        <div key={`skill-${key}`} className="space-y-2 p-3 rounded-xl border border-white/5 bg-secondary/10">
                          <div className="flex justify-between items-center px-0.5">
                            <div className="flex items-center gap-2">
                              <Icon className="w-4 h-4 text-muted-foreground/60" />
                              <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{(t.proStatsLabels as any)[key] || key.toUpperCase()}</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-mono font-bold text-white">{displayValue}</span>
                              <span className="text-[10px] text-muted-foreground/50">/</span>
                              <span className="text-xs font-mono font-bold text-primary/70">{talentLimit}</span>
                            </div>
                          </div>
                          <Progress value={(displayValue / talentLimit) * 100} max={100} className="h-1 rounded-full bg-secondary/40" />
                        </div>
                      ); 
                    })}
                  </div>
                </section>

                <section className="pt-4 border-t border-white/5">
                  <h3 className="text-[9px] font-black text-yellow-500 uppercase tracking-[0.2em] mb-4 flex items-center gap-2 opacity-80 px-1">
                    <Gem className="w-3.5 h-3.5" /> {language === 'ru' ? 'ЦЕНА ИГРОКА' : 'UNIT PRICE'}
                  </h3>
                  <div className="bg-secondary/30 p-4 rounded-xl border border-white/5">
                     <p className="text-[8px] font-black text-muted-foreground uppercase">ESTIMATED MARKET VALUE</p>
                     <p className="text-xl font-headline font-bold text-white italic">€ {(profilePlayer.overallRating * 15000 + 100000).toLocaleString()}</p>
                  </div>
                </section>
                
                <div className="pt-4 pb-8 flex flex-col gap-2">
                  <Button 
                    className="w-full h-14 hero-gradient font-black text-xs uppercase tracking-widest shadow-xl"
                    onClick={() => handleTransferListing(profilePlayer)}
                    disabled={isTransferring || (profilePlayer.onTransferUntil && new Date(profilePlayer.onTransferUntil) > now)}
                  >
                    {isTransferring ? <Loader2 className="animate-spin mr-2" /> : <ShoppingCart className="w-4 h-4 mr-2" />}
                    {profilePlayer.onTransferUntil && new Date(profilePlayer.onTransferUntil) > now ? (language === 'ru' ? 'УЖЕ НА РЫНКЕ' : 'ALREADY LISTED') : (language === 'ru' ? 'ВЫСТАВИТЬ НА ТРАНСФЕР' : 'LIST ON TRANSFER MARKET')}
                  </Button>
                  <Button variant="ghost" className="w-full h-12 text-[9px] font-black uppercase tracking-widest text-muted-foreground" onClick={() => setProfilePlayer(null)}>{language === 'ru' ? 'ЗАКРЫТЬ' : 'BACK'}</Button>
                </div>
            </div>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}

const icons: Record<string, any> = {
  lastHitting: Target, mapAwareness: Eye, positioning: Map, reflexes: Zap,
  manaManagement: Sparkles, objectiveControl: Sword, communication: Users,
  tiltResistance: Brain, versatility: TrendingUp, ganking: Crosshair,
};
