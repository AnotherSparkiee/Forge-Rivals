'use client';

import { useState, useEffect, useRef } from 'react';
import { useGameState } from '@/app/lib/store';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ChevronLeft, Loader2, Gavel, AlertCircle, RefreshCw, ShoppingCart, Users, ShieldCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { LoadingScreen } from '@/components/game/LoadingScreen';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useUser, useFirestore, useCollection, useMemoFirebase, updateDocumentNonBlocking, useDoc } from '@/firebase';
import { collection, query, doc, arrayUnion, serverTimestamp, where } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';
import { Progress } from '@/components/ui/progress';

export default function YouthTransfersPage() {
  const { language, isLoaded: isStoreLoaded, credits } = useGameState();
  const { user, isUserLoading } = useUser();
  const db = useFirestore();
  const { toast } = useToast();
  const router = useRouter();
  
  const [isBidding, setIsBidding] = useState<string | null>(null);
  const [isAuthStabilized, setIsAuthStabilized] = useState(false);
  const [syncProgress, setSyncProgress] = useState(0);

  useEffect(() => {
    if (!isUserLoading && user?.uid) {
      const interval = setInterval(() => {
        setSyncProgress(prev => Math.min(prev + 4, 100));
      }, 100);
      const timer = setTimeout(() => {
        setIsAuthStabilized(true);
        setSyncProgress(100);
        clearInterval(interval);
      }, 2500);
      return () => {
        clearTimeout(timer);
        clearInterval(interval);
      };
    }
  }, [isUserLoading, user?.uid]);

  const authReady = isAuthStabilized && !!user?.uid;

  const marketQuery = useMemoFirebase(() => {
    if (!authReady) return null;
    return query(collection(db, 'market_v2'), where('isYouth', '==', true));
  }, [db, authReady]);

  const { data: agents, isLoading: isMarketLoading, error: marketError } = useCollection(marketQuery);

  const userRef = useMemoFirebase(() => (authReady ? doc(db, 'players_v5', user!.uid) : null), [db, authReady, user?.uid]);
  const { data: profile } = useDoc(userRef);

  const handleBid = async (agent: any) => {
    if (!user || isBidding) return;
    
    const minNextBid = Math.ceil(agent.currentBid * 1.05);
    if (credits < minNextBid) {
      toast({ title: language === 'ru' ? "Недостаточно средств" : "Insufficient funds", variant: "destructive" });
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
      toast({ title: language === 'ru' ? "Ставка на юниора принята!" : "Youth Bid Placed!" });
    } finally {
      setIsBidding(null);
    }
  };

  if (isUserLoading || !isStoreLoaded) return <LoadingScreen />;

  const t = {
    title: language === 'ru' ? 'ТРАНСФЕРЫ ЮНИОРОВ' : 'YOUTH TRANSFERS',
    sync: language === 'ru' ? 'Синхронизация архива...' : 'Syncing Academy Archive...',
    empty: language === 'ru' ? 'На рынке юниоров пока пусто' : 'Youth market is currently empty',
    warning: language === 'ru' ? "Юниоры требуют развития. Оценивайте потенциал!" : "Juniors require training. Assess potential limits!"
  };

  if (marketError) return <div className="p-10 text-center uppercase font-black text-red-500">Access Error</div>;

  if (!authReady) {
    return (
      <div className="max-w-md mx-auto px-4 pt-40 text-center space-y-8">
        <Loader2 className="w-16 h-16 animate-spin mx-auto text-primary opacity-20" />
        <h3 className="text-sm font-headline font-bold uppercase tracking-[0.3em] text-primary">{t.sync}</h3>
        <Progress value={syncProgress} className="h-1 max-w-[200px] mx-auto" />
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto px-4 pt-8 pb-32">
      <header className="mb-6 flex items-center gap-4">
        <Link href="/youth-academy">
          <Button variant="ghost" size="icon" className="rounded-full">
            <ChevronLeft className="w-6 h-6" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-headline font-bold uppercase tracking-tighter text-white">{t.title}</h1>
          <p className="text-muted-foreground text-[10px] uppercase tracking-widest font-bold opacity-60">Scouting Rising Stars</p>
        </div>
      </header>

      <div className="p-3 bg-accent/5 border border-accent/20 rounded-xl mb-6 flex items-center gap-3">
        <Users className="w-4 h-4 text-accent shrink-0" />
        <p className="text-[9px] text-muted-foreground uppercase font-black leading-tight italic">{t.warning}</p>
      </div>

      <div className="space-y-3">
        {isMarketLoading ? (
          <div className="py-20 text-center"><Loader2 className="animate-spin mx-auto text-primary" /></div>
        ) : agents && agents.length > 0 ? (
          agents.map((agent) => (
            <Card key={agent.id} className={cn("glass-card border-white/5", agent.highestBidderId === user?.uid && "border-green-500/40 bg-green-500/5")}>
              <CardContent className="p-4">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-14 h-14 rounded-2xl overflow-hidden bg-secondary/50 border border-white/10 shrink-0 shadow-lg">
                    <img src={agent.heroData?.image} alt="" className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-base font-bold uppercase truncate text-white">{agent.heroData?.name}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline" className="text-[7px] py-0 border-white/10 uppercase font-black">{agent.heroData?.role}</Badge>
                      {agent.highestBidderName && <span className="text-[7px] font-black uppercase text-primary">TOP: {agent.highestBidderName}</span>}
                    </div>
                  </div>
                  <div className="text-right flex flex-col items-end">
                    <p className="text-2xl font-headline font-bold text-accent italic leading-none">{agent.heroData?.overallRating}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-4 pt-4 border-t border-white/5">
                  <div className="flex flex-col">
                    <p className="text-[8px] uppercase text-muted-foreground font-black">Current Bid</p>
                    <p className="text-lg font-headline font-bold text-primary">€{agent.currentBid?.toLocaleString()}</p>
                  </div>
                  <Button className="hero-gradient font-black text-[10px] px-6 h-10 rounded-xl" onClick={() => handleBid(agent)} disabled={!!isBidding || agent.highestBidderId === user?.uid}>
                    {isBidding === agent.id ? <Loader2 className="w-4 h-4 animate-spin" /> : agent.highestBidderId === user?.uid ? "LEADING" : `BID €${Math.ceil(agent.currentBid * 1.05).toLocaleString()}`}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <div className="py-20 text-center opacity-30 border border-dashed border-white/10 rounded-2xl flex flex-col items-center gap-4 p-10">
            <ShoppingCart className="w-10 h-10" />
            <p className="text-[10px] uppercase font-black text-center">{t.empty}</p>
          </div>
        )}
      </div>
    </div>
  );
}
