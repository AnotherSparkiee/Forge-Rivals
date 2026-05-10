
'use client';

import { useState, useMemo, useEffect } from 'react';
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

  const userRef = useMemoFirebase(() => user ? doc(db, 'players_v5', user.uid) : null, [db, user]);
  const { data: profile, isLoading: isProfileLoading } = useDoc(userRef);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const today = getMoscowDateString();
  
  // КРИТИЧЕСКИЙ ФИКС: Блокируем запрос до полной готовности Auth и Profile
  const marketQuery = useMemoFirebase(() => {
    if (!isLoaded || isUserLoading || isProfileLoading || !user?.uid || !profile) return null;
    return query(collection(db, 'market_v2'), where('dropDate', '==', today));
  }, [db, today, user?.uid, isUserLoading, isProfileLoading, isLoaded, !!profile]);

  const { data: agents, isLoading: isMarketLoading } = useCollection(marketQuery);

  // Инициализация системного рынка
  useEffect(() => {
    if (isLoaded && !isUserLoading && !isProfileLoading && user?.uid && profile && isMarketLoading === false && Array.isArray(agents) && agents.length === 0) {
      const initMarket = async () => {
        const mskNow = getMoscowTime();
        const dropTime = new Date(mskNow);
        dropTime.setHours(mskNow.getHours() - (mskNow.getHours() % 12), 0, 0, 0);
        
        const expiryTime = new Date(dropTime);
        expiryTime.setHours(expiryTime.getHours() + 12);

        const roles: Role[] = ['Carry', 'Midlaner', 'Tank', 'Jungler', 'Support'];
        
        roles.forEach(role => {
          for (let i = 0; i < 3; i++) {
            const hero = generateUniqueHero(role, i, false);
            const startPrice = (hero.overallRating * 15000) + 50000;
            const agentId = `bot_${today}_${role}_${i}`;
            
            const agentData = {
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
            };
            
            setDocumentNonBlocking(doc(db, 'market_v2', agentId), agentData, { merge: true });
          }
        });
      };
      initMarket();
    }
  }, [isLoaded, isUserLoading, isProfileLoading, user?.uid, profile, isMarketLoading, agents, today, db]);

  const handleBid = async (agent: any) => {
    if (!user || !profile || isBidding) return;

    if (agent.highestBidderId === user.uid) {
      toast({ title: language === 'ru' ? "Вы уже лидер" : "You are leading", variant: "destructive" });
      return;
    }

    if (agent.sellerId === user.uid) {
      toast({ title: language === 'ru' ? "Это ваш игрок" : "You are the seller", variant: "destructive" });
      return;
    }

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
        highestBidderName: profile.displayName || "Manager",
        bidders: arrayUnion(user.uid)
      });
      toast({ title: language === 'ru' ? "Ставка принята!" : "Bid Placed!", description: `€ ${minNextBid.toLocaleString()}` });
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
    title: language === 'ru' ? "СВОБОДНЫЕ АГЕНТЫ" : "FREE AGENTS",
    subtitle: language === 'ru' ? "Глобальный рынок талантов" : "Global talent marketplace",
    overall: language === 'ru' ? "ОБЩ" : "OVR",
    bid: language === 'ru' ? "СТАВКА" : "BID",
    noPlayers: language === 'ru' ? "Кандидаты появятся позже" : "Candidates appearing soon",
    roles: [
      { id: 'Carry', label: language === 'ru' ? "Керри" : "Carry" },
      { id: 'Midlaner', label: language === 'ru' ? "Мидер" : "Midlaner" },
      { id: 'Tank', label: language === 'ru' ? "Оффлейнер" : "Offlaner" },
      { id: 'Jungler', label: language === 'ru' ? "Четверка" : "Support" },
      { id: 'Support', label: language === 'ru' ? "Пятерка" : "Full Support" },
    ]
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
            <Zap className="w-6 h-6 text-primary" />
            {t.title}
          </h1>
          <p className="text-muted-foreground text-[10px] uppercase tracking-widest">{t.subtitle}</p>
        </div>
      </header>

      <div className="mb-6">
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="p-4 flex gap-3">
            <Info className="w-5 h-5 text-primary shrink-0" />
            <div className="text-[10px] text-muted-foreground leading-relaxed italic">
              {language === 'ru' 
                ? "Агенты доступны ровно 12 часов. Каждая ставка увеличивает цену на 3%. Победитель забирает игрока по окончании таймера."
                : "Agents available for 12 hours. Each bid increases price by 3%. Highest bidder signs the player when the timer ends."}
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="Carry" className="w-full">
        <div className="overflow-x-auto pb-2 mb-4 scrollbar-hide">
          <TabsList className="bg-secondary/30 border border-white/5 h-11 w-max flex p-1">
            {t.roles.map((role) => (
              <TabsTrigger 
                key={role.id} 
                value={role.id}
                className="text-[9px] font-black uppercase px-4 h-full data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
              >
                {role.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        {t.roles.map((role) => {
          const roleAgents = agents?.filter(a => a.heroData.role === role.id && new Date(a.dropTime).getTime() <= now) || [];

          return (
            <TabsContent key={role.id} value={role.id} className="space-y-3 mt-0">
              {isMarketLoading ? (
                <div className="py-20 text-center opacity-50">
                  <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
                </div>
              ) : roleAgents.length > 0 ? (
                roleAgents.map((agent) => {
                  const player = agent.heroData;
                  const isLeading = agent.highestBidderId === user?.uid;
                  const isSeller = agent.sellerId === user?.uid;
                  const minNext = Math.ceil(agent.currentBid * 1.03);
                  const isClosed = now >= new Date(agent.expiresAt).getTime();

                  return (
                    <Card key={agent.id} className={cn(
                      "glass-card border-white/5 overflow-hidden transition-all",
                      isLeading && "border-green-500/30 bg-green-500/5",
                      isClosed && "opacity-50 grayscale"
                    )}>
                      <CardContent className="p-4">
                        <div className="flex items-center gap-4 mb-4">
                          <div className="relative shrink-0">
                            <div className="w-16 h-16 rounded-xl overflow-hidden bg-secondary/50 border border-white/10 shadow-lg">
                              <img src={player.image} alt={player.name} className="w-full h-full object-cover" />
                            </div>
                            <div className="absolute -bottom-1 -right-1 bg-background rounded-md px-1 border border-white/10 text-[10px]">
                              {player.country.flag}
                            </div>
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <h3 className="text-sm font-bold uppercase truncate">{player.name}</h3>
                              {isLeading && <Badge className="bg-green-500 text-white text-[7px] h-3 px-1 uppercase font-black">LEADER</Badge>}
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
                              <Coins className="w-2.5 h-2.5" /> {t.bid}
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

                        <Button 
                          className={cn(
                            "w-full h-11 font-black text-[10px] tracking-widest uppercase shadow-lg transition-all",
                            isLeading ? "bg-green-600 hover:bg-green-700" : "hero-gradient"
                          )}
                          onClick={() => handleBid(agent)}
                          disabled={!!isBidding || isClosed || isLeading || isSeller}
                        >
                          {isBidding === agent.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Gavel className="w-4 h-4 mr-2" />}
                          {isClosed ? "CLOSED" : (isLeading ? "HIGHEST BIDDER" : "PLACE BID")}
                        </Button>
                      </CardContent>
                    </Card>
                  );
                })
              ) : (
                <div className="py-20 text-center opacity-40">
                  <Clock className="w-12 h-12 mx-auto mb-4 text-muted-foreground animate-pulse" />
                  <p className="text-xs uppercase font-black tracking-widest leading-relaxed">
                    {t.noPlayers}
                  </p>
                </div>
              )}
            </TabsContent>
          );
        })}
      </Tabs>
    </div>
  );
}
