'use client';

import { useState, useEffect, useRef } from 'react';
import { useGameState } from '@/app/lib/store';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ChevronLeft, Loader2, Gavel, AlertCircle, RefreshCw, ShoppingCart } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { LoadingScreen } from '@/components/game/LoadingScreen';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useUser, useFirestore, useCollection, useMemoFirebase, updateDocumentNonBlocking, useDoc, setDocumentNonBlocking } from '@/firebase';
import { collection, query, doc, arrayUnion } from 'firebase/firestore';
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
  const initTriggeredRef = useRef(false);

  // Ждем, пока пользователь полностью загрузится
  const authReady = !isUserLoading && !!user?.uid;

  const marketQuery = useMemoFirebase(() => {
    if (!authReady) return null;
    // Запрос всей коллекции для метода list
    return query(collection(db, 'market_v2'));
  }, [db, authReady]);

  const { data: agents, isLoading: isMarketLoading, error: marketError } = useCollection(marketQuery);

  const userRef = useMemoFirebase(() => (authReady ? doc(db, 'players_v5', user!.uid) : null), [db, authReady, user?.uid]);
  const { data: profile } = useDoc(userRef);

  // Авто-инициализация рынка при его отсутствии (версия v7)
  useEffect(() => {
    if (authReady && !isMarketLoading && agents && agents.length === 0 && !initTriggeredRef.current && !marketError) {
      initTriggeredRef.current = true;
      const roles = ['Carry', 'Midlaner', 'Tank', 'Jungler', 'Support'] as const;
      roles.forEach((role, i) => {
        const hero = generateUniqueHero(role, i, false);
        const agentId = `sys_agent_${role.toLowerCase()}_${i}_v7`;
        const startPrice = (hero.overallRating * 10000) + 50000;
        
        setDocumentNonBlocking(doc(db, 'market_v2', agentId), {
          id: agentId,
          heroData: JSON.parse(JSON.stringify(hero)),
          currentBid: startPrice,
          startingPrice: startPrice,
          highestBidderId: null,
          highestBidderName: null,
          bidders: [],
          expiresAt: new Date(Date.now() + 86400000).toISOString(),
          version: 7
        }, { merge: true });
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
        highestBidderName: profile?.displayName || "Manager",
        bidders: arrayUnion(user.uid)
      });
      toast({ title: language === 'ru' ? "Ставка принята!" : "Bid Placed!" });
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
        <h2 className="text-xl font-bold uppercase text-white">Market Link Restricted</h2>
        <p className="text-[10px] text-muted-foreground uppercase px-10 font-black tracking-widest leading-relaxed">
          {language === 'ru' 
            ? 'Связь с базой данных трансферов ограничена. Пожалуйста, убедитесь, что ваш профиль полностью синхронизирован.' 
            : 'Access to the transfer archive node was restricted. Secure authentication sync required.'}
        </p>
        <Button onClick={() => window.location.reload()} variant="outline" className="h-12 border-white/10 uppercase text-[10px] font-black tracking-widest px-8">
          <RefreshCw className="w-3 h-3 mr-2" /> {language === 'ru' ? 'СИНХРОНИЗИРОВАТЬ' : 'RE-SYNC'}
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
            {(!authReady || isMarketLoading) ? 'Establishing Secure Link...' : 'Operational Node Online'}
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

        {roleList.map((role) => {
          const roleAgents = agents?.filter(a => a.heroData?.role === role.id) || [];
          
          return (
            <TabsContent key={role.id} value={role.id} className="space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
              {(!authReady || isMarketLoading) ? (
                <div className="py-20 text-center flex flex-col items-center gap-4 opacity-50">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em]">Syncing Records...</p>
                </div>
              ) : roleAgents.length > 0 ? (
                roleAgents.map((agent) => (
                  <Card key={agent.id} className="glass-card border-white/5 overflow-hidden group hover:border-primary/30 transition-all">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-4 mb-4">
                        <div className="w-12 h-12 rounded-xl overflow-hidden bg-secondary/50 border border-white/10 shrink-0">
                          <img src={agent.heroData?.image} alt="" className="w-full h-full object-cover" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="text-sm font-bold uppercase truncate text-white">{agent.heroData?.name}</h3>
                          <Badge variant="outline" className="text-[7px] py-0 border-white/10 uppercase mt-1 font-black">
                            {agent.heroData?.role}
                          </Badge>
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
                          <p className="text-[8px] uppercase text-muted-foreground font-black tracking-widest">Active Bid</p>
                          <p className="text-sm font-headline font-bold text-primary">€{agent.currentBid?.toLocaleString()}</p>
                        </div>
                        <Button 
                          className="h-10 hero-gradient font-black text-[10px] px-6 shadow-lg shadow-primary/10 active:scale-95 transition-transform" 
                          onClick={() => handleBid(agent)} 
                          disabled={!!isBidding || agent.highestBidderId === user?.uid}
                        >
                          {isBidding === agent.id ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : agent.highestBidderId === user?.uid ? (
                            'LEADING'
                          ) : (
                            <><Gavel className="w-3 h-3 mr-2" /> PLACE BID</>
                          )}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))
              ) : (
                <div className="py-20 text-center opacity-30 border border-dashed border-white/10 rounded-2xl flex flex-col items-center gap-4">
                   <ShoppingCart className="w-12 h-12" />
                   <p className="text-[10px] uppercase font-black tracking-widest leading-relaxed px-10">No active operational listings in this sector.</p>
                </div>
              )}
            </TabsContent>
          );
        })}
      </Tabs>
    </div>
  );
}