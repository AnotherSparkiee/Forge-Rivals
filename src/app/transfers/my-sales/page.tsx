
'use client';

import { useState, useEffect } from 'react';
import { useGameState } from '@/app/lib/store';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ChevronLeft, Loader2, AlertCircle, RefreshCw, Coins, Timer, Users } from 'lucide-react';
import Link from 'next/link';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import { LoadingScreen } from '@/components/game/LoadingScreen';
import { cn } from '@/lib/utils';

export default function MySalesPage() {
  const { language, isLoaded: isStoreLoaded } = useGameState();
  const { user, isUserLoading } = useUser();
  const db = useFirestore();
  const [isAuthStabilized, setIsAuthStabilized] = useState(false);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!isUserLoading && user?.uid) {
      const timer = setTimeout(() => setIsAuthStabilized(true), 1200);
      return () => clearTimeout(timer);
    } else {
      setIsAuthStabilized(false);
    }
  }, [isUserLoading, user?.uid]);

  const authReady = isAuthStabilized && !!user?.uid;

  const marketQuery = useMemoFirebase(() => {
    if (!authReady) return null;
    return query(collection(db, 'market_v7'), where('sellerId', '==', user!.uid));
  }, [db, user?.uid, authReady]);

  const { data: agents, isLoading: isMarketLoading, error: marketError } = useCollection(marketQuery);

  const getCountdown = (expiryIso: string) => {
    const expiry = new Date(expiryIso).getTime();
    const diff = expiry - now;
    if (diff <= 0) return "EXPIRED";
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const s = Math.floor((diff % 60000) / 1000);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  if (isUserLoading || !isStoreLoaded) return <LoadingScreen />;

  if (marketError) {
    return (
      <div className="max-w-md mx-auto px-4 pt-20 text-center space-y-6">
        <AlertCircle className="w-12 h-12 text-red-500 mx-auto" />
        <h2 className="text-xl font-bold uppercase text-white">Private Node Locked</h2>
        <p className="text-[10px] text-muted-foreground px-10 font-black uppercase tracking-widest leading-relaxed">
          Access to your private asset sales node was denied. Please re-synchronize your security clearance.
        </p>
        <Button onClick={() => window.location.reload()} variant="outline" className="h-12 border-white/10 uppercase text-[10px] font-bold px-8">
          <RefreshCw className="w-3 h-3 mr-2" /> Sync Clearance
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto px-4 pt-8 pb-32">
      <header className="mb-6 flex items-center gap-4">
        <Link href="/transfers">
          <Button variant="ghost" size="icon" className="rounded-full">
            <ChevronLeft className="w-6 h-6" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-headline font-bold uppercase tracking-tighter text-white">
            {language === 'ru' ? 'МОИ ПРОДАЖИ' : 'MY SALES'}
          </h1>
          <p className="text-muted-foreground text-[10px] uppercase tracking-widest font-bold opacity-60">
            {(!authReady || isMarketLoading) ? 'Scanning...' : 'Active Asset Listings'}
          </p>
        </div>
      </header>

      <div className="space-y-3">
        {(!authReady || isMarketLoading) ? (
          <div className="py-20 text-center flex flex-col items-center gap-4 opacity-50">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-[10px] uppercase font-bold tracking-[0.2em]">Synchronizing Assets...</p>
          </div>
        ) : agents && agents.length > 0 ? (
          agents.map((agent) => (
            <Card key={agent.id} className="glass-card border-white/5 hover:bg-white/5 transition-all overflow-hidden">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-4">
                   <div className="flex items-center gap-1.5 text-accent">
                     <Timer className="w-3.5 h-3.5" />
                     <span className="text-[10px] font-mono font-bold">{getCountdown(agent.expiresAt)}</span>
                   </div>
                   {agent.highestBidderId && (
                     <div className="flex items-center gap-1 bg-primary/10 px-2 py-0.5 rounded border border-primary/20">
                       <Users className="w-3 h-3 text-primary" />
                       <span className="text-[8px] font-black text-primary uppercase">{agent.highestBidderName}</span>
                     </div>
                   )}
                </div>

                <div className="flex items-center justify-between gap-4">
                   <div className="flex items-center gap-4 flex-1 min-w-0">
                      <div className="w-12 h-12 rounded-xl overflow-hidden bg-secondary/50 border border-white/10 shrink-0 shadow-md">
                        <img src={agent.heroData?.image} alt="" className="w-full h-full object-cover" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-sm font-bold uppercase text-white truncate">{agent.heroData?.name}</h3>
                        <p className="text-[8px] font-black text-muted-foreground uppercase tracking-widest mt-1">
                          Role: {agent.heroData?.role} | OVR {agent.heroData?.overallRating}
                        </p>
                      </div>
                   </div>
                   <div className="text-right border-l border-white/5 pl-4">
                      <p className="text-[8px] font-black text-muted-foreground uppercase tracking-widest mb-0.5">Top Bid</p>
                      <p className="text-lg font-headline font-bold text-primary italic leading-none">€{agent.currentBid?.toLocaleString()}</p>
                   </div>
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <div className="py-20 text-center opacity-30 text-[10px] uppercase font-black border border-dashed border-white/10 rounded-2xl flex flex-col items-center gap-4 p-10 leading-relaxed">
            <Coins className="w-10 h-10" />
            <p>No active listings found in your asset portfolio</p>
          </div>
        )}
      </div>
    </div>
  );
}
