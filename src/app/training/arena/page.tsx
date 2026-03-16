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
  Hammer, Users, MinusCircle, PlusCircle
} from 'lucide-react';
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { getMoscowTime } from '@/app/lib/time-utils';

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

  if (!isLoaded) return null;

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

  const calculateProgress = (id: string) => {
    const start = arena.constructionStarts?.[id];
    const finish = arena.constructionFinishes?.[id];
    
    if (!finish || !start) return 0;
    
    const startTime = new Date(start).getTime();
    const finishTime = new Date(finish).getTime();
    
    const total = finishTime - startTime;
    const elapsed = Date.now() - startTime;
    
    if (total <= 0) return 100;
    const prog = (elapsed / total) * 100;
    
    return Math.min(Math.max(prog, 0), 100);
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

      {/* Capacity Card */}
      <Card className={cn(
        "glass-card mb-6 border-primary/20 bg-primary/5 cursor-pointer hover:bg-primary/10 transition-all overflow-hidden",
        isCapacityConstructing && "border-orange-500/30 bg-orange-500/5"
      )} onClick={() => setShowCapacityDialog(true)}>
        <CardContent className="p-6 relative">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <div className={cn("p-3 rounded-2xl bg-primary/20", isCapacityConstructing && "animate-pulse text-orange-400")}>
                <Users className="w-8 h-8" />
              </div>
              <div>
                <p className="text-xs uppercase font-bold text-muted-foreground tracking-widest">{t.items.capacity.label}</p>
                <p className="text-3xl font-headline font-bold text-primary">{arena.capacity.toLocaleString()}</p>
              </div>
            </div>
            {isCapacityConstructing && (
              <div className="text-right">
                <p className="text-[7px] uppercase text-muted-foreground font-bold">{t.inProgress}</p>
                <p className="text-[9px] font-mono font-bold text-orange-400">{formatFinishTime(arena.constructionFinishes.capacity!)}</p>
              </div>
            )}
          </div>
          <div className="flex items-center justify-between text-[10px] uppercase font-bold text-muted-foreground mb-4">
            <span>{t.currentStatus}: {arena.capacity.toLocaleString()}</span>
            <span className="text-accent">{t.maintenance}: 30,000€</span>
          </div>
          {isCapacityConstructing && (
            <div className="space-y-1.5">
              <div className="flex justify-between text-[8px] uppercase font-bold text-orange-400">
                <span>{t.improving}</span>
                <span>{Math.floor(calculateProgress('capacity'))}%</span>
              </div>
              <Progress value={calculateProgress('capacity')} className="h-1 bg-orange-500/20" />
            </div>
          )}
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
              "glass-card border-white/5 overflow-hidden",
              isConstructing && "bg-orange-500/5 border-orange-500/20"
            )}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-0">
                  <div className="flex items-center gap-4">
                    <div className={cn("p-2.5 rounded-xl bg-secondary/50", isConstructing ? "text-orange-400 animate-pulse" : item.color)}>
                      {isConstructing ? <Hammer className="w-5 h-5" /> : <item.icon className="w-5 h-5" />}
                    </div>
                    <div>
                      <h3 className="text-sm font-bold uppercase">{t.items[item.id as keyof typeof t.items].label}</h3>
                      <Badge variant="secondary" className="text-[9px] h-4 py-0 uppercase mt-1">LVL {level}</Badge>
                    </div>
                  </div>
                  {isConstructing ? (
                    <div className="text-right">
                      <p className="text-[7px] uppercase text-muted-foreground font-bold">{t.finishAt}</p>
                      <p className="text-[9px] font-mono font-bold text-orange-400">{formatFinishTime(finishTime)}</p>
                    </div>
                  ) : (
                    <Button size="sm" variant="outline" className="h-9 px-3" onClick={() => setSelectedFacility(item.id)}>
                      <span className="text-[9px] uppercase font-bold text-primary">{t.upgrade}</span>
                    </Button>
                  )}
                </div>
                {isConstructing && (
                  <div className="mt-3 space-y-1">
                    <div className="flex justify-between text-[7px] uppercase font-bold text-orange-400">
                      <span>{t.improving}</span>
                      <span>{Math.floor(progress)}%</span>
                    </div>
                    <Progress value={progress} className="h-1 bg-orange-500/20" />
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
            <DialogTitle className="text-center font-headline font-bold text-xl uppercase">{t.capacityTitle}</DialogTitle>
            <DialogDescription className="text-center text-xs mt-2">
              {t.currentStatus}: {t.items.capacity.label} {arena.capacity}
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-6">
            <div className="flex flex-col gap-2 p-3 bg-secondary/30 rounded-xl border border-white/5 text-center">
               <p className="text-[10px] uppercase font-bold text-muted-foreground">{t.maintenance}</p>
               <p className="text-sm font-headline font-bold text-accent">30,000€</p>
            </div>

            {!isExpanding ? (
              <div className="grid grid-cols-2 gap-3">
                <Button className="hero-gradient font-bold h-12" onClick={() => setIsExpanding(true)} disabled={isAnyConstructing}>
                  <PlusCircle className="w-4 h-4 mr-2" /> {t.expand}
                </Button>
                <Button variant="outline" className="font-bold h-12 border-white/10" disabled>
                  <MinusCircle className="w-4 h-4 mr-2" /> {t.decrease}
                </Button>
              </div>
            ) : (
              <div className="space-y-6 animate-in fade-in zoom-in duration-300">
                <div className="space-y-4">
                  <div className="flex justify-between text-[10px] uppercase font-bold text-primary">
                    <span>+ {expansionSeats[0]} {t.seats}</span>
                    <span>Max +5000</span>
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
                     <p className="text-[8px] uppercase font-bold text-muted-foreground mb-1">{t.cost}</p>
                     <p className="text-sm font-bold text-accent">€ {((expansionSeats[0] / 500) * 125000).toLocaleString()}</p>
                  </div>
                  <div className="bg-secondary/30 p-3 rounded-xl text-center border border-white/5">
                     <p className="text-[8px] uppercase font-bold text-muted-foreground mb-1">{t.duration}</p>
                     <p className="text-sm font-bold text-primary flex items-center justify-center gap-1">
                       <Clock className="w-3 h-3" /> {(expansionSeats[0] / 500) * 6} {t.hours}
                     </p>
                  </div>
                </div>

                <Button className="w-full hero-gradient font-bold h-12" onClick={handleExpansion} disabled={isAnyConstructing}>
                  {isAnyConstructing ? t.crewBusy : t.confirm}
                </Button>
                <Button variant="ghost" className="w-full text-[10px] uppercase font-bold" onClick={() => setIsExpanding(false)}>
                  Back
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
              <DialogTitle className="text-center font-headline font-bold text-xl uppercase">
                {t.items[selectedFacility as keyof typeof t.items].label}
              </DialogTitle>
              <DialogDescription className="text-center text-xs mt-2 italic">
                {t.items[selectedFacility as keyof typeof t.items].desc}
              </DialogDescription>
            </DialogHeader>

            <div className="grid grid-cols-2 gap-3 mt-6">
              <div className="bg-secondary/30 p-3 rounded-xl text-center border border-white/5">
                 <p className="text-[8px] uppercase font-bold text-muted-foreground mb-1">{t.cost}</p>
                 <p className="text-sm font-bold text-accent">€ {(15000 * (((arena as any)[selectedFacility] || 0) + 1)).toLocaleString()}</p>
              </div>
              <div className="bg-secondary/30 p-3 rounded-xl text-center border border-white/5">
                 <p className="text-[8px] uppercase font-bold text-muted-foreground mb-1">{t.duration}</p>
                 <p className="text-sm font-bold text-primary flex items-center justify-center gap-1">
                   <Clock className="w-3 h-3" /> {4 * (((arena as any)[selectedFacility] || 0) + 1)} {t.hours}
                 </p>
              </div>
            </div>

            <DialogFooter className="mt-6">
              <Button className="w-full hero-gradient font-bold h-12" onClick={handleFacilityUpgrade} disabled={isAnyConstructing}>
                {isAnyConstructing ? t.crewBusy : t.confirm}
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}
