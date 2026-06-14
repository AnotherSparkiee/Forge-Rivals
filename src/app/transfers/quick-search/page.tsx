
'use client';

import { useState, useEffect, useRef, memo, useMemo, useCallback } from 'react';
import { useGameState } from '@/app/lib/store';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { 
  ChevronLeft, Loader2, Gavel, ShieldCheck, 
  Timer, Star, ShoppingCart, X, Check, Search, Info, Users,
  ChevronLeft as ChevronLeftIcon, ChevronRight as ChevronRightIcon,
  ChevronsLeft, ChevronsRight, Zap, Gem, Award, Target, Eye, Map, 
  Sparkles, Sword, Crosshair, Brain, TrendingUp, Activity
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

/**
 * Нормализатор талантов. Строго приводит к шкале 1-100.
 */
const normTalent = (val: any) => {
  const n = Number(val);
  if (isNaN(n)) return 0;
  return n < 10 ? Math.round(n * 10) : Math.round(n);
};

/**
 * Рендерит индикатор таланта.
 * До 50 - стандартные звезды.
 * 51+ - элитная графика (МАКСИМАЛЬНЫЙ РАЗМЕР h-12 = 48px).
 */
export const renderStars = (talent: number) => {
  const numericTalent = normTalent(talent);

  // Элитная графика для талантов выше 50 (h-12 = 48px)
  if (numericTalent > 50) {
    let src = "https://iili.io/CCZlOeR.png"; // 5 stars elite (51-59)
    if (numericTalent >= 60 && numericTalent <= 69) {
      src = "https://iili.io/CnTWT0X.md.png"; // 6 stars (60-69)
    }
    if (numericTalent >= 70) {
      src = "https://iili.io/CCZXucP.png"; // 7 звезд (70+)
    }
    return <img src={src} alt={`${numericTalent} stars`} className="h-12 w-auto object-contain" />;
  }

  // Обычные звезды для таланта <= 50 (w-5 h-5)
  const starRating = Math.max(0, numericTalent / 10);
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => {
        const fill = Math.min(Math.max(starRating - i, 0), 1);
        return (
          <div key={i} className="relative w-5 h-5">
            <Star className="absolute inset-0 w-5 h-5 text-muted-foreground/20" />
            <div className="absolute inset-0 overflow-hidden" style={{ width: `${fill * 100}%` }}>
              <Star className="w-5 h-5 text-yellow-500 fill-yellow-500" />
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
  const { isPremium, managerSkills } = useGameState();

  const isLeading = agent.highestBidderId === user?.uid;
  const isOwner = agent.sellerId === user?.uid;
  const isDiamond = agent.currency === 'crystals';
  const nextBidValue = Math.ceil(agent.currentBid * (1 + bidPercent / 100));
  const liveAge = calculateLiveAge(agent.heroData.baseAge, agent.heroData.hiredAt);
  
  const talentsValues = Object.values(agent.heroData.proTalents || {}).map(v => normTalent(v));
  const maxTalentValue = Math.max(...talentsValues);

  const rolesRu: Record<string, string> = {
    'Carry': 'Керри', 'Midlaner': 'Мидер', 'Tank': 'Танк', 'Jungler': 'Лес', 'Support': 'Саппорт'
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

  const icons: Record<string, any> = {
    lastHitting: Target, mapAwareness: Eye, positioning: Map, reflexes: Zap,
    manaManagement: Sparkles, objectiveControl: Sword, communication: Users,
    tiltResistance: Brain, versatility: TrendingUp, ganking: Crosshair,
  };

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
               {agent.isPro && <Badge className="bg-yellow-500 text-black text-[7px] font-black uppercase px-2 h-4 border-none">PRO UNIT</Badge>}
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
                <h3 className="text-base font-bold uppercase truncate text-white tracking-tight leading-tight">{agent.heroData?.name}</h3>
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
            </div>
            <Button 
              className={cn(
                "h-11 font-black text-[10px] px-6 rounded-xl uppercase tracking-[0.1em] transition-all shrink-0", 
                isLeading ? "bg-green-600/20 text-green-400 border border-green-500/30" : 
                (isOwner ? "bg-secondary/50 text-muted-foreground border border-white/5" : "hero-gradient shadow-xl active:scale-95")
              )} 
              onClick={(e) => { e.stopPropagation(); if (!isLeading && !isOwner) setShowBidModal(true); }} 
              disabled={isLeading || isOwner}
            >
              {isOwner ? (language === 'ru' ? 'ВАШ ГЕРОЙ' : 'YOUR UNIT') : (isLeading ? (language === 'ru' ? 'ЛИДИРУЕТЕ' : 'LEADING') : (language === 'ru' ? 'ПОСТАВИТЬ' : 'PLACE BID'))}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Dialog open={showDossier} onOpenChange={setShowDossier}>
        <DialogContent className="max-w-md bg-background border-white/10 p-0 overflow-hidden shadow-2xl h-[90vh] flex flex-col">
          <div className="p-6 text-center bg-gradient-to-br from-primary/20 via-background to-accent/10 border-b border-white/5 relative shrink-0">
            <Button variant="ghost" size="icon" className="absolute left-4 top-4 rounded-full" onClick={() => setShowDossier(false)}><X className="w-5 h-5" /></Button>
            <div className="relative mx-auto w-24 h-24 mb-4">
              <div className={cn("w-full h-full rounded-2xl overflow-hidden border-2 shadow-2xl bg-secondary/50", agent.isPro ? "border-yellow-500" : "border-primary/50")}>
                <img src={agent.heroData?.image} alt="" className="w-full h-full object-cover" />
              </div>
              <div className="absolute -bottom-2 -right-2 w-10 h-10 rounded-xl bg-background border border-white/10 flex items-center justify-center shadow-xl">
                <span className="text-xl">{agent.heroData.country?.flag}</span>
              </div>
            </div>
            <DialogTitle className="text-2xl font-headline font-bold uppercase tracking-tight text-white leading-none">{agent.heroData?.name}</DialogTitle>
            <div className="flex items-center justify-center gap-2 mt-2">
              <Badge className="bg-primary text-primary-foreground text-[10px] font-black uppercase px-2 h-5">{rolesRu[agent.heroData.role] || agent.heroData.role}</Badge>
              {agent.isPro && <Badge className="bg-yellow-500 text-black text-[10px] font-black uppercase px-2 h-5">PRO LEGEND</Badge>}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-8 scrollbar-hide">
            <section>
              <h3 className="text-[9px] font-black text-primary uppercase tracking-[0.2em] mb-4 flex items-center gap-2 opacity-80 px-1">
                <Activity className="w-3.5 h-3.5" /> {language === 'ru' ? 'ТЕКУЩИЕ НАВЫКИ' : 'CURRENT SKILLS'}
              </h3>
              <div className="space-y-3">
                {Object.entries(agent.heroData.proStats).map(([key, value]: [string, any]) => { 
                  const Icon = icons[key] || Info;
                  const displayValue = Math.round(Number(value));
                  const talentLimit = normTalent((agent.heroData.proTalents as any)[key] || 10);
                  
                  return (
                    <div key={key} className="space-y-2 p-3 rounded-xl border border-white/5 bg-secondary/10">
                      <div className="flex justify-between items-center px-0.5">
                        <div className="flex items-center gap-2">
                          <Icon className="w-3.5 h-3.5 text-muted-foreground/60" />
                          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{proStatsLabels[key]}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                           <span className="text-[10px] font-mono font-bold text-white">{displayValue}</span>
                           <span className="text-[8px] text-muted-foreground/50">/</span>
                           <span className="text-[9px] font-mono font-bold text-primary/70">{talentLimit}</span>
                        </div>
                      </div>
                      <Progress value={(displayValue / talentLimit) * 100} max={100} className="h-1 rounded-full bg-secondary/40" />
                    </div>
                  ); 
                })}
              </div>
            </section>

            <section>
              <h3 className="text-[9px] font-black text-accent uppercase tracking-[0.2em] mb-4 flex items-center gap-2 opacity-80 px-1">
                <Zap className="w-3.5 h-3.5" /> {language === 'ru' ? 'ПРЕДЕЛЫ ТАЛАНТА' : 'TALENT LIMITS'}
              </h3>
              <div className="space-y-2">
                {Object.entries(agent.heroData.proTalents || {}).map(([key, value]: [string, any]) => {
                  const talentVal = normTalent(value);
                  const Icon = icons[key] || Info;
                  return (
                    <div key={`talent-${key}`} className="flex items-center justify-between p-3 rounded-xl border border-white/5 bg-background/40">
                      <div className="flex items-center gap-2">
                        <Icon className="w-3 h-3 text-accent/50" />
                        <span className="text-[9px] font-bold uppercase text-muted-foreground/80">{proStatsLabels[key]}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-[10px] font-mono font-bold text-accent">{talentVal}</span>
                        {renderStars(talentVal)}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          </div>

          <div className="p-4 bg-secondary/20 border-t border-white/5 shrink-0">
             <Button className="w-full h-12 hero-gradient font-black text-xs uppercase" onClick={() => { setShowDossier(false); if (!isLeading && !isOwner) setShowBidModal(true); }} disabled={isLeading || isOwner}>
               {isLeading ? (language === 'ru' ? 'ВЫ ЛИДИРУЕТЕ' : 'LEADING') : (isOwner ? (language === 'ru' ? 'ВАШ ГЕРОЙ' : 'YOUR UNIT') : (language === 'ru' ? 'ПЕРЕЙТИ К СТАВКЕ' : 'BID TERMINAL'))}
             </Button>
          </div>
        </DialogContent>
      </Dialog>
      
      <Dialog open={showBidModal} onOpenChange={setShowBidModal}>
        <DialogContent className="max-sm bg-card border-white/10 p-0 overflow-hidden shadow-2xl">
          <div className="p-6 text-center bg-gradient-to-br from-primary/20 via-background to-accent/10 border-b border-white/5">
            <DialogTitle className="text-2xl font-headline font-bold uppercase tracking-tight text-white">{agent.heroData?.name}</DialogTitle>
            <DialogDescription className="text-[10px] text-muted-foreground mt-2 uppercase tracking-[0.2em] font-black">{language === 'ru' ? 'ТЕРМИНАЛ СТАВОК' : 'BIDDING TERMINAL'}</DialogDescription>
          </div>
          <div className="p-6 space-y-8">
            <div className="space-y-4">
              <div className="flex justify-between items-center px-1">
                <span className="text-[10px] font-black uppercase text-muted-foreground flex items-center gap-2"><Gavel className="w-4 h-4 text-primary" /> {language === 'ru' ? 'СУММА СДЕЛКИ' : 'NEW BID'}</span>
                <span className="text-xl font-headline font-black text-primary italic">{isDiamond ? <Gem className="inline w-5 h-5 mr-1" /> : '€ '} {nextBidValue.toLocaleString()}</span>
              </div>
              <Slider value={[bidPercent]} onValueChange={(val) => setBidPercent(val[0])} min={3} max={300} step={1} />
            </div>
            <div className="bg-primary/5 rounded-xl border border-primary/20 p-4 flex gap-4"><Info className="w-5 h-5 text-primary shrink-0" /><p className="text-[10px] text-muted-foreground italic">{language === 'ru' ? "Сумма будет списана немедленно. При перебитии ставки - возвращена." : "Funds deducted immediately. Returned if outbid."}</p></div>
          </div>
          <DialogFooter className="p-4 bg-secondary/20 border-t border-white/5 gap-2">
            <Button variant="outline" className="flex-1 h-12 uppercase font-black text-[10px] border-white/10" onClick={() => setShowBidModal(false)}>{language === 'ru' ? 'ОТМЕНА' : 'CANCEL'}</Button>
            <Button className="flex-[2] h-12 hero-gradient font-black text-[11px] uppercase shadow-xl" onClick={async () => { setIsProcessing(true); await onBid(agent, nextBidValue); setIsProcessing(false); setShowBidModal(false); }} disabled={isProcessing}>{isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : (language === 'ru' ? 'ПОДТВЕРДИТЬ' : 'CONFIRM')}</Button>
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
  
  const [now, setNow] = useState(Date.now());
  const [page, setPage] = useState(0);
  const ITEMS_PER_PAGE = 10;

  useEffect(() => {
    const timer = setInterval(() => setNow(getMoscowTime().getTime()), 1000);
    return () => clearInterval(timer);
  }, []);

  const marketQuery = useMemoFirebase(() => {
    if (!user?.uid) return null;
    return query(collection(db, 'market_v7'));
  }, [db, user?.uid]);

  const { data: agents, isLoading: isMarketLoading } = useCollection(marketQuery);
  const userDocRef = useMemoFirebase(() => user?.uid ? doc(db, 'players_v10', user.uid) : null, [db, user?.uid]);
  const { data: profile } = useDoc(userDocRef);

  const filteredAgents = useMemo(() => {
    if (!agents) return [];
    return agents.filter(a => {
      const expiry = new Date(a.expiresAt).getTime();
      if (expiry <= now) return false;
      const liveAge = calculateLiveAge(a.heroData.baseAge, a.heroData.hiredAt);
      if (a.isYouth || a.isPro || liveAge.numeric < 18.0) return false;
      return true;
    }).sort((a, b) => new Date(a.expiresAt).getTime() - new Date(b.expiresAt).getTime());
  }, [agents, now]);

  const paginatedAgents = useMemo(() => filteredAgents.slice(page * ITEMS_PER_PAGE, (page + 1) * ITEMS_PER_PAGE), [filteredAgents, page]);
  const totalPages = Math.ceil(filteredAgents.length / ITEMS_PER_PAGE);

  const handleGlobalBid = useCallback(async (agent: any, amount: number) => {
    if (!user || !profile) return;
    if (credits < amount) { toast({ title: language === 'ru' ? "Недостаточно средств" : "Insufficient funds", variant: "destructive" }); return; }
    try {
      const prevBidder = agent.highestBidderId;
      const heroName = agent.heroData?.name || "Player";
      const mskNow = getMoscowTime().getTime();
      const expiryTime = new Date(agent.expiresAt).getTime();
      let finalExpiresAt = agent.expiresAt;
      if (expiryTime - mskNow < 600000) finalExpiresAt = new Date(mskNow + 600000).toISOString();

      await updateDoc(doc(db, 'market_v7', agent.id), { 
        currentBid: amount, highestBidderId: user.uid, highestBidderName: profile.displayName || "Unknown Manager", 
        bidders: arrayUnion(user.uid), updatedAt: serverTimestamp(), expiresAt: finalExpiresAt
      });

      addCredits(-amount);
      if (prevBidder && prevBidder !== user.uid) {
        addDocumentNonBlocking(collection(db, 'notifications_v7'), {
          userId: prevBidder, title: "Ставка перебита!", description: `Ваша ставка на "${heroName}" перебита.`, type: 'market', read: false, createdAt: new Date().toISOString()
        });
      }
      toast({ title: language === 'ru' ? "Ставка принята!" : "Bid Confirmed!" });
    } catch (e) { toast({ title: "Error", variant: "destructive" }); }
  }, [user, profile, credits, language, toast, db, addCredits]);

  if (isUserLoading || !isStoreLoaded || isMarketLoading) return <LoadingScreen />;

  return (
    <div className="max-w-md mx-auto px-4 pt-8 pb-32">
      <header className="mb-6 flex items-center gap-4">
        <Link href="/transfers"><Button variant="ghost" size="icon" className="rounded-full border border-white/5"><ChevronLeft className="w-6 h-6" /></Button></Link>
        <div><h1 className="text-2xl font-headline font-bold uppercase text-white">{language === 'ru' ? 'БЫСТРЫЙ ПОИСК' : 'QUICK SEARCH'}</h1><p className="text-muted-foreground text-[10px] uppercase font-bold opacity-60">Real-time Auction Stream</p></div>
      </header>
      <div className="space-y-3">
        {paginatedAgents.length > 0 ? (
          <>
            {paginatedAgents.map((agent) => (<TransferHeroCard key={agent.id} agent={agent} user={user} profile={profile} onBid={handleGlobalBid} now={now} language={language} />))}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 pt-6">
                <Button variant="ghost" size="icon" disabled={page === 0} onClick={() => setPage(0)} className="h-8 w-8"><ChevronsLeft className="w-4 h-4" /></Button>
                <Button variant="ghost" size="icon" disabled={page === 0} onClick={() => setPage(p => p - 1)} className="h-8 w-8"><ChevronLeftIcon className="h-4 w-4" /></Button>
                <span className="text-[10px] font-black text-muted-foreground uppercase px-4">{language === 'ru' ? 'Стр' : 'Page'} {page + 1} / {totalPages}</span>
                <Button variant="ghost" size="icon" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)} className="h-8 w-8"><ChevronRightIcon className="h-4 w-4" /></Button>
              </div>
            )}
          </>
        ) : (
          <div className="py-20 text-center opacity-30 border border-dashed border-white/10 rounded-2xl flex flex-col items-center gap-4 p-10"><ShoppingCart className="w-12 h-12" /><p className="text-[10px] uppercase font-black">{language === 'ru' ? 'Аукционы не найдены' : 'No active auctions'}</p></div>
        )}
      </div>
    </div>
  );
}

