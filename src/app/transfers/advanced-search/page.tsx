'use client';

import { useState, useEffect } from 'react';
import { useGameState } from '@/app/lib/store';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ChevronLeft, Search, Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query } from 'firebase/firestore';
import { LoadingScreen } from '@/components/game/LoadingScreen';

export default function AdvancedSearchPage() {
  const { language, isLoaded: isStoreLoaded } = useGameState();
  const { user, isUserLoading } = useUser();
  const db = useFirestore();

  const marketQuery = useMemoFirebase(() => {
    if (isUserLoading || !user?.uid) return null;
    return query(collection(db, 'market_v2'));
  }, [db, user?.uid, isUserLoading]);

  const { data: agents, isLoading: isMarketLoading, error: marketError } = useCollection(marketQuery);

  if (isUserLoading || !isStoreLoaded) return <LoadingScreen />;

  if (marketError) {
    return (
      <div className="max-w-md mx-auto px-4 pt-20 text-center space-y-6">
        <AlertCircle className="w-12 h-12 text-red-500 mx-auto" />
        <h2 className="text-xl font-bold uppercase text-white">Archive Sync Error</h2>
        <p className="text-[10px] text-muted-foreground px-10 uppercase font-black tracking-widest">
          Unable to establish connection to the market data node. Authentication re-sync required.
        </p>
        <Button onClick={() => window.location.reload()} variant="outline" className="h-12 border-white/10 uppercase text-[10px] font-bold px-8">
          <RefreshCw className="w-3 h-3 mr-2" /> Reconnect
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
            {language === 'ru' ? 'РАСШИРЕННЫЙ ПОИСК' : 'ADVANCED SEARCH'}
          </h1>
          <p className="text-muted-foreground text-[10px] uppercase tracking-widest font-bold opacity-60">Global Archive Scan Active</p>
        </div>
      </header>

      <div className="space-y-3">
        {isMarketLoading ? (
          <div className="py-20 text-center flex flex-col items-center gap-4 opacity-50">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-[10px] uppercase font-bold tracking-[0.2em]">Fetching Node Data...</p>
          </div>
        ) : agents && agents.length > 0 ? (
          agents.map((agent) => (
            <Card key={agent.id} className="glass-card border-white/5 group hover:border-primary/30 transition-all">
              <CardContent className="p-4 flex items-center justify-between">
                 <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg overflow-hidden bg-secondary/50 border border-white/10 shrink-0">
                      <img src={agent.heroData?.image} alt="" className="w-full h-full object-cover" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold uppercase text-white truncate max-w-[150px]">{agent.heroData?.name}</h3>
                      <p className="text-[8px] text-muted-foreground font-black uppercase tracking-widest mt-0.5">{agent.heroData?.role}</p>
                    </div>
                 </div>
                 <div className="text-right flex flex-col items-end">
                    <p className="text-lg font-headline font-bold text-accent italic leading-none">{agent.heroData?.overallRating}</p>
                    <p className="text-[9px] font-bold text-primary mt-1">€{agent.currentBid?.toLocaleString()}</p>
                 </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <div className="py-20 text-center opacity-30 text-[10px] uppercase font-black border border-dashed border-white/10 rounded-2xl p-10 leading-relaxed">
            Market archive is currently empty in this sector
          </div>
        )}
      </div>
    </div>
  );
}