'use client';

import { useState, useEffect, useRef } from 'react';
import { useGameState } from '@/app/lib/store';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ChevronLeft, Loader2, Gavel, AlertCircle, RefreshCw, ShoppingCart, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { LoadingScreen } from '@/components/game/LoadingScreen';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useUser, useFirestore, useCollection, useMemoFirebase, updateDocumentNonBlocking, useDoc, setDocumentNonBlocking } from '@/firebase';
import { collection, query, doc, arrayUnion, serverTimestamp } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { generateUniqueHero } from '@/app/lib/moba-data';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';

export default function QuickSearchPage() {
  const { language, isLoaded: isStoreLoaded, credits } = useGameState();
  const { user, isUserLoading } = useUser();
  const db = useFirestore();
  const { toast } = useToast();
  const router = useRouter();
  
  const [isBidding, setIsBidding] = useState<string | null>(null);
  const [isAuthStabilized, setIsAuthStabilized] = useState(false);
  const initTriggeredRef = useRef(false);

  // CRITICAL: 2.5s stabilization delay to ensure Firebase Token is fully synchronized with Firestore backend
  useEffect(() => {
    if (!isUserLoading && user?.uid) {
      const timer = setTimeout(() => setIsAuthStabilized(true), 2500);
      return () => clearTimeout(timer);
    } else {
      setIsAuthStabilized(false);
    }
  }, [isUserLoading, user?.uid]);

  const authReady = isAuthStabilized && !!user?.uid;

  const marketQuery = useMemoFirebase(() => {
    if (!authReady) return null;
    // Query the global market collection
    return query(collection(db, 'market_v2'));
  }, [db, authReady]);

  const { data: agents, isLoading: isMarketLoading, error: marketError } = useCollection(marketQuery);

  const userRef = useMemoFirebase(() => (authReady ? doc(db, 'players_v5', user!.uid) : null), [db, authReady, user?.uid]);
  const { data: profile } = useDoc(userRef);

  // GLOBAL MARKET INITIALIZATION (Determined by deterministic keys)
  useEffect(() => {
    if (authReady && !isMarketLoading && agents && agents.length === 0 && !initTriggeredRef.current && !marketError) {
      initTriggeredRef.current = true;
      
      const roles = ['Carry', 'Midlaner', 'Tank', 'Jungler', 'Support'] as const;
      
      // Create a shared pool of 15 players (3 for each role)
      roles.forEach((role, roleIdx) => {
        for (let i = 1; i <= 3; i++) {
          const hero = generateUniqueHero(role, i, false);
          // Deterministic Global ID ensures all players see the SAME lot
          const agentId = `global_lot_${role.toLowerCase()}_${i}_v12`;
          const startPrice = (hero.overallRating * 12000) + 100000;
          
          setDocumentNonBlocking(doc(db, 'market_v2', agentId), {
            id: agentId,
            heroData: JSON.parse(JSON.stringify(hero)),
            currentBid: startPrice,
            startingPrice: startPrice,
            highestBidderId: null,
            highestBidderName: null,
            bidders: [],
            // Expires in 3 days for persistent bidding wars
            expiresAt: new Date(Date.now() + 86400000 * 3).toISOString(),
            createdAt: serverTimestamp(),
            version: 12
          }, { merge: true });
        }
      });
    }
  }, [isMarketLoading, agents, authReady, db, marketError]);

  const handleBid = async (agent: any) => {
    if (!user || isBidding) return;
    
    // Minimum bid is 5% higher than current
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
        title: language === 'ru' ? "Ставка принята!" : "Bid Placed!",
        description: language === 'ru' ? "Вы теперь лидер торгов за этого игрока." : "You are now the leading bidder."
      });
    } finally {
      setIsBidding(null);
    }
  };

  if (isUserLoading || !isStoreLoaded) return <LoadingScreen />;

  if (marketError) {
    return (
      <div className="max-w-md mx-auto px-4 pt-20 text-center space-y-6">
        <div className="w-20 h-20 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto">
          <AlertCircle className="w-10 h-10 text-red-500" />
        </div>
        <h2 className="text-xl font-bold uppercase text-white">Market Protocol Restricted</h2>
        <p className="text-[10px] text-muted-foreground uppercase px-10 font-black tracking-widest leading-relaxed">
          {language === 'ru' 
            ? 'Связь с глобальным рынком ограничена. Пожалуйста, убедитесь, что ваша авторизация активна.' 
            : 'Access to the global market node was restricted. Secure authentication sync required.'}
        </p>
        <Button onClick={() => window.location.reload()} variant="outline" className="h-12 border-white/10 uppercase text-[10px] font-black tracking-widest px-8">
          <RefreshCw className="w-3 h-3 mr-2" /> {language === 'ru' ? 'СИНХРОНИЗИРОВАТЬ' : 'RE-SYNC TERMINAL'}
        </Button>
      </div>
    );
  }

  const roleList = [
    { id: 'Carry', label: language === 'ru' ? "Керри" : "Carry" },
    { id: 'Midlaner', label: language === 'ru' ? "Мидер" : "Midlaner" },
    { id: 'Tank', label: language === 'ru' ? "Танк" : "Tank" },
    { id: 'Jungler', label: language === 'ru' ? "Лес" : "Jungler" },
    { id: 'Support', label: language === 'ru' ? "Саппорт" : "Support" },
  ];

  return (
    <div className="max-w-md mx-auto px-4 pt-8 pb-32">
      <header className="mb-6 flex items-center gap-4">
        <Button variant="ghost" size="icon" className="rounded-full" onClick={() => router.push('/transfers')}>
          <ChevronLeft className="w-6 h-6" />
        </Button>
        <div>
          <h1 className="text-2xl font-headline font-bold uppercase tracking-tighter text-white">
            {language === 'ru' ? 'БЫСТРЫЙ ПОИСК' : 'QUICK SEARCH'}
          </h1>
          <p className="text-muted-foreground text-[10px] uppercase tracking-widest font-bold opacity-60">
            {(!authReady || isMarketLoading) ? 'Establishing Secure Link...' : 'Global Shared Market Online'}
          </p>
        </div>
      </header>

      <Tabs defaultValue="Carry" className="w-full">
        <TabsList className="bg-secondary/30 border border-white/5 h-11 w-full flex mb-4 p-1 rounded-xl">
          {roleList.map((role) => (
            <TabsTrigger key={role.id} value={role.id} className="flex-1 text-[9px] font-black uppercase rounded-lg">
              {role.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <div className="p-3 bg-primary/5 border border-primary/20 rounded-xl mb-4 flex items-center gap-3">
          <Users className="w-4 h-4 text-primary shrink-0" />
          <p className="text-[9px] text-muted-foreground uppercase font-bold leading-tight italic">
            {language === 'ru' 
              ? "Внимание: этот список един для всех менеджеров лиги. Боритесь за лучших игроков, перебивая ставки соперников!"
              : "Warning: this roster is shared globally. Compete with other managers by outbidding them for elite talent!"}
          </p>
        </div>

        {roleList.map((role) => {
          const roleAgents = agents?.filter(a => a.heroData?.role === role.id) || [];
          
          return (
            <TabsContent key={role.id} value={role.id} className="space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
              {(!authReady || isMarketLoading) ? (
                <div className="py-20 text-center flex flex-col items-center gap-4 opacity-50">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em]">Syncing Shared Database...</p>
                </div>
              ) : roleAgents.length > 0 ? (
                roleAgents.map((agent) => {
                  const isLeading = agent.highestBidderId === user?.uid;
                  
                  return (
                    <Card key={agent.id} className={cn(
                      "glass-card border-white/5 overflow-hidden group transition-all",
                      isLeading ? "border-green-500/40 bg-green-500/5 ring-1 ring-green-500/20" : "hover:border-primary/30"
                    )}>
                      <CardContent className="p-4">
                        <div className="flex items-center gap-4 mb-4">
                          <div className="w-12 h-12 rounded-xl overflow-hidden bg-secondary/50 border border-white/10 shrink-0">
                            <img src={agent.heroData?.image} alt="" className="w-full h-full object-cover" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="text-sm font-bold uppercase truncate text-white">{agent.heroData?.name}</h3>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge variant="outline" className="text-[7px] py-0 border-white/10 uppercase font-black">
                                {agent.heroData?.role}
                              </Badge>
                              {agent.highestBidderName && (
                                <span className={cn(
                                  "text-[7px] font-black uppercase tracking-tighter px-1 rounded-sm",
                                  isLeading ? "bg-green-500/20 text-green-400" : "bg-primary/20 text-primary"
                                )}>
                                  Top: {agent.highestBidderName}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-xl font-headline font-bold text-accent italic leading-none">
                              {agent.heroData?.overallRating}
                            </p>
                            <p className="text-[8px] font-black text-muted-foreground uppercase mt-1">OVR</p>
                          </div>
                        </div>
                        
                        <div className="flex items-center justify-between gap-4 pt-3 border-t border-white/5">
                          <div className="flex flex-col">
                            <p className="text-[8px] uppercase text-muted-foreground font-black tracking-widest">Global Bid</p>
                            <p className="text-sm font-headline font-bold text-primary">€{agent.currentBid?.toLocaleString()}</p>
                          </div>
                          <Button 
                            className={cn(
                              "h-10 font-black text-[10px] px-6 shadow-lg active:scale-95 transition-all",
                              isLeading ? "bg-green-600 hover:bg-green-700 text-white" : "hero-gradient shadow-primary/10"
                            )}
                            onClick={() => handleBid(agent)} 
                            disabled={!!isBidding || isLeading}
                          >
                            {isBidding === agent.id ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : isLeading ? (
                              <><ShoppingCart className="w-3 h-3 mr-2" /> LEADING</>
                            ) : (
                              <><Gavel className="w-3 h-3 mr-2" /> BID €{Math.ceil(agent.currentBid * 1.05).toLocaleString()}</>
                            )}
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })
              ) : (
                <div className="py-20 text-center opacity-30 border border-dashed border-white/10 rounded-2xl flex flex-col items-center gap-4">
                   <ShoppingCart className="w-12 h-12" />
                   <p className="text-[10px] uppercase font-black tracking-widest leading-relaxed px-10">Shared market is re-populating. Stand by...</p>
                </div>
              )}
            </TabsContent>
          );
        })}
      </Tabs>
    </div>
  );
}