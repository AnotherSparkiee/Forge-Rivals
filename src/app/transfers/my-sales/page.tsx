
'use client';

import { useState, useEffect } from 'react';
import { useGameState } from '@/app/lib/store';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { 
  ChevronLeft, Coins, Clock, Loader2, Gavel, User, AlertTriangle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { LoadingScreen } from '@/components/game/LoadingScreen';
import { useUser, useFirestore, useCollection, useMemoFirebase, useDoc } from '@/firebase';
import { collection, query, where, doc } from 'firebase/firestore';

export default function MySalesPage() {
  const { language, isLoaded } = useGameState();
  const { user, isUserLoading } = useUser();
  const db = useFirestore();
  const [now, setNow] = useState(Date.now());

  const userRef = useMemoFirebase(() => user ? doc(db, 'players_v5', user.uid) : null, [db, user]);
  const { data: profile, isLoading: isProfileLoading } = useDoc(userRef);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  // КРИТИЧЕСКИЙ ФИКС: Блокируем запрос до полной готовности
  const marketQuery = useMemoFirebase(() => {
    if (!isLoaded || isUserLoading || isProfileLoading || !user?.uid || !profile) return null;
    return query(collection(db, 'market_v2'), where('sellerId', '==', user.uid));
  }, [db, user?.uid, isUserLoading, isProfileLoading, isLoaded, !!profile]);

  const { data: agents, isLoading: isMarketLoading } = useCollection(marketQuery);

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
    title: language === 'ru' ? "МОИ ПРОДАЖИ" : "MY SALES",
    subtitle: language === 'ru' ? "Ваши игроки на аукционе" : "Your players currently on market",
    overall: language === 'ru' ? "ОБЩ" : "OVR",
    currentBid: language === 'ru' ? "ТЕКУЩАЯ СТАВКА" : "CURRENT BID",
    leader: language === 'ru' ? "ЛИДЕР" : "LEADER",
    noSales: language === 'ru' ? "Нет активных продаж" : "No active sales found",
    noBidder: language === 'ru' ? "Нет ставок" : "No bids yet"
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
            <Coins className="w-6 h-6 text-primary" />
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
            const isClosed = now >= new Date(agent.expiresAt).getTime();

            return (
              <Card key={agent.id} className={cn(
                "glass-card border-white/5 overflow-hidden transition-all",
                isClosed && "opacity-50 grayscale"
              )}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-16 h-16 rounded-xl overflow-hidden bg-secondary/50 border border-white/10 shadow-lg shrink-0">
                      <img src={player.image} alt={player.name} className="w-full h-full object-cover" />
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-bold uppercase truncate">{player.name}</h3>
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

                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-secondary/40 p-2.5 rounded-xl border border-white/5">
                      <p className="text-[7px] uppercase font-black text-muted-foreground flex items-center gap-1 mb-1">
                        <Gavel className="w-2.5 h-2.5" /> {t.currentBid}
                      </p>
                      <p className="text-sm font-headline font-bold text-white">€{agent.currentBid.toLocaleString()}</p>
                    </div>
                    <div className="bg-secondary/40 p-2.5 rounded-xl border border-white/5">
                      <p className="text-[7px] uppercase font-black text-muted-foreground flex items-center gap-1 mb-1">
                        <User className="w-2.5 h-2.5" /> {t.leader}
                      </p>
                      <p className="text-[10px] font-bold text-primary truncate">
                        {agent.highestBidderName || t.noBidder}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        ) : (
          <div className="py-20 text-center opacity-30 flex flex-col items-center gap-4">
            <AlertTriangle className="w-16 h-16" />
            <p className="text-xs font-bold uppercase tracking-widest">{t.noSales}</p>
            <p className="text-[10px] text-muted-foreground max-w-[200px] text-center">
              {language === 'ru' ? "Вы можете выставить игрока на трансфер из раздела Ростер -> Контракты" : "You can put a player on transfer from Roster -> Contracts"}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
