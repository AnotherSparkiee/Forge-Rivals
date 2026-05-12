'use client';

import { useGameState } from '@/app/lib/store';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ChevronLeft, Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import { LoadingScreen } from '@/components/game/LoadingScreen';

export default function MySalesPage() {
  const { language, isLoaded: isStoreLoaded } = useGameState();
  const { user, isUserLoading } = useUser();
  const db = useFirestore();

  // Decoupled query: Wait only for user uid
  const marketQuery = useMemoFirebase(() => {
    if (isUserLoading || !user?.uid) return null;
    return query(collection(db, 'market_v2'), where('sellerId', '==', user.uid));
  }, [db, user?.uid, isUserLoading]);

  const { data: agents, isLoading: isMarketLoading, error: marketError } = useCollection(marketQuery);

  if (isUserLoading || !isStoreLoaded) return <LoadingScreen />;

  if (marketError) {
    return (
      <div className="max-w-md mx-auto px-4 pt-20 text-center space-y-6">
        <AlertCircle className="w-12 h-12 text-red-500 mx-auto" />
        <h2 className="text-xl font-bold uppercase">Restricted Feed</h2>
        <p className="text-xs text-muted-foreground px-10">Unauthorized attempt to access private sales node.</p>
        <Button onClick={() => window.location.reload()} variant="outline" className="border-white/10 uppercase text-[10px] font-bold">
          <RefreshCw className="w-3 h-3 mr-2" /> Restart Link
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
          <h1 className="text-2xl font-headline font-bold uppercase tracking-tighter">
            {language === 'ru' ? 'МОИ ПРОДАЖИ' : 'MY SALES'}
          </h1>
          <p className="text-muted-foreground text-[10px] uppercase tracking-widest">Active Listings</p>
        </div>
      </header>

      <div className="space-y-3">
        {isMarketLoading ? (
          <div className="py-20 text-center flex flex-col items-center gap-4 opacity-50">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-[10px] uppercase font-bold tracking-widest">Accessing Sale Feed...</p>
          </div>
        ) : agents && agents.length > 0 ? (
          agents.map((agent) => (
            <Card key={agent.id} className="glass-card border-white/5">
              <CardContent className="p-4 flex items-center justify-between">
                 <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg overflow-hidden bg-secondary/50 border border-white/10">
                      <img src={agent.heroData?.image} alt="" className="w-full h-full object-cover" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold uppercase">{agent.heroData?.name}</h3>
                      <p className="text-[8px] font-black text-accent uppercase">
                        Highest Bidder: {agent.highestBidderName || 'None'}
                      </p>
                    </div>
                 </div>
                 <div className="text-right">
                    <p className="text-sm font-bold text-white">€{agent.currentBid?.toLocaleString()}</p>
                 </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <div className="py-20 text-center opacity-30 text-xs uppercase font-black border border-dashed border-white/10 rounded-2xl">
            No active listings found
          </div>
        )}
      </div>
    </div>
  );
}