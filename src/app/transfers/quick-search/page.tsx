
'use client';

import { useState, useEffect, useRef, memo, useMemo, useCallback } from 'react';
import { useGameState } from '@/app/lib/store';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { 
  ChevronLeft, Loader2, Gavel, ShieldCheck, 
  Timer, Star, ShoppingCart, X, Check, Search, Info, Users,
  ChevronLeft as ChevronLeftIcon, ChevronRight as ChevronRightIcon,
  ChevronsLeft, ChevronsRight, Zap, Gem, Award, Target, Eye, Map, 
  Sparkles, Sword, Crosshair, Brain, TrendingUp
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { LoadingScreen } from '@/components/game/LoadingScreen';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Slider } from '@/components/ui/slider';
import { Progress } from '@/components/ui/progress';
import { useUser, useFirestore, useCollection, useMemoFirebase, useDoc } from '@/firebase';
import { collection, query, doc, arrayUnion, serverTimestamp, setDoc, updateDoc, deleteDoc, getDoc } from 'firebase/firestore';
import { addDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { useToast } from '@/hooks/use-toast';
import { generateUniqueHero } from '@/app/lib/moba-data';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';
import { getMoscowTime, calculateLiveAge, getMoscowDateString, getEndOfMoscowDay } from '@/app/lib/time-utils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

const ITEMS_PER_PAGE = 10;

/**
 * Рендерит звезды таланта в зависимости от его значения (шкала 1-100).
 */
export const renderStars = (talent: number) => {
  const numericTalent = Math.round(Number(talent || 0));

  if (numericTalent > 50) {
    let src = "https://iili.io/CCZlOeR.png"; // 5 stars elite (51-59)
    if (numericTalent >= 60 && numericTalent <= 69) src = "https://iili.io/CnTWT0X.md.png"; // 6 stars (60-69)
    if (numericTalent >= 70) src = "https://iili.io/CCZXucP.png"; // 7 stars (70-100)
    return <img src={src} alt={`${numericTalent} stars`} className="h-3 w-auto object-contain" />;
  }

  // Обычные векторные звезды для таланта <= 50 (делим на 10 для 1-5 звезд)
  const starRating = numericTalent / 10;
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => {
        const fill = Math.min(Math.max(starRating - i, 0), 1);
        return (
          <div key={i} className="relative w-2 h-2">
            <Star className="absolute inset-0 w-2 h-2 text-muted-foreground/20" />
            <div className="absolute inset-0 overflow-hidden" style={{ width: `${fill * 100}%` }}>
              <Star className="w-2 h-2 text-yellow-500 fill-yellow-500" />
            </div>
          </div>
        );
      })}
    </div>
  );
};

