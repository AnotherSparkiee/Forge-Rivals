
'use client';

import { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useGameState } from '@/app/lib/store';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { 
  ChevronLeft, Package, Clock, Loader2, Gavel, TrendingUp, AlertTriangle, Search
} from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { LoadingScreen } from '@/components/game/LoadingScreen';
import { useUser, useFirestore, useCollection, useMemoFirebase, updateDocumentNonBlocking, useDoc } from '@/firebase';
import { collection, query, where, doc, arrayUnion } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';

export default function MyBidsPage() {
  const { language, isLoaded, credits } = useGameState();
  const { user, isUserLoading } = useUser();
  const db = useFirestore();
  const { toast } = useToast();
  
  const [isBidding, setIsBidding] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());

  const userRef = useMemoFirebase(() => user ? doc(db, 'players_v5', user.uid) : null, [db, user]);
  const { data: profile, isLoading: isProfileLoading } = useDoc(userRef);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const marketQuery = useMemoFirebase(() => {
    // CRITICAL: Block query until fully authorized
    if (!isLoaded || isUserLoading || isProfileLoading || !user?.uid || !profile) return null;
    return query(collection(db, 'market_v1'), where('bidders', 'array-contains', user.uid));
  }, [db, user?.uid, isUserLoading, isProfileLoading, isLoaded, !!profile]);

  const { data: agents, isLoading: isMarketLoading } = useCollection(marketQuery);

  const handleBid = async (agent: any) => {
    if (!user || !profile || isBidding) return;

    if (agent.highestBidderId === user.uid) {
      toast({ 
        title: language === 'ru' ? "Вы уже лидер" : "You are leading", 
        variant: "destructive" 
      });
      return;
    }

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
      updateDocumentNonBlocking(doc(db, 'market_v1', agent.id), {
        currentBid: minNextBid,
        highestBidderId: user.uid,
        highestBidderName: profile.displayName || "Manager",
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

  if (!isLoaded || isUserLoading || isProfileLoading) return <LoadingScreen />;

  const t = {
    title: language === 'ru' ? "МОИ ПОКУПКИ" : "MY BIDS",
    subtitle: language === 'ru' ? "Список ваших активных торгов" : "Active auction participations",
    overall: language === 'ru' ? "ОБЩ" : "OVR",
    bid: language === 'ru' ? "СТАВКА" : "BID",
    noResults: language === 'ru' ? "Вы еще не делали ставок" : "No active bids found",
    leader: language === 'ru' ? "ВЫ ЛИДЕР" : "YOU ARE LEADING",
    outbid: language === 'ru' ? "СТАВКА ПЕРЕБИТА" : "OUTBID",
    findPlayers: language === 'ru' ? "Найти игроков" : "Find Players"
  };

  return (
    <div className="max-w-md mx-auto px-4 pt-8 pb-32">
      <header className="mb-6 flex items-center gap-4">
        <Link href="/transfers">
          <Button variant="ghost" size="icon" className="rounded-full">
            <ChevronLeft className="w-6 h-6" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-headline font-bold uppercase tracking-tighter flex items-center gap-2">
            <Package className="w-6 h-6 text-primary" />
            {t.title}
          </h1>
          <p className="text-muted-foreground text-[10px] uppercase tracking-widest">{t.subtitle}</p>
        </div>
      </header>

      <div className="space-y-3">
        {isMarketLoading ? (
          <div className="py-20 text-center opacity-50">
            <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
          </div>
        ) : agents && agents.length > 0 ? (
          agents.map((agent) => {
            const player = agent.heroData;
            const isLeading = agent.highestBidderId === user?.uid;
            const minNext = Math.ceil(agent.currentBid * 1.03);
            const isClosed = now >= new Date(agent.expiresAt).getTime();

            return (
              <Card key={agent.id} className={cn(
                "glass-card border-white/5 overflow-hidden transition-all",
                isLeading ? "border-green-500/30 bg-green-500/5" : "border-red-500/30 bg-red-500/5",
                isClosed && "opacity-50 grayscale"
              )}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-16 h-16 rounded-xl overflow-hidden bg-secondary/50 border border-white/10 shadow-lg">
                      <img src={player.image} alt={player.name} className="w-full h-full object-cover" />
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-bold uppercase truncate">{player.name}</h3>
                        <Badge className={cn(
                          "text-[7px] h-3 px-1 uppercase font-black",
                          isLeading ? "bg-green-500 text-white" : "bg-red-500 text-white"
                        )}>
                          {isLeading ? t.leader : t.outbid}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline" className="text-[7px] h-3 py-0 border-white/10 opacity-60 uppercase">{player.role}</Badge>
                        <div className="flex items-center gap-1 text-[8px] font-mono text-accent">
                          <Clock className="w-2.5 h-2.5" />
                          {formatCountdown(agent.expiresAt)}
                        </div>
                      </div>
                    </div>

                    <div className="text-right border-l border-white/5 pl-4">
                      <p className="text-[7px] font-black text-primary uppercase tracking-tighter mb-0.5">{t.overall}</p>
                      <p className="text-2xl font-headline font-bold text-primary italic leading-none">{player.overallRating}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <div className="bg-secondary/40 p-2.5 rounded-xl border border-white/5">
                      <p className="text-[7px] uppercase font-black text-muted-foreground flex items-center gap-1 mb-1">
                        <Gavel className="w-2.5 h-2.5" /> {t.bid}
                      </p>
                      <p className="text-sm font-headline font-bold text-white">€{agent.currentBid.toLocaleString()}</p>
                    </div>
                    <div className="bg-secondary/40 p-2.5 rounded-xl border border-white/5">
                      <p className="text-[7px] uppercase font-black text-muted-foreground flex items-center gap-1 mb-1">
                        <TrendingUp className="w-2.5 h-2.5" /> Next Min
                      </p>
                      <p className="text-sm font-headline font-bold text-primary">€{minNext.toLocaleString()}</p>
                    </div>
                  </div>

                  {!isLeading && !isClosed && (
                    <Button 
                      className="w-full h-11 hero-gradient font-black text-[10px] tracking-widest uppercase shadow-lg transition-all active:scale-95"
                      onClick={() => handleBid(agent)}
                      disabled={!!isBidding}
                    >
                      {isBidding === agent.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Gavel className="w-4 h-4 mr-2" />}
                      RE-BID (€{minNext.toLocaleString()})
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })
        ) : (
          <div className="py-20 text-center opacity-30 flex flex-col items-center gap-4">
            <AlertTriangle className="w-16 h-16" />
            <p className="text-xs font-bold uppercase tracking-widest">{t.noResults}</p>
            <Link href="/transfers/quick-search">
              <Button variant="outline" className="text-[8px] font-black uppercase border-white/10">
                <Search className="w-3 h-3 mr-2" /> {t.findPlayers}
              </Button>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
