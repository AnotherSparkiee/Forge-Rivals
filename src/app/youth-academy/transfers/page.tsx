'use client';

import { useState, useEffect, useRef, memo, useMemo, useCallback } from 'react';
import { useGameState } from '@/app/lib/store';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { 
  ChevronLeft, Loader2, Gavel, ShieldCheck, 
  Timer, Star, ShoppingCart, X, Check, Search, Info, Users,
  ChevronLeft as ChevronLeftIcon, ChevronRight as ChevronRightIcon,
  ChevronsLeft, ChevronsRight
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { LoadingScreen } from '@/components/game/LoadingScreen';
import { Slider } from '@/components/ui/slider';
import { useUser, useFirestore, useCollection, useMemoFirebase, useDoc } from '@/firebase';
import { collection, query, doc, arrayUnion, serverTimestamp, updateDoc } from 'firebase/firestore';
import { addDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';
import { calculateLiveAge, getMoscowTime } from '@/app/lib/time-utils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

const ITEMS_PER_PAGE = 10;

const YouthTransferCard = memo(({ 
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
  const [bidPercent, setBidPercent] = useState(5);
  const [isProcessing, setIsProcessing] = useState(false);

  const isLeading = agent.highestBidderId === user?.uid;
  const isOwner = agent.sellerId === user?.uid;
  const nextBidValue = Math.ceil(agent.currentBid * (1 + bidPercent / 100));
  const liveAge = calculateLiveAge(agent.heroData.baseAge, agent.heroData.hiredAt);
  const avgTalent = Object.values(agent.heroData.proTalents || {}).reduce((a: any, b: any) => a + Number(b), 0) as number / 10;

  const rolesRu: Record<string, string> = {
    'Carry': 'Керри',
    'Midlaner': 'Мидер',
    'Tank': 'Танк',
    'Jungler': 'Лес',
    'Support': 'Саппорт'
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
    <>
      <Card className={cn(
        "glass-card border-white/5 overflow-hidden transition-all", 
        isLeading && "border-green-500/40 bg-green-500/5",
        isOwner && "border-blue-500/40 bg-blue-500/5"
      )}>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
             <div className="flex items-center gap-1.5 text-accent">
               <Timer className="w-3.5 h-3.5 animate-pulse" />
               <span className="text-[10px] font-mono font-bold tracking-tighter">{getCountdown(agent.expiresAt)}</span>
             </div>
             <div className="flex gap-1.5">
               {isOwner && <Badge className="bg-blue-600 text-white text-[7px] font-black uppercase px-2 h-4 border-none">{language === 'ru' ? 'ВАШ ЮНИОР' : 'YOUR LOT'}</Badge>}
               {isLeading && <Badge className="bg-green-600 text-white text-[7px] font-black uppercase px-2 h-4 border-none">{language === 'ru' ? 'ВЫ ЛИДИРУЕТЕ' : 'LEADING'}</Badge>}
             </div>
          </div>

          <div className="flex items-center gap-4 mb-4">
            <div className="relative shrink-0">
              <div className="w-16 h-16 rounded-xl overflow-hidden bg-secondary/30 border border-white/10 relative">
                <img src={agent.heroData?.image} alt="" className="w-full h-full object-cover" />
              </div>
              <div className="absolute -bottom-1 -right-1 bg-background rounded-md p-1 border border-white/10 shadow-xl z-10 flex items-center justify-center">
                <span className="text-base leading-none">{agent.heroData.country?.flag}</span>
              </div>
            </div>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="text-base font-bold uppercase truncate text-white tracking-tight leading-tight">{agent.heroData?.name}</h3>
                <Badge variant="outline" className="text-[8px] h-4 py-0 border-white/10 uppercase font-black text-accent/80">
                  {rolesRu[agent.heroData.role] || agent.heroData.role}
                </Badge>
              </div>
              
              <div className="grid grid-cols-2 gap-3 mt-2">
                 <div className="flex flex-col">
                   <p className="text-[8px] font-black text-muted-foreground uppercase leading-none mb-1">{language === 'ru' ? 'ТАЛАНТ' : 'ТАЛАНТ'}</p>
                   {renderStars(avgTalent)}
                 </div>
                 <div className="flex flex-col border-l border-white/5 pl-3">
                   <p className="text-[8px] font-black text-muted-foreground uppercase leading-none mb-1">{language === 'ru' ? 'ВОЗРАСТ' : 'ВОЗРАСТ'}</p>
                   <p className="text-[11px] font-bold text-white leading-none mt-0.5">{liveAge.display}</p>
                 </div>
              </div>
            </div>
            
            <div className="text-right flex flex-col items-end shrink-0 justify-center">
              <p className="text-3xl font-headline font-bold text-accent italic leading-none">{agent.heroData?.overallRating}</p>
              <p className="text-[8px] font-black text-muted-foreground uppercase mt-1">OVR</p>
            </div>
          </div>
          
          <div className="flex items-center justify-between gap-4 pt-4 border-t border-white/5">
            <div className="flex flex-col">
              <p className="text-[8px] uppercase text-muted-foreground font-black tracking-widest leading-none mb-1">{language === 'ru' ? 'ЦЕНА' : 'ЦЕНА'}</p>
              <p className="text-xl font-headline font-bold text-white tracking-tight leading-none">€{agent.currentBid?.toLocaleString()}</p>
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
                "h-11 font-black text-[10px] px-6 rounded-xl uppercase tracking-widest transition-all", 
                isLeading ? "bg-green-600/20 text-green-400 border border-green-500/30" : 
                (isOwner ? "bg-secondary/50 text-muted-foreground border border-white/5" : "hero-gradient shadow-xl shadow-primary/20")
              )} 
              onClick={() => !isLeading && !isOwner && setShowBidModal(true)} 
              disabled={isLeading || isOwner}
            >
              {isOwner ? (language === 'ru' ? 'ВАШ ЮНИОР' : 'YOUR UNIT') : (
                isLeading ? <><ShieldCheck className="w-4 h-4 mr-2" /> {language === 'ru' ? 'ЛИДИРУЕТЕ' : 'LEADING'}</> : (
                  <>{language === 'ru' ? 'ПОСТАВИТЬ' : 'PLACE BID'}</>
                )
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

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
                <span className="text-xl font-headline font-black text-primary italic">€ {nextBidValue.toLocaleString()}</span>
              </div>
              
              <div className="relative pt-4 pb-2">
                <Slider
                  value={[bidPercent]}
                  onValueChange={(val) => setBidPercent(val[0])}
                  min={3}
                  max={300}
                  step={1}
                />
                <div className="flex justify-between mt-3 text-[8px] font-black text-muted-foreground/40 uppercase tracking-widest">
                  <span>MIN € {(agent.currentBid * 1.03).toLocaleString()}</span>
                  <span>MAX € {(agent.currentBid * 4).toLocaleString()}</span>
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

YouthTransferCard.displayName = 'YouthTransferCard';

export default function YouthTransfersPage() {
  const { language, isLoaded: isStoreLoaded, credits, addCredits } = useGameState();
  const { user, isUserLoading } = useUser();
  const db = useFirestore();
  const router = useRouter();
  const { toast } = useToast();

  const [now, setNow] = useState(Date.now());
  const [page, setPage] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setNow(getMoscowTime().getTime()), 1000);
    return () => clearInterval(timer);
  }, []);

  const marketQuery = useMemoFirebase(() => {
    if (!user?.uid) return null;
    return query(collection(db, 'market_v7'));
  }, [db, user?.uid]);

  const { data: allAgents, isLoading: isMarketLoading } = useCollection(marketQuery);
  const userDocRef = useMemoFirebase(() => user?.uid ? doc(db, 'players_v10', user.uid) : null, [db, user?.uid]);
  const { data: profile } = useDoc(userDocRef);

  const youthAgents = useMemo(() => {
    return (allAgents?.filter(a => (a.heroData?.baseAge && Number(a.heroData.baseAge) < 18) || a.isYouth === true) || [])
      .filter(a => new Date(a.expiresAt).getTime() > now)
      .sort((a, b) => new Date(a.expiresAt).getTime() - new Date(b.expiresAt).getTime());
  }, [allAgents, now]);

  const paginatedAgents = useMemo(() => {
    const start = page * ITEMS_PER_PAGE;
    return youthAgents.slice(start, start + ITEMS_PER_PAGE);
  }, [youthAgents, page]);

  const totalPages = Math.ceil(youthAgents.length / ITEMS_PER_PAGE);

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
        addDocumentNonBlocking(collection(db, 'notifications_v6'), {
          userId: prevBidder, title: language === 'ru' ? "Ставка перебита!" : "Outbid!",
          description: language === 'ru' ? `Ставка на "${heroName}" перебита ${new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}` : `Bid on "${heroName}" outbid ${new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}`,
          type: 'market', read: false, createdAt: new Date().toISOString()
        });
      }
      
      toast({ 
        title: language === 'ru' ? "Ставка принята!" : "Bid Placed!",
        description: timeLeft < 600000 ? (language === 'ru' ? "Аукцион продлен на 10 минут!" : "Auction extended by 10 minutes!") : undefined
      });
    } catch (e) {
      toast({ title: "Error placing bid", variant: "destructive" });
    }
  }, [user, profile, credits, language, toast, db, addCredits]);

  if (isUserLoading || !isStoreLoaded || isMarketLoading) return <LoadingScreen />;

  return (
    <div className="max-w-md mx-auto px-4 pt-8 pb-32">
      <header className="mb-6 flex items-center gap-4">
        <Button variant="ghost" size="icon" className="rounded-full" onClick={() => router.push('/youth-academy')}><ChevronLeft className="w-6 h-6" /></Button>
        <div>
          <h1 className="text-2xl font-headline font-bold uppercase tracking-tighter text-primary flex items-center gap-2">
            <ShoppingCart className="w-6 h-6 text-primary" />
            {language === 'ru' ? 'ТРАНСФЕРЫ ЮНИОРОВ' : 'YOUTH TRANSFERS'}
          </h1>
          <p className="text-muted-foreground text-[10px] uppercase tracking-widest font-bold opacity-60">
            Academy Market Stream
          </p>
        </div>
      </header>

      <div className="space-y-3 animate-in fade-in duration-500">
        {paginatedAgents.length > 0 ? (
          <>
            {paginatedAgents.map((agent) => (
              <YouthTransferCard 
                key={agent.id} 
                agent={agent} 
                user={user} 
                profile={profile} 
                onBid={handleGlobalBid}
                now={now}
                language={language}
              />
            ))}

            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 pt-6">
                <Button variant="ghost" size="icon" disabled={page === 0} onClick={() => setPage(0)} className="h-8 w-8"><ChevronsLeft className="w-4 h-4" /></Button>
                <Button variant="ghost" size="icon" disabled={page === 0} onClick={() => setPage(p => p - 1)} className="h-8 w-8"><ChevronLeftIcon className="h-4 w-4" /></Button>
                <span className="text-[10px] font-black text-muted-foreground uppercase px-4">
                  {language === 'ru' ? 'Стр' : 'Page'} {page + 1} / {totalPages}
                </span>
                <Button variant="ghost" size="icon" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)} className="h-8 w-8"><ChevronRightIcon className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" disabled={page >= totalPages - 1} onClick={() => setPage(totalPages - 1)} className="h-8 w-8"><ChevronsRight className="w-4 h-4" /></Button>
              </div>
            )}
          </>
        ) : (
          <div className="py-20 text-center opacity-30 border border-dashed border-white/10 rounded-2xl flex flex-col items-center gap-4 p-10">
            <ShoppingCart className="w-12 h-12" />
            <p className="text-[10px] uppercase font-black">{language === 'ru' ? 'Нет молодежных лотов' : 'No youth listings'}</p>
          </div>
        )}
      </div>
    </div>
  );
}
