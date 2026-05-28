
'use client';

import { useState, useEffect, useMemo } from 'react';
import { useGameState } from '../../lib/store';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
} from '@/components/ui/dialog';
import { Slider } from '@/components/ui/slider';
import { Progress } from '@/components/ui/progress';
import { 
  ChevronLeft, MessageSquare, Coffee, ShoppingBag, 
  Monitor, Home, Lightbulb, Wallet, Clock,
  Hammer, Users, MinusCircle, PlusCircle, ImageIcon
} from 'lucide-react';
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { getMoscowTime } from '@/app/lib/time-utils';
import { PlaceHolderImages } from '@/app/lib/placeholder-images';

export default function ArenaPage() {
  const { 
    arena, credits, startCapacityExpansion, startArenaConstruction, checkConstructions, language, isLoaded 
  } = useGameState();
  const { toast } = useToast();
  
  const [selectedFacility, setSelectedFacility] = useState<string | null>(null);
  const [showCapacityDialog, setShowCapacityDialog] = useState(false);
  const [isExpanding, setIsExpanding] = useState(false);
  const [expansionSeats, setExpansionSeats] = useState([500]);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (isLoaded) {
      const timer = setInterval(() => {
        checkConstructions();
        setNow(Date.now());
      }, 1000); 
      return () => clearInterval(timer);
    }
  }, [isLoaded, checkConstructions]);

  const isAnyConstructing = useMemo(() => {
    if (!arena || !arena.constructionFinishes) return false;
    return Object.values(arena.constructionFinishes).some(v => v !== null && v !== undefined);
  }, [arena]);

  const isCapacityConstructing = !!arena.constructionFinishes?.capacity;

  const maxArenaLevel = useMemo(() => {
    if (!arena) return 0;
    return Math.max(
      arena.pressCenterLevel || 0,
      arena.cafeLevel || 0,
      arena.shopLevel || 0,
      arena.screensLevel || 0,
      arena.roofLevel || 0,
      arena.lightingLevel || 0
    );
  }, [arena]);

  const showStarterImage = maxArenaLevel >= 1 && maxArenaLevel <= 10;
  const starterImage = (PlaceHolderImages || []).find(img => img.id === 'arena-starter')?.imageUrl;

  const labels = {
    en: {
      title: "ARENA MANAGEMENT",
      subtitle: "Stadium Operations Terminal",
      capacityTitle: "Stadium Expansion",
      currentStatus: "Current Status",
      maintenance: "Support",
      expand: "Expand",
      decrease: "Decrease",
      seats: "seats",
      confirm: "Initiate Construction",
      cost: "Cost",
      duration: "Duration",
      hours: "hours",
      level: "Level",
      upgrade: "Upgrade",
      inProgress: "Construction in Progress",
      improving: "Improving...",
      finishAt: "Ready at",
      crewBusy: "Arena Crew Busy",
      facilities: "Facility Upgrades",
      items: {
        capacity: { label: "Stadium Capacity", desc: "Current stadium seating capacity." },
        pressCenterLevel: { label: "Press Center", desc: "Increases media coverage and attracts more elite fans." },
        cafeLevel: { label: "Food Court", desc: "Provides catering services, increasing matchday revenue." },
        shopLevel: { label: "Fan Shop", desc: "Boosts merchandise sales and team popularity." },
        screensLevel: { label: "Digital Screens", desc: "Attracts higher-paying sponsors for advertising." },
        roofLevel: { label: "Stadium Roof", desc: "Ensures attendance stability during bad weather." },
        lightingLevel: { label: "Lighting System", desc: "Enables HD-broadcasts and prime-time matches." }
      }
    },
    ru: {
      title: "УПРАВЛЕНИЕ АРЕНОЙ",
      subtitle: "Терминал эксплуатации стадиона",
      capacityTitle: "Расширение стадиона",
      currentStatus: "Текущее состояние",
      maintenance: "Поддержка",
      expand: "Расширить",
      decrease: "Уменьшить",
      seats: "мест",
      confirm: "Начать постройку",
      cost: "Стоимость",
      duration: "Длительность",
      hours: "ч",
      level: "Уровень",
      upgrade: "Улучшить",
      inProgress: "Идет строительство",
      improving: "Улучшается...",
      finishAt: "Готовность в",
      crewBusy: "Бригада Арены занята",
      facilities: "Улучшение объектов",
      items: {
        capacity: { label: "Вместимость стадиона", desc: "Текущая вместимость зрительских мест." },
        pressCenterLevel: { label: "Пресс-центр", desc: "Улучшает освещение в СМИ и привлекает больше фанатов." },
        cafeLevel: { label: "Кафе и фуд-корт", desc: "Обеспечивает питание, увеличивая доход в дни матчей." },
        shopLevel: { label: "Магазин атрибутики", desc: "Увеличивает продажи мерча и популярность команды." },
        screensLevel: { label: "Экраны и табло", desc: "Привлекает дорогих спонсоров для рекламы." },
        roofLevel: { label: "Крыша стадиона", desc: "Обеспечивает стабильную посещаемость в любую погоду." },
        lightingLevel: { label: "Система освещения", desc: "Позволяет проводить HD-трансляции в прайм-тайм." }
      }
    }
  };

  const t = labels[language as keyof typeof labels] || labels.ru;

  if (!isLoaded) return null;

  const calculateProgress = (id: string) => {
    const start = arena.constructionStarts?.[id];
    const finish = arena.constructionFinishes?.[id];
    if (!finish || !start) return 0;
    const startTime = new Date(start).getTime();
    const finishTime = new Date(finish).getTime();
    const total = finishTime - startTime;
    const elapsed = Date.now() - startTime;
    if (total <= 0) return 100;
    return Math.min(Math.max((elapsed / total) * 100, 0), 100);
  };

  const handleFacilityUpgrade = () => {
    if (!selectedFacility) return;
    const currentLevel = (arena as any)[selectedFacility];
    const cost = 15000 * (currentLevel + 1);
    if (startArenaConstruction(selectedFacility as any, cost)) {
      toast({ title: t.inProgress });
      setSelectedFacility(null);
    } else {
      toast({ title: t.crewBusy, variant: "destructive" });
    }
  };

  const handleExpansion = () => {
    const seatsToAdd = expansionSeats[0];
    const cost = (seatsToAdd / 500) * 125000;
    const hours = (seatsToAdd / 500) * 6;
    if (startCapacityExpansion(seatsToAdd, cost, hours)) {
      toast({ title: t.inProgress });
      setShowCapacityDialog(false);
      setIsExpanding(false);
    } else {
      toast({ title: t.crewBusy, variant: "destructive" });
    }
  };

  const facilityList = [
    { id: 'pressCenterLevel', icon: MessageSquare, color: 'text-blue-400' },
    { id: 'cafeLevel', icon: Coffee, color: 'text-orange-400' },
    { id: 'shopLevel', icon: ShoppingBag, color: 'text-green-400' },
    { id: 'screensLevel', icon: Monitor, color: 'text-primary' },
    { id: 'roofLevel', icon: Home, color: 'text-slate-400' },
    { id: 'lightingLevel', icon: Lightbulb, color: 'text-yellow-400' },
  ];

  const formatFinishTime = (iso: string) => {
    const date = new Date(iso);
    return date.toLocaleString('ru-RU', { 
      day: '2-digit', month: '2-digit', 
      hour: '2-digit', minute: '2-digit',
      timeZone: 'Europe/Moscow' 
    });
  };

  return (
    <div className="max-w-md mx-auto px-4 pt-8 pb-20">
      <header className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/training">
            <Button variant="ghost" size="icon" className="rounded-full">
              <ChevronLeft className="w-6 h-6" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-headline font-bold uppercase tracking-tighter">{t.title}</h1>
            <p className="text-muted-foreground text-[10px] uppercase tracking-widest">{t.subtitle}</p>
          </div>
        </div>
      </header>

      {/* Main Visual & Capacity Card */}
      <Card className={cn(
        "glass-card mb-6 border-white/10 bg-card overflow-hidden transition-all duration-700",
        isCapacityConstructing && "border-orange-500/30 ring-1 ring-orange-500/20"
      )}>
        <CardContent className="p-0">
          {/* IMAGE FIRST - FULL RESOLUTION */}
          {showStarterImage && starterImage && (
            <div className="animate-in fade-in duration-1000">
               <div className="relative">
                 <img 
                  src={starterImage} 
                  alt="Arena Visual" 
                  className="w-full h-auto block" 
                  loading="eager"
                 />
               </div>
            </div>
          )}

          {/* CAPACITY INFO BELOW */}
          <div className="p-6 cursor-pointer hover:bg-white/5 transition-all" onClick={() => setShowCapacityDialog(true)}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-5">
                <div className={cn(
                  "p-4 rounded-2xl bg-secondary/50 border border-white/5 shadow-inner transition-colors",
                  isCapacityConstructing ? "text-orange-400 animate-pulse border-orange-500/20" : "text-primary"
                )}>
                  <Users className="w-8 h-8" />
                </div>
                <div>
                  <p className="text-[10px] uppercase font-black text-muted-foreground tracking-[0.2em] mb-1">{t.items.capacity.label}</p>
                  <div className="flex items-baseline gap-2">
                    <p className="text-4xl font-headline font-bold text-white tracking-tighter leading-none">{arena.capacity.toLocaleString()}</p>
                    <span className="text-xs font-black text-primary/40 uppercase">SEATS</span>
                  </div>
                </div>
              </div>
              {isCapacityConstructing ? (
                <div className="text-right">
                  <p className="text-[8px] uppercase text-orange-400 font-black tracking-widest mb-1">{t.inProgress}</p>
                  <p className="text-xs font-mono font-bold text-white">{formatFinishTime(arena.constructionFinishes.capacity!)}</p>
                </div>
              ) : (
                <div className="p-2 rounded-full bg-white/5 border border-white/5">
                  <PlusCircle className="w-5 h-5 text-primary/50" />
                </div>
              )}
            </div>

            <div className="flex items-center justify-between text-[9px] font-black uppercase tracking-widest pt-2 border-t border-white/5">
              <span className="text-muted-foreground/60">{t.currentStatus}: {arena.capacity.toLocaleString()}</span>
              <span className="text-accent flex items-center gap-1.5">
                <Wallet className="w-3 h-3" /> 30,000 € / MATCH
              </span>
            </div>
            
            {isCapacityConstructing && (
              <div className="space-y-1.5 mt-6">
                <div className="flex justify-between text-[8px] uppercase font-black text-orange-400 tracking-widest">
                  <span>{t.improving}</span>
                  <span>{Math.floor(calculateProgress('capacity'))}%</span>
                </div>
                <Progress value={calculateProgress('capacity')} className="h-1 bg-orange-500/10" />
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <h2 className="text-xs font-headline font-bold text-accent uppercase tracking-[0.2em] mb-4 px-1">{t.facilities}</h2>

      <div className="space-y-3">
        {facilityList.map((item) => {
          const level = (arena as any)[item.id] || 0;
          const finishTime = arena.constructionFinishes?.[item.id];
          const isConstructing = !!finishTime;
          const progress = isConstructing ? calculateProgress(item.id) : 0;
          
          return (
            <Card key={item.id} className={cn(
              "glass-card border-white/5 overflow-hidden transition-all",
              isConstructing && "bg-orange-500/5 border-orange-500/20"
            )}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={cn(
                      "p-2.5 rounded-xl bg-secondary/50 border border-white/5", 
                      isConstructing ? "text-orange-400 animate-pulse" : item.color
                    )}>
                      {isConstructing ? <Hammer className="w-5 h-5" /> : <item.icon className="w-5 h-5" />}
                    </div>
                    <div>
                      <h3 className="text-sm font-bold uppercase tracking-tight">{t.items[item.id as keyof typeof t.items].label}</h3>
                      <Badge variant="outline" className="text-[8px] h-4 py-0 uppercase font-black tracking-widest mt-1 border-white/10 opacity-60">LVL {level}</Badge>
                    </div>
                  </div>
                  {isConstructing ? (
                    <div className="text-right">
                      <p className="text-[7px] uppercase text-muted-foreground font-black tracking-widest">{t.finishAt}</p>
                      <p className="text-[10px] font-mono font-bold text-orange-400">{formatFinishTime(finishTime)}</p>
                    </div>
                  ) : (
                    <Button size="sm" variant="outline" className="h-9 px-4 border-white/10 hover:bg-primary/10 hover:text-primary transition-all" onClick={() => setSelectedFacility(item.id)}>
                      <span className="text-[9px] uppercase font-black tracking-widest">{t.upgrade}</span>
                    </Button>
                  )}
                </div>
                {isConstructing && (
                  <div className="mt-4 space-y-1.5">
                    <div className="flex justify-between text-[7px] uppercase font-black text-orange-400 tracking-widest">
                      <span>{t.improving}</span>
                      <span>{Math.floor(progress)}%</span>
                    </div>
                    <Progress value={progress} className="h-1 bg-orange-500/10" />
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Capacity Dialog */}
      <Dialog open={showCapacityDialog} onOpenChange={(open) => { setShowCapacityDialog(open); if(!open) setIsExpanding(false); }}>
        <DialogContent className="max-w-xs bg-card border-white/5 p-6">
          <DialogHeader>
            <DialogTitle className="text-center font-headline font-bold text-xl uppercase tracking-tighter">{t.capacityTitle}</DialogTitle>
            <DialogDescription className="text-center text-[10px] mt-2 font-bold uppercase tracking-widest opacity-60">
              {t.currentStatus}: {arena.capacity} SEATS
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-6">
            <div className="flex flex-col gap-2 p-4 bg-secondary/30 rounded-2xl border border-white/5 text-center shadow-inner">
               <p className="text-[9px] uppercase font-black text-muted-foreground tracking-[0.2em]">{t.maintenance}</p>
               <p className="text-lg font-headline font-bold text-accent">30,000 € / MATCH</p>
            </div>

            {!isExpanding ? (
              <div className="grid grid-cols-2 gap-3">
                <Button className="hero-gradient font-black text-[10px] uppercase h-12 shadow-lg shadow-primary/20" onClick={() => setIsExpanding(true)} disabled={isAnyConstructing}>
                  <PlusCircle className="w-4 h-4 mr-2" /> {t.expand}
                </Button>
                <Button variant="outline" className="font-black text-[10px] uppercase h-12 border-white/10 text-muted-foreground" disabled>
                  <MinusCircle className="w-4 h-4 mr-2" /> {t.decrease}
                </Button>
              </div>
            ) : (
              <div className="space-y-6 animate-in fade-in zoom-in duration-300">
                <div className="space-y-4">
                  <div className="flex justify-between text-[10px] font-black uppercase text-primary tracking-widest">
                    <span>+ {expansionSeats[0]} {t.seats}</span>
                    <span className="opacity-40">Max +5000</span>
                  </div>
                  <Slider 
                    value={expansionSeats} 
                    onValueChange={setExpansionSeats} 
                    max={5000} 
                    min={500} 
                    step={500} 
                    className="py-4"
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-secondary/30 p-3 rounded-xl text-center border border-white/5">
                     <p className="text-[8px] uppercase font-black text-muted-foreground mb-1 tracking-tighter">{t.cost}</p>
                     <p className="text-sm font-bold text-accent">€ {((expansionSeats[0] / 500) * 125000).toLocaleString()}</p>
                  </div>
                  <div className="bg-secondary/30 p-3 rounded-xl text-center border border-white/5">
                     <p className="text-[8px] uppercase font-black text-muted-foreground mb-1 tracking-tighter">{t.duration}</p>
                     <p className="text-sm font-bold text-primary flex items-center justify-center gap-1">
                       <Clock className="w-3 h-3" /> {(expansionSeats[0] / 500) * 6} {t.hours}
                     </p>
                  </div>
                </div>

                <Button className="w-full hero-gradient font-black text-[10px] uppercase h-14 shadow-2xl shadow-primary/30 active:scale-95 transition-all" onClick={handleExpansion} disabled={isAnyConstructing}>
                  {isAnyConstructing ? t.crewBusy : t.confirm}
                </Button>
                <Button variant="ghost" className="w-full text-[9px] font-black uppercase tracking-widest text-muted-foreground" onClick={() => setIsExpanding(false)}>
                  Back to stats
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Facility Dialog */}
      <Dialog open={!!selectedFacility} onOpenChange={() => setSelectedFacility(null)}>
        {selectedFacility && (
          <DialogContent className="max-w-xs bg-card border-white/5 p-6">
            <DialogHeader>
              <DialogTitle className="text-center font-headline font-bold text-xl uppercase tracking-tight">
                {t.items[selectedFacility as keyof typeof t.items].label}
              </DialogTitle>
              <DialogDescription className="text-center text-xs mt-3 italic text-muted-foreground leading-relaxed">
                "{t.items[selectedFacility as keyof typeof t.items].desc}"
              </DialogDescription>
            </DialogHeader>

            <div className="grid grid-cols-2 gap-3 mt-8">
              <div className="bg-secondary/30 p-4 rounded-2xl text-center border border-white/5 shadow-inner">
                 <p className="text-[8px] uppercase font-black text-muted-foreground mb-1 tracking-widest">{t.cost}</p>
                 <p className="text-sm font-bold text-accent italic">€ {(15000 * (((arena as any)[selectedFacility] || 0) + 1)).toLocaleString()}</p>
              </div>
              <div className="bg-secondary/30 p-4 rounded-2xl text-center border border-white/5 shadow-inner">
                 <p className="text-[8px] uppercase font-black text-muted-foreground mb-1 tracking-widest">{t.duration}</p>
                 <p className="text-sm font-bold text-primary flex items-center justify-center gap-1.5">
                   <Clock className="w-3.5 h-3.5" /> {4 * (((arena as any)[selectedFacility] || 0) + 1)} {t.hours}
                 </p>
              </div>
            </div>

            <DialogFooter className="mt-8">
              <Button className="w-full h-14 hero-gradient font-black text-[10px] uppercase tracking-[0.2em] shadow-2xl shadow-primary/30 active:scale-95 transition-all" onClick={handleFacilityUpgrade} disabled={isAnyConstructing}>
                {isAnyConstructing ? t.crewBusy : t.confirm}
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}
