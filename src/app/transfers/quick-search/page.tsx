
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
  const numericTalent = Number(talent || 0);

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
  
  // Определяем максимальный талант игрока для главной иконки в карточке
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
                   <p className="text-[11px] font-bold text-white leading-none mt-0.5">{liveAge.display}</p>
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
                  const talent = Number(agent.heroData.proTalents ? (agent.heroData.proTalents as any)[key] : 45); 
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

      <Dialog open={showBidModal} onOpenChange={setShowBidModal}>
        <DialogContent className="max-sm bg-card border-white/10 p-0 overflow-hidden shadow-2xl">
          <div className="p-6 text-center bg-gradient-to-br from-primary/20 via-background to-accent/10 border-b border-white/5">
            <div className="mx-auto w-16 h-16 rounded-2xl overflow-hidden border border-primary/50 shadow-xl bg-secondary/50 mb-4">
              <img src={agent.heroData?.image} alt="" className="w-full h-full object-cover" />
            </div>
            <DialogTitle className="text-2xl font-headline font-bold uppercase tracking-tight text-white leading-none">
              {agent.heroData?.name}
            </DialogTitle>
            <DialogDescription className="text-[10px] text-muted-foreground mt-2 uppercase tracking-[0.2em] font-black">
              {language === 'ru' ? 'ТЕРМИНАЛ СТАВОК' : 'BIDDING TERMINAL'}
            </DialogDescription>
          </div>

          <div className="p-6 space-y-8">
            <div className="space-y-4">
              <div className="flex justify-between items-center px-1">
                <span className="text-[10px] font-black uppercase text-muted-foreground flex items-center gap-2">
                  <Gavel className="w-4 h-4 text-primary" /> {language === 'ru' ? 'СУММА СДЕЛКИ' : 'NEW BID AMOUNT'}
                </span>
                <div className="flex items-center gap-1.5">
                  {isDiamond ? <Gem className="w-4 h-4 text-blue-400" /> : <span className="text-primary font-black">€</span>}
                  <span className="text-xl font-headline font-black text-primary italic">{nextBidValue.toLocaleString()}</span>
                </div>
              </div>
              
              <div className="relative pt-4 pb-2">
                <Slider
                  value={[bidPercent]}
                  onValueChange={(val) => setBidPercent(val[0])}
                  min={3}
                  max={maxBidLimit}
                  step={1}
                />
                <div className="flex justify-between mt-3 text-[8px] font-black text-muted-foreground/40 uppercase tracking-widest">
                  <span>MIN +3%</span>
                  <span>MAX +{maxBidLimit}%</span>
                </div>
              </div>
            </div>

            <div className="bg-primary/5 rounded-xl border border-primary/20 p-4 flex gap-4">
               <Info className="w-5 h-5 text-primary shrink-0" />
               <p className="text-[10px] text-muted-foreground leading-relaxed italic">
                 {language === 'ru' 
                  ? "Средства будут списаны немедленно. Если вашу ставку перебьют, сумма вернется на баланс клуба." 
                  : "Funds will be deducted immediately. If outbid, the amount will be returned to your club balance."}
               </p>
            </div>
          </div>

          <DialogFooter className="p-4 bg-secondary/20 border-t border-white/5 gap-2">
            <Button variant="outline" className="flex-1 h-12 uppercase font-black text-[10px] border-white/10" onClick={() => setShowBidModal(false)}>
              {language === 'ru' ? 'ОТМЕНА' : 'CANCEL'}
            </Button>
            <Button 
              className="flex-[2] h-12 hero-gradient font-black text-[11px] uppercase tracking-widest shadow-xl shadow-primary/20"
              onClick={async () => {
                setIsProcessing(true);
                await onBid(agent, nextBidValue);
                setIsProcessing(false);
                setShowBidModal(false);
              }}
              disabled={isProcessing}
            >
              {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : (language === 'ru' ? 'ПОДТВЕРДИТЬ' : 'CONFIRM')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
});

TransferHeroCard.displayName = 'TransferHeroCard';

