
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUser, useFirestore, useCollection, useMemoFirebase, useDoc, addDocumentNonBlocking } from '@/firebase';
import { useGameState } from '@/app/lib/store';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { 
  ChevronLeft, ShoppingCart, Loader2, Gavel, ShieldCheck, Clock, AlertCircle, Users
} from 'lucide-react';
import { collection, query, doc, arrayUnion, updateDoc, serverTimestamp } from 'firebase/firestore';
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
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const marketQuery = useMemoFirebase(() => {
    if (!user?.uid) return null;
    return query(collection(db, 'market_v7'));
  }, [db, user?.uid]);

  const { data: allAgents, isLoading: isMarketLoading, error: marketError } = useCollection(marketQuery);

  const userRef = useMemoFirebase(() => (user?.uid ? doc(db, 'players_v10', user.uid) : null), [db, user?.uid]);
  const { data: profile } = useDoc(userRef);

  const youthAgents = (allAgents?.filter(a => a.heroData?.baseAge && Number(a.heroData.baseAge) < 18) || [])
    .filter(a => new Date(a.expiresAt).getTime() > now);

  const handleBid = async (agent: any) => {
    if (!user || !profile || isBidding) return;
    
    // Prevent bidding on own player
    if (agent.sellerId === user.uid) {
      toast({ 
        title: language === 'ru' ? "Нельзя ставить на себя" : "Cannot bid on yourself", 
        variant: "destructive" 
      });
      return;
    }
    
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
      const previousBidderId = agent.highestBidderId;
      const heroName = agent.heroData?.name || "Player";
      const agentRef = doc(db, 'market_v7', agent.id);
      
      await updateDoc(agentRef, {
        currentBid: Number(minNextBid),
        highestBidderId: String(user.uid),
        highestBidderName: profile.displayName || "Manager", 
        bidders: arrayUnion(user.uid),
        updatedAt: serverTimestamp()
      });
      
      addCredits(-minNextBid);

      // Send notification to previous bidder if they were outbid
      if (previousBidderId && previousBidderId !== user.uid) {
        const nowTime = new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
        const notifTitle = language === 'ru' ? "Ставка перебита!" : "Outbid!";
        const notifDesc = language === 'ru' 
          ? `Ставка на "${heroName}" перебита ${nowTime}`
          : `Bid on "${heroName}" was outbid ${nowTime}`;

        addDocumentNonBlocking(collection(db, 'notifications_v6'), {
          userId: previousBidderId,
          title: notifTitle,
          description: notifDesc,
          type: 'market',
          read: false,
          createdAt: new Date().toISOString()
        });
      }

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
          Access to the market data node was denied. Re-authentication sequence or session refresh required.
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
                  <div className="flex items-center justify-between mb-3">
                     <div className="flex items-center gap-1.5 text-accent">
                       <Clock className="w-3.5 h-3.5 animate-pulse" />
                       <span className="text-[10px] font-mono font-bold">Active</span>
                     </div>
                     <div className="flex gap-2">
                       {isOwner && <Badge className="bg-blue-600 text-white text-[7px] font-black uppercase px-2 h-4 border-none">{language === 'ru' ? 'Ваш лот' : 'Your Lot'}</Badge>}
                       {isLeading && <Badge className="bg-green-600 text-white text-[7px] font-black uppercase px-2 h-4 border-none">{language === 'ru' ? 'Вы лидируете' : 'Leading'}</Badge>}
                     </div>
                  </div>
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
                        isLeading ? "bg-green-600 text-white" : 
                        (isOwner ? "bg-secondary/50 text-muted-foreground border border-white/5" : "hero-gradient shadow-primary/20")
                      )}
                      onClick={() => handleBid(agent)} 
                      disabled={!!isBidding || isLeading || isOwner}
                    >
                      {isBidding === agent.id ? <Loader2 className="w-4 h-4 animate-spin" /> : 
                       (isOwner ? (language === 'ru' ? 'ВАШ ЮНИОР' : 'YOUR UNIT') : 
                       (isLeading ? 'LEADING' : <><Gavel className="w-4 h-4 mr-2" /> BID</>))}
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
