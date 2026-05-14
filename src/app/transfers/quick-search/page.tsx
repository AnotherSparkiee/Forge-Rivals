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

  // CRITICAL: 3.5s stabilization delay to ensure Firebase Token is fully synchronized with Firestore backend
  // This is essential to prevent "Missing or insufficient permissions" on initial load
  useEffect(() => {
    if (!isUserLoading && user?.uid) {
      const timer = setTimeout(() => setIsAuthStabilized(true), 3500);
      return () => clearTimeout(timer);
    } else {
      setIsAuthStabilized(false);
    }
  }, [isUserLoading, user?.uid]);

  const authReady = isAuthStabilized && !!user?.uid;

  // We only define the query once auth is ready to prevent immediate "anonymous" request failures
  const marketQuery = useMemoFirebase(() => {
    if (!authReady) return null;
    return query(collection(db, 'market_v2'));
  }, [db, authReady]);

  const { data: agents, isLoading: isMarketLoading, error: marketError } = useCollection(marketQuery);

  const userRef = useMemoFirebase(() => (authReady ? doc(db, 'players_v5', user!.uid) : null), [db, authReady, user?.uid]);
  const { data: profile } = useDoc(userRef);

  // SHARED GLOBAL MARKET INITIALIZATION
  // Everyone sees the SAME agents based on fixed versioned keys
  useEffect(() => {
    if (authReady && !isMarketLoading && agents && agents.length === 0 && !initTriggeredRef.current && !marketError) {
      initTriggeredRef.current = true;
      
      const roles = ['Carry', 'Midlaner', 'Tank', 'Jungler', 'Support'] as const;
      const VERSION = 15; // Increment to force global refresh
      
      roles.forEach((role) => {
        for (let i = 1; i <= 3; i++) {
          const hero = generateUniqueHero(role, i, false);
          // Fixed global IDs ensure parity across all clients
          const agentId = `shared_lot_${role.toLowerCase()}_${i}_v${VERSION}`;
          const startPrice = (hero.overallRating * 12000) + 100000;
          
          setDocumentNonBlocking(doc(db, 'market_v2', agentId), {
            id: agentId,
            heroData: JSON.parse(JSON.stringify(hero)),
            currentBid: startPrice,
            startingPrice: startPrice,
            highestBidderId: null,
            highestBidderName: null,
            bidders: [],
            expiresAt: new Date(Date.now() + 86400000 * 7).toISOString(),
            createdAt: serverTimestamp(),
            marketVersion: VERSION
          }, { merge: true });
        }
      });
    }
  }, [isMarketLoading, agents, authReady, db, marketError]);

  const handleBid = async (agent: any) => {
    if (!user || isBidding) return;
    
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
        description: language === 'ru' ? "Вы теперь лидер торгов." : "You are now the leading bidder."
      });
    } finally {
      setIsBidding(null);
    }
  };

  if (isUserLoading || !isStoreLoaded) return <LoadingScreen />;

  const t = {
    title: language === 'ru' ? 'БЫСТРЫЙ ПОИСК' : 'QUICK SEARCH',
    sync: language === 'ru' ? 'Синхронизация с узлом рынка...' : 'Establishing Secure Link...',
    warning: language === 'ru' 
      ? "Внимание: этот список един для всей лиги. Вы боретесь за одних и тех же игроков!"
      : "Warning: this list is shared globally. You are competing for the same elite talent!",
    reconnect: language === 'ru' ? 'ПЕРЕПОДКЛЮЧИТЬСЯ' : 'RE-SYNC TERMINAL',
    errorDesc: language === 'ru' 
      ? 'Связь с рынком ограничена. Проверьте статус авторизации.' 
      : 'Access to the global market node was restricted. Secure authentication sync required.'
  };

  if (marketError) {
    return (
      <div className="max-w-md mx-auto px-4 pt-20 text-center space-y-6">
        <AlertCircle className="w-12 h-12 text-red-500 mx-auto" />
        <h2 className="text-xl font-bold uppercase text-white">Market Sync Restricted</h2>
        <p className="text-[10px] text-muted-foreground uppercase px-10 font-black tracking-widest leading-relaxed">
          {t.errorDesc}
        </p>
        <Button onClick={() => window.location.reload()} variant="outline" className="h-12 border-white/10 uppercase text-[10px] font-black px-8">
          <RefreshCw className="w-3 h-3 mr-2" /> {t.reconnect}
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
          <h1 className="text-2xl font-headline font-bold uppercase tracking-tighter text-white">{t.title}</h1>
          <p className="text-muted-foreground text-[10px] uppercase tracking-widest font-bold opacity-60">
            {(!authReady || isMarketLoading) ? t.sync : 'Global Shared Market Active'}
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
            {t.warning}
          </p>
        </div>

        {roleList.map((role) => {
          const roleAgents = agents?.filter(a => a.heroData?.role === role.id) || [];
          
          return (
            <TabsContent key={role.id} value={role.id} className="space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
              {(!authReady || isMarketLoading) ? (
                <div className="py-20 text-center flex flex-col items-center gap-4 opacity-50">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em]">Synchronizing Archive...</p>
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
                            <p className="text-xl font-headline font-bold text-accent italic leading-none">{agent.heroData?.overallRating}</p>
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