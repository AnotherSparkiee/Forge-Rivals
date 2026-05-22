'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useGameState } from '@/app/lib/store';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { 
  ChevronLeft, ShoppingCart, Loader2, Gavel, ShieldCheck, Clock, AlertCircle, Users
} from 'lucide-react';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, doc, arrayUnion, serverTimestamp, updateDoc } from 'firebase/firestore';
import { LoadingScreen } from '@/components/game/LoadingScreen';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

export default function YouthTransfersPage() {
  const { language, isLoaded: isStoreLoaded, credits, addCredits } = useGameState();
  const { user, isUserLoading } = useUser();
  const db = useFirestore();
  const router = useRouter();
  const { toast } = useToast();

  const [isBidding, setIsBidding] = useState<string | null>(null);

  // Global market stream: просто слушаем всю коллекцию без сложных фильтров для стабильности
  const marketQuery = useMemoFirebase(() => {
    if (!user?.uid) return null;
    return query(collection(db, 'market_v2'));
  }, [db, user?.uid]);

  const { data: allAgents, isLoading: isMarketLoading, error: marketError } = useCollection(marketQuery);

  // Фильтруем юниоров по возрасту на уровне клиента
  const youthAgents = allAgents?.filter(a => a.heroData?.baseAge < 18) || [];

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
      const agentRef = doc(db, 'market_v2', agent.id);
      await updateDoc(agentRef, {
        currentBid: minNextBid,
        highestBidderId: user.uid,
        highestBidderName: "Manager", // Упрощенное имя для прохождения валидации
        bidders: arrayUnion(user.uid),
        updatedAt: serverTimestamp()
      });
      
      addCredits(-minNextBid);

      toast({ 
        title: language === 'ru' ? "Ставка принята!" : "Bid Placed!",
        description: language === 'ru' ? "Вы теперь лидер торгов." : "You are now the leading bidder."
      });
    } catch (e: any) {
      console.error("Bid operation fail:", e);
      toast({ title: "Bid Failed", description: e.message, variant: "destructive" });
    } finally {
      setIsBidding(null);
    }
  };

  if (isUserLoading || !isStoreLoaded) return <LoadingScreen />;

  const t = {
    title: language === 'ru' ? 'ТРАНСФЕРЫ ЮНИОРОВ' : 'YOUTH TRANSFERS',
    subtitle: language === 'ru' ? 'Рынок молодых талантов' : 'Youth talent market',
    activeCount: language === 'ru' ? 'Активных лотов' : 'Active Lots'
  };

  if (marketError) {
    return (
      <div className="max-w-md mx-auto px-4 pt-20 text-center space-y-6">
        <AlertCircle className="w-12 h-12 text-red-500 mx-auto" />
        <h2 className="text-xl font-bold uppercase text-white">Market Archive Error</h2>
        <p className="text-[10px] text-muted-foreground uppercase px-10 font-black tracking-widest leading-relaxed">
          The market data node is currently unavailable. Ensure your operational clearance is active.
        </p>
        <Button onClick={() => window.location.reload()} variant="outline" className="h-12 border-white/10 uppercase text-[10px] font-black px-8">
          RE-SYNC TERMINAL
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto px-4 pt-8 pb-32">
      <header className="mb-6 flex items-center gap-4">
        <Button variant="ghost" size="icon" className="rounded-full" onClick={() => router.push('/youth-academy')}>
          <ChevronLeft className="w-6 h-6" />
        </Button>
        <div>
          <h1 className="text-2xl font-headline font-bold uppercase tracking-tighter text-primary flex items-center gap-2">
            <ShoppingCart className="w-6 h-6 text-primary" />
            {t.title}
          </h1>
          <p className="text-muted-foreground text-[10px] uppercase tracking-widest font-bold opacity-60">
            {isMarketLoading ? 'SYNCING...' : `${t.activeCount}: ${youthAgents.length}`}
          </p>
        </div>
      </header>

      <div className="space-y-3">
        {isMarketLoading ? (
          <div className="py-20 text-center flex flex-col items-center gap-4 opacity-50">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-[10px] font-bold uppercase tracking-[0.2em]">Establishing Link...</p>
          </div>
        ) : youthAgents.length > 0 ? (
          youthAgents.map((agent) => {
            const isLeading = agent.highestBidderId === user?.uid;
            const isOwner = agent.sellerId === user?.uid;

            return (
              <Card key={agent.id} className={cn(
                "glass-card border-white/5 overflow-hidden group transition-all",
                isLeading ? "border-green-500/40 bg-green-500/5 ring-1 ring-green-500/20" : "hover:border-primary/30",
                isOwner && "border-blue-500/30 bg-blue-500/5"
              )}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-14 h-14 rounded-2xl overflow-hidden bg-secondary/50 border border-white/10 shrink-0 shadow-lg">
                      <img src={agent.heroData?.image} alt="" className="w-full h-full object-cover" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-base font-bold uppercase truncate text-white tracking-tight">{agent.heroData?.name}</h3>
                      <div className="flex flex-wrap items-center gap-2 mt-1">
                        <Badge variant="outline" className="text-[7px] py-0 border-white/10 uppercase font-black">
                          {agent.heroData?.role}
                        </Badge>
                        <Badge className="bg-accent text-accent-foreground text-[7px] font-black uppercase">YOUTH</Badge>
                        {isOwner && <Badge className="bg-blue-500 text-white text-[7px] font-black uppercase">YOUR LOT</Badge>}
                      </div>
                    </div>
                    <div className="text-right flex flex-col items-end">
                      <p className="text-2xl font-headline font-bold text-accent italic leading-none">{agent.heroData?.overallRating}</p>
                      <p className="text-[8px] font-black text-muted-foreground uppercase mt-1 tracking-tighter">OVR</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between gap-4 pt-4 border-t border-white/5">
                    <div className="flex flex-col">
                      <p className="text-[8px] uppercase text-muted-foreground font-black tracking-widest">Current Bid</p>
                      <p className="text-lg font-headline font-bold text-primary tabular-nums">€{agent.currentBid?.toLocaleString()}</p>
                    </div>
                    <Button 
                      className={cn(
                        "h-11 font-black text-[10px] px-6 shadow-xl rounded-xl",
                        isLeading ? "bg-green-600 text-white" : "hero-gradient shadow-primary/20"
                      )}
                      onClick={() => handleBid(agent)} 
                      disabled={!!isBidding || isLeading || isOwner}
                    >
                      {isBidding === agent.id ? <Loader2 className="w-4 h-4 animate-spin" /> : isLeading ? 'LEADING' : <><Gavel className="w-4 h-4 mr-2" /> BID</>}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })
        ) : (
          <div className="py-20 text-center opacity-30 border border-dashed border-white/10 rounded-2xl flex flex-col items-center gap-4 p-10">
            <Users className="w-16 h-16 text-muted-foreground" />
            <p className="text-[10px] uppercase font-black tracking-widest text-center">Market is empty in this sector</p>
          </div>
        )}
      </div>
    </div>
  );
}