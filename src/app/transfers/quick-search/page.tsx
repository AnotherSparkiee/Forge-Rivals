'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useGameState } from '@/app/lib/store';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { 
  ChevronLeft, Info, Zap, Clock, Loader2, Gavel, TrendingUp, Coins
} from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { LoadingScreen } from '@/components/game/LoadingScreen';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { generateUniqueHero, Role } from '@/app/lib/moba-data';
import { useUser, useFirestore, useCollection, useMemoFirebase, updateDocumentNonBlocking, setDocumentNonBlocking, useDoc } from '@/firebase';
import { collection, query, where, doc, arrayUnion } from 'firebase/firestore';
import { getMoscowDateString, getMoscowTime } from '@/app/lib/time-utils';
import { useToast } from '@/hooks/use-toast';

export default function QuickSearchPage() {
  const { language, isLoaded, credits } = useGameState();
  const { user, isUserLoading } = useUser();
  const db = useFirestore();
  const { toast } = useToast();
  const [isBidding, setIsBidding] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const initTriggeredRef = useRef(false);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const today = getMoscowDateString();
  
  // Упрощенный запрос: только проверка на наличие user.uid
  const marketQuery = useMemoFirebase(() => {
    if (!user?.uid) return null;
    return query(collection(db, 'market_v2'));
  }, [db, user?.uid]);

  const { data: agents, isLoading: isMarketLoading } = useCollection(marketQuery);

  // Инициализация рынка при пустой коллекции
  useEffect(() => {
    if (user?.uid && !isMarketLoading && agents?.length === 0 && !initTriggeredRef.current) {
      initTriggeredRef.current = true;
      
      const mskNow = getMoscowTime();
      const dropTime = new Date(mskNow);
      dropTime.setHours(mskNow.getHours() - (mskNow.getHours() % 12), 0, 0, 0);
      const expiryTime = new Date(dropTime);
      expiryTime.setHours(expiryTime.getHours() + 12);

      const roles: Role[] = ['Carry', 'Midlaner', 'Tank', 'Jungler', 'Support'];
      
      roles.forEach(role => {
        for (let i = 0; i < 2; i++) {
          const hero = generateUniqueHero(role, i, false);
          const startPrice = (hero.overallRating * 15000) + 50000;
          const agentId = `sys_${today}_${role}_${i}`;
          
          setDocumentNonBlocking(doc(db, 'market_v2', agentId), {
            id: agentId,
            heroData: JSON.parse(JSON.stringify(hero)),
            currentBid: startPrice,
            startingPrice: startPrice,
            highestBidderId: null,
            highestBidderName: null,
            bidders: [],
            expiresAt: expiryTime.toISOString(),
            dropDate: today,
            dropTime: dropTime.toISOString(),
            sellerId: 'system',
            sellerName: 'League Agent'
          }, { merge: true });
        }
      });
    }
  }, [user?.uid, isMarketLoading, agents, today, db]);

  const handleBid = async (agent: any) => {
    if (!user || isBidding) return;
    const minNextBid = Math.ceil(agent.currentBid * 1.03);
    if (credits < minNextBid) {
      toast({ title: language === 'ru' ? "Недостаточно средств" : "Insufficient funds", variant: "destructive" });
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

  if (isUserLoading || !isLoaded) return <LoadingScreen />;

  const roles = [
    { id: 'Carry', label: language === 'ru' ? "Керри" : "Carry" },
    { id: 'Midlaner', label: language === 'ru' ? "Мидер" : "Midlaner" },
    { id: 'Tank', label: language === 'ru' ? "Оффлейнер" : "Offlaner" },
    { id: 'Jungler', label: language === 'ru' ? "Четверка" : "Support" },
    { id: 'Support', label: language === 'ru' ? "Пятерка" : "Full Support" },
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
          <h1 className="text-2xl font-headline font-bold uppercase tracking-tighter">{language === 'ru' ? 'БЫСТРЫЙ ПОИСК' : 'QUICK SEARCH'}</h1>
          <p className="text-muted-foreground text-[10px] uppercase tracking-widest">Minimal Terminal Mode</p>
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
          const roleAgents = agents?.filter(a => a.heroData.role === role.id) || [];
          return (
            <TabsContent key={role.id} value={role.id} className="space-y-3">
              {isMarketLoading ? (
                <div className="py-20 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" /></div>
              ) : roleAgents.length > 0 ? (
                roleAgents.map((agent) => (
                  <Card key={agent.id} className="glass-card border-white/5">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-4 mb-4">
                        <div className="w-12 h-12 rounded-xl overflow-hidden bg-secondary/50 border border-white/10 shrink-0">
                          <img src={agent.heroData.image} alt="" className="w-full h-full object-cover" />
                        </div>
                        <div className="flex-1">
                          <h3 className="text-sm font-bold uppercase truncate">{agent.heroData.name}</h3>
                          <p className="text-[10px] text-accent font-mono">{formatCountdown(agent.expiresAt)}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xl font-headline font-bold text-primary italic">{agent.heroData.overallRating}</p>
                        </div>
                      </div>
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex-1 bg-secondary/40 p-2 rounded-lg text-center border border-white/5">
                          <p className="text-[8px] uppercase text-muted-foreground">Price</p>
                          <p className="text-xs font-bold text-white">€{agent.currentBid.toLocaleString()}</p>
                        </div>
                        <Button className="flex-1 h-9 hero-gradient font-black text-[10px]" onClick={() => handleBid(agent)} disabled={!!isBidding || agent.highestBidderId === user?.uid}>
                          {agent.highestBidderId === user?.uid ? 'LEADING' : 'BID'}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))
              ) : (
                <div className="py-20 text-center opacity-30 text-xs uppercase font-black">No agents found</div>
              )}
            </TabsContent>
          );
        })}
      </Tabs>
    </div>
  );
}