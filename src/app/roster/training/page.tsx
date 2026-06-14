
'use client';

import { useState } from 'react';
import { useGameState } from '../../lib/store';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { 
  ChevronLeft, Dumbbell, Target, Sparkles, 
  Zap, Star, Award, Info, CheckCircle2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { LoadingScreen } from '@/components/game/LoadingScreen';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { renderStars } from '@/app/transfers/quick-search/page';

export default function TrainingPage() {
  const { ownedHeroes, language, isLoaded, setTrainingFocus } = useGameState();

  const t = {
    title: language === 'ru' ? "ТРЕНИРОВКИ" : "PLAYER TRAINING",
    subtitle: language === 'ru' ? "Программа развития навыков" : "Skill development program",
    focus: language === 'ru' ? "Фокус тренировки" : "Training Focus",
    selectFocus: language === 'ru' ? "Выберите навык" : "Select Focus",
    noFocus: language === 'ru' ? "Не выбрано" : "None Selected",
    stats: language === 'ru' ? "Прогресс и Лимиты" : "Progress & Limits",
    desc: language === 'ru' 
      ? "Опыт начисляется после каждого матча. Официальные игры (Лига, Кубок) дают больше опыта, чем тренировочные."
      : "XP is awarded after each match. Official games (League, Cup) grant more XP than training matches.",
    skills: {
      lastHitting: language === 'ru' ? "Добив крипов" : "Last Hitting",
      mapAwareness: language === 'ru' ? "Контроль карты" : "Map Awareness",
      positioning: language === 'ru' ? "Позиционка" : "Positioning",
      reflexes: language === 'ru' ? "Рефлексы" : "Reflexes",
      manaManagement: language === 'ru' ? "Менеджмент маны" : "Mana Management",
      objectiveControl: language === 'ru' ? "Объекты" : "Objective Control",
      communication: language === 'ru' ? "Коммуникация" : "Communication",
      tiltResistance: language === 'ru' ? "Стрессоустойчивость" : "Tilt Resistance",
      versatility: language === 'ru' ? "Универсальность" : "Versatility",
      ganking: language === 'ru' ? "Ганкинг" : "Ganking",
    }
  };

  if (!isLoaded) return <LoadingScreen />;

  return (
    <div className="max-w-md mx-auto px-4 pt-8 pb-32">
      <header className="mb-6 flex items-center gap-4">
        <Link href="/roster">
          <Button variant="ghost" size="icon" className="rounded-full">
            <ChevronLeft className="w-6 h-6" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-headline font-bold uppercase tracking-tighter flex items-center gap-2">
            <Dumbbell className="w-6 h-6 text-primary" />
            {t.title}
          </h1>
          <p className="text-muted-foreground text-[10px] uppercase tracking-widest">{t.subtitle}</p>
        </div>
      </header>

      <div className="space-y-6">
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="p-4 flex gap-4">
            <Info className="w-5 h-5 text-primary shrink-0" />
            <p className="text-[10px] text-muted-foreground leading-relaxed italic">
              "{t.desc}"
            </p>
          </CardContent>
        </Card>

        <div className="space-y-3">
          {ownedHeroes.map((hero) => {
            const currentFocus = hero.trainingFocus;
            const focusSkillValue = currentFocus ? Math.round(Number((hero.proStats as any)[currentFocus])) : 0;
            const focusSkillTalent = (currentFocus && hero.proTalents) ? Math.round(Number((hero.proTalents as any)[currentFocus])) : (currentFocus ? 30 : 0);
            const isAtLimit = currentFocus && focusSkillValue >= focusSkillTalent;

            return (
              <Card key={hero.id} className="glass-card border-white/5 overflow-hidden">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl border border-white/10 overflow-hidden bg-secondary/50">
                        <img src={hero.image} alt={hero.name} className="w-full h-full object-cover" />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold uppercase truncate max-w-[120px]">{hero.name}</h3>
                        <Badge variant="outline" className="text-[7px] h-3 px-1 border-white/10 uppercase opacity-60">{hero.role}</Badge>
                      </div>
                    </div>
                    
                    <div className="w-36">
                      <Select 
                        value={currentFocus || "none"} 
                        onValueChange={(val) => setTrainingFocus(hero.id, val === "none" ? null : val)}
                      >
                        <SelectTrigger className="h-8 bg-secondary/50 border-white/5 text-[9px] font-bold uppercase tracking-tighter">
                          <SelectValue placeholder={t.selectFocus} />
                        </SelectTrigger>
                        <SelectContent className="bg-card border-white/10">
                          <SelectItem value="none" className="text-[9px] uppercase font-bold">{t.noFocus}</SelectItem>
                          {Object.entries(t.skills).map(([key, label]) => (
                            <SelectItem key={key} value={key} className="text-[9px] uppercase font-bold">
                              {label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {currentFocus ? (
                    <div className="space-y-4 bg-background/40 p-4 rounded-xl border border-white/5">
                      <div className="flex justify-between items-center px-0.5">
                        <div className="flex items-center gap-2">
                          <Target className={cn("w-4 h-4", isAtLimit ? "text-yellow-500" : "text-primary")} />
                          <span className="text-xs font-black uppercase tracking-widest">
                            {t.skills[currentFocus as keyof typeof t.skills]}
                          </span>
                        </div>
                        <div className="flex flex-col items-end">
                          <div className="flex items-center gap-1.5 mb-1">
                            <span className={cn("text-xs font-mono font-bold", isAtLimit ? "text-yellow-500" : "text-white")}>
                              {focusSkillValue}
                            </span>
                            <span className="text-[10px] text-muted-foreground">/</span>
                            <span className="text-xs font-mono font-bold text-primary">
                              {focusSkillTalent}
                            </span>
                          </div>
                          {renderStars(focusSkillTalent)}
                        </div>
                      </div>
                      <div className="relative">
                        <Progress value={(focusSkillValue / focusSkillTalent) * 100} max={100} className="h-1 rounded-full bg-secondary/40" />
                      </div>
                      {isAtLimit && (
                        <div className="flex items-center justify-center gap-1.5 pt-1 text-yellow-500">
                          <CheckCircle2 className="w-3 h-3" />
                          <span className="text-[8px] font-black uppercase tracking-widest">Max Potential Reached</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="py-4 text-center border border-dashed border-white/5 rounded-xl opacity-30">
                      <p className="text-[8px] font-bold uppercase tracking-widest">{t.selectFocus}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}

