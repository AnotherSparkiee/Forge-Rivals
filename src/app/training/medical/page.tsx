
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
  ChevronLeft, Activity, HeartPulse, Brain, FlaskConical, 
  UserCircle, Hammer, Clock, Loader2, Gem, Zap
} from 'lucide-react';
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const ACCEL_CREWS = [
  { id: 1, multiplier: 2, price: 100, labelRu: 'Малая бригада (2x)', labelEn: 'Small Crew (2x)' },
  { id: 2, multiplier: 4, price: 250, labelRu: 'Средняя бригада (4x)', labelEn: 'Medium Crew (4x)' },
  { id: 3, multiplier: 8, price: 600, labelRu: 'Большая бригада (8x)', labelEn: 'Large Crew (8x)' },
];

export default function MedicalPage() {
  const { 
    medical, credits, crystals, startMedicalConstruction, accelerateConstruction, checkConstructions, language, isLoaded 
  } = useGameState();
  const { toast } = useToast();
  
  const [selectedFacility, setSelectedFacility] = useState<string | null>(null);
  const [acceleratingFacility, setAcceleratingFacility] = useState<string | null>(null);
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

  const labels = {
    en: {
      title: "MEDICAL CENTER",
      subtitle: "Rehabilitation and Health Monitoring",
      confirm: "Initiate Project",
      cost: "Medical Costs",
      duration: "Timeframe",
      hours: "hours",
      level: "Level",
      upgrade: "Modernize",
      accelerate: "Accelerate",
      accelTitle: "Expedite Lab Renovation",
      accelDesc: "Bring in specialized medical engineers to finish the department faster.",
      inProgress: "Renovation in Progress",
      improving: "Improving...",
      finishAt: "Ready at",
      facilities: "Department Upgrades",
      items: {
        physiotherapyLevel: { label: "Physiotherapy", desc: "Improves the physical condition of your players, preventing injuries." },
        massageLevel: { label: "Massage Room", desc: "Speeds up player fatigue recovery between matches." },
        psychiatristLevel: { label: "Psychiatrist", desc: "Reduces player fatigue after matches." },
        labLevel: { label: "Medical Lab", desc: "Speeds up the healing process for all injuries." },
        psychologistLevel: { label: "Psychologist", desc: "Slightly speeds up training in unofficial matches and slows training speed decay." }
      }
    },
    ru: {
      title: "МЕДИЦИНСКИЙ ЦЕНТР",
      subtitle: "Реабилитация и мониторинг здоровья",
      confirm: "Начать проект",
      cost: "Затраты",
      duration: "Срок",
      hours: "ч",
      level: "Уровень",
      upgrade: "Улучшить",
      accelerate: "Ускорить",
      accelTitle: "Ускорение медцентра",
      accelDesc: "Привлеките профильных инженеров, чтобы закончить обустройство кабинетов быстрее.",
      inProgress: "Идет реновация",
      improving: "Улучшается...",
      finishAt: "Готовность в",
      facilities: "Улучшение отделов",
      items: {
        physiotherapyLevel: { label: "Физиотерапия", desc: "Улучшает физическое состояние Ваших игроков, предупреждая получение травм." },
        massageLevel: { label: "Массажная", desc: "Ускоряет восстановление усталости игроков между матчами." },
        psychiatristLevel: { label: "Психиатр", desc: "Уменьшает усталость игроков после матчей." },
        labLevel: { label: "Лаборатория", desc: "Значительно ускоряет лечение всех видов травм." },
        psychologistLevel: { label: "Психолог", desc: "Ускоряет тренировку в неофициальных матчах и замедляет падание скорости тренировки." }
      }
    }
  };

  const t = labels[language as keyof typeof labels] || labels.ru;

  const calculateProgress = useCallback((id: string) => {
    const start = medical.constructionStarts?.[id];
    const finish = medical.constructionFinishes?.[id];
    if (!finish || !start) return 0;
    const startTime = new Date(start).getTime();
    const finishTime = new Date(finish).getTime();
    const total = finishTime - startTime;
    const elapsed = Date.now() - startTime;
    return Math.min(Math.max((elapsed / total) * 100, 0), 100);
  }, [medical.constructionStarts, medical.constructionFinishes]);

  const handleFacilityUpgrade = () => {
    if (!selectedFacility) return;
    const currentLevel = (medical as any)[selectedFacility];
    const cost = 30000 * (currentLevel + 1);
    if (startMedicalConstruction(selectedFacility as any, cost)) {
      toast({ title: t.inProgress });
      setSelectedFacility(null);
    }
  };

  const handleAccelerate = (multiplier: number, price: number) => {
    if (!acceleratingFacility) return;
    if (accelerateConstruction('medical', acceleratingFacility, multiplier, price)) {
      toast({ title: language === 'ru' ? "Медицина ускорена!" : "Medical Rushed!" });
      setAcceleratingFacility(null);
    } else {
      toast({ title: language === 'ru' ? "Недостаточно ресурсов" : "Insufficient Resources", variant: "destructive" });
    }
  };

  const facilityList = [
    { id: 'physiotherapyLevel', icon: Activity, color: 'text-green-400' },
    { id: 'massageLevel', icon: HeartPulse, color: 'text-red-400' },
    { id: 'psychiatristLevel', icon: Brain, color: 'text-purple-400' },
    { id: 'labLevel', icon: FlaskConical, color: 'text-blue-400' },
    { id: 'psychologistLevel', icon: UserCircle, color: 'text-yellow-400' },
  ];

  const formatFinishTime = (iso: string) => {
    const date = new Date(iso);
    return date.toLocaleString('ru-RU', { 
      day: '2-digit', month: '2-digit', 
      hour: '2-digit', minute: '2-digit',
      timeZone: 'Europe/Moscow' 
    });
  };

  if (!isLoaded) return <LoadingScreen />;

  return (
    <div className="max-w-md mx-auto px-4 pt-8 pb-6">
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
          const level = (medical as any)[item.id] || 0;
          const finishTime = medical.constructionFinishes?.[item.id];
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
                    <Button size="sm" className="bg-orange-600 hover:bg-orange-700 text-white font-black text-[9px] h-8 px-3 gap-1.5" onClick={() => setAcceleratingFacility(item.id)}>
                      <Zap className="w-3 h-3" /> {t.accelerate}
                    </Button>
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
          <DialogContent className="max-w-md bg-card border-white/10 p-0 overflow-hidden shadow-2xl">
            <div className="p-6 text-center bg-gradient-to-br from-primary/20 via-background to-accent/10 border-b border-white/5">
              <DialogTitle className="text-xl font-headline font-bold uppercase tracking-tight text-primary">
                {t.items[selectedFacility as keyof typeof t.items].label}
              </DialogTitle>
              <DialogDescription className="text-center text-xs mt-4 italic text-muted-foreground leading-relaxed bg-secondary/20 p-4 rounded-xl border border-white/5">
                {t.items[selectedFacility as keyof typeof t.items].desc}
              </DialogDescription>
            </div>
            <div className="p-6 grid grid-cols-2 gap-3">
              <div className="bg-secondary/30 p-4 rounded-2xl text-center border border-white/5">
                 <p className="text-[8px] uppercase font-black text-muted-foreground mb-1 tracking-widest">{t.cost}</p>
                 <p className="text-sm font-bold text-accent italic">€ {(30000 * (((medical as any)[selectedFacility] || 0) + 1)).toLocaleString()}</p>
              </div>
              <div className="bg-secondary/30 p-4 rounded-2xl text-center border border-white/5">
                 <p className="text-[8px] uppercase font-black text-muted-foreground mb-1 tracking-widest">{t.duration}</p>
                 <p className="text-sm font-bold text-primary flex items-center justify-center gap-1.5"><Clock className="w-3.5 h-3.5" /> {4 * (((medical as any)[selectedFacility] || 0) + 1)} {t.hours}</p>
              </div>
            </div>
            <DialogFooter className="p-4 bg-secondary/20 border-t border-white/5">
              <Button className="w-full h-14 hero-gradient font-black text-[10px] uppercase tracking-[0.2em]" onClick={handleFacilityUpgrade}>
                {t.confirm}
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>

      <Dialog open={!!acceleratingFacility} onOpenChange={() => setAcceleratingFacility(null)}>
        {acceleratingFacility && (
          <DialogContent className="max-w-md bg-card border-white/10 p-0 overflow-hidden shadow-2xl">
            <div className="p-6 text-center bg-gradient-to-br from-orange-500/20 via-background to-transparent border-b border-white/5">
              <DialogTitle className="text-xl font-headline font-bold uppercase tracking-tight text-orange-400 flex items-center justify-center gap-2">
                <Zap className="w-5 h-5" /> {t.accelTitle}
              </DialogTitle>
              <DialogDescription className="text-center text-[10px] mt-2 uppercase font-black tracking-widest opacity-60">
                {t.accelDesc}
              </DialogDescription>
            </div>
            <div className="p-4 space-y-2">
              {ACCEL_CREWS.map((crew) => (
                <Card key={crew.id} className="glass-card border-white/5 hover:border-orange-500/30 cursor-pointer transition-all" onClick={() => handleAccelerate(crew.multiplier, crew.price)}>
                  <CardContent className="p-4 flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold uppercase text-white">{language === 'ru' ? crew.labelRu : crew.labelEn}</h4>
                      <p className="text-[8px] text-muted-foreground uppercase font-black mt-1">Остаток времени / {crew.multiplier}</p>
                    </div>
                    <Badge className="bg-accent text-accent-foreground font-black h-8 px-3">{crew.price} 💎</Badge>
                  </CardContent>
                </Card>
              ))}
            </div>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}
