'use client';

import { useState } from 'react';
import { useGameState } from '@/app/lib/store';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ChevronLeft, Loader2, Package } from 'lucide-react';
import Link from 'next/link';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import { LoadingScreen } from '@/components/game/LoadingScreen';

export default function MyBidsPage() {
  const { language, isLoaded } = useGameState();
  const { user, isUserLoading } = useUser();
  const db = useFirestore();

  const marketQuery = useMemoFirebase(() => {
    if (!user?.uid) return null;
    return query(collection(db, 'market_v2'), where('bidders', 'array-contains', user.uid));
  }, [db, user?.uid]);

  const { data: agents, isLoading: isMarketLoading } = useCollection(marketQuery);

  if (isUserLoading || !isLoaded) return <LoadingScreen />;

  return (
    <div className="max-w-md mx-auto px-4 pt-8 pb-32">
      <header className="mb-6 flex items-center gap-4">
        <Link href="/transfers">
          <Button variant="ghost" size="icon" className="rounded-full">
            <ChevronLeft className="w-6 h-6" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-headline font-bold uppercase tracking-tighter">{language === 'ru' ? 'МОИ ПОКУПКИ' : 'MY BIDS'}</h1>
          <p className="text-muted-foreground text-[10px] uppercase tracking-widest">Active participations</p>
        </div>
      </header>

      <div className="space-y-3">
        {isMarketLoading ? (
          <div className="py-20 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" /></div>
        ) : agents && agents.length > 0 ? (
          agents.map((agent) => (
            <Card key={agent.id} className="glass-card border-white/5">
              <CardContent className="p-4 flex items-center justify-between">
                 <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg overflow-hidden bg-secondary/50">
                      <img src={agent.heroData.image} alt="" className="w-full h-full object-cover" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold uppercase">{agent.heroData.name}</h3>
                      <p className="text-[8px] font-black text-green-400 uppercase">
                        {agent.highestBidderId === user?.uid ? 'LEADING' : 'OUTBID'}
                      </p>
                    </div>
                 </div>
                 <div className="text-right">
                    <p className="text-sm font-bold text-white">€{agent.currentBid.toLocaleString()}</p>
                 </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <div className="py-20 text-center opacity-30 text-xs uppercase font-black">No active bids</div>
        )}
      </div>
    </div>
  );
}