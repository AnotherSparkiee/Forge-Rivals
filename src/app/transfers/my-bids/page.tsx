'use client';

import { useState, useEffect, useMemo } from 'react';
import { useGameState } from '@/app/lib/store';
import { Button } from '@/components/ui/button';
import { ChevronLeft, Loader2, Package, Search } from 'lucide-react';
import Link from 'next/link';
import { useUser, useFirestore, useCollection, useMemoFirebase, useDoc } from '@/firebase';
import { collection, query, where, doc, updateDoc, arrayUnion, serverTimestamp } from 'firebase/firestore';
import { addDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { LoadingScreen } from '@/components/game/LoadingScreen';
import { TransferHeroCard } from '../quick-search/page';
import { useToast } from '@/hooks/use-toast';

export default function MyBidsPage() {
  const { language, isLoaded: isStoreLoaded, credits, addCredits } = useGameState();
  const { user, isUserLoading } = useUser();
  const db = useFirestore();
  const { toast } = useToast();
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const marketQuery = useMemoFirebase(() => {
    if (!user?.uid) return null;
    return query(collection(db, 'market_v7'), where('bidders', 'array-contains', user.uid));
  }, [db, user?.uid]);

  const { data: agents, isLoading: isMarketLoading } = useCollection(marketQuery);
  const { data: profile } = useDoc(user?.uid ? doc(db, 'players_v10', user.uid) : null);

  const handleGlobalBid = async (agent: any, amount: number) => {
    if (!user || !profile) return;
    if (credits < amount) { 
      toast({ title: language === 'ru' ? "Недостаточно средств" : "Insufficient funds", variant: "destructive" }); 
      return; 
    }
    try {
      const prevBidder = agent.highestBidderId;
      const heroName = agent.heroData?.name || "Player";
      
      // Time Extension Logic (Anti-sniping) - Threshold 10 minutes (600,000 ms)
      const expiryTime = new Date(agent.expiresAt).getTime();
      const timeLeft = expiryTime - Date.now();
      let finalExpiresAt = agent.expiresAt;
      
      if (timeLeft < 600000) { 
        finalExpiresAt = new Date(Date.now() + 600000).toISOString(); 
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
        title: language === 'ru' ? "Ставка принята!" : "Bid Confirmed!",
        description: timeLeft < 600000 ? (language === 'ru' ? "Аукцион продлен на 10 минут!" : "Auction extended by 10 minutes!") : undefined
      });
    } catch (e) {
      toast({ title: "Error placing bid", variant: "destructive" });
    }
  };

  const activeBids = useMemo(() => {
    return (agents || []).filter(a => new Date(a.expiresAt).getTime() > now)
      .sort((a, b) => new Date(a.expiresAt).getTime() - new Date(b.expiresAt).getTime());
  }, [agents, now]);

  if (isUserLoading || !isStoreLoaded || isMarketLoading) return <LoadingScreen />;

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
          <p className="text-muted-foreground text-[10px] uppercase tracking-widest font-bold opacity-60">Personal Bidding Records</p>
        </div>
      </header>

      <div className="space-y-3 animate-in fade-in duration-500">
        {activeBids.length > 0 ? (
          activeBids.map((agent) => (
            <TransferHeroCard 
              key={agent.id} 
              agent={agent} 
              user={user} 
              profile={profile} 
              onBid={handleGlobalBid}
              now={now}
              language={language}
            />
          ))
        ) : (
          <div className="py-20 text-center opacity-30 text-[10px] uppercase font-black border border-dashed border-white/10 rounded-2xl flex flex-col items-center gap-4 p-10 leading-relaxed">
            <Package className="w-10 h-10" />
            <p>You haven't placed any bids on active units</p>
            <Link href="/transfers/quick-search">
              <Button variant="outline" className="h-10 text-[9px] uppercase font-black tracking-widest mt-4">
                <Search className="w-3 h-3 mr-2" /> Search Units
              </Button>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
