'use client';

/**
 * @fileOverview Терминал скаутинга v1. 
 * Реализует поиск и найм новых талантов в Академию.
 */

import { useState, useEffect } from 'react';
import { useGameState } from '../../lib/store';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { 
  ChevronLeft, Radar, Search, UserPlus, 
  Info, Zap, Star, Trophy, Sparkles, Loader2,
  Users, Target, Brain, TrendingUp, Crosshair, 
  Sword, Eye, Map, Clock, ShieldAlert, X,
  ChevronRight
} from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { LoadingScreen } from '@/components/game/LoadingScreen';
import { Badge } from '@/components/ui/badge';
import { Hero } from '../../lib/moba-data';
import { calculateLiveAge } from '@/app/lib/time-utils';
import { renderStars, STAT_KEYS } from '@/app/transfers/quick-search/page';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

export default function ScoutingPage() {
  const { 
    language, isLoaded, scoutingCandidates, lastScoutDate, 
    scoutCandidates, recruitCandidate, hq, academy, youthAcademyHeroes,
    activeLicenseTier, isPremium
  } = useGameState();
  
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedHero, setSelectedHero] = useState<Hero | null>(null);

  const t = {
    en: {
      title: "SCOUTING TERMINAL",
      subtitle: "Talent Discovery & Recruitment",
      find: "COMMISSION SCOUTING REPORT",
      findDesc: "Direct scouts to search for gifted local cadets.",
      reportTitle: "Operational Candidates",
      lastScouted: "Last report",
      noCandidates: "No candidates currently detected.",
      recruit: "SIGN TO ACADEMY",
      limitReached: "Academy at full capacity",
      alreadyIn: "Candidate enlisted",
      success: "Cadet Enlisted",
      successDesc: "New talent has been moved to the Academy squad.",
      capacity: "ACADEMY CAPACITY",
      stats: "Candidate Dossier",
      close: "CLOSE"
    },
    ru: {
      title: "ТЕРМИНАЛ СКАУТИНГА",
      subtitle: "Поиск и набор талантов",
      find: "ЗАПРОСИТЬ ОТЧЕТ СКАУТОВ",
      findDesc: "Направить скаутов на поиск одаренных кадетов.",
      reportTitle: "Доступные кандидаты",
      lastScouted: "Последний отчет",
      noCandidates: "Кандидаты не обнаружены.",
      recruit: "ЗАЧИСЛИТЬ В ШКОЛУ",
      limitReached: "Академия переполнена",
      alreadyIn: "Кандидат зачислен",
      success: "Кадет зачислен",
      successDesc: "Новый талант направлен в состав Юношеской школы.",
      capacity: "ВМЕСТИМОСТЬ ШКОЛЫ",
      stats: "Досье кандидата",
      close: "ЗАКРЫТЬ"
    }
  }[language as 'en' | 'ru'];

  const academyLimit = 10 + (academy.youthBootcampLevel || 0);

  const handleScout = async () => {
    setIsProcessing(true);
    // Simulate complex analysis
    setTimeout(() => {
      scoutCandidates();
      setIsProcessing(false);
      toast({ title: language === 'ru' ? "Отчет готов!" : "Report Ready!" });
    }, 2000);
  };

  const handleRecruit = (hero: Hero) => {
    if (youthAcademyHeroes.length >= academyLimit) {
      toast({ title: t.limitReached, variant: "destructive" });
      return;
    }
    recruitCandidate(hero.id);
    toast({ title: t.success, description: t.successDesc });
    setSelectedHero(null);
  };

  if (!isLoaded) return <LoadingScreen />;

  return (
    <div className="max-w-md mx-auto px-4 pt-8 pb-32">
      <header className="mb-6 flex items-center gap-4">
        <Link href="/youth-academy">
          <Button variant="ghost" size="icon" className="rounded-full">
            <ChevronLeft className="w-6 h-6" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-headline font-bold uppercase tracking-tighter flex items-center gap-2 text-primary">
            <Radar className="w-6 h-6 text-primary" />
            {t.title}
          </h1>
          <p className="text-muted-foreground text-[10px] uppercase tracking-widest font-black opacity-50">{t.subtitle}</p>
        </div>
      </header>

      <div className="space-y-6">
        {/* CAPACITY INFO */}
        <Card className="glass-card border-white/5 bg-secondary/10">
          <CardContent className="p-4 flex items-center justify-between">
             <div className="flex items-center gap-3">
               <div className="p-2 rounded-lg bg-primary/20"><Users className="w-4 h-4 text-primary" /></div>
               <span className="text-[10px] font-black uppercase text-muted-foreground">{t.capacity}</span>
             </div>
             <div className="text-right">
               <span className="text-sm font-headline font-bold text-white italic">{youthAcademyHeroes.length} / {academyLimit}</span>
             </div>
          </CardContent>
        </Card>

        {/* SCOUTING ACTION */}
        <Card className={cn(
          "glass-card border-dashed border-primary/30 transition-all",
          isProcessing && "animate-pulse border-accent"
        )}>
          <CardContent className="p-6 text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center mx-auto relative">
              {isProcessing ? <Loader2 className="w-8 h-8 text-accent animate-spin" /> : <Radar className="w-8 h-8 text-primary" />}
              {isProcessing && <div className="absolute inset-0 rounded-full border-2 border-accent border-t-transparent animate-spin"></div>}
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-bold uppercase text-white">{t.find}</h3>
              <p className="text-[9px] text-muted-foreground uppercase leading-relaxed italic">{t.findDesc}</p>
            </div>
            <Button 
              className="w-full h-12 hero-gradient font-black text-[10px] tracking-widest uppercase shadow-lg shadow-primary/20"
              onClick={handleScout}
              disabled={isProcessing}
            >
              {isProcessing ? 'SCANNING SECTORS...' : 'START SCOUTING MISSION'}
            </Button>
            {lastScoutDate && (
              <p className="text-[7px] font-black text-muted-foreground/40 uppercase tracking-widest">
                {t.lastScouted}: {lastScoutDate}
              </p>
            )}
          </CardContent>
        </Card>

        {/* CANDIDATES LIST */}
        <div className="space-y-3">
          <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-accent px-1 flex items-center gap-2 px-1">
            <Search className="w-3.5 h-3.5" /> {t.reportTitle}
          </h2>

          {scoutingCandidates.length > 0 ? scoutingCandidates.map((hero) => {
            const talentsValues = Object.values(hero.proTalents || {}).map(v => Number(v));
            const maxTalent = Math.max(...talentsValues);
            
            return (
              <Card key={hero.id} className="glass-card border-white/5 hover:bg-white/5 transition-all cursor-pointer" onClick={() => setSelectedHero(hero)}>
                <CardContent className="p-3 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-lg overflow-hidden border border-white/10 bg-secondary/50 shrink-0">
                    <img src={hero.image} alt="" className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="text-xs font-bold uppercase truncate text-white">{hero.name}</h4>
                      <Badge variant="outline" className="text-[6px] h-3 px-1 border-white/10 uppercase opacity-60">{hero.role}</Badge>
                    </div>
                    <div className="flex items-center gap-3">
                       {renderStars(maxTalent)}
                       <span className="text-[8px] font-black text-muted-foreground uppercase">AGE: {hero.baseAge}</span>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground/30" />
                </CardContent>
              </Card>
            );
          }) : (
            <div className="py-12 text-center opacity-30 border border-dashed border-white/5 rounded-2xl flex flex-col items-center gap-4">
               <ShieldAlert className="w-8 h-8" />
               <p className="text-[8px] font-black uppercase tracking-widest">{t.noCandidates}</p>
            </div>
          )}
        </div>
      </div>

      {/* CANDIDATE DOSSIER */}
      <Dialog open={!!selectedHero} onOpenChange={() => setSelectedHero(null)}>
        <DialogContent className="max-w-md bg-background border-white/10 p-0 overflow-hidden shadow-2xl h-[90vh] flex flex-col">
          <div className="p-4 pt-12 pb-8 bg-gradient-to-br from-primary/20 via-background to-accent/10 border-b border-white/5 relative shrink-0 text-center">
            <Button variant="ghost" size="icon" className="absolute left-4 top-10 rounded-full bg-black/20" onClick={() => setSelectedHero(null)}><X className="w-5 h-5" /></Button>
            <div className="relative mx-auto w-24 h-24 mb-4">
              <div className="w-full h-full rounded-2xl overflow-hidden border-2 border-primary/50 shadow-2xl bg-secondary/50">
                <img src={selectedHero?.image} alt="" className="w-full h-full object-cover" />
              </div>
              <div className="absolute -bottom-2 -right-2 w-10 h-10 rounded-xl bg-background border border-white/10 flex items-center justify-center shadow-xl">
                <span className="text-xl">{selectedHero?.country?.flag}</span>
              </div>
            </div>
            <DialogTitle className="text-2xl font-headline font-bold uppercase tracking-tight text-white leading-none">
              {selectedHero?.name}
            </DialogTitle>
            <div className="flex items-center justify-center gap-2 mt-2">
              <Badge className="bg-primary text-primary-foreground text-[10px] font-black uppercase px-2 h-5">{selectedHero?.role}</Badge>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-8 scrollbar-hide">
            <section className="space-y-3">
              <h3 className="text-[9px] font-black text-primary uppercase tracking-[0.2em] mb-4 flex items-center gap-2 opacity-80 px-1">
                <Info className="w-3.5 h-3.5" /> {t.stats}
              </h3>
              <div className="grid grid-cols-2 gap-2">
                <div className="flex items-center justify-between p-3 bg-secondary/10 rounded-xl border border-white/5">
                   <span className="text-[9px] font-bold text-muted-foreground uppercase">Initial OVR</span>
                   <span className="text-sm font-headline font-bold text-accent">{selectedHero?.overallRating}</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-secondary/10 rounded-xl border border-white/5">
                   <span className="text-[9px] font-bold text-muted-foreground uppercase">Potential</span>
                   <div className="flex items-center">
                    {selectedHero && renderStars(Math.max(...Object.values(selectedHero.proTalents || {}).map(v => Number(v))))}
                   </div>
                </div>
              </div>
            </section>

            <section className="space-y-3">
              <h3 className="text-[9px] font-black text-accent uppercase tracking-[0.2em] mb-4 flex items-center gap-2 opacity-80 px-1">
                <Zap className="w-3.5 h-3.5" /> TALENT TELEMETRY
              </h3>
              <div className="space-y-2">
                {STAT_KEYS.map((key) => {
                  const talentLimit = selectedHero ? (Number((selectedHero.proTalents as any)[key]) < 10 ? Number((selectedHero.proTalents as any)[key]) * 10 : Number((selectedHero.proTalents as any)[key])) : 0;
                  return (
                    <div key={key} className="p-3 bg-secondary/10 rounded-xl border border-white/5 flex justify-between items-center">
                      <span className="text-[9px] font-bold uppercase text-muted-foreground tracking-widest">{key.toUpperCase()}</span>
                      <div className="flex items-center gap-3">
                         {renderStars(talentLimit)}
                         <span className="text-xs font-mono font-bold text-accent">{talentLimit}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          </div>

          <div className="p-4 bg-secondary/20 border-t border-white/5 shrink-0">
             <Button 
               className="w-full h-14 hero-gradient font-black text-xs uppercase tracking-widest shadow-xl active:scale-95 transition-all" 
               onClick={() => selectedHero && handleRecruit(selectedHero)}
             >
               <UserPlus className="w-4 h-4 mr-2" />
               {t.recruit}
             </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
