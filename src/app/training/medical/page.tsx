'use client';

/**
 * @fileOverview МЕДИЦИНСКИЙ ЦЕНТР v2.
 * Реализован интерфейс лечения травмированных игроков и управление объектами.
 */

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
  UserCircle, Hammer, Clock, Loader2, Gem, Zap, 
  ShieldAlert, User, ShieldCheck, Stethoscope
} from 'lucide-react';
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Hero } from '../../lib/moba-data';

const ACCEL_CREWS = [
  { id: 1, multiplier: 2, price: 100, labelRu: 'Малая бригада (2x)', labelEn: 'Small Crew (2x)' },
  { id: 2, multiplier: 4, price: 250, labelRu: 'Средняя бригада (4x)', labelEn: 'Medium Crew (4x)' },
  { id: 3, multiplier: 8, price: 600, labelRu: 'Большая бригада (8x)', labelEn: 'Large Crew (8x)' },
];

export default function MedicalPage() {
  const { 
    medical, credits, crystals, startMedicalConstruction, accelerateConstruction, 
    checkConstructions, language, isLoaded, ownedHeroes, healHero 
  } = useGameState();
  const { toast } = useToast();
  
  const [activeTab, setActiveTab] = useState<'facilities' | 'patients'>('patients');
  const [selectedFacility, setSelectedFacility] = useState<string | null>(null);
  const [acceleratingFacility, setAcceleratingFacility] = useState<string | null>(null);
  const [selectedPatient, setSelectedPatient] = useState<Hero | null>(null);
  const [isHealing, setIsHealing] = useState(false);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (isLoaded) {
      const timer = setInterval(() => {
        checkConstructions();
        setNow(Date.now());
      }, 5000); 
      return () => clearInterval(timer);
    }
  }, [isLoaded, checkConstructions]);

  const injuredHeroes = useMemo(() => {
    return ownedHeroes.filter(h => h.isInjured);
  }, [ownedHeroes]);

  const labels = {
    en: {
      title: "MEDICAL CENTER",
      subtitle: "Rehabilitation and Health Monitoring",
      patientsTab: "Patients",
      facilitiesTab: "Facilities",
      noPatients: "Operational status: CLEAR",
      noPatientsDesc: "All personnel fit for tactical deployment.",
      healCredits: "Standard Treatment",
      healCrystals: "Elite Surgery",
      confirm: "Initiate Project",
      cost: "Medical Costs",
      duration: "Timeframe",
      hours: "hours",
      level: "Ур",
      upgrade: "Modernize",
      accelerate: "Accelerate",
      items: {
        physiotherapyLevel: { label: "Physiotherapy", desc: "Improves the physical condition of your players, preventing injuries." },
        massageLevel: { label: "Massage Room", desc: "Speeds up player fatigue recovery between matches." },
        psychiatristLevel: { label: "Psychiatrist", desc: "Reduces player fatigue after matches." },
        labLevel: { label: "Medical Lab", desc: "Speeds up the healing process for all injuries." },
        psychologistLevel: { label: "Psychologist", desc: "Slightly speeds up training in unofficial matches." }
      }
    },
    ru: {
      title: "МЕДИЦИНСКИЙ ЦЕНТР",
      subtitle: "Реабилитация и мониторинг здоровья",
      patientsTab: "Пациенты",
      facilitiesTab: "Объекты",
      noPatients: "Статус: ЧИСТО",
      noPatientsDesc: "Весь персонал готов к выполнению боевых задач.",
      healCredits: "Стационарное лечение",
      healCrystals: "Элитная хирургия",
      confirm: "Начать проект",
      cost: "Затраты",
      duration: "Срок",
      hours: "ч",
      level: "Ур",
      upgrade: "Улучшить",
      accelerate: "Ускорить",
      items: {
        physiotherapyLevel: { label: "Физиотерапия", desc: "Улучшает физическое состояние игроков, предупреждая травмы." },
        massageLevel: { label: "Массажная", desc: "Ускоряет восстановление усталости между матчами." },
        psychiatristLevel: { label: "Психиатр", desc: "Уменьшает усталость игроков после матчей." },
        labLevel: { label: "Лаборатория", desc: "Значительно ускоряет пассивное лечение всех травм." },
        psychologistLevel: { label: "Психолог", desc: "Ускоряет тренировку в неофициальных матчах." }
      }
    }
  };

  const t = labels[language as keyof typeof labels] || labels.ru;

  const calculateProgress = useCallback((id: string) => {
    const start = medical.constructionStarts?.[id];
    const finish = medical.constructionFinishes?.[id];
    if (!finish || !start) return 0;
    const startTime = new Date(start).getTime();
    const total = new Date(finish).getTime() - startTime;
    const elapsed = Date.now() - startTime;
    return Math.min(Math.max((elapsed / total) * 100, 0), 100);
  }, [medical.constructionStarts, medical.constructionFinishes]);

  const handleFacilityUpgrade = () => {
    if (!selectedFacility) return;
    const cost = 30000 * (((medical as any)[selectedFacility] || 0) + 1);
    if (startMedicalConstruction(selectedFacility as any, cost)) {
      toast({ title: language === 'ru' ? "Модернизация начата" : "Upgrade Initiated" });
      setSelectedFacility(null);
    }
  };

  const handleHeal = (type: 'credits' | 'crystals', cost: number) => {
    if (!selectedPatient) return;
    const bal = type === 'credits' ? credits : crystals;
    if (bal < cost) {
      toast({ title: t.cost, description: t.healCredits, variant: "destructive" });
      return;
    }

    setIsHealing(true);
    setTimeout(() => {
      healHero(selectedPatient.id, type, cost);
      toast({ title: language === 'ru' ? "Игрок здоров!" : "Player Recovered!" });
      setIsHealing(false);
      setSelectedPatient(null);
    }, 1000);
  };

  const facilityList = [
    { id: 'physiotherapyLevel', icon: Activity, color: 'text-green-400' },
    { id: 'massageLevel', icon: HeartPulse, color: 'text-red-400' },
    { id: 'psychiatristLevel', icon: Brain, color: 'text-purple-400' },
    { id: 'labLevel', icon: FlaskConical, color: 'text-blue-400' },
    { id: 'psychologistLevel', icon: UserCircle, color: 'text-yellow-400' },
  ];

  if (!isLoaded) return <LoadingScreen />;

  return (
    <div className="max-w-md mx-auto px-4 pt-8 pb-32">
      <header className="mb-6 flex items-center gap-4">
        <Link href="/training">
          <Button variant="ghost" size="icon" className="rounded-full">
            <ChevronLeft className="w-6 h-6" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-headline font-bold uppercase tracking-tighter flex items-center gap-2">
            <Stethoscope className="w-6 h-6 text-primary" />
            {t.title}
          </h1>
          <p className="text-muted-foreground text-[10px] uppercase tracking-widest">{t.subtitle}</p>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-2 mb-6 bg-secondary/20 p-1 rounded-xl border border-white/5">
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={() => setActiveTab('patients')}
          className={cn("h-10 text-[10px] font-black uppercase tracking-widest", activeTab === 'patients' ? "bg-white/10 text-primary" : "text-muted-foreground")}
        >
          {t.patientsTab} ({injuredHeroes.length})
        </Button>
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={() => setActiveTab('facilities')}
          className={cn("h-10 text-[10px] font-black uppercase tracking-widest", activeTab === 'facilities' ? "bg-white/10 text-primary" : "text-muted-foreground")}
        >
          {t.facilitiesTab}
        </Button>
      </div>

      {activeTab === 'patients' && (
        <div className="space-y-3 animate-in fade-in duration-500">
          {injuredHeroes.length > 0 ? injuredHeroes.map((hero) => (
            <Card key={hero.id} className="glass-card border-red-500/20 bg-red-500/5 cursor-pointer hover:bg-red-500/10 transition-all" onClick={() => setSelectedPatient(hero)}>
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl border border-red-500/30 overflow-hidden bg-secondary/50 relative">
                     <img src={hero.image} alt={hero.name} className="w-full h-full object-cover opacity-50 grayscale" />
                     <ShieldAlert className="absolute inset-0 m-auto w-6 h-6 text-red-500 animate-pulse" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold uppercase text-white">{hero.name}</h3>
                    <p className="text-[10px] text-red-400 font-bold uppercase mt-1">Травмирован до: {new Date(hero.injuredUntil!).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-red-400" />
              </CardContent>
            </Card>
          )) : (
            <div className="py-20 text-center opacity-30 flex flex-col items-center gap-4 border-2 border-dashed border-white/5 rounded-3xl">
               <ShieldCheck className="w-16 h-16 text-green-400" />
               <div>
                 <h2 className="text-xl font-headline font-bold uppercase text-white">{t.noPatients}</h2>
                 <p className="text-[10px] uppercase font-bold tracking-widest">{t.noPatientsDesc}</p>
               </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'facilities' && (
        <div className="space-y-3 animate-in fade-in duration-500">
          {facilityList.map((item) => {
            const level = (medical as any)[item.id] || 0;
            const isConstructing = !!medical.constructionFinishes?.[item.id];
            const progress = isConstructing ? calculateProgress(item.id) : 0;
            
            return (
              <Card key={item.id} className={cn("glass-card border-white/5", isConstructing && "bg-orange-500/5 border-orange-500/20")}>
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={cn("p-2.5 rounded-xl bg-secondary/50", isConstructing ? "text-orange-400 animate-pulse" : item.color)}>
                      {isConstructing ? <Hammer className="w-5 h-5" /> : <item.icon className="w-5 h-5" />}
                    </div>
                    <div>
                      <h3 className="text-sm font-bold uppercase">{t.items[item.id as keyof typeof t.items].label}</h3>
                      <Badge variant="outline" className="text-[8px] h-4 uppercase mt-1 border-white/10 opacity-60">LVL {level}</Badge>
                    </div>
                  </div>
                  {!isConstructing && (
                    <Button size="sm" variant="outline" className="h-9 px-4 border-white/10" onClick={() => setSelectedFacility(item.id)}>
                      <span className="text-[9px] font-black uppercase">{t.upgrade}</span>
                    </Button>
                  )}
                </CardContent>
                {isConstructing && (
                  <div className="px-4 pb-4 space-y-1">
                    <div className="flex justify-between text-[7px] font-black uppercase text-orange-400">
                      <span>IMPROVING...</span>
                      <span>{Math.floor(progress)}%</span>
                    </div>
                    <Progress value={progress} className="h-1" />
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* PATIENT MODAL */}
      <Dialog open={!!selectedPatient} onOpenChange={() => setSelectedPatient(null)}>
        <DialogContent className="max-w-md bg-card border-white/10 p-0 overflow-hidden shadow-2xl">
          <div className="p-6 text-center bg-gradient-to-br from-red-500/20 via-background to-transparent border-b border-white/5">
            <div className="w-20 h-20 rounded-2xl mx-auto mb-4 border-2 border-red-500/50 overflow-hidden shadow-xl bg-secondary/50">
               <img src={selectedPatient?.image} alt="" className="w-full h-full object-cover grayscale" />
            </div>
            <DialogTitle className="text-2xl font-headline font-bold uppercase tracking-tight text-white">{selectedPatient?.name}</DialogTitle>
            <DialogDescription className="text-[10px] text-red-400 mt-1 font-black uppercase tracking-widest animate-pulse">REHABILITATION PROTOCOL REQUIRED</DialogDescription>
          </div>

          <div className="p-6 space-y-4">
            <Card className="glass-card border-yellow-500/20 hover:border-yellow-500/50 transition-all cursor-pointer" onClick={() => handleHeal('credits', 25000)}>
              <CardContent className="p-5 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-xl bg-yellow-500/10"><Coins className="w-6 h-6 text-yellow-500" /></div>
                  <div>
                    <h3 className="text-sm font-bold uppercase text-white">{t.healCredits}</h3>
                    <p className="text-[9px] text-muted-foreground uppercase">Интенсивная терапия (24ч)</p>
                  </div>
                </div>
                <Badge className="bg-primary text-primary-foreground font-black">25,000 €</Badge>
              </CardContent>
            </Card>

            <Card className="glass-card border-blue-500/20 hover:border-blue-500/50 transition-all cursor-pointer" onClick={() => handleHeal('crystals', 150)}>
              <CardContent className="p-5 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-xl bg-blue-500/10"><Gem className="w-6 h-6 text-blue-400" /></div>
                  <div>
                    <h3 className="text-sm font-bold uppercase text-white">{t.healCrystals}</h3>
                    <p className="text-[9px] text-muted-foreground uppercase">Мгновенное восстановление</p>
                  </div>
                </div>
                <Badge className="bg-accent text-accent-foreground font-black">150 💎</Badge>
              </CardContent>
            </Card>
          </div>

          <div className="p-4 bg-secondary/20 border-t border-white/5">
            <Button variant="ghost" className="w-full text-[10px] font-bold uppercase" onClick={() => setSelectedPatient(null)}>ЗАКРЫТЬ</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* FACILITY MODAL */}
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
    </div>
  );
}
