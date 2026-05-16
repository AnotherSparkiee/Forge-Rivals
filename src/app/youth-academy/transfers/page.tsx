'use client';

import { useState, useEffect, useRef } from 'react';
import { useGameState } from '@/app/lib/store';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ChevronLeft, Loader2, Gavel, AlertCircle, RefreshCw, ShoppingCart, Users, ShieldCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { LoadingScreen } from '@/components/game/LoadingScreen';
import { useUser, useFirestore, useCollection, useMemoFirebase, updateDocumentNonBlocking, useDoc } from '@/firebase';
import { collection, query, doc, arrayUnion, serverTimestamp } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';
import { Progress } from '@/components/ui/progress';
import Link from 'next/link';

export default function YouthTransfersPage() {
  const { language, isLoaded: isStoreLoaded, credits } = useGameState();
  const { user, isUserLoading } = useUser();
  const db = useFirestore();
  const { toast } = useToast();
  const router = useRouter();
  
  const [isBidding, setIsBidding] = useState<string | null>(null);
  const [isAuthStabilized, setIsAuthStabilized] = useState(false);
  const [syncProgress, setSyncProgress] = useState(0);

  // Authentication stabilization protocol (4.5s)
  useEffect(() => {
    if (!isUserLoading && user?.uid) {
      const interval = setInterval(() => {
        setSyncProgress(prev => Math.min(prev + 2.2, 100));
      }, 100);

      const timer = setTimeout(() => {
        setIsAuthStabilized(true);
        setSyncProgress(100);
        clearInterval(interval);
      }, 4500);

      return () => {
        clearTimeout(timer);
        clearInterval(interval);
      };
    } else {
      setIsAuthStabilized(false);
      setSyncProgress(0);
    }
  }, [isUserLoading, user?.uid]);

  const authReady = isAuthStabilized && !!user?.uid;

  // Use a broad query without filters to prevent Permission Denied quirks on shared nodes
  const marketQuery = useMemoFirebase(() => {
    if (!authReady) return null;
    return query(collection(db, 'market_v2'));
  }, [db, authReady]);

  const { data: agents, isLoading: isMarketLoading, error: marketError } = useCollection(marketQuery);

  const userRef = useMemoFirebase(() => (authReady ? doc(db, 'players_v5', user!.uid) : null), [db, authReady, user?.uid]);
  const { data: profile } = useDoc(userRef);

  const handleBid = async (agent: any) => {
    if (!user || isBidding) return;
    
    const minNextBid = Math.ceil(agent.currentBid * 1.05);
    if (credits < minNextBid) {
      toast({ 
        title: language === 'ru' ? "Недостаточно средств" : "Insufficient funds", 
        variant: "destructive" 
      });
      return;
    }

    setIsBidding(agent.id);
    try {
      updateDocumentNonBlocking(doc(db, 'market_v2', agent.id), {
        currentBid: minNextBid,
        highestBidderId: user.uid,
        highestBidderName: profile?.displayName || "Anonymous Manager",
        bidders: arrayUnion(user.uid),
        updatedAt: serverTimestamp()
      });
      toast({ 
        title: language === 'ru' ? "Ставка на юниора принята!" : "Youth Bid Placed!",
        description: language === 'ru' ? "Вы лидируете в торгах." : "You are the leading bidder."
      });
    } finally {
      setIsBidding(null);
    }
  };

  if (isUserLoading || !isStoreLoaded) return <LoadingScreen />;

  const t = {
    title: language === 'ru' ? 'ТРАНСФЕРЫ ЮНИОРОВ' : 'YOUTH TRANSFERS',
    sync: language === 'ru' ? 'Синхронизация архива...' : 'Syncing Academy Archive...',
    empty: language === 'ru' ? 'На рынке юниоров пока пусто' : 'Youth market is currently empty',
    warning: language === 'ru' ? "Юниоры требуют развития. Оценивайте потенциал!" : "Juniors require training. Assess potential limits!",
    reconnect: language === 'ru' ? 'ПЕРЕПОДКЛЮЧИТЬСЯ' : 'RE-SYNC TERMINAL',
    errorDesc: language === 'ru' 
      ? 'Ошибка доступа к архиву юниоров. Требуется повторная синхронизация.' 
      : 'Access to youth archive restricted. Terminal re-synchronization required.'
  };

  if (marketError) {
    return (
      <div className="max-w-md mx-auto px-4 pt-20 text-center space-y-6">
        <AlertCircle className="w-12 h-12 text-red-500 mx-auto" />
        <h2 className="text-xl font-bold uppercase text-white">Academy Protocol Error</h2>
        <p className="text-[10px] text-muted-foreground uppercase px-10 font-black tracking-widest leading-relaxed">
          {t.errorDesc}
        </p>
        <Button onClick={() => window.location.reload()} variant="outline" className="h-12 border-white/10 uppercase text-[10px] font-black px-8">
          <RefreshCw className="w-3 h-3 mr-2" /> {t.reconnect}
        </Button>
      </div>
    );
  }

  if (!authReady) {
    return (
      <div className="max-w-md mx-auto px-4 pt-40 text-center space-y-8">
        <div className="relative w-24 h-24 mx-auto">
          <Loader2 className="w-24 h-24 animate-spin text-primary opacity-20" />
          <ShieldCheck className="w-10 h-10 text-primary absolute inset-0 m-auto animate-pulse" />
        </div>
        <div className="space-y-4">
          <h3 className="text-sm font-headline font-bold uppercase tracking-[0.3em] text-primary">{t.sync}</h3>
          <div className="w-56 mx-auto space-y-2">
            <Progress value={syncProgress} className="h-1.5 bg-primary/10" />
            <p className="text-[8px] text-muted-foreground font-black uppercase tracking-widest">Link Status: {Math.floor(syncProgress)}%</p>
          </div>
        </div>
      </div>
    );
  }

  // Filter youth agents locally to avoid complex index/permission issues in Firestore
  const youthAgents = agents?.filter(a => a.isYouth === true) || [];

  return (
    <div className="max-w-md mx-auto px-4 pt-8 pb-32">
      <header className="mb-6 flex items-center gap-4">
        <Link href="/youth-academy">
          <Button variant="ghost" size="icon" className="rounded-full">
            <ChevronLeft className="w-6 h-6" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-headline font-bold uppercase tracking-tighter text-white">{t.title}</h1>
          <p className="text-muted-foreground text-[10px] uppercase tracking-widest font-bold opacity-60">
            {isMarketLoading ? 'Syncing Academy Archive...' : 'Global Youth Market Active'}
          </p>
        </div>
      </header>

      <div className="p-3 bg-accent/5 border border-accent/20 rounded-xl mb-6 flex items-center gap-3">
        <Users className="w-4 h-4 text-accent shrink-0" />
        <p className="text-[9px] text-muted-foreground uppercase font-black leading-tight italic tracking-tight">
          {t.warning}
        </p>
      </div>

      <div className="space-y-3">
        {isMarketLoading ? (
          <div className="py-20 text-center flex flex-col items-center gap-4 opacity-50">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-[10px] font-bold uppercase tracking-[0.2em]">Synchronizing Bids...</p>
          </div>
        ) : youthAgents.length > 0 ? (
          youthAgents.map((agent) => {
            const isLeading = agent.highestBidderId === user?.uid;
            return (
              <Card key={agent.id} className={cn(
                "glass-card border-white/5 overflow-hidden group transition-all",
                isLeading ? "border-green-500/40 bg-green-500/5 ring-1 ring-green-500/20" : "hover:border-primary/30"
              )}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-14 h-14 rounded-2xl overflow-hidden bg-secondary/50 border border-white/10 shrink-0 shadow-lg">
                      <img src={agent.heroData?.image} alt="" className="w-full h-full object-cover" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-base font-bold uppercase truncate text-white tracking-tight">{agent.heroData?.name}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline" className="text-[7px] py-0 border-white/10 uppercase font-black bg-black/20">
                          {agent.heroData?.role}
                        </Badge>
                        {agent.highestBidderName && (
                          <span className={cn(
                            "text-[7px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-sm",
                            isLeading ? "bg-green-500/20 text-green-400" : "bg-primary/20 text-primary"
                          )}>
                            TOP: {agent.highestBidderName}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right flex flex-col items-end">
                      <p className="text-2xl font-headline font-bold text-accent italic leading-none">{agent.heroData?.overallRating}</p>
                      <p className="text-[8px] font-black text-muted-foreground uppercase mt-1 tracking-tighter">OVR UNIT</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between gap-4 pt-4 border-t border-white/5">
                    <div className="flex flex-col">
                      <p className="text-[8px] uppercase text-muted-foreground font-black tracking-widest">Global Current Bid</p>
                      <p className="text-lg font-headline font-bold text-primary tabular-nums">€{agent.currentBid?.toLocaleString()}</p>
                    </div>
                    <Button 
                      className={cn(
                        "h-11 font-black text-[10px] px-8 shadow-xl active:scale-95 transition-all rounded-xl",
                        isLeading ? "bg-green-600 hover:bg-green-700 text-white" : "hero-gradient shadow-primary/20"
                      )}
                      onClick={() => handleBid(agent)} 
                      disabled={!!isBidding || isLeading}
                    >
                      {isBidding === agent.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : isLeading ? (
                        <><ShieldCheck className="w-4 h-4 mr-2" /> LEADING BID</>
                      ) : (
                        <><Gavel className="w-4 h-4 mr-2" /> BID €{Math.ceil(agent.currentBid * 1.05).toLocaleString()}</>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })
        ) : (
          <div className="py-20 text-center opacity-30 border border-dashed border-white/10 rounded-2xl flex flex-col items-center gap-4 p-10">
            <ShoppingCart className="w-12 h-12" />
            <p className="text-[10px] uppercase font-black text-center leading-relaxed">
              {t.empty}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
