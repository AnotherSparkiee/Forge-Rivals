
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUser, useFirestore, useCollection, useMemoFirebase, useDoc, addDocumentNonBlocking } from '@/firebase';
import { useGameState } from '@/app/lib/store';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ChevronLeft, ShoppingCart, Loader2, Gavel, ShieldCheck, Clock, AlertCircle, Users, Percent, Timer, Star, Flag, X, Check } from 'lucide-react';
import { collection, query, doc, arrayUnion, updateDoc, serverTimestamp } from 'firebase/firestore';
import { LoadingScreen } from '@/components/game/LoadingScreen';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { calculateLiveAge } from '@/app/lib/time-utils';

export default function YouthTransfersPage() {
  const { language, isLoaded: isStoreLoaded, credits, addCredits } = useGameState();
  const { user, isUserLoading } = useUser();
  const db = useFirestore();
  const router = useRouter();
  const { toast } = useToast();

  const [isBidding, setIsBidding] = useState<string | null>(null);
  const [activeBidId, setActiveBidId] = useState<string | null>(null);
  const [bidPercentages, setBidPercentages] = useState<Record<string, number>>({});
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const marketQuery = useMemoFirebase(() => {
    if (!user?.uid) return null;
    return query(collection(db, 'market_v7'));
  }, [db, user?.uid]);

  const { data: allAgents, isLoading: isMarketLoading, error: marketError } = useCollection(marketQuery);

  const userRef = useMemoFirebase(() => (user?.uid ? doc(db, 'players_v10', user.uid) : null), [db, user?.uid]);
  const { data: profile } = useDoc(userRef);

  const youthAgents = (allAgents?.filter(a => a.heroData?.baseAge && Number(a.heroData.baseAge) < 18) || [])
    .filter(a => new Date(a.expiresAt).getTime() > now);

  const handleBid = async (agent: any) => {
    if (!user || !profile || isBidding) return;
    
    if (agent.sellerId === user.uid) {
      toast({ title: language === 'ru' ? "Нельзя ставить на себя" : "Cannot bid on yourself", variant: "destructive" });
      return;
    }
    
    const percentage = bidPercentages[agent.id] || 5;
    const bidIncrement = Math.ceil(agent.currentBid * (percentage / 100));
    const nextBid = agent.currentBid + bidIncrement;

    if (credits < nextBid) {
      toast({ title: language === 'ru' ? "Недостаточно средств" : "Insufficient funds", variant: "destructive" });
      return;
    }

    setIsBidding(agent.id);
    try {
      const previousBidderId = agent.highestBidderId;
      const heroName = agent.heroData?.name || "Player";
      const agentRef = doc(db, 'market_v7', agent.id);
      
      await updateDoc(agentRef, {
        currentBid: Number(nextBid),
        highestBidderId: String(user.uid),
        highestBidderName: profile.displayName || "Manager", 
        bidders: arrayUnion(user.uid),
        updatedAt: serverTimestamp()
      });
      
      addCredits(-nextBid);

      if (previousBidderId && previousBidderId !== user.uid) {
        const notifTitle = language === 'ru' ? "Ставка перебита!" : "Outbid!";
        const notifDesc = language === 'ru' 
          ? `Ставка на "${heroName}" перебита ${new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}`
          : `Bid on "${heroName}" was outbid ${new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}`;

        addDocumentNonBlocking(collection(db, 'notifications_v6'), {
          userId: previousBidderId,
          title: notifTitle,
          description: notifDesc,
          type: 'market',
          read: false,
          createdAt: new Date().toISOString()
        });
      }

      toast({ title: language === 'ru' ? "Ставка принята!" : "Bid Placed!" });
      setActiveBidId(null);
    } finally {
      setIsBidding(null);
    }
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

  const getCountdown = (expiryIso: string) => {
    const diff = new Date(expiryIso).getTime() - now;
    if (diff <= 0) return "00:00:00";
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const s = Math.floor((diff % 60000) / 1000);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  if (isUserLoading || !isStoreLoaded) return <LoadingScreen />;

  const t = {
    title: language === 'ru' ? 'ТРАНСФЕРЫ ЮНИОРОВ' : 'YOUTH TRANSFERS',
    subtitle: language === 'ru' ? 'Рынок молодых талантов' : 'Youth talent market',
    activeCount: language === 'ru' ? 'Активных лотов' : 'Active Lots'
  };

  if (marketError) {
    return (
      <div className="max-w-md mx-auto px-4 pt-20 text-center space-y-6">
        <AlertCircle className="w-12 h-12 text-red-500 mx-auto" />
        <h2 className="text-xl font-bold uppercase text-white">Market Archive Error</h2>
        <Button onClick={() => window.location.reload()} variant="outline" className="h-12 border-white/10 uppercase text-[10px] font-black px-8">RE-SYNC TERMINAL</Button>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto px-4 pt-8 pb-32">
      <header className="mb-6 flex items-center gap-4">
        <Button variant="ghost" size="icon" className="rounded-full" onClick={() => router.push('/youth-academy')}><ChevronLeft className="w-6 h-6" /></Button>
        <div>
          <h1 className="text-2xl font-headline font-bold uppercase tracking-tighter text-primary flex items-center gap-2">
            <ShoppingCart className="w-6 h-6 text-primary" />
            {t.title}
          </h1>
          <p className="text-muted-foreground text-[10px] uppercase tracking-widest font-bold opacity-60">
            {isMarketLoading ? 'SYNCING...' : `${t.activeCount}: ${youthAgents.length}`}
          </p>
        </div>
      </header>

      <div className="space-y-3">
        {isMarketLoading ? (
          <div className="py-20 text-center flex flex-col items-center gap-4 opacity-50"><Loader2 className="w-8 h-8 animate-spin text-primary" /><p className="text-[10px] uppercase font-bold tracking-[0.2em]">Establishing Link...</p></div>
        ) : youthAgents.length > 0 ? (
          youthAgents.map((agent) => {
            const isLeading = agent.highestBidderId === user?.uid;
            const isOwner = agent.sellerId === user?.uid;
            const isConfiguring = activeBidId === agent.id;
            const currentSelectedPercent = bidPercentages[agent.id] || 5;
            const nextBidValue = Math.ceil(agent.currentBid * (1 + currentSelectedPercent / 100));
            const liveAge = calculateLiveAge(agent.heroData.baseAge, agent.heroData.hiredAt);
            const avgTalent = Object.values(agent.heroData.proTalents || {}).reduce((a: any, b: any) => a + b, 0) as number / 10;

            return (
              <Card key={agent.id} className={cn(
                "glass-card border-white/5 overflow-hidden group transition-all",
                isLeading ? "border-green-500/40 bg-green-500/5 ring-1 ring-green-500/20" : "hover:border-primary/30",
                isOwner && "border-blue-500/30 bg-blue-500/5"
              )}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3">
                     <div className="flex items-center gap-1.5 text-accent">
                       <Timer className="w-3.5 h-3.5 animate-pulse" />
                       <span className="text-[10px] font-mono font-bold tracking-tighter">{getCountdown(agent.expiresAt)}</span>
                     </div>
                     <div className="flex gap-2">
                       {isOwner && <Badge className="bg-blue-600 text-white text-[7px] font-black uppercase px-2 h-4 border-none">{language === 'ru' ? 'Ваш лот' : 'Your Lot'}</Badge>}
                       {isLeading && <Badge className="bg-green-600 text-white text-[7px] font-black uppercase px-2 h-4 border-none">{language === 'ru' ? 'Вы лидируете' : 'Leading'}</Badge>}
                     </div>
                  </div>
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-16 h-16 rounded-2xl overflow-hidden bg-secondary/50 border border-white/10 shrink-0 shadow-lg">
                      <img src={agent.heroData?.image} alt="" className="w-full h-full object-cover" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-base font-bold uppercase truncate text-white tracking-tight">{agent.heroData?.name}</h3>
                      <div className="flex flex-wrap items-center gap-2 mt-1">
                        <Badge variant="outline" className="text-[7px] py-0 border-white/10 uppercase font-black">{agent.heroData?.role}</Badge>
                        <div className="flex items-center gap-1 text-[8px] font-black text-muted-foreground uppercase">
                           <Flag className="w-2.5 h-2.5" /> {agent.heroData.country?.name}
                        </div>
                      </div>
                      <div className="flex items-center gap-3 mt-2">
                         <div className="flex flex-col">
                           <p className="text-[7px] font-black text-muted-foreground uppercase leading-none mb-1">Talent</p>
                           {renderStars(avgTalent)}
                         </div>
                         <div className="flex flex-col border-l border-white/10 pl-3">
                           <p className="text-[7px] font-black text-muted-foreground uppercase leading-none mb-1">Age</p>
                           <p className="text-[10px] font-bold text-white leading-none">{liveAge.display} yrs</p>
                         </div>
                      </div>
                    </div>
                    <div className="text-right flex flex-col items-end shrink-0">
                      <p className="text-2xl font-headline font-bold text-accent italic leading-none">{agent.heroData?.overallRating}</p>
                      <p className="text-[8px] font-black text-muted-foreground uppercase mt-1">OVR</p>
                    </div>
                  </div>

                  {isConfiguring && !isOwner && !isLeading && (
                    <div className="bg-secondary/20 p-4 rounded-xl border border-white/10 space-y-4 mb-4 animate-in slide-in-from-top-2 duration-300">
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] font-black uppercase text-muted-foreground flex items-center gap-1.5">
                          <Percent className="w-3 h-3 text-primary" /> {language === 'ru' ? 'Шаг ставки' : 'Bid Increment'}
                        </span>
                        <span className="text-[10px] font-mono font-bold text-primary">{currentSelectedPercent}%</span>
                      </div>
                      <Slider
                        value={[currentSelectedPercent]}
                        onValueChange={(val) => setBidPercentages(prev => ({ ...prev, [agent.id]: val[0] }))}
                        min={3}
                        max={300}
                        step={1}
                        className="py-2"
                      />
                      <div className="flex justify-between items-center text-[9px] font-bold text-muted-foreground opacity-50 px-0.5">
                        <span>3%</span>
                        <span>300%</span>
                      </div>
                    </div>
                  )}
                  
                  <div className="flex items-center justify-between gap-4 pt-4 border-t border-white/5">
                    <div className="flex flex-col">
                      <p className="text-[8px] uppercase text-muted-foreground font-black tracking-widest">Current Bid</p>
                      <p className="text-lg font-headline font-bold text-white tabular-nums">€{agent.currentBid?.toLocaleString()}</p>
                    </div>
                    
                    <div className="flex gap-2">
                      {isConfiguring ? (
                        <>
                          <Button variant="outline" size="icon" className="h-12 w-12 rounded-xl border-white/10" onClick={() => setActiveBidId(null)}>
                            <X className="w-5 h-5 text-muted-foreground" />
                          </Button>
                          <Button 
                            className="h-12 font-black text-[10px] px-5 rounded-xl uppercase tracking-widest flex flex-col items-center justify-center leading-none hero-gradient shadow-lg shadow-primary/20"
                            onClick={() => handleBid(agent)}
                            disabled={!!isBidding}
                          >
                            {isBidding === agent.id ? <Loader2 className="w-4 h-4 animate-spin" /> : (
                              <>
                                <span className="mb-1">{language === 'ru' ? 'ПОДТВЕРДИТЬ' : 'CONFIRM'}</span>
                                <span className="text-[8px] opacity-80">€{nextBidValue.toLocaleString()}</span>
                              </>
                            )}
                          </Button>
                        </>
                      ) : (
                        <Button 
                          className={cn(
                            "h-12 font-black text-[10px] px-6 rounded-xl uppercase tracking-widest flex items-center justify-center leading-none", 
                            isLeading ? "bg-green-600/20 text-green-400 border border-green-500/30" : 
                            (isOwner ? "bg-secondary/50 text-muted-foreground border border-white/5" : "hero-gradient shadow-lg shadow-primary/20")
                          )} 
                          onClick={() => !isLeading && !isOwner && setActiveBidId(agent.id)} 
                          disabled={isLeading || isOwner}
                        >
                          {isOwner ? (language === 'ru' ? 'ВАШ ЮНИОР' : 'YOUR UNIT') : (
                            isLeading ? <><ShieldCheck className="w-4 h-4 mr-2" /> LEADING</> : (
                              <>{language === 'ru' ? 'ПОСТАВИТЬ' : 'PLACE BID'}</>
                            )
                          )}
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        ) : (
          <div className="py-20 text-center opacity-30 border border-dashed border-white/10 rounded-2xl flex flex-col items-center gap-4 p-10">
            <ShoppingCart className="w-12 h-12" />
            <p className="text-[10px] uppercase font-black tracking-widest text-center">Market is empty in this sector</p>
          </div>
        )}
      </div>
    </div>
  );
}
