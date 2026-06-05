
'use client';

import { useState, useEffect, useRef } from 'react';
import { useGameState } from '@/app/lib/store';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ChevronLeft, Loader2, Gavel, AlertCircle, RefreshCw, ShoppingCart, Users, ShieldCheck, Clock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { LoadingScreen } from '@/components/game/LoadingScreen';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useUser, useFirestore, useCollection, useMemoFirebase, useDoc } from '@/firebase';
import { collection, query, doc, arrayUnion, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { generateUniqueHero } from '@/app/lib/moba-data';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';

export default function QuickSearchPage() {
  const { language, isLoaded: isStoreLoaded, credits, addCredits } = useGameState();
  const { user, isUserLoading } = useUser();
  const db = useFirestore();
  const { toast } = useToast();
  const router = useRouter();
  
  const [isBidding, setIsBidding] = useState<string | null>(null);
  const initTriggeredRef = useRef(false);

  const marketQuery = useMemoFirebase(() => {
    if (!user?.uid) return null;
    return query(collection(db, 'market_v7'));
  }, [db, user?.uid]);

  const { data: agents, isLoading: isMarketLoading, error: marketError } = useCollection(marketQuery);

  const userRef = useMemoFirebase(() => (user?.uid ? doc(db, 'players_v10', user.uid) : null), [db, user?.uid]);
  const { data: profile } = useDoc(userRef);

  useEffect(() => {
    if (!isMarketLoading && agents && agents.length === 0 && !initTriggeredRef.current && !marketError && user?.uid) {
      initTriggeredRef.current = true;
      const initializeMarket = async () => {
        const roles = ['Carry', 'Midlaner', 'Tank', 'Jungler', 'Support'] as const;
        for (const role of roles) {
          for (let i = 1; i <= 2; i++) {
            const hero = generateUniqueHero(role, i, false);
            const agentId = `system_bot_${role.toLowerCase()}_${i}_${Date.now()}`;
            const startPrice = (hero.overallRating * 18000) + 300000;
            await setDoc(doc(db, 'market_v7', agentId), {
              id: agentId, heroData: JSON.parse(JSON.stringify(hero)), currentBid: startPrice, startingPrice: startPrice, highestBidderId: null, highestBidderName: null, bidders: [], expiresAt: new Date(Date.now() + 86400000 * 7).toISOString(), createdAt: serverTimestamp(), isSystem: true, isYouth: false
            });
          }
        }
      };
      initializeMarket().catch(e => console.error("Market init failed", e));
    }
  }, [isMarketLoading, agents, user?.uid, db, marketError]);

  const handleBid = async (agent: any) => {
    if (!user || isBidding) return;
    const minNextBid = Math.ceil(agent.currentBid * 1.05);
    if (credits < minNextBid) { toast({ title: language === 'ru' ? "Недостаточно средств" : "Insufficient funds", variant: "destructive" }); return; }
    setIsBidding(agent.id);
    try {
      const agentRef = doc(db, 'market_v7', agent.id);
      await updateDoc(agentRef, { currentBid: minNextBid, highestBidderId: user.uid, highestBidderName: profile?.displayName || "Manager", bidders: arrayUnion(user.uid), updatedAt: serverTimestamp() });
      addCredits(-minNextBid);
      toast({ title: language === 'ru' ? "Ставка принята!" : "Bid Placed!" });
    } finally { setIsBidding(null); }
  };

  if (isUserLoading || !isStoreLoaded) return <LoadingScreen />;

  const roleList = [ { id: 'Carry', label: language === 'ru' ? "Керри" : "Carry" }, { id: 'Midlaner', label: language === 'ru' ? "Мидер" : "Midlaner" }, { id: 'Tank', label: language === 'ru' ? "Танк" : "Tank" }, { id: 'Jungler', label: language === 'ru' ? "Лес" : "Jungler" }, { id: 'Support', label: language === 'ru' ? "Саппорт" : "Support" } ];

  return (
    <div className="max-w-md mx-auto px-4 pt-8 pb-32">
      <header className="mb-6 flex items-center gap-4">
        <Button variant="ghost" size="icon" className="rounded-full" onClick={() => router.push('/transfers')}><ChevronLeft className="w-6 h-6" /></Button>
        <div><h1 className="text-2xl font-headline font-bold uppercase tracking-tighter text-white">QUICK SEARCH</h1><p className="text-muted-foreground text-[10px] uppercase tracking-widest font-bold opacity-60">Real-time Market Active</p></div>
      </header>
      <Tabs defaultValue="Carry" className="w-full">
        <TabsList className="bg-secondary/30 border border-white/5 h-11 w-full flex mb-4 p-1 rounded-xl">
          {roleList.map((role) => ( <TabsTrigger key={role.id} value={role.id} className="flex-1 text-[9px] font-black uppercase rounded-lg">{role.label}</TabsTrigger> ))}
        </TabsList>
        {roleList.map((role) => {
          const roleAgents = agents?.filter(a => a.heroData?.role === role.id && a.isYouth !== true) || [];
          return (
            <TabsContent key={role.id} value={role.id} className="space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
              {isMarketLoading ? ( <div className="py-20 text-center opacity-50"><Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" /></div> ) : roleAgents.length > 0 ? (
                roleAgents.map((agent) => {
                  const isLeading = agent.highestBidderId === user?.uid;
                  return (
                    <Card key={agent.id} className={cn("glass-card border-white/5 overflow-hidden transition-all", isLeading && "border-green-500/40 bg-green-500/5")}>
                      <CardContent className="p-4">
                        <div className="flex items-center gap-4 mb-4">
                          <div className="w-14 h-14 rounded-2xl overflow-hidden bg-secondary/50 border border-white/10 shrink-0 shadow-lg"><img src={agent.heroData?.image} alt="" className="w-full h-full object-cover" /></div>
                          <div className="flex-1 min-w-0"><h3 className="text-base font-bold uppercase truncate text-white tracking-tight">{agent.heroData?.name}</h3><div className="flex flex-wrap items-center gap-2 mt-1"><Badge variant="outline" className="text-[7px] py-0 border-white/10 uppercase">{agent.heroData?.role}</Badge>{agent.highestBidderName && <span className="text-[7px] font-black uppercase text-primary">TOP: {agent.highestBidderName}</span>}</div></div>
                          <div className="text-right flex flex-col items-end"><p className="text-2xl font-headline font-bold text-accent italic leading-none">{agent.heroData?.overallRating}</p><p className="text-[8px] font-black text-muted-foreground uppercase mt-1">OVR</p></div>
                        </div>
                        <div className="flex items-center justify-between gap-4 pt-4 border-t border-white/5">
                          <div className="flex flex-col"><p className="text-[8px] uppercase text-muted-foreground font-black tracking-widest">Current Bid</p><p className="text-lg font-headline font-bold text-primary">€{agent.currentBid?.toLocaleString()}</p></div>
                          <Button className={cn("h-11 font-black text-[10px] px-6 rounded-xl", isLeading ? "bg-green-600 text-white" : "hero-gradient")} onClick={() => handleBid(agent)} disabled={!!isBidding || isLeading}>{isBidding === agent.id ? <Loader2 className="w-4 h-4 animate-spin" /> : isLeading ? <><ShieldCheck className="w-4 h-4 mr-2" /> LEADING</> : <><Gavel className="w-4 h-4 mr-2" /> BID</>}</Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })
              ) : ( <div className="py-20 text-center opacity-30 border border-dashed border-white/10 rounded-2xl flex flex-col items-center gap-4 p-10"><ShoppingCart className="w-12 h-12" /><p className="text-[10px] uppercase font-black">No active listings</p></div> )}
            </TabsContent>
          );
        })}
      </Tabs>
    </div>
  );
}
