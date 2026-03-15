'use client';

import { useState, useEffect } from 'react';
import { useGameState } from '../../lib/store';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
} from '@/components/ui/dialog';
import { 
  ChevronLeft, MessageSquare, Coffee, ShoppingBag, 
  Monitor, Home, Lightbulb, ArrowUpCircle, Wallet, Clock,
  Hammer, Users
} from 'lucide-react';
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export default function ArenaPage() {
  const { 
    arena, credits, upgradeArenaCapacity, startArenaConstruction, checkConstructions, language, isLoaded 
  } = useGameState();
  const { toast } = useToast();
  
  const [selectedFacility, setSelectedFacility] = useState<string | null>(null);

  // Periodically check if any construction finished
  useEffect(() => {
    if (isLoaded) {
      const timer = setInterval(() => {
        checkConstructions();
      }, 10000); // Check every 10 seconds
      return () => clearInterval(timer);
    }
  }, [isLoaded]);

  if (!isLoaded) return null;

  const labels = {
    en: {
      title: "ARENA MANAGEMENT",
      subtitle: "Stadium Operations Terminal",
      capacity: "Seating Capacity",
      upgrade: "Upgrade",
      level: "Level",
      cost: "Cost",
      duration: "Duration",
      hours: "hours",
      confirm: "Confirm Build",
      facilities: "Facility Development",
      success: "Construction Started",
      error: "Insufficient Credits",
      inProgress: "Construction in Progress",
      finishAt: "Ready at",
      items: {
        capacity: { label: "Stadium Expansion", desc: "Adds 500 additional seats to increase matchday ticket revenue." },
        pressCenterLevel: { label: "Press Center", desc: "Increases media coverage and attracts more elite fans, boosting overall match income." },
        cafeLevel: { label: "Food Court", desc: "Provides high-quality catering services, significantly increasing matchday catering revenue." },
        shopLevel: { label: "Fan Shop", desc: "Boosts merchandise sales and team popularity among the local community." },
        screensLevel: { label: "Digital Screens", desc: "Improves fan engagement and attracts higher-paying sponsors for digital advertising." },
        roofLevel: { label: "Stadium Roof", desc: "Ensures maximum comfort and attendance stability during bad weather conditions." },
        lightingLevel: { label: "Lighting System", desc: "Enables high-definition broadcasts and prime-time evening match slots." }
      }
    },
    ru: {
      title: "УПРАВЛЕНИЕ АРЕНОЙ",
      subtitle: "Терминал эксплуатации стадиона",
      capacity: "Вместимость трибун",
      upgrade: "Улучшить",
      level: "Уровень",
      cost: "Стоимость",
      duration: "Длительность",
      hours: "ч",
      confirm: "Начать постройку",
      facilities: "Развитие инфраструктуры",
      success: "Строительство начато",
      error: "Недостаточно кредитов",
      inProgress: "Идет строительство",
      finishAt: "Готовность в",
      items: {
        capacity: { label: "Расширение стадиона", desc: "Добавляет 500 дополнительных мест, что увеличивает выручку от продажи билетов." },
        pressCenterLevel: { label: "Пресс-центр", desc: "Улучшает освещение в СМИ и привлекает больше фанатов, повышая общий доход." },
        cafeLevel: { label: "Кафе и фуд-корт", desc: "Обеспечивает качественное питание, значительно увеличивая доход от кейтеринга в дни матчей." },
        shopLevel: { label: "Магазин атрибутики", desc: "Увеличивает продажи мерчандайзинга и популярность команды среди местного населения." },
        screensLevel: { label: "Экраны и табло", desc: "Улучшает вовлеченность зрителей и привлекает более дорогих спонсоров для цифровой рекламы." },
        roofLevel: { label: "Крыша стадиона", desc: "Обеспечивает максимальный комфорт и стабильную посещаемость в любых погодных условиях." },
        lightingLevel: { label: "Система освещения", desc: "Позволяет проводить качественные HD-трансляции и матчи в прайм-тайм." }
      }
    }
  };

  const t = labels[language as keyof typeof labels] || labels.ru;

  const handleUpgradeCapacity = () => {
    const cost = 15000;
    if (upgradeArenaCapacity(cost)) {
      toast({ title: t.success, description: `+500 seats added.` });
    } else {
      toast({ title: t.error, variant: "destructive" });
    }
  };

  const executeUpgrade = () => {
    if (!selectedFacility) return;
    
    const currentLevel = (arena as any)[selectedFacility];
    const cost = 15000 * (currentLevel + 1);
    
    if (startArenaConstruction(selectedFacility as any, cost)) {
      toast({ title: t.success, description: `${t.items[selectedFacility as keyof typeof t.items].label}: ${t.success}` });
      setSelectedFacility(null);
    } else {
      toast({ title: t.error, variant: "destructive" });
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
      day: '2-digit', 
      month: '2-digit', 
      hour: '2-digit', 
      minute: '2-digit' 
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
        <Badge variant="outline" className="flex items-center gap-1.5 py-1 border-primary/20 text-primary">
          <Wallet className="w-3 h-3" /> {credits.toLocaleString()}
        </Badge>
      </header>

      {/* Main Capacity Card */}
      <Card className="glass-card mb-6 border-primary/20 bg-primary/5">
        <CardContent className="p-6">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 rounded-2xl bg-primary/20">
              <Users className="w-8 h-8 text-primary" />
            </div>
            <div>
              <p className="text-xs uppercase font-bold text-muted-foreground tracking-widest">{t.capacity}</p>
              <p className="text-3xl font-headline font-bold text-primary">{arena.capacity.toLocaleString()}</p>
            </div>
          </div>
          <Button 
            onClick={handleUpgradeCapacity}
            className="w-full hero-gradient font-bold h-12 flex items-center justify-between px-6 shadow-lg shadow-primary/20"
          >
            <span className="flex items-center gap-2">
              <ArrowUpCircle className="w-4 h-4" /> {t.upgrade}
            </span>
            <span className="font-mono text-xs">€ 15,000</span>
          </Button>
          <p className="text-[10px] text-center mt-3 text-muted-foreground italic">
            {t.items.capacity.desc}
          </p>
        </CardContent>
      </Card>

      <h2 className="text-xs font-headline font-bold text-accent uppercase tracking-[0.2em] mb-4 px-1">
        {t.facilities}
      </h2>

      <div className="space-y-3">
        {facilityList.map((item) => {
          const level = (arena as any)[item.id] || 0;
          const data = t.items[item.id as keyof typeof t.items];
          const finishTime = arena.constructionFinishes?.[item.id];
          const isConstructing = !!finishTime;

          return (
            <Card key={item.id} className={cn(
              "glass-card border-white/5 overflow-hidden group transition-all",
              isConstructing ? "bg-orange-500/5 border-orange-500/20" : "hover:border-primary/30"
            )}>
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={cn(
                    "p-2.5 rounded-xl bg-secondary/50 border border-white/5 transition-transform",
                    isConstructing ? "text-orange-400 animate-pulse" : item.color,
                    !isConstructing && "group-hover:scale-110"
                  )}>
                    {isConstructing ? <Hammer className="w-5 h-5" /> : <item.icon className="w-5 h-5" />}
                  </div>
                  <div>
                    <h3 className="text-sm font-bold uppercase tracking-tight">{data.label}</h3>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Badge variant="secondary" className="text-[9px] h-4 py-0 uppercase bg-primary/10 text-primary">LVL {level}</Badge>
                      {isConstructing && (
                        <span className="text-[8px] text-orange-400 font-bold uppercase animate-pulse">{t.inProgress}</span>
                      )}
                    </div>
                  </div>
                </div>
                
                {isConstructing && finishTime ? (
                  <div className="text-right">
                    <p className="text-[7px] uppercase text-muted-foreground font-bold">{t.finishAt}</p>
                    <p className="text-[9px] font-mono font-bold text-orange-400">{formatFinishTime(finishTime)}</p>
                  </div>
                ) : (
                  <Button 
                    size="sm" 
                    variant="outline" 
                    className="h-9 px-3 border-white/10 hover:bg-primary/10 hover:border-primary/30"
                    onClick={() => setSelectedFacility(item.id)}
                  >
                    <span className="text-[9px] uppercase font-bold text-primary">{t.upgrade}</span>
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Upgrade Modal */}
      <Dialog open={!!selectedFacility} onOpenChange={() => setSelectedFacility(null)}>
        {selectedFacility && (
          <DialogContent className="max-w-xs bg-card border-white/5 p-0 overflow-hidden">
            <div className="h-24 hero-gradient flex items-center justify-center relative">
              {(() => {
                const item = facilityList.find(f => f.id === selectedFacility);
                const Icon = item?.icon || Home;
                return <Icon className="w-12 h-12 text-primary-foreground drop-shadow-lg" />;
              })()}
            </div>
            
            <div className="p-6 space-y-4">
              <DialogHeader>
                <DialogTitle className="text-center font-headline font-bold text-xl uppercase tracking-tighter">
                  {t.items[selectedFacility as keyof typeof t.items].label}
                </DialogTitle>
                <DialogDescription className="text-center text-xs leading-relaxed italic mt-2">
                  {t.items[selectedFacility as keyof typeof t.items].desc}
                </DialogDescription>
              </DialogHeader>

              <div className="grid grid-cols-2 gap-3 pt-4 border-t border-white/5">
                <div className="bg-secondary/30 p-3 rounded-xl text-center border border-white/5">
                   <p className="text-[8px] uppercase font-bold text-muted-foreground mb-1">{t.cost}</p>
                   <p className="text-sm font-headline font-bold text-accent">
                     € {(15000 * (((arena as any)[selectedFacility] || 0) + 1)).toLocaleString()}
                   </p>
                </div>
                <div className="bg-secondary/30 p-3 rounded-xl text-center border border-white/5">
                   <p className="text-[8px] uppercase font-bold text-muted-foreground mb-1">{t.duration}</p>
                   <p className="text-sm font-headline font-bold text-primary flex items-center justify-center gap-1">
                     <Clock className="w-3 h-3" /> {4 * (((arena as any)[selectedFacility] || 0) + 1)} {t.hours}
                   </p>
                </div>
              </div>

              <div className="pt-2">
                <p className="text-[9px] text-center text-muted-foreground uppercase font-bold tracking-widest">
                  {t.level}: {(arena as any)[selectedFacility] || 0} <span className="text-primary">→ {((arena as any)[selectedFacility] || 0) + 1}</span>
                </p>
              </div>
            </div>

            <DialogFooter className="p-4 bg-secondary/20 sm:justify-center">
              <Button onClick={executeUpgrade} className="w-full hero-gradient font-bold h-12">
                {t.confirm}
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}
