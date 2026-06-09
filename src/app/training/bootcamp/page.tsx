
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
  ChevronLeft, Zap, Target, Waves, Microscope, 
  Hammer, Clock, Loader2, Gem
} from 'lucide-react';
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const CREWS = [
  { id: 1, multiplier: 1, price: 0, labelRu: 'Обычная', labelEn: 'Standard' },
  { id: 2, multiplier: 2, price: 100, labelRu: 'Малая (2x)', labelEn: 'Small (2x)' },
  { id: 3, multiplier: 4, price: 250, labelRu: 'Средняя (4x)', labelEn: 'Medium (4x)' },
  { id: 4, multiplier: 8, price: 600, labelRu: 'Большая (8x)', labelEn: 'Large (8x)' },
];

export default function BootcampPage() {
  const { 
    bootcamp, credits, crystals, startBootcampConstruction, checkConstructions, language, isLoaded 
  } = useGameState();
  const { toast } = useToast();
  
  const [selectedFacility, setSelectedFacility] = useState<string | null>(null);
  const [selectedCrewId, setSelectedCrewId] = useState(1);
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
    if (!bootcamp) return false;
    return Object.values(bootcamp.constructionFinishes).some(v => v !== null && v !== undefined);
  }, [bootcamp]);

  const labels = {
    en: {
      title: "BOOTCAMP",
      subtitle: "Intensive Team Training Base",
      confirm: "Initiate Construction",
      cost: "Investment",
      duration: "Duration",
      hours: "hours",
      level: "Level",
      upgrade: "Upgrade",
      inProgress: "Construction in Progress",
      improving: "Improving...",
      finishAt: "Ready at",
      crewBusy: "Bootcamp Crew Occupied",
      facilities: "Facilities Upgrades",
      crewSelect: "Engineering Crew Selection",
      items: {
        bootcampLevel: { label: "Main Bootcamp", desc: "Speeds up player training and makes it possible for players to reach maximum skill levels." },
        tacticsHallLevel: { label: "Tactics Hall", desc: "Makes various tactical instructions more effective and eliminates their negative consequences." },
        poolLevel: { label: "Pool & Wellness", desc: "Slows down skill decay in older players (30+) and form decay in resting players." },
        researchLevel: { label: "Research Lab", desc: "Increases training in unofficial matches and speeds up training at high skill levels." }
      }
    },
    ru: {
      title: "БУТКЕМП",
      subtitle: "База интенсивной подготовки",
      confirm: "Начать постройку",
      cost: "Инвестиции",
      duration: "Срок",
      hours: "ч",
      level: "Уровень",
      upgrade: "Улучшить",
      inProgress: "Идет строительство",
      improving: "Улучшается...",
      finishAt: "Готовность в",
      crewBusy: "Бригада Буткемпа занята",
      facilities: "Улучшение объектов",
      crewSelect: "Выбор инженерной группы",
      items: {
        bootcampLevel: { label: "Основной Буткемп", desc: "Ускоряет тренировку игроков и делает возможным достижение игроками максимальных уровней навыков." },
        tacticsHallLevel: { label: "Зал тактики", desc: "Делает различные тактические указания более эффективными и устраняет их негативные последствия во время матча." },
        poolLevel: { label: "Бассейн и отдых", desc: "Замедляет падение навыков у возрастных игроков (30+) и падение формы у отдыхавших игроков." },
        researchLevel: { label: "Исследования", desc: "Увеличивает рост характеристик в неофициальных матчах и ускоряет тренировку на высоких уровнях навыков." }
      }
    }
  };

  const t = labels[language as keyof typeof labels] || labels.ru;

  const calculateProgress = useCallback((id: string) => {
    const start = bootcamp.constructionStarts?.[id];
    const finish = bootcamp.constructionFinishes?.[id];
    if (!finish || !start) return 0;
    const startTime = new Date(start).getTime();
    const finishTime = new Date(finish).getTime();
    const total = finishTime - startTime;
    const elapsed = Date.now() - startTime;
    return Math.min(Math.max((elapsed / total) * 100, 0), 100);
  }, [bootcamp.constructionStarts, bootcamp.constructionFinishes]);

  const handleFacilityUpgrade = () => {
    if (!selectedFacility) return;
    const currentLevel = (bootcamp as any)[selectedFacility];
    const cost = 40000 * (currentLevel + 1);
    const crew = CREWS.find(c => c.id === selectedCrewId) || CREWS[0];
    
    if (startBootcampConstruction(selectedFacility as any, cost, crew.multiplier, crew.price)) {
      toast({ title: t.inProgress });
      setSelectedFacility(null);
      setSelectedCrewId(1);
    } else {
      toast({ title: t.crewBusy, variant: "destructive" });
    }
  };

  const facilityList = [
    { id: 'bootcampLevel', icon: Zap, color: 'text-primary' },
    { id: 'tacticsHallLevel', icon: Target, color: 'text-red-400' },
    { id: 'poolLevel', icon: Waves, color: 'text-blue-400' },
    { id: 'researchLevel', icon: Microscope, color: 'text-accent' },
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
          const level = (bootcamp as any)[item.id] || 0;
          const finishTime = bootcamp.constructionFinishes?.[item.id];
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

      <Dialog open={!!selectedFacility} onOpenChange={() => { setSelectedFacility(null); setSelectedCrewId(1); }}>
        {selectedFacility && (
          <DialogContent className="max-w-md bg-card border-white/10 p-0 overflow-hidden shadow-2xl border">
            <div className="p-6 text-center bg-gradient-to-br from-primary/20 via-background to-accent/10 border-b border-white/5">
              <DialogTitle className="text-xl font-headline font-bold uppercase tracking-tight text-primary">
                {t.items[selectedFacility as keyof typeof t.items].label}
              </DialogTitle>
              <DialogDescription className="text-center text-xs mt-4 italic text-muted-foreground leading-relaxed bg-secondary/20 p-4 rounded-xl border border-white/5">
                {t.items[selectedFacility as keyof typeof t.items].desc}
              </DialogDescription>
            </div>

            <div className="p-6 space-y-6">
              <div className="space-y-3">
                <h4 className="text-[10px] font-black uppercase text-accent tracking-[0.2em] flex items-center gap-2">
                  <Zap className="w-3 h-3" /> {t.crewSelect}
                </h4>
                <div className="grid grid-cols-2 gap-2">
                  {CREWS.map((crew) => (
                    <button
                      key={crew.id}
                      onClick={() => setSelectedCrewId(crew.id)}
                      className={cn(
                        "p-3 rounded-xl border text-left transition-all",
                        selectedCrewId === crew.id 
                          ? "bg-primary/20 border-primary shadow-lg ring-1 ring-primary/50" 
                          : "bg-secondary/20 border-white/5 hover:border-white/20"
                      )}
                    >
                      <p className="text-[9px] font-bold uppercase text-white truncate">{language === 'ru' ? crew.labelRu : crew.labelEn}</p>
                      <div className="flex items-center gap-1.5 mt-1">
                        <Gem className="w-2.5 h-2.5 text-accent" />
                        <span className="text-[10px] font-headline font-black text-accent">{crew.price}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 mt-6">
                <div className="bg-secondary/30 p-3 rounded-xl text-center border border-white/5">
                   <p className="text-[8px] uppercase font-bold text-muted-foreground mb-1">{t.cost}</p>
                   <p className="text-sm font-bold text-accent">€ {(40000 * (((bootcamp as any)[selectedFacility] || 0) + 1)).toLocaleString()}</p>
                </div>
                <div className="bg-secondary/30 p-3 rounded-xl text-center border border-white/5">
                   <p className="text-[8px] uppercase font-bold text-muted-foreground mb-1">{t.duration}</p>
                   <p className="text-sm font-bold text-primary flex items-center justify-center gap-1">
                     <Clock className="w-3 h-3" /> 
                     {Math.ceil((4 * (((bootcamp as any)[selectedFacility] || 0) + 1)) / (CREWS.find(c => c.id === selectedCrewId)?.multiplier || 1))} {t.hours}
                   </p>
                </div>
              </div>
            </div>

            <DialogFooter className="p-4 bg-secondary/20 border-t border-white/5">
              <Button className="w-full h-12 hero-gradient font-bold uppercase text-[10px] tracking-widest shadow-xl shadow-primary/20" onClick={handleFacilityUpgrade} disabled={isAnyConstructing}>
                {isAnyConstructing ? t.crewBusy : t.confirm}
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}
