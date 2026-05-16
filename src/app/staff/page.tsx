'use client';

import { useState } from 'react';
import { useGameState } from '../lib/store';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
} from '@/components/ui/dialog';
import { 
  ChevronLeft, UserCog, GraduationCap, Microscope, 
  Stethoscope, CircleDollarSign, Zap, Clock, TrendingUp, Info
} from 'lucide-react';
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { LoadingScreen } from '@/components/game/LoadingScreen';

export default function StaffPage() {
  const { staff, credits, upgradeStaff, language, isLoaded } = useGameState();
  const { toast } = useToast();
  
  const [selectedMember, setSelectedMember] = useState<string | null>(null);

  if (!isLoaded) return <LoadingScreen />;

  const labels = {
    en: {
      title: "CLUB PERSONNEL",
      subtitle: "Professional Staff Management",
      hiring: "Hire Specialist",
      upgrade: "Professional Growth",
      level: "LVL",
      maxLevel: "Max Proficiency",
      cost: "Contract Value",
      benefit: "Operational Benefit",
      confirm: "Sign Contract",
      insufficient: "Insufficient Credits",
      success: "Staff member modernized",
      personnel: "Active Staff",
      items: {
        coachLevel: { 
          label: "Head Coach", 
          desc: "Expert in tactical drills and technical development.",
          benefitDesc: "Increases XP gain from all matches by ",
          icon: GraduationCap,
          color: "text-blue-400"
        },
        analystLevel: { 
          label: "Tactical Analyst", 
          desc: "Masters meta-data and rival performance patterns.",
          benefitDesc: "Boosts team synergy growth rate by ",
          icon: Microscope,
          color: "text-red-400"
        },
        scoutLevel: { 
          label: "Lead Scout", 
          desc: "Uncovers high-potential prodigies in remote sectors.",
          benefitDesc: "Improves youth academy talent quality by ",
          icon: TrendingUp,
          color: "text-accent"
        },
        doctorLevel: { 
          label: "Team Physician", 
          desc: "Optimizes recovery cycles and health monitoring.",
          benefitDesc: "Reduces hero fatigue gain per match by ",
          icon: Stethoscope,
          color: "text-green-400"
        },
        financierLevel: { 
          label: "Chief Financial Officer", 
          desc: "Manages fiscal logistics and tax efficiency.",
          benefitDesc: "Reduces facility maintenance costs by ",
          icon: CircleDollarSign,
          color: "text-yellow-400"
        }
      }
    },
    ru: {
      title: "ПЕРСОНАЛ КЛУБА",
      subtitle: "Управление профессиональными кадрами",
      hiring: "Нанять специалиста",
      upgrade: "Повысить квалификацию",
      level: "УР",
      maxLevel: "Макс. квалификация",
      cost: "Стоимость контракта",
      benefit: "Эффект для клуба",
      confirm: "Подписать контракт",
      insufficient: "Недостаточно евро",
      success: "Сотрудник прошел переподготовку",
      personnel: "Действующий персонал",
      items: {
        coachLevel: { 
          label: "Главный тренер", 
          desc: "Эксперт в тактических упражнениях и развитии игроков.",
          benefitDesc: "Увеличивает получаемый опыт в матчах на ",
          icon: GraduationCap,
          color: "text-blue-400"
        },
        analystLevel: { 
          label: "Аналитик", 
          desc: "Изучает мету и паттерны игры соперников.",
          benefitDesc: "Ускоряет рост сыгранности состава на ",
          icon: Microscope,
          color: "text-red-400"
        },
        scoutLevel: { 
          label: "Главный скаут", 
          desc: "Находит самых талантливых юниоров по всему миру.",
          benefitDesc: "Улучшает качество талантов в академии на ",
          icon: TrendingUp,
          color: "text-accent"
        },
        doctorLevel: { 
          label: "Спортивный врач", 
          desc: "Оптимизирует циклы восстановления и мониторинг здоровья.",
          benefitDesc: "Снижает накопление усталости за матч на ",
          icon: Stethoscope,
          color: "text-green-400"
        },
        financierLevel: { 
          label: "Финансовый директор", 
          desc: "Управляет налогами и эффективностью бюджета.",
          benefitDesc: "Снижает затраты на содержание базы на ",
          icon: CircleDollarSign,
          color: "text-yellow-400"
        }
      }
    }
  };

  const t = labels[language as keyof typeof labels] || labels.ru;

  const staffList = [
    { id: 'coachLevel' },
    { id: 'analystLevel' },
    { id: 'scoutLevel' },
    { id: 'doctorLevel' },
    { id: 'financierLevel' },
  ];

  const handleUpgrade = () => {
    if (!selectedMember) return;
    const currentLevel = (staff as any)[selectedMember] || 0;
    const cost = 50000 * (currentLevel + 1);
    
    if (upgradeStaff(selectedMember as any, cost)) {
      toast({ title: t.success });
      setSelectedMember(null);
    } else {
      toast({ title: t.insufficient, variant: "destructive" });
    }
  };

  const calculateBenefit = (id: string, level: number) => {
    return level * 3; // 3% per level
  };

  return (
    <div className="max-w-md mx-auto px-4 pt-8 pb-32">
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

      <div className="space-y-3">
        <h2 className="text-xs font-headline font-bold text-accent uppercase tracking-[0.2em] mb-4 px-1">{t.personnel}</h2>

        {staffList.map((item) => {
          const level = (staff as any)[item.id] || 0;
          const config = t.items[item.id as keyof typeof t.items];
          const benefit = calculateBenefit(item.id, level);
          
          return (
            <Card key={item.id} className="glass-card border-white/5 hover:border-primary/20 transition-all cursor-pointer overflow-hidden" onClick={() => setSelectedMember(item.id)}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={cn("p-3 rounded-xl bg-secondary/50 shadow-inner", config.color)}>
                      <config.icon className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold uppercase tracking-tight">{config.label}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="secondary" className="text-[9px] h-4 py-0 uppercase">LVL {level}</Badge>
                        {level > 0 && (
                          <span className="text-[8px] font-black text-green-400 uppercase tracking-tighter">
                            +{benefit}% EFFECT
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <Button size="sm" variant="ghost" className="h-8 px-2 text-primary hover:bg-primary/10">
                      <Zap className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
                <p className="text-[10px] text-muted-foreground mt-3 leading-tight italic">
                  {config.desc}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="mt-8 p-4 bg-primary/5 rounded-xl border border-primary/20">
        <div className="flex gap-4">
          <div className="p-2 rounded-lg bg-primary/20 h-fit">
            <Info className="w-4 h-4 text-primary" />
          </div>
          <p className="text-[10px] text-muted-foreground leading-relaxed">
            {language === 'ru' 
              ? "Персонал — это основа стабильности клуба. Высококлассные специалисты не только улучшают показатели тренировок, но и оптимизируют внутренние процессы команды."
              : "Personnel is the foundation of club stability. Top-tier specialists not only improve training performance but also optimize internal team processes."}
          </p>
        </div>
      </div>

      <Dialog open={!!selectedMember} onOpenChange={() => setSelectedMember(null)}>
        {selectedMember && (
          <DialogContent className="max-w-xs bg-card border-white/10 p-6 overflow-hidden">
            {(() => {
              const config = t.items[selectedMember as keyof typeof t.items];
              const currentLevel = (staff as any)[selectedMember] || 0;
              const nextLevel = currentLevel + 1;
              const cost = 50000 * nextLevel;
              const isMax = currentLevel >= 10;

              return (
                <>
                  <DialogHeader className="text-center">
                    <div className={cn("mx-auto w-16 h-16 rounded-2xl bg-secondary/50 flex items-center justify-center mb-4 border border-white/5", config.color)}>
                      <config.icon className="w-8 h-8" />
                    </div>
                    <DialogTitle className="text-xl font-headline font-bold uppercase tracking-tight">
                      {config.label}
                    </DialogTitle>
                    <DialogDescription className="text-xs mt-2 italic px-2">
                      {config.desc}
                    </DialogDescription>
                  </DialogHeader>

                  <div className="space-y-4 my-6">
                    <div className="bg-secondary/30 p-4 rounded-xl border border-white/5 text-center">
                      <p className="text-[8px] uppercase font-black text-muted-foreground mb-1">{t.benefit}</p>
                      <p className="text-xs font-bold text-white leading-relaxed">
                        {config.benefitDesc}
                        <span className="text-green-400">+{calculateBenefit(selectedMember, nextLevel)}%</span>
                      </p>
                    </div>

                    {!isMax && (
                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-secondary/30 p-3 rounded-xl text-center border border-white/5">
                           <p className="text-[8px] uppercase font-bold text-muted-foreground mb-1">{t.cost}</p>
                           <p className="text-sm font-bold text-accent">€ {cost.toLocaleString()}</p>
                        </div>
                        <div className="bg-secondary/30 p-3 rounded-xl text-center border border-white/5">
                           <p className="text-[8px] uppercase font-bold text-muted-foreground mb-1">New LVL</p>
                           <p className="text-sm font-bold text-primary">{nextLevel}</p>
                        </div>
                      </div>
                    )}
                  </div>

                  <DialogFooter>
                    {isMax ? (
                      <Button className="w-full h-12 bg-secondary/50 text-muted-foreground cursor-not-allowed uppercase text-[10px] font-black" disabled>
                        {t.maxLevel}
                      </Button>
                    ) : (
                      <Button 
                        className="w-full h-12 hero-gradient font-bold uppercase text-[10px] shadow-lg active:scale-95 transition-all" 
                        onClick={handleUpgrade}
                        disabled={credits < cost}
                      >
                        {credits < cost ? t.insufficient : t.confirm}
                      </Button>
                    )}
                  </DialogFooter>
                </>
              );
            })()}
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}
