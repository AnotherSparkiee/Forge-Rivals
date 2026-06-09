
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
import { PlaceHolderImages } from '@/app/lib/placeholder-images';

export default function HQPage() {
  const { 
    hq, credits, startHQConstruction, checkConstructions, language, isLoaded 
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

  const maxHQLevel = useMemo(() => {
    if (!hq) return 0;
    return Math.max(
      Number(hq.hrLevel || 0),
      Number(hq.financeLevel || 0),
      Number(hq.scoutsLevel || 0),
      Number(hq.pressOfficeLevel || 0),
      Number(hq.adminLevel || 0)
    );
  }, [hq]);

  const showStarterImage = Number(maxHQLevel) >= 0 && Number(maxHQLevel) <= 10;
  const starterImage = (PlaceHolderImages || []).find(img => img.id === 'hq-starter')?.imageUrl;

  const isAnyConstructing = useMemo(() => {
    if (!hq) return false;
    return Object.values(hq.constructionFinishes).some(v => v !== null && v !== undefined);
  }, [hq]);

  const labels = {
    en: {
      title: "HEADQUARTERS",
      subtitle: "Management and Administration Hub",
      hqObject: "Central Office",
      hqObjectDesc: "Club Management HQ",
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
        hrLevel: { label: "HR Department", desc: "Allows hiring the necessary number of professional staff members." },
        financeLevel: { label: "Finance Dept", desc: "Provides discounts on building and facility maintenance." },
        scoutsLevel: { label: "Scouting Center", desc: "Provides intelligence on opponents and detailed player search." },
        pressOfficeLevel: { label: "Press Service", desc: "Interaction with the fan movement and attracting new supporters." },
        adminLevel: { label: "Administration", desc: "Increases manager experience (XP) gained from each match." }
      }
    },
    ru: {
      title: "ГЛАВНЫЙ ОФИС",
      subtitle: "Центр управления и администрации",
      hqObject: "Центральный офис",
      hqObjectDesc: "Штаб управления клубом",
      confirm: "Начать проект",
      cost: "Инвестиции",
      duration: "Срок",
      hours: "ч",
      level: "Уровень",
      upgrade: "Улучшить",
      inProgress: "Идет реновация офиса",
      improving: "Улучшается...",
      finishAt: "Завершение в",
      crewBusy: "Бригада офиса занята",
      facilities: "Улучшение отделов",
      items: {
        hrLevel: { label: "Отдел кадров", desc: "Позволяет нанимать необходимое количество профессионального персонала." },
        financeLevel: { label: "Финансы", desc: "Дает скидки на обслуживание построек и объектов базы." },
        scoutsLevel: { label: "Скауты", desc: "Развед-информация о сопернике и детальный поиск игроков на рынке." },
        pressOfficeLevel: { label: "Пресс-служба", desc: "Взаимодействие с фан-движением и привлечение новых болельщиков." },
        adminLevel: { label: "Администрация", desc: "Увеличивает опыт менеджера, получаемый с каждым сыгранным матчем." }
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

      <Card className="glass-card mb-6 border-white/10 bg-black overflow-hidden transition-all">
        <CardContent className="p-0">
          {showStarterImage && starterImage && (
            <div className="w-full bg-background border-b border-white/5 overflow-hidden">
               <img 
                src={starterImage} 
                alt="HQ Preview" 
                className="w-full h-auto block"
                loading="eager"
                decoding="sync"
               />
            </div>
          )}
          <div className="p-4">
             <h2 className="text-sm font-headline font-bold text-white uppercase tracking-tight">{t.hqObject}</h2>
             <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest mt-1">{t.hqObjectDesc}</p>
          </div>
        </CardContent>
      </Card>

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

      <Dialog open={!!selectedFacility} onOpenChange={() => setSelectedFacility(null)}>
        {selectedFacility && (
          <DialogContent className="max-w-xs bg-card border-white/5 p-6 shadow-2xl border">
            <DialogHeader>
              <DialogTitle className="text-center font-headline font-bold text-xl uppercase tracking-tight text-primary">
                {t.items[selectedFacility as keyof typeof t.items].label}
              </DialogTitle>
              <DialogDescription className="text-center text-xs mt-4 italic text-muted-foreground leading-relaxed bg-secondary/20 p-4 rounded-xl border border-white/5">
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
              <Button className="w-full hero-gradient font-bold h-12 uppercase text-[10px] tracking-widest shadow-xl shadow-primary/20" onClick={handleFacilityUpgrade} disabled={isAnyConstructing}>
                {isAnyConstructing ? t.crewBusy : t.confirm}
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}