export default function QuickSearchPage() {
  const { language, isLoaded: isStoreLoaded, credits, addCredits } = useGameState();
  const { user, isUserLoading } = useUser();
  const db = useFirestore();
  const { toast } = useToast();
  const router = useRouter();
  
  const [now, setNow] = useState(Date.now());
  const [activeTab, setActiveTab] = useState('Carry');
  const [page, setPage] = useState(0);
  const initTriggeredRef = useRef(false);

  useEffect(() => {
    const timer = setInterval(() => setNow(getMoscowTime().getTime()), 1000);
    return () => clearInterval(timer);
  }, []);

  const userDocRef = useMemoFirebase(() => user?.uid ? doc(db, 'players_v10', user.uid) : null, [db, user?.uid]);
  const { data: profile } = useDoc(userDocRef);

  const marketQuery = useMemoFirebase(() => {
    if (!user?.uid) return null;
    return query(collection(db, 'market_v7'));
  }, [db, user?.uid]);

  const { data: agents, isLoading: isMarketLoading, error: marketError } = useCollection(marketQuery);

  useEffect(() => {
    if (isMarketLoading || marketError || !user?.uid || !isStoreLoaded) return;

    const today = getMoscowDateString();
    const systemAgentsToday = (agents || []).filter(a => a.isSystem && a.dropDate === today && !a.isPro);

    if (systemAgentsToday.length === 0 && !initTriggeredRef.current) {
      initTriggeredRef.current = true;
      
      const refreshMarket = async () => {
        const deterministicExpiry = getEndOfMoscowDay();
        const roles = ['Carry', 'Midlaner', 'Tank', 'Jungler', 'Support'] as const;
        for (const role of roles) {
          for (let i = 1; i <= 10; i++) {
            const agentId = `sys_drop_${today}_${role.toLowerCase()}_${i}`;
            const existingRef = doc(db, 'market_v7', agentId);
            const existingSnap = await getDoc(existingRef);
            if (!existingSnap.exists()) {
              const seed = `${today}_${role}_${i}`;
              const hero = generateUniqueHero(role, i, false, seed);
              if (hero.baseAge < 18) { hero.baseAge = 18; hero.age = 18; }
              const startPrice = (hero.overallRating * 17500) + 290000;
              await setDoc(existingRef, { id: agentId, heroData: JSON.parse(JSON.stringify(hero)), currentBid: startPrice, startingPrice: startPrice, highestBidderId: null, highestBidderName: null, bidders: [], expiresAt: deterministicExpiry, dropDate: today, createdAt: serverTimestamp(), isSystem: true, isYouth: false, sellerId: 'system' });
            }
          }
        }
      };
      refreshMarket().catch(e => console.error("Daily market refresh failed", e));
    }
  }, [isMarketLoading, agents, user?.uid, db, marketError, isStoreLoaded]);

  const handleGlobalBid = useCallback(async (agent: any, amount: number) => {
    if (!user || !profile) return;
    if (credits < amount) { 
      toast({ title: language === 'ru' ? "Недостаточно средств" : "Insufficient funds", variant: "destructive" }); 
      return; 
    }
    try {
      const prevBidder = agent.highestBidderId;
      const heroName = agent.heroData?.name || "Player";
      
      const mskNow = getMoscowTime().getTime();
      const expiryTime = new Date(agent.expiresAt).getTime();
      const timeLeft = expiryTime - mskNow;
      let finalExpiresAt = agent.expiresAt;
      
      if (timeLeft < 600000) { 
        finalExpiresAt = new Date(mskNow + 600000).toISOString(); 
      }

      await updateDoc(doc(db, 'market_v7', agent.id), { 
        currentBid: amount, highestBidderId: user.uid, highestBidderName: profile.displayName || "Unknown Manager", 
        bidders: arrayUnion(user.uid), updatedAt: serverTimestamp(),
        expiresAt: finalExpiresAt
      });

      addCredits(-amount);
      if (prevBidder && prevBidder !== user.uid) {
        addDocumentNonBlocking(collection(db, 'notifications_v7'), {
          userId: prevBidder, title: language === 'ru' ? "Ставка перебита!" : "Outbid!",
          description: language === 'ru' ? `Ставка на "${heroName}" перебита ${new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}` : `Bid on "${heroName}" outbid ${new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}`,
          type: 'market', read: false, createdAt: new Date().toISOString()
        });
      }
      
      toast({ 
        title: language === 'ru' ? "Ставка принята!" : "Bid Confirmed!",
        description: timeLeft < 600000 ? (language === 'ru' ? "Аукцион продлен на 10 минут!" : "Auction extended by 10 minutes!") : undefined
      });
    } catch (e) {
      toast({ title: "Error placing bid", variant: "destructive" });
    }
  }, [user, profile, credits, language, toast, db, addCredits]);

  const roleList = useMemo(() => [ { id: 'Carry', label: "Керри" }, { id: 'Midlaner', label: "Мидер" }, { id: 'Tank', label: "Танк" }, { id: 'Jungler', label: "Лес" }, { id: 'Support', label: "Саппорт" } ], []);
  
  const filteredAgents = useMemo(() => {
    return (agents?.filter(a => a.heroData?.role === activeTab && a.isYouth !== true && !a.isPro) || [])
      .filter(a => { const liveAge = calculateLiveAge(a.heroData.baseAge, a.heroData.hiredAt); return new Date(a.expiresAt).getTime() > now && liveAge.numeric >= 18.0; })
      .sort((a, b) => new Date(a.expiresAt).getTime() - new Date(b.expiresAt).getTime());
  }, [agents, activeTab, now]);

  const paginatedAgents = useMemo(() => { const start = page * ITEMS_PER_PAGE; return filteredAgents.slice(start, start + ITEMS_PER_PAGE); }, [filteredAgents, page]);
  const totalPages = Math.ceil(filteredAgents.length / ITEMS_PER_PAGE);

  if (isUserLoading || !isStoreLoaded || isMarketLoading) return <LoadingScreen />;

  return (
    <div className="max-w-md mx-auto px-4 pt-8 pb-6">
      <header className="mb-6 flex items-center gap-4">
        <Button variant="ghost" size="icon" className="rounded-full" onClick={() => router.push('/transfers')}><ChevronLeft className="w-6 h-6" /></Button>
        <div>
          <h1 className="text-2xl font-headline font-bold uppercase tracking-tighter text-white">{language === 'ru' ? 'БЫСТРЫЙ ПОИСК' : 'QUICK SEARCH'}</h1>
          <p className="text-muted-foreground text-[10px] uppercase tracking-widest font-bold opacity-60">Daily Professional Market Stream</p>
        </div>
      </header>
      <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v); setPage(0); }} className="w-full">
        <TabsList className="bg-secondary/30 border border-white/5 h-12 w-full flex mb-6 p-1.5 rounded-2xl">
          {roleList.map((role) => ( <TabsTrigger key={role.id} value={role.id} className="flex-1 text-[10px] font-black uppercase rounded-xl">{role.label}</TabsTrigger> ))}
        </TabsList>
        {roleList.map((role) => (
          <TabsContent key={role.id} value={role.id} className="space-y-3 animate-in fade-in duration-500">
            {paginatedAgents.length > 0 ? (
              <>
                {paginatedAgents.map((agent) => ( <TransferHeroCard key={agent.id} agent={agent} user={user} profile={profile} onBid={handleGlobalBid} now={now} language={language} /> ))}
                {totalPages > 1 && (
                  <div className="flex items-center justify-center gap-2 pt-6">
                    <Button variant="ghost" size="icon" disabled={page === 0} onClick={() => setPage(0)} className="h-8 w-8"><ChevronsLeft className="w-4 h-4" /></Button>
                    <Button variant="ghost" size="icon" disabled={page === 0} onClick={() => setPage(p => p - 1)} className="h-4 w-4"><ChevronLeftIcon className="h-4 w-4" /></Button>
                    <span className="text-[10px] font-black text-muted-foreground uppercase px-4">{language === 'ru' ? 'Стр' : 'Page'} {page + 1} / {totalPages}</span>
                    <Button variant="ghost" size="icon" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)} className="h-4 w-4"><ChevronRightIcon className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" disabled={page >= totalPages - 1} onClick={() => setPage(totalPages - 1)} className="h-8 w-8"><ChevronsRight className="w-4 h-4" /></Button>
                  </div>
                )}
              </>
            ) : ( <div className="py-20 text-center opacity-30 border border-dashed border-white/10 rounded-2xl flex flex-col items-center gap-4 p-10"><ShoppingCart className="w-12 h-12" /><p className="text-[10px] uppercase font-black">{language === 'ru' ? 'Нет активных лотов' : 'No active listings'}</p></div> )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
