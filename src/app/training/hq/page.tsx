'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useGameState } from '../../lib/store';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
} from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { 
  ChevronLeft, Users, Landmark, Search, Megaphone, 
  Briefcase, Hammer, Clock, Loader2
} from 'lucide-react';
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export default function HQPage() {
  const { 
    hq, arena, credits, startHQConstruction, checkConstructions, language, isLoaded 
  } = useGameState();
  const { toast } = useToast();
  
  const [selectedFacility, setSelectedFacility] = useState<string | null>(null);
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
    if (!hq || !arena) return false;
    const hqBuilding = Object.values(hq.constructionFinishes).some(v => v !== null && v !== undefined);
    const arenaBuilding = Object.values(arena.constructionFinishes).some(v => v !== null && v !== undefined);
    return hqBuilding || arenaBuilding;
  }, [hq, arena]);

  const labels = {
    en: {
      title: "HEADQUARTERS",
      subtitle: "Management and Administration Hub",
      confirm: "Initiate Project",
      cost: "Investment",
      duration: "Timeframe",
      hours: "hours",
      level: "Level",
      upgrade: "Modernize",
      inProgress: "Office Renovation",
      improving: "Improving...",
      finishAt: "Finalizing at",
      crewBusy: "Administration Crew Occupied",
      facilities: "Department Upgrades",
      items: {
        hrLevel: { label: "HR Department", desc: "Reduces hero hiring costs and improves staff efficiency." },
        financeLevel: { label: "Finance Dept", desc: "Optimizes tax operations and increases match income." },
        scoutsLevel: { label: "Scouting Center", desc: "Reveals hidden talents and rare hero opportunities." },
        pressOfficeLevel: { label: "Press Service", desc: "Manages public relations and team fame growth." },
        adminLevel: { label: "Administration", desc: "Reduces all facility maintenance costs globally." }
      }
    },
    ru: {
      title: "ГЛАВНЫЙ ОФИС",
      subtitle: "Центр управления и администрации",
      confirm: "Начать проект",
      cost: "Инвестиции",
      duration: "Срок",
      hours: "ч",
      level: "Уровень",
      upgrade: "Улучшить",
      inProgress: "Идет реновация офиса",
      improving: "Улучшается...",
      finishAt: "Завершение в",
      crewBusy: "Бригада занята",
      facilities: "Улучшение отделов",
      items: {
        hrLevel: { label: "Отдел кадров", desc: "Снижает стоимость найма и улучшает навыки персонала." },
        financeLevel: { label: "Финансы", desc: "Оптимизирует налоги и увеличивает доход с билетов." },
        scoutsLevel: { label: "Скауты", desc: "Находит редких героев и будущих звезд." },
        pressOfficeLevel: { label: "Пресс-служба", desc: "Управляет пиаром и ускоряет рост славы клуба." },
        adminLevel: { label: "Администрация", desc: "Снижает расходы на содержание всех объектов." }
      }
    }
  };

  const t = labels[language as keyof typeof labels] || labels.ru;

  const calculateProgress = useCallback((id: string) => {
    const start = hq.constructionStarts?.[id];
    const finish = hq.constructionFinishes?.[id];
    if (!finish || !start) return 0;
    const startTime = new Date(start).getTime();
    const finishTime = new Date(finish).getTime();
    const total = finishTime - startTime;
    const elapsed = Date.now() - startTime;
    return Math.min(Math.max((elapsed / total) * 100, 0), 100);
  }, [hq.constructionStarts, hq.constructionFinishes]);

  const handleFacilityUpgrade = () => {
    if (!selectedFacility) return;
    const currentLevel = (hq as any)[selectedFacility];
    const cost = 25000 * (currentLevel + 1);
    if (startHQConstruction(selectedFacility as any, cost)) {
      toast({ title: t.inProgress });
      setSelectedFacility(null);
    } else {
      toast({ title: t.crewBusy, variant: "destructive" });
    }
  };

  const facilityList = [
    { id: 'hrLevel', icon: Users, color: 'text-blue-400' },
    { id: 'financeLevel', icon: Landmark, color: 'text-yellow-400' },
    { id: 'scoutsLevel', icon: Search, color: 'text-accent' },
    { id: 'pressOfficeLevel', icon: Megaphone, color: 'text-primary' },
    { id: 'adminLevel', icon: Briefcase, color: 'text-slate-400' },
  ];

  const formatFinishTime = (iso: string) => {
    const date = new Date(iso);
    return date.toLocaleString('ru-RU', { 
      day: '2-digit', month: '2-digit', 
      hour: '2-digit', minute: '2-digit',
      timeZone: 'Europe/Moscow' 
    });
  };

  if (!isLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto px-4 pt-8 pb-20">
      <header className="mb-6 flex items-center gap-4">
        <Link href="/training">
          <Button variant="ghost" size="icon" className="rounded-full">
            <ChevronLeft className="w-6 h-6" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-headline font-bold uppercase tracking-tighter">{t.title}</h1>
          <p className="text-muted-foreground text-[10px] uppercase tracking-widest">{t.subtitle}</p>
        </div>
      </header>

      <h2 className="text-xs font-headline font-bold text-accent uppercase tracking-[0.2em] mb-4 px-1">{t.facilities}</h2>

      <div className="space-y-3">
        {facilityList.map((item) => {
          const level = (hq as any)[item.id] || 0;
          const finishTime = hq.constructionFinishes?.[item.id];
          const isConstructing = !!finishTime;
          const progress = isConstructing ? calculateProgress(item.id) : 0;
          
          return (
            <Card key={item.id} className={cn(
              "glass-card border-white/5 overflow-hidden",
              isConstructing && "bg-orange-500/5 border-orange-500/20"
            )}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
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
                 <p className="text-sm font-bold text-accent">€ {(25000 * (((hq as any)[selectedFacility] || 0) + 1)).toLocaleString()}</p>
              </div>
              <div className="bg-secondary/30 p-3 rounded-xl text-center border border-white/5">
                 <p className="text-[8px] uppercase font-bold text-muted-foreground mb-1">{t.duration}</p>
                 <p className="text-sm font-bold text-primary flex items-center justify-center gap-1">
                   <Clock className="w-3 h-3" /> {4 * (((hq as any)[selectedFacility] || 0) + 1)} {t.hours}
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
