'use client';

import { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useGameState } from '@/app/lib/store';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ChevronLeft, Search, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query } from 'firebase/firestore';
import { LoadingScreen } from '@/components/game/LoadingScreen';

export default function AdvancedSearchPage() {
  const { language, isLoaded } = useGameState();
  const { user, isUserLoading } = useUser();
  const db = useFirestore();

  const marketQuery = useMemoFirebase(() => {
    if (!user?.uid) return null;
    return query(collection(db, 'market_v2'));
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
          <h1 className="text-2xl font-headline font-bold uppercase tracking-tighter">{language === 'ru' ? 'РАСШИРЕННЫЙ ПОИСК' : 'ADVANCED SEARCH'}</h1>
          <p className="text-muted-foreground text-[10px] uppercase tracking-widest">Minimal Mode</p>
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
                      <p className="text-[9px] text-muted-foreground uppercase">{agent.heroData.role}</p>
                    </div>
                 </div>
                 <div className="text-right">
                    <p className="text-lg font-headline font-bold text-accent italic">{agent.heroData.overallRating}</p>
                    <p className="text-[9px] font-bold text-primary">€{agent.currentBid.toLocaleString()}</p>
                 </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <div className="py-20 text-center opacity-30 text-xs uppercase font-black">Market is currently empty</div>
        )}
      </div>
    </div>
  );
}