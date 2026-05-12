'use client';

import { useState } from 'react';
import { useGameState } from '@/app/lib/store';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ChevronLeft, Loader2, Gavel, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { LoadingScreen } from '@/components/game/LoadingScreen';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useUser, useFirestore, useCollection, useMemoFirebase, updateDocumentNonBlocking } from '@/firebase';
import { collection, query, doc, arrayUnion } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';

export default function QuickSearchPage() {
  const { language, isLoaded: isStoreLoaded, credits } = useGameState();
  const { user, isUserLoading } = useUser();
  const db = useFirestore();
  const { toast } = useToast();
  const [isBidding, setIsBidding] = useState<string | null>(null);

  const marketQuery = useMemoFirebase(() => {
    // CRITICAL: Prevent query until Auth is fully resolved
    if (isUserLoading || !user?.uid) return null;
    return query(collection(db, 'market_v2'));
  }, [db, user?.uid, isUserLoading]);

  const { data: agents, isLoading: isMarketLoading, error: marketError } = useCollection(marketQuery);

  const handleBid = async (agent: any) => {
    if (!user || isBidding) return;
    const minNextBid = Math.ceil(agent.currentBid * 1.03);
    
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
        highestBidderName: user.displayName || "Manager",
        bidders: arrayUnion(user.uid)
      });
      toast({ title: language === 'ru' ? "Ставка принята!" : "Bid Placed!" });
    } finally {
      setIsBidding(null);
    }
  };

  if (marketError) {
    return (
      <div className="max-w-md mx-auto px-4 pt-20 text-center space-y-4">
        <AlertCircle className="w-12 h-12 text-red-500 mx-auto" />
        <h2 className="text-xl font-bold uppercase tracking-tighter">Access Denied</h2>
        <p className="text-xs text-muted-foreground uppercase">The database is currently restricted. Please re-authenticate.</p>
        <Button onClick={() => window.location.reload()} variant="outline" className="border-white/10 uppercase text-[10px] font-bold">Retry Terminal Connection</Button>
      </div>
    );
  }

  if (isUserLoading || !isStoreLoaded) return <LoadingScreen />;

  const roles = [
    { id: 'Carry', label: language === 'ru' ? "Керри" : "Carry" },
    { id: 'Midlaner', label: language === 'ru' ? "Мидер" : "Midlaner" },
    { id: 'Tank', label: language === 'ru' ? "Танк" : "Tank" },
    { id: 'Jungler', label: language === 'ru' ? "Лес" : "Jungler" },
    { id: 'Support', label: language === 'ru' ? "Саппорт" : "Support" },
  ];

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
            {language === 'ru' ? 'БЫСТРЫЙ ПОИСК' : 'QUICK SEARCH'}
          </h1>
          <p className="text-muted-foreground text-[10px] uppercase tracking-widest">
            {isMarketLoading ? 'Synchronizing Archive...' : 'Global Market Node: Active'}
          </p>
        </div>
      </header>

      <Tabs defaultValue="Carry" className="w-full">
        <TabsList className="bg-secondary/30 border border-white/5 h-11 w-full flex mb-4">
          {roles.map((role) => (
            <TabsTrigger key={role.id} value={role.id} className="flex-1 text-[9px] font-black uppercase">
              {role.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {roles.map((role) => {
          const roleAgents = agents?.filter(a => a.heroData?.role === role.id) || [];
          
          return (
            <TabsContent key={role.id} value={role.id} className="space-y-3">
              {isMarketLoading ? (
                <div className="py-20 text-center flex flex-col items-center gap-4 opacity-50">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                  <p className="text-[10px] font-bold uppercase tracking-widest">Accessing Node...</p>
                </div>
              ) : roleAgents.length > 0 ? (
                roleAgents.map((agent) => (
                  <Card key={agent.id} className="glass-card border-white/5 overflow-hidden">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-4 mb-4">
                        <div className="w-12 h-12 rounded-xl overflow-hidden bg-secondary/50 border border-white/10 shrink-0">
                          <img src={agent.heroData?.image} alt="" className="w-full h-full object-cover" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="text-sm font-bold uppercase truncate">{agent.heroData?.name}</h3>
                          <Badge variant="outline" className="text-[7px] py-0 border-white/10 uppercase mt-1">
                            {agent.heroData?.role}
                          </Badge>
                        </div>
                        <div className="text-right">
                          <p className="text-xl font-headline font-bold text-primary italic leading-none">
                            {agent.heroData?.overallRating}
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex items-center justify-between gap-4 pt-3 border-t border-white/5">
                        <div className="flex flex-col">
                          <p className="text-[8px] uppercase text-muted-foreground font-black">Current Bid</p>
                          <p className="text-sm font-headline font-bold text-white">€{agent.currentBid?.toLocaleString()}</p>
                        </div>
                        <Button 
                          className="h-10 hero-gradient font-black text-[10px] px-6" 
                          onClick={() => handleBid(agent)} 
                          disabled={!!isBidding || agent.highestBidderId === user?.uid}
                        >
                          {isBidding === agent.id ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : agent.highestBidderId === user?.uid ? (
                            'LEADING'
                          ) : (
                            <><Gavel className="w-3 h-3 mr-2" /> BID</>
                          )}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))
              ) : (
                <div className="py-20 text-center opacity-30 border border-dashed border-white/10 rounded-2xl">
                  <p className="text-[10px] uppercase font-black">No active agents in this sector</p>
                </div>
              )}
            </TabsContent>
          );
        })}
      </Tabs>
    </div>
  );
}