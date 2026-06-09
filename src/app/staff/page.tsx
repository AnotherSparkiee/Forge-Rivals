'use client';

import { useState, useMemo } from 'react';
import { useGameState } from '../lib/store';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
} from '@/components/ui/dialog';
import { 
  ChevronLeft, UserCog, GraduationCap, Microscope, 
  Stethoscope, CircleDollarSign, Zap, Clock, TrendingUp, Info,
  Gem, UserPlus, Star, Award, HeartPulse, ShieldCheck
} from 'lucide-react';
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { LoadingScreen } from '@/components/game/LoadingScreen';
import { StaffMember, StaffRole, generateStaffMember } from '../lib/moba-data';
import { calculateLiveAge } from '../lib/time-utils';
import { Progress } from '@/components/ui/progress';

export default function StaffPage() {
  const { staff, credits, crystals, hireStaffMember, trainStaffSkill, language, isLoaded } = useGameState();
  const { toast } = useToast();
  
  const [selectedRole, setSelectedRole] = useState<StaffRole | null>(null);
  const [hiringCandidates, setHiringCandidates] = useState<StaffMember[]>([]);

  const t = {
    title: language === 'ru' ? "ПЕРСОНАЛ КЛУБА" : "CLUB PERSONNEL",
    subtitle: language === 'ru' ? "Управление кадрами и навыками" : "Human resources & skills hub",
    activeStaff: language === 'ru' ? "Действующие специалисты" : "Active Specialists",
    hiring: language === 'ru' ? "Нанять специалиста" : "Hire Specialist",
    train: language === 'ru' ? "ОБУЧИТЬ (+1)" : "TRAIN (+1)",
    cost: language === 'ru' ? "Стоимость" : "Cost",
    age: language === 'ru' ? "Возраст" : "Age",
    years: language === 'ru' ? "лет" : "yrs",
    insufficient: language === 'ru' ? "Недостаточно ресурсов" : "Insufficient funds/gems",
    maxSkill: language === 'ru' ? "Максимум (99)" : "Max Skill (99)",
    hireBtn: language === 'ru' ? "ПОДПИСАТЬ КОНТРАКТ" : "SIGN CONTRACT",
    roles: {
      coach: { 
        label: language === 'ru' ? "Главный тренер" : "Head Coach",
        skills: { primary: language === 'ru' ? "Стратегия" : "Strategy", secondary: language === 'ru' ? "Техника" : "Technique" },
        icon: GraduationCap, color: "text-blue-400"
      },
      analyst: { 
        label: language === 'ru' ? "Аналитик" : "Tactical Analyst",
        skills: { primary: language === 'ru' ? "Дата-майнинг" : "Data Mining", secondary: language === 'ru' ? "Контр-пик" : "Counter-pick" },
        icon: Microscope, color: "text-red-400"
      },
      scout: { 
        label: language === 'ru' ? "Главный скаут" : "Lead Scout",
        skills: { primary: language === 'ru' ? "Интуиция" : "Discovery", secondary: language === 'ru' ? "Оценка" : "Assessment" },
        icon: TrendingUp, color: "text-accent"
      },
      doctor: { 
        label: language === 'ru' ? "Спортивный врач" : "Physician",
        skills: { primary: language === 'ru' ? "Реабилитация" : "Recovery", secondary: language === 'ru' ? "Профилактика" : "Prevention" },
        icon: Stethoscope, color: "text-green-400"
      },
      financier: { 
        label: language === 'ru' ? "Финансовый директор" : "CFO",
        skills: { primary: language === 'ru' ? "Логистика" : "Logistics", secondary: language === 'ru' ? "Налоги" : "Fiscals" },
        icon: CircleDollarSign, color: "text-yellow-400"
      }
    }
  };

  const handleOpenHiring = (role: StaffRole) => {
    const candidates = Array.from({ length: 3 }).map(() => generateStaffMember(role));
    setHiringCandidates(candidates);
    setSelectedRole(role);
  };

  const handleHire = (candidate: StaffMember) => {
    if (credits < (candidate.salary / 2)) {
      toast({ title: t.insufficient, variant: "destructive" });
      return;
    }
    hireStaffMember(candidate);
    toast({ title: language === 'ru' ? "Контракт подписан!" : "Contract signed!" });
    setSelectedRole(null);
  };

  const handleTrain = (role: StaffRole, skillKey: 'primary' | 'secondary') => {
    if (crystals < 100) {
      toast({ title: t.insufficient, variant: "destructive" });
      return;
    }
    if (trainStaffSkill(role, skillKey, 100)) {
      toast({ title: language === 'ru' ? "Навык улучшен!" : "Skill improved!" });
    }
  };

  if (!isLoaded) return <LoadingScreen />;

  return (
    <div className="max-w-md mx-auto px-4 pt-8 pb-6">
      <header className="mb-6 flex items-center gap-4">
        <Link href="/">
          <Button variant="ghost" size="icon" className="rounded-full">
            <ChevronLeft className="w-6 h-6" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-headline font-bold uppercase tracking-tighter flex items-center gap-2">
            <UserCog className="w-6 h-6 text-primary" />
            {t.title}
          </h1>
          <p className="text-muted-foreground text-[10px] uppercase tracking-widest">{t.subtitle}</p>
        </div>
      </header>

      <div className="space-y-6">
        <h2 className="text-xs font-headline font-bold text-accent uppercase tracking-[0.2em] px-1">{t.activeStaff}</h2>

        {(Object.keys(t.roles) as StaffRole[]).map((roleKey) => {
          const member = staff[roleKey];
          const config = t.roles[roleKey];
          const Icon = config.icon;

          if (!member) {
            return (
              <Card key={roleKey} className="glass-card border-white/5 border-dashed bg-secondary/10 hover:border-primary/30 transition-all cursor-pointer" onClick={() => handleOpenHiring(roleKey)}>
                <CardContent className="p-6 flex flex-col items-center justify-center text-center space-y-3">
                  <div className="w-12 h-12 rounded-full bg-secondary/50 flex items-center justify-center border border-white/5 opacity-50">
                    <UserPlus className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold uppercase text-muted-foreground">{config.label}</h3>
                    <p className="text-[10px] text-muted-foreground/60 uppercase tracking-widest mt-1">{t.hiring}</p>
                  </div>
                </CardContent>
              </Card>
            );
          }

          const liveAge = calculateLiveAge(member.baseAge, member.hiredAt);

          return (
            <Card key={roleKey} className="glass-card border-white/5 overflow-hidden">
              <CardContent className="p-0">
                <div className="p-4 flex items-center gap-4 bg-primary/5 border-b border-white/5">
                  <div className="w-16 h-16 rounded-xl overflow-hidden border border-white/10 shrink-0">
                    <img src={member.image} alt="" className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-bold uppercase truncate">{member.firstName} {member.lastName}</h3>
                      <Badge variant="outline" className={cn("text-[7px] py-0 border-white/10 uppercase", config.color)}>{config.label}</Badge>
                    </div>
                    <p className="text-[9px] text-muted-foreground font-bold uppercase tracking-widest mt-1">
                      {t.age}: {liveAge.display} {t.years}
                    </p>
                  </div>
                </div>

                <div className="p-4 space-y-4">
                  {(['primary', 'secondary'] as const).map((skillKey) => (
                    <div key={skillKey} className="space-y-2">
                      <div className="flex justify-between items-end">
                        <div>
                          <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest leading-none mb-1">
                            {config.skills[skillKey]}
                          </p>
                          <div className="flex items-center gap-2">
                            <span className="text-lg font-headline font-bold text-white leading-none">{member.skills[skillKey]}</span>
                            <span className="text-[10px] text-muted-foreground">/ 99</span>
                          </div>
                        </div>
                        <Button 
                          size="sm" 
                          variant="outline" 
                          className="h-8 border-white/10 bg-secondary/50 hover:bg-accent/10 hover:text-accent font-black text-[9px] gap-1.5"
                          onClick={() => handleTrain(roleKey, skillKey)}
                          disabled={member.skills[skillKey] >= 99}
                        >
                          <Gem className="w-3 h-3 text-accent" /> 100
                        </Button>
                      </div>
                      <Progress value={(member.skills[skillKey] / 99) * 100} className="h-1 bg-white/5" />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Dialog open={!!selectedRole} onOpenChange={() => setSelectedRole(null)}>
        <DialogContent className="max-w-md bg-card border-white/10 p-0 overflow-hidden shadow-2xl">
          <div className="p-6 text-center bg-gradient-to-br from-primary/20 via-background to-accent/10 border-b border-white/5">
            <DialogTitle className="text-xl font-headline font-bold uppercase tracking-tight text-primary">
              {t.hiring}: {selectedRole ? t.roles[selectedRole].label : ''}
            </DialogTitle>
            <DialogDescription className="text-[10px] text-muted-foreground mt-2 uppercase tracking-widest font-bold">
              {language === 'ru' ? 'Выберите подходящего кандидата' : 'Select a suitable candidate'}
            </DialogDescription>
          </div>

          <div className="p-4 space-y-3 overflow-y-auto max-h-[60vh] scrollbar-hide">
            {hiringCandidates.map((candidate) => (
              <Card key={candidate.id} className="glass-card border-white/5 hover:border-primary/30 transition-all overflow-hidden group">
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="w-16 h-16 rounded-xl overflow-hidden border border-white/10 shrink-0">
                    <img src={candidate.image} alt="" className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-bold uppercase text-white truncate">{candidate.firstName} {candidate.lastName}</h4>
                    <p className="text-[9px] text-muted-foreground font-bold uppercase mt-1">{t.age}: {candidate.baseAge} {t.years}</p>
                    <div className="flex items-center gap-4 mt-2">
                      <div className="text-center bg-background/50 px-2 py-1 rounded border border-white/5">
                        <p className="text-[7px] text-muted-foreground uppercase font-black">Skill 1</p>
                        <p className="text-xs font-bold text-primary">{candidate.skills.primary}</p>
                      </div>
                      <div className="text-center bg-background/50 px-2 py-1 rounded border border-white/5">
                        <p className="text-[7px] text-muted-foreground uppercase font-black">Skill 2</p>
                        <p className="text-xs font-bold text-accent">{candidate.skills.secondary}</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <p className="text-xs font-headline font-bold text-green-400">€{(candidate.salary / 2).toLocaleString()}</p>
                    <Button size="sm" className="hero-gradient font-black text-[9px] px-3 h-8" onClick={() => handleHire(candidate)}>
                      {t.hireBtn}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="p-4 bg-secondary/20 border-t border-white/5">
            <Button variant="ghost" className="w-full text-[10px] uppercase font-bold" onClick={() => setSelectedRole(null)}>
              {language === 'ru' ? 'ОТМЕНА' : 'CANCEL'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
