
'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useGameState } from '@/app/lib/store';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { 
  ChevronLeft, Loader2, Star, ShoppingCart, 
  Crown, Zap, Award, Target, Trophy, Info
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { LoadingScreen } from '@/components/game/LoadingScreen';
import { useUser, useFirestore, useCollection, useMemoFirebase, useDoc } from '@/firebase';
import { collection, query, doc, arrayUnion, serverTimestamp, setDoc, getDoc, updateDoc } from 'firebase/firestore';
import { addDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { useToast } from '@/hooks/use-toast';
import { generateUniqueHero } from '@/app/lib/moba-data';
import { getMoscowTime, getMoscowDateString, getEndOfMoscowDay } from '@/app/lib/time-utils';
import { TransferHeroCard } from '../quick-search/page';
import Link from 'next/link';

export default function ProTransfersPage() {
  const { language, isLoaded: isStoreLoaded, credits, addCredits } = useGameState();
  const { user, isUserLoading } = useUser();
  const db = useFirestore();
  const { toast } = useToast();
  
  const [now, setNow] = useState(Date.now());
  const initTriggeredRef = useRef(false);

  useEffect(() => {
    const timer = setInterval(() => setNow(getMoscowTime().getTime()), 1000);
    return () => clearInterval(timer);
  }, []);

  const marketQuery = useMemoFirebase(() => {
    if (!user?.uid) return null;
    return query(collection(db, 'market_v7'));
  }, [db, user?.uid]);

  const { data: agents, isLoading: isMarketLoading } = useCollection(marketQuery);
  const userDocRef = useMemoFirebase(() => user?.uid ? doc(db, 'players_v10', user.uid) : null, [db, user?.uid]);
  const { data: profile } = useDoc(userDocRef);

  useEffect(() => {
    if (isMarketLoading || !user?.uid || !isStoreLoaded) return;

    const today = getMoscowDateString();
    const proAgentsToday = (agents || []).filter(a => a.isSystem && a.dropDate === today && a.isPro);

    if (proAgentsToday.length === 0 && !initTriggeredRef.current) {
      initTriggeredRef.current = true;
      
      const refreshProMarket = async () => {
        const deterministicExpiry = getEndOfMoscowDay();
        const roles = ['Carry', 'Midlaner', 'Tank', 'Jungler', 'Support'] as const;
        
        // Generate 1 PRO player per role daily
        for (const role of roles) {
          const agentId = `pro_drop_${today}_${role.toLowerCase()}`;
          const existingRef = doc(db, 'market_v7', agentId);
          const existingSnap = await getDoc(existingRef);
          
          if (!existingSnap.exists()) {
            const seed = `pro_${today}_${role}`;
            const hero = generateUniqueHero(role, 99, false, seed, true); // true = isPro
            const startPrice = (hero.overallRating * 50000) + 1500000; // PRO players start at 3M+
            
            await setDoc(existingRef, { 
              id: agentId, 
              heroData: JSON.parse(JSON.stringify(hero)), 
              currentBid: startPrice, 
              startingPrice: startPrice, 
              highestBidderId: null, 
              highestBidderName: null, 
              bidders: [], 
              expiresAt: deterministicExpiry, 
              dropDate: today, 
              createdAt: serverTimestamp(), 
              isSystem: true, 
              isPro: true,
              sellerId: 'system' 
            });
          }
        }
      };
      refreshProMarket().catch(e => console.error("PRO market refresh failed", e));
    }
  }, [isMarketLoading, agents, user?.uid, isStoreLoaded, db]);

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
        addDocumentNonBlocking(collection(db, 'notifications_v7'), {
          userId: prevBidder, title: language === 'ru' ? "Ставка перебита!" : "Outbid!",
          description: language === 'ru' ? `Ставка на PRO-игрока "${heroName}" перебита!` : `Bid on PRO unit "${heroName}" outbid!`,
          type: 'market', read: false, createdAt: new Date().toISOString()
        });
      }
      
      toast({ title: language === 'ru' ? "Ставка принята!" : "Elite Bid Confirmed!" });
    } catch (e) {
      toast({ title: "Bidding failed", variant: "destructive" });
    }
  }, [user, profile, credits, language, toast, db, addCredits]);

  const proAgents = useMemo(() => {
    return (agents || []).filter(a => a.isPro && new Date(a.expiresAt).getTime() > now)
      .sort((a, b) => new Date(a.expiresAt).getTime() - new Date(b.expiresAt).getTime());
  }, [agents, now]);

  if (isUserLoading || !isStoreLoaded || isMarketLoading) return <LoadingScreen />;

  return (
    <div className="max-w-md mx-auto px-4 pt-8 pb-32">
      <header className="mb-6 flex items-center gap-4">
        <Link href="/transfers">
          <Button variant="ghost" size="icon" className="rounded-full"><ChevronLeft className="w-6 h-6" /></Button>
        </Link>
        <div>
          <h1 className="text-2xl font-headline font-bold uppercase tracking-tighter text-white flex items-center gap-2">
            <Crown className="w-6 h-6 text-yellow-500" />
            {language === 'ru' ? 'PRO-ИГРОКИ' : 'PRO MARKET'}
          </h1>
          <p className="text-muted-foreground text-[10px] uppercase tracking-widest font-bold opacity-60">Elite Strategic Assets</p>
        </div>
      </header>

      <div className="space-y-6">
        <Card className="glass-card border-yellow-500/30 bg-gradient-to-br from-yellow-500/10 to-transparent">
          <CardContent className="p-4 space-y-4">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-yellow-500 flex items-center gap-2">
              <Info className="w-3.5 h-3.5" /> PRO UNIT ADVANTAGES
            </h3>
            <div className="grid grid-cols-1 gap-2">
               <div className="flex items-center gap-3 text-[10px] font-bold uppercase text-white/80">
                 <Zap className="w-3.5 h-3.5 text-yellow-500" /> Extreme Talent (Faster Training)
               </div>
               <div className="flex items-center gap-3 text-[10px] font-bold uppercase text-white/80">
                 <Target className="w-3.5 h-3.5 text-primary" /> Tactical Precision (Clutch moments)
               </div>
               <div className="flex items-center gap-3 text-[10px] font-bold uppercase text-white/80">
                 <Users className="w-3.5 h-3.5 text-accent" /> High Media Status (Attendance boost)
               </div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-3">
          {proAgents.length > 0 ? (
            proAgents.map((agent) => (
              <div key={agent.id} className="relative group">
                <div className="absolute -inset-0.5 bg-gradient-to-r from-yellow-500/30 to-accent/30 rounded-2xl blur opacity-30 group-hover:opacity-60 transition duration-500"></div>
                <TransferHeroCard 
                  agent={agent} 
                  user={user} 
                  profile={profile} 
                  onBid={handleGlobalBid}
                  now={now}
                  language={language}
                />
              </div>
            ))
          ) : (
            <div className="py-20 text-center opacity-30 border border-dashed border-white/10 rounded-2xl flex flex-col items-center gap-4 p-10">
              <Trophy className="w-12 h-12" />
              <p className="text-[10px] uppercase font-black">All elite assets commissioned</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
