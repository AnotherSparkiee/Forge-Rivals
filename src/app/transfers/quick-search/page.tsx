'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useGameState } from '@/app/lib/store';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { 
  ChevronLeft, Loader2, Gavel
} from 'lucide-react';
import { cn } from '@/lib/utils';
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
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Блокируем запрос, пока Auth и Store не будут готовы на 100%
  const marketQuery = useMemoFirebase(() => {
    if (!user?.uid || !isStoreLoaded) return null;
    return query(collection(db, 'market_v2'));
  }, [db, user?.uid, isStoreLoaded]);

  const { data: agents, isLoading: isMarketLoading } = useCollection(marketQuery);

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

  const formatCountdown = (expiryIso: string) => {
    const diff = new Date(expiryIso).getTime() - now;
    if (diff <= 0) return "CLOSED";
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const s = Math.floor((diff % 60000) / 1000);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

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
            {isMarketLoading ? 'Syncing Market...' : 'Market Online'}
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
                <div className="py-20 text-center">
                  <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
                  <p className="text-[10px] uppercase font-bold mt-4 opacity-50">Accessing Satellite Data...</p>
                </div>
              ) : roleAgents.length > 0 ? (
                roleAgents.map((agent) => (
                  <Card key={agent.id} className="glass-card border-white/5 overflow-hidden border-primary/10">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-4 mb-4">
                        <div className="w-12 h-12 rounded-xl overflow-hidden bg-secondary/50 border border-white/10 shrink-0">
                          <img src={agent.heroData.image} alt="" className="w-full h-full object-cover" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="text-sm font-bold uppercase truncate">{agent.heroData.name}</h3>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="outline" className="text-[7px] py-0 border-white/10 uppercase opacity-60">
                              {agent.heroData.role}
                            </Badge>
                            <span className="text-[10px] text-accent font-mono font-bold">
                              {formatCountdown(agent.expiresAt)}
                            </span>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-xl font-headline font-bold text-primary italic leading-none">
                            {agent.heroData.overallRating}
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex items-center justify-between gap-4 pt-3 border-t border-white/5">
                        <div className="flex flex-col">
                          <p className="text-[8px] uppercase text-muted-foreground font-black tracking-widest">Current Bid</p>
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
                  <p className="text-[10px] uppercase font-black tracking-widest">No agents currently listed</p>
                </div>
              )}
            </TabsContent>
          );
        })}
      </Tabs>
    </div>
  );
}