'use client';

import { useState, useEffect } from 'react';
import { useGameState } from '@/app/lib/store';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ChevronLeft, Loader2, AlertCircle, RefreshCw, Package } from 'lucide-react';
import Link from 'next/link';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import { LoadingScreen } from '@/components/game/LoadingScreen';
import { cn } from '@/lib/utils';

export default function MyBidsPage() {
  const { language, isLoaded: isStoreLoaded } = useGameState();
  const { user, isUserLoading } = useUser();
  const db = useFirestore();
  const [isAuthStabilized, setIsAuthStabilized] = useState(false);

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
    return query(collection(db, 'market_v5'), where('bidders', 'array-contains', user!.uid));
  }, [db, user?.uid, authReady]);

  const { data: agents, isLoading: isMarketLoading, error: marketError } = useCollection(marketQuery);

  if (isUserLoading || !isStoreLoaded) return <LoadingScreen />;

  if (marketError) {
    return (
      <div className="max-w-md mx-auto px-4 pt-20 text-center space-y-6">
        <AlertCircle className="w-12 h-12 text-red-500 mx-auto" />
        <h2 className="text-xl font-bold uppercase text-white">Telemetry Restricted</h2>
        <p className="text-[10px] text-muted-foreground px-10 font-black uppercase tracking-widest leading-relaxed">
          The market data node refused the bid telemetry stream. Secure authentication sync required.
        </p>
        <Button onClick={() => window.location.reload()} variant="outline" className="h-12 border-white/10 uppercase text-[10px] font-bold px-8">
          <RefreshCw className="w-3 h-3 mr-2" /> Re-establish Link
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
            {language === 'ru' ? 'МОИ ПОКУПКИ' : 'MY BIDS'}
          </h1>
          <p className="text-muted-foreground text-[10px] uppercase tracking-widest font-bold opacity-60">
            {(!authReady || isMarketLoading) ? 'Connecting...' : 'Personal Bidding Stream Active'}
          </p>
        </div>
      </header>

      <div className="space-y-3">
        {(!authReady || isMarketLoading) ? (
          <div className="py-20 text-center flex flex-col items-center gap-4 opacity-50">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-[10px] uppercase font-bold tracking-[0.2em]">Retrieving Records...</p>
          </div>
        ) : agents && agents.length > 0 ? (
          agents.map((agent) => (
            <Card key={agent.id} className="glass-card border-white/5 hover:bg-white/5 transition-all">
              <CardContent className="p-4 flex items-center justify-between">
                 <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg overflow-hidden bg-secondary/50 border border-white/10 shrink-0">
                      <img src={agent.heroData?.image} alt="" className="w-full h-full object-cover" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold uppercase text-white truncate max-w-[140px]">{agent.heroData?.name}</h3>
                      <p className={cn(
                        "text-[8px] font-black uppercase tracking-tighter mt-0.5 px-1 rounded-sm w-fit",
                        agent.highestBidderId === user?.uid ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"
                      )}>
                        {agent.highestBidderId === user?.uid ? 'LEADING BID' : 'OUTBID'}
                      </p>
                    </div>
                 </div>
                 <div className="text-right">
                    <p className="text-sm font-headline font-bold text-white italic">€{agent.currentBid?.toLocaleString()}</p>
                    <p className="text-[7px] font-black text-muted-foreground uppercase mt-1 tracking-widest">Active Val</p>
                 </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <div className="py-20 text-center opacity-30 text-[10px] uppercase font-black border border-dashed border-white/10 rounded-2xl flex flex-col items-center gap-4 p-10">
            <Package className="w-10 h-10" />
            <p>No active bids found in your operational records</p>
          </div>
        )}
      </div>
    </div>
  );
}