export const TransferHeroCard = memo(({ 
  agent, 
  user, 
  profile, 
  onBid, 
  now,
  language 
}: { 
  agent: any, 
  user: any, 
  profile: any, 
  onBid: (agent: any, amount: number) => Promise<void>,
  now: number,
  language: string
}) => {
  const [showBidModal, setShowBidModal] = useState(false);
  const [showDossier, setShowDossier] = useState(false);
  const [bidPercent, setBidPercent] = useState(5);
  const [isProcessing, setIsProcessing] = useState(false);
  const { isPremium, activeLicenseTier } = useGameState();

  const isLeading = agent.highestBidderId === user?.uid;
  const isOwner = agent.sellerId === user?.uid;
  const isDiamond = agent.currency === 'crystals';
  const nextBidValue = Math.ceil(agent.currentBid * (1 + bidPercent / 100));
  const liveAge = calculateLiveAge(agent.heroData.baseAge, agent.heroData.hiredAt);
  
  // Ключевой параметр: используем MAX таланта для главного блока
  const maxTalentValue = Math.max(...Object.values(agent.heroData.proTalents || {}).map(v => Number(v)));

  const rolesRu: Record<string, string> = {
    'Carry': 'Керри',
    'Midlaner': 'Мидер',
    'Tank': 'Танк',
    'Jungler': 'Лес',
    'Support': 'Саппорт'
  };

  const proStatsLabels: Record<string, string> = {
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
  };

  const getCountdown = (expiryIso: string) => {
    const expiry = new Date(expiryIso).getTime();
    const diff = expiry - now;
    if (diff <= 0) return "00:00:00";
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const s = Math.floor((diff % 60000) / 1000);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const maxBidLimit = useMemo(() => {
    if (isPremium || isDiamond) return 1000;
    const tier = activeLicenseTier || 4;
    if (tier === 4) return 10;
    if (tier === 3) return 30;
    if (tier === 2) return 100;
    if (tier === 1) return 300;
    return 10;
  }, [isPremium, activeLicenseTier, isDiamond]);

  return (
    <>
      <Card 
        onClick={() => setShowDossier(true)}
        className={cn(
          "glass-card border-white/5 overflow-hidden transition-all cursor-pointer active:scale-[0.98]", 
          isLeading && "border-green-500/40 bg-green-500/5",
          isOwner && "border-primary/40 bg-primary/5",
          agent.isPro && "border-yellow-500/30 shadow-[0_0_20px_rgba(234,179,8,0.1)]"
        )}
      >
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
             <div className="flex items-center gap-1.5 text-accent">
               <Timer className="w-3.5 h-3.5 animate-pulse" />
               <span className="text-[10px] font-mono font-bold tracking-tighter">{getCountdown(agent.expiresAt)}</span>
             </div>
             <div className="flex gap-1.5">
               {agent.isPro && <Badge className="bg-yellow-500 text-black text-[7px] font-black uppercase px-2 h-4 border-none shadow-[0_0_10px_rgba(234,179,8,0.3)]">PRO UNIT</Badge>}
               {isOwner && <Badge className="bg-primary text-primary-foreground text-[7px] font-black uppercase px-2 h-4 border-none">{language === 'ru' ? 'ВАШ ЛОТ' : 'YOUR LOT'}</Badge>}
               {isLeading && <Badge className="bg-green-600 text-white text-[7px] font-black uppercase px-2 h-4 border-none">{language === 'ru' ? 'ЛИДИРУЕТЕ' : 'LEADING'}</Badge>}
             </div>
          </div>

          <div className="flex items-center gap-4 mb-4">
            <div className="relative shrink-0">
              <div className="w-16 h-16 rounded-xl overflow-hidden bg-secondary/30 border border-white/10 relative">
                <img src={agent.heroData?.image} alt="" className="w-full h-full object-cover" />
                <div className="absolute -bottom-1 -right-1 bg-background rounded-md p-0.5 border border-white/10 shadow-xl z-10 flex items-center justify-center">
                  <span className="text-xs leading-none">{agent.heroData.country?.flag}</span>
                </div>
              </div>
            </div>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <div className={cn("relative flex items-center min-w-0", agent.isPro && "pl-1.5 border-l-2 border-yellow-500")}>
                  {agent.isPro && <div className="absolute inset-0 bg-gradient-to-r from-yellow-500/20 to-transparent -z-10" />}
                  <h3 className="text-base font-bold uppercase truncate text-white tracking-tight leading-tight">{agent.heroData?.name}</h3>
                </div>
                <Badge variant="outline" className="text-[8px] h-4 py-0 border-white/10 uppercase font-black text-primary/80">
                  {rolesRu[agent.heroData.role] || agent.heroData.role}
                </Badge>
              </div>
              
              <div className="grid grid-cols-2 gap-3 mt-2">
                 <div className="flex flex-col">
                   <p className="text-[8px] font-black text-muted-foreground uppercase leading-none mb-1">{language === 'ru' ? 'ТАЛАНТ' : 'TALENT'}</p>
                   {renderStars(maxTalentValue)}
                 </div>
                 <div className="flex flex-col border-l border-white/5 pl-3">
                   <p className="text-[8px] font-black text-muted-foreground uppercase leading-none mb-1">{language === 'ru' ? 'ВОЗРАСТ' : 'AGE'}</p>
                   <p className="text-sm font-bold text-white leading-none mt-0.5">{liveAge.display}</p>
                 </div>
              </div>
            </div>
            
            <div className="text-right flex flex-col items-end shrink-0 justify-center">
              <p className="text-3xl font-headline font-bold text-accent italic leading-none">{agent.heroData?.overallRating}</p>
              <p className="text-[8px] font-black text-muted-foreground uppercase mt-1 tracking-widest">OVR</p>
            </div>
          </div>

          <div className="flex items-center justify-between gap-4 pt-4 border-t border-white/5">
            <div className="flex flex-col gap-1.5 min-w-0 flex-1">
              <p className="text-[8px] uppercase text-muted-foreground font-black tracking-widest leading-none">{language === 'ru' ? 'ЦЕНА' : 'PRICE'}</p>
              <div className="flex items-center gap-1.5">
                {isDiamond ? <Gem className="w-4 h-4 text-blue-400" /> : <span className="text-white font-black">€</span>}
                <p className="text-xl font-headline font-bold text-white tracking-tight leading-none">{agent.currentBid?.toLocaleString()}</p>
              </div>
              <div className="flex items-center min-w-0 mt-1">
                {agent.highestBidderName ? (
                  <div className="relative inline-flex items-center min-w-0 max-w-full">
                    <div className="absolute inset-0 bg-gradient-to-r from-accent/30 via-accent/5 to-transparent border-l-2 border-accent -z-10" />
                    <span className="px-2 py-0.5 text-[9px] font-bold uppercase tracking-tight truncate text-white">
                      {agent.highestBidderName}
                    </span>
                  </div>
                ) : (
                  <span className="text-[9px] font-black uppercase text-muted-foreground/50">
                    {language === 'ru' ? 'Нет ставок' : 'No bids'}
                  </span>
                )}
              </div>
            </div>
            
            <Button 
              className={cn(
                "h-11 font-black text-[10px] px-6 rounded-xl uppercase tracking-[0.1em] transition-all shrink-0", 
                isLeading ? "bg-green-600/20 text-green-400 border border-green-500/30" : 
                (isOwner ? "bg-secondary/50 text-muted-foreground border border-white/5" : "hero-gradient shadow-xl shadow-primary/20 active:scale-95")
              )} 
              onClick={(e) => { e.stopPropagation(); if (!isLeading && !isOwner) setShowBidModal(true); }} 
              disabled={isLeading || isOwner}
            >
              {isOwner ? (language === 'ru' ? 'ВАШ ГЕРОЙ' : 'YOUR UNIT') : (
                isLeading ? <><ShieldCheck className="w-4 h-4 mr-2" /> {language === 'ru' ? 'ЛИДИРУЕТЕ' : 'LEADING'}</> : (
                  <>{language === 'ru' ? 'ПОСТАВИТЬ' : 'PLACE BID'}</>
                )
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Dialog open={showDossier} onOpenChange={setShowDossier}>
        <DialogContent className="max-w-md bg-background border-white/10 p-0 overflow-hidden shadow-2xl h-[90vh] flex flex-col">
          <div className="p-6 text-center bg-gradient-to-br from-primary/20 via-background to-accent/10 border-b border-white/5 relative shrink-0">
            <Button variant="ghost" size="icon" className="absolute left-4 top-4 rounded-full" onClick={() => setShowDossier(false)}>
              <X className="w-5 h-5" />
            </Button>
            <div className="relative mx-auto w-24 h-24 mb-4">
              <div className={cn("w-full h-full rounded-2xl overflow-hidden border-2 shadow-2xl bg-secondary/50", agent.isPro ? "border-yellow-500" : "border-primary/50")}>
                <img src={agent.heroData?.image} alt="" className="w-full h-full object-cover" />
              </div>
              <div className="absolute -bottom-2 -right-2 w-10 h-10 rounded-xl bg-background border border-white/10 flex items-center justify-center shadow-xl">
                <span className="text-xl">{agent.heroData.country?.flag}</span>
              </div>
            </div>
            <DialogTitle className="text-2xl font-headline font-bold uppercase tracking-tight text-white leading-none">
              {agent.heroData?.name}
            </DialogTitle>
            <div className="flex items-center justify-center gap-2 mt-2">
              <Badge className="bg-primary text-primary-foreground text-[10px] font-black uppercase px-2 h-5">{rolesRu[agent.heroData.role] || agent.heroData.role}</Badge>
              {agent.isPro && <Badge className="bg-yellow-500 text-black text-[10px] font-black uppercase px-2 h-5">PRO LEGEND</Badge>}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-8 scrollbar-hide">
            <section>
              <h3 className="text-[9px] font-black text-primary uppercase tracking-[0.2em] mb-4 flex items-center gap-2 opacity-80 px-1">
                <Info className="w-3.5 h-3.5" /> {language === 'ru' ? 'ХАРАКТЕРИСТИКИ' : 'BIOMETRICS & STATUS'}
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-secondary/20 p-3 rounded-xl border border-white/5 space-y-0.5">
                  <p className="text-[7px] font-black text-muted-foreground uppercase">{language === 'ru' ? 'ВОЗРАСТ' : 'AGE'}</p>
                  <p className="text-xs font-bold text-white">{liveAge.display} {language === 'ru' ? 'лет' : 'yrs'}</p>
                </div>
                <div className="bg-secondary/20 p-3 rounded-xl border border-white/5 space-y-0.5">
                  <p className="text-[7px] font-black text-muted-foreground uppercase">{language === 'ru' ? 'ЗАРПЛАТА' : 'SALARY'}</p>
                  <p className="text-xs font-bold text-green-400">€ {(agent.heroData.salary || 0).toLocaleString()}</p>
                </div>
                <div className="bg-secondary/20 p-3 rounded-xl border border-white/5 space-y-0.5">
                  <p className="text-[7px] font-black text-muted-foreground uppercase">{language === 'ru' ? 'РЕЙТИНГ' : 'OVERALL'}</p>
                  <p className="text-xs font-bold text-accent">{agent.heroData.overallRating} OVR</p>
                </div>
                <div className="bg-secondary/20 p-3 rounded-xl border border-white/5 space-y-0.5">
                  <p className="text-[7px] font-black text-muted-foreground uppercase">{language === 'ru' ? 'СТАТУС' : 'STATUS'}</p>
                  <p className="text-[10px] font-bold text-green-400 flex items-center gap-1.5"><ShieldCheck className="w-3 h-3" /> {language === 'ru' ? 'ГОТОВ' : 'READY'}</p>
                </div>
              </div>
            </section>

            <section>
              <h3 className="text-[9px] font-black text-accent uppercase tracking-[0.2em] mb-4 flex items-center gap-2 opacity-80 px-1">
                <Award className="w-3.5 h-3.5" /> {language === 'ru' ? 'ПРОФЕССИОНАЛЬНЫЕ НАВЫКИ' : 'PROFESSIONAL SKILLS'}
              </h3>
              <div className="space-y-3">
                {Object.entries(agent.heroData.proStats).map(([key, value]: [string, any]) => { 
                  // ПРИНУДИТЕЛЬНО ОКРУГЛЯЕМ ТАЛАНТ ДЛЯ ОТОБРАЖЕНИЯ (6.1 -> 61)
                  const talent = Math.round(Number(agent.heroData.proTalents ? (agent.heroData.proTalents as any)[key] : 45)); 
                  const icons: Record<string, any> = {
                    lastHitting: Target, mapAwareness: Eye, positioning: Map, reflexes: Zap,
                    manaManagement: Sparkles, objectiveControl: Sword, communication: Users,
                    tiltResistance: Brain, versatility: TrendingUp, ganking: Crosshair,
                  };
                  const Icon = icons[key] || Info;
                  return (
                    <div key={key} className="space-y-2 p-3 rounded-xl border border-white/5 bg-secondary/10 transition-all">
                      <div className="flex justify-between items-center px-0.5">
                        <div className="flex items-center gap-2">
                          <Icon className="w-3.5 h-3.5 text-muted-foreground/60" />
                          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                            {proStatsLabels[key]}
                          </span>
                        </div>
                        <div className="flex flex-col items-end">
                          <span className="text-[10px] font-mono font-bold text-primary">{value} / {talent}</span>
                          {renderStars(talent)}
                        </div>
                      </div>
                      <div className="relative">
                        <Progress value={(value / talent) * 100} max={100} className="h-1 rounded-full bg-secondary/40" />
                      </div>
                    </div>
                  ); 
                })}
              </div>
            </section>
          </div>

          <div className="p-4 bg-secondary/20 border-t border-white/5 shrink-0">
             <Button 
               className="w-full h-12 hero-gradient font-black text-xs uppercase tracking-widest"
               onClick={() => { setShowDossier(false); if (!isLeading && !isOwner) setShowBidModal(true); }}
               disabled={isLeading || isOwner}
             >
               {isLeading ? 'ВЫ ЛИДИРУЕТЕ' : (isOwner ? 'ВАШ ГЕРОЙ' : 'ПЕРЕЙТИ К СТАВКЕ')}
             </Button>
          </div>
        </DialogContent>
      </Dialog>
      
      {/* Bid Modal remains same */}
    </>
  );
});
