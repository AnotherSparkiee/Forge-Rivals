'use client';

import { useState } from 'react';
import { useGameState } from '../lib/store';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  ChevronLeft, GraduationCap, User, Star, ArrowUpCircle,
  Info, TrendingUp, ShieldCheck, HeartPulse, Zap,
  Sword, Sparkles, Crosshair, Map, Eye, Target, Brain, Users
} from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { LoadingScreen } from '@/components/game/LoadingScreen';
import { Hero } from '../lib/moba-data';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogPortal
} from "@/components/ui/dialog";
import { useToast } from '@/hooks/use-toast';

export default function YouthAcademyPage() {
  const { youthAcademyHeroes, language, isLoaded, promoteYouthPlayer } = useGameState();
  const [selectedHero, setSelectedHero] = useState<Hero | null>(null);
  const { toast } = useToast();

  if (!isLoaded) return <LoadingScreen />;

  const t = {
    title: language === 'ru' ? "ЮНОШЕСКАЯ АКАДЕМИЯ" : "YOUTH ACADEMY",
    subtitle: language === 'ru' ? "Кузница будущих легенд" : "Forging future legends",
    promote: language === 'ru' ? "ПЕРЕВЕСТИ В ОСНОВУ" : "PROMOTE TO SQUAD",
    notReady: language === 'ru' ? "НЕ ГОТОВ (НУЖНО 18 ЛЕТ)" : "NOT READY (NEED 18 YRS)",
    overall: language === 'ru' ? "ОБЩ" : "OVR",
    age: language === 'ru' ? "Возраст" : "Age",
    years: language === 'ru' ? "лет" : "yrs",
    stats: language === 'ru' ? "Навыки и потенциал" : "Skills & Potential",
    desc: language === 'ru' 
      ? "Новые таланты прибывают в академию каждые 4 дня. Вы можете перевести игрока в основной состав, как только ему исполнится 18 лет."
      : "New talents arrive at the academy every 4 days. You can promote a player to the main squad once they reach 18 years of age.",
    success: language === 'ru' ? "Игрок переведен в состав!" : "Player promoted to squad!",
    proStatsLabels: {
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

  const handlePromote = (heroId: string) => {
    promoteYouthPlayer(heroId);
    toast({ title: t.success });
    setSelectedHero(null);
  };

  const renderStars = (rating: number) => (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => {
        const fill = Math.min(Math.max(rating - i, 0), 1);
        return (
          <div key={i} className="relative w-2.5 h-2.5">
            <Star className="absolute inset-0 w-2.5 h-2.5 text-muted-foreground/20" />
            <div className="absolute inset-0 overflow-hidden" style={{ width: `${fill * 100}%` }}>
              <Star className="w-2.5 h-2.5 text-yellow-500 fill-yellow-500" />
            </div>
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="max-w-md mx-auto px-4 pt-8 pb-32">
      <header className="mb-6 flex items-center gap-4">
        <Link href="/">
          <Button variant="ghost" size="icon" className="rounded-full">
            <ChevronLeft className="w-6 h-6" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-headline font-bold uppercase tracking-tighter flex items-center gap-2 text-primary">
            <GraduationCap className="w-6 h-6" />
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

        <div className="space-y-2">
          {youthAcademyHeroes.length > 0 ? youthAcademyHeroes.map((hero) => (
            <Card 
              key={hero.id} 
              className="glass-card border-white/5 hover:bg-white/5 cursor-pointer transition-all"
              onClick={() => setSelectedHero(hero)}
            >
              <CardContent className="p-3 flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl overflow-hidden bg-secondary/50 border border-white/10 shrink-0">
                  <img src={hero.image} alt={hero.name} className="w-full h-full object-cover" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold truncate uppercase">{hero.name}</h3>
                    <Badge variant="outline" className="text-[7px] h-3 px-1 border-white/10 uppercase opacity-60">{hero.role}</Badge>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <p className="text-[9px] text-muted-foreground font-black uppercase tracking-widest">
                      {t.age}: {hero.age} {t.years}
                    </p>
                    {hero.age === 18 && (
                      <Badge className="bg-green-500/20 text-green-400 text-[6px] h-3 px-1 font-black animate-pulse">READY</Badge>
                    )}
                  </div>
                </div>
                <div className="flex flex-col items-center justify-center min-w-[40px] border-l border-white/5 pl-3">
                  <span className="text-lg font-headline font-bold text-accent italic">{hero.overallRating}</span>
                </div>
              </CardContent>
            </Card>
          )) : (
            <div className="py-20 text-center opacity-30 flex flex-col items-center gap-4">
              <Users className="w-16 h-16" />
              <p className="text-xs font-bold uppercase tracking-widest">Academy is currently empty</p>
            </div>
          )}
        </div>
      </div>

      <Dialog open={!!selectedHero} onOpenChange={() => setSelectedHero(null)}>
        <DialogPortal>
          <DialogContent className="fixed inset-0 z-[100] max-w-none w-full h-full m-0 p-0 bg-background border-none flex flex-col rounded-none sm:rounded-none overflow-hidden outline-none translate-x-0 translate-y-0 top-0 left-0 animate-in fade-in zoom-in duration-300">
            {selectedHero && (
              <>
                <DialogHeader className="sr-only">
                  <DialogTitle>{selectedHero.name}</DialogTitle>
                  <DialogDescription>Academy student dossier</DialogDescription>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto scrollbar-hide">
                  <div className="p-4 pt-12 pb-8 bg-gradient-to-br from-primary/20 via-background to-accent/5 border-b border-white/5 flex flex-col items-center text-center gap-4">
                    <div className="relative">
                      <div className="w-24 h-24 rounded-2xl overflow-hidden border border-primary/50 shadow-[0_0_30px_rgba(var(--primary),0.3)] bg-secondary/50">
                        <img src={selectedHero.image} alt={selectedHero.name} className="w-full h-full object-cover" />
                      </div>
                      <div className="absolute -bottom-1 -right-1 w-8 h-8 rounded-lg bg-background border border-white/10 flex items-center justify-center shadow-xl">
                        <span className="text-base">{selectedHero.country?.flag || '🏳️'}</span>
                      </div>
                    </div>
                    
                    <div className="space-y-1">
                      <h2 className="text-2xl font-headline font-bold uppercase text-white tracking-tight leading-none">{selectedHero.name}</h2>
                      <Badge className="bg-primary text-primary-foreground text-[10px] font-black uppercase px-2 h-5">{selectedHero.role}</Badge>
                    </div>

                    <div className="w-full grid grid-cols-2 gap-3 max-w-[300px] mx-auto">
                      <div className="bg-background/40 p-3 rounded-xl border border-white/10">
                        <p className="text-[8px] font-black text-muted-foreground uppercase tracking-widest">{t.overall}</p>
                        <p className="text-xl font-headline font-bold text-accent italic leading-none">{selectedHero.overallRating}</p>
                      </div>
                      <div className="bg-background/40 p-3 rounded-xl border border-white/10">
                        <p className="text-[8px] font-black text-muted-foreground uppercase tracking-widest">{t.age}</p>
                        <p className="text-xl font-headline font-bold text-primary italic leading-none">{selectedHero.age}</p>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 space-y-8 pb-32">
                    <section className="space-y-3">
                      <h3 className="text-[9px] font-black text-accent uppercase tracking-[0.2em] mb-4 flex items-center gap-2 opacity-80 px-1">
                        <TrendingUp className="w-3.5 h-3.5" /> ACADEMY STATUS
                      </h3>
                      <div className="bg-secondary/10 p-4 rounded-xl border border-white/5 flex items-center justify-between">
                         <div className="flex items-center gap-3">
                           <ShieldCheck className={cn("w-5 h-5", selectedHero.age >= 18 ? "text-green-400" : "text-muted-foreground")} />
                           <div>
                             <p className="text-[10px] font-bold uppercase">{selectedHero.age >= 18 ? 'GRADUATED' : 'STUDENT'}</p>
                             <p className="text-[8px] text-muted-foreground">{selectedHero.age >= 18 ? 'Eligible for promotion' : 'Requires training until 18'}</p>
                           </div>
                         </div>
                         {selectedHero.age < 18 && (
                           <div className="text-right">
                             <p className="text-[8px] font-black text-accent uppercase">{18 - selectedHero.age} Years to go</p>
                           </div>
                         )}
                      </div>
                    </section>

                    <section>
                      <h3 className="text-[9px] font-black text-muted-foreground uppercase tracking-[0.2em] mb-4 flex items-center gap-2 opacity-80 px-1">
                        <Star className="w-3.5 h-3.5" /> {t.stats}
                      </h3>
                      <div className="space-y-5">
                        {Object.entries(selectedHero.proStats).map(([key, value]) => {
                          const talent = selectedHero.proTalents ? (selectedHero.proTalents as any)[key] : 3.0;
                          const icons: Record<string, any> = {
                            lastHitting: Target, mapAwareness: Eye, positioning: Map, reflexes: Zap,
                            manaManagement: Sparkles, objectiveControl: Sword, communication: Users,
                            tiltResistance: Brain, versatility: TrendingUp, ganking: Crosshair,
                          };
                          const Icon = icons[key] || Info;
                          return (
                            <div key={key} className="space-y-2 bg-secondary/10 p-3 rounded-xl border border-white/5">
                              <div className="flex justify-between items-center px-0.5">
                                <div className="flex items-center gap-2">
                                  <Icon className="w-3.5 h-3.5 text-muted-foreground/60" />
                                  <span className="text-[10px] font-bold uppercase tracking-widest">{t.proStatsLabels[key as keyof typeof t.proStatsLabels]}</span>
                                </div>
                                <div className="flex flex-col items-end">
                                  <span className="text-[10px] font-mono font-bold text-primary">{value} / 100</span>
                                  {renderStars(talent)}
                                </div>
                              </div>
                              <div className="relative h-1 bg-secondary/40 rounded-full overflow-hidden">
                                <div className="absolute top-0 left-0 h-full bg-primary" style={{ width: `${value}%` }} />
                                <div className="absolute top-0 left-0 h-full bg-yellow-500/20" style={{ width: `${talent * 20}%` }} />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </section>
                  </div>
                </div>

                <div className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-background via-background/95 to-transparent pt-12 flex-shrink-0 z-[110] flex flex-col gap-2">
                  <Button 
                    className={cn(
                      "w-full h-14 font-black text-[11px] tracking-[0.2em] shadow-xl rounded-xl active:scale-95 transition-all uppercase",
                      selectedHero.age >= 18 ? "hero-gradient" : "bg-secondary/50 border border-white/5 text-muted-foreground cursor-not-allowed"
                    )}
                    disabled={selectedHero.age < 18}
                    onClick={() => handlePromote(selectedHero.id)}
                  >
                    <ArrowUpCircle className="w-4 h-4 mr-2" />
                    {selectedHero.age >= 18 ? t.promote : t.notReady}
                  </Button>
                  <Button 
                    variant="ghost"
                    className="w-full h-12 text-[9px] font-bold tracking-widest text-muted-foreground uppercase"
                    onClick={() => setSelectedHero(null)}
                  >
                    {language === 'ru' ? 'ВЕРНУТЬСЯ' : 'BACK TO ACADEMY'}
                  </Button>
                </div>
              </>
            )}
          </DialogContent>
        </DialogPortal>
      </Dialog>
    </div>
  );
}
