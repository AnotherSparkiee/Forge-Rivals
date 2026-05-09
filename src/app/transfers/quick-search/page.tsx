
'use client';

import { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useGameState } from '@/app/lib/store';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { 
  ChevronLeft, Search, Star, Globe, 
  UserPlus, Coins, Info, Zap, Clock, Loader2, Gavel, TrendingUp, AlertTriangle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { LoadingScreen } from '@/components/game/LoadingScreen';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { generateUniqueHero, Role } from '@/app/lib/moba-data';
import { useUser, useFirestore, useCollection, useMemoFirebase, updateDocumentNonBlocking, addDocumentNonBlocking } from '@/firebase';
import { collection, query, where, doc, getDocs, limit } from 'firebase/firestore';
import { getMoscowDateString, getMoscowTime } from '@/app/lib/time-utils';
import { useToast } from '@/hooks/use-toast';

export default function QuickSearchPage() {
  const { language, isLoaded, credits, addCredits } = useGameState();
  const { user, isUserLoading } = useUser();
  const db = useFirestore();
  const { toast } = useToast();
  const [isBidding, setIsBidding] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const today = getMoscowDateString();
  
  const marketQuery = useMemoFirebase(() => {
    return query(collection(db, 'market_v1'), where('dropDate', '==', today));
  }, [db, today]);

  const { data: agents, isLoading: isMarketLoading } = useCollection(marketQuery);

  // Initialize market if empty for today (Deterministic Client-Side Initialization)
  useEffect(() => {
    if (isLoaded && !isMarketLoading && (!agents || agents.length === 0)) {
      const initMarket = async () => {
        // Random but deterministic drop hour based on date (0 to 11)
        const dateSeed = today.split('-').reduce((acc, v) => acc + parseInt(v), 0);
        const dropHour = dateSeed % 12; 
        
        const mskNow = getMoscowTime();
        const dropTime = new Date(mskNow);
        dropTime.setHours(dropHour, 0, 0, 0);
        
        const expiryTime = new Date(dropTime);
        expiryTime.setHours(expiryTime.getHours() + 12);

        const roles: Role[] = ['Carry', 'Midlaner', 'Tank', 'Jungler', 'Support'];
        
        // Only the first one who sees the empty market for today will populate it
        // Firestore rules will handle the "one time" creation due to ID checks if needed, 
        // but for free agents we generate unique IDs per batch.
        roles.forEach(role => {
          for (let i = 0; i < 3; i++) {
            const hero = generateUniqueHero(role, i, false);
            const startPrice = (hero.overallRating * 15000) + 50000;
            
            const agentData = {
              id: `${today}_${role}_${i}`,
              heroData: JSON.parse(JSON.stringify(hero)),
              currentBid: startPrice,
              startingPrice: startPrice,
              highestBidderId: null,
              highestBidderName: null,
              expiresAt: expiryTime.toISOString(),
              dropDate: today,
              dropTime: dropTime.toISOString()
            };
            
            addDocumentNonBlocking(collection(db, 'market_v1'), agentData);
          }
        });
      };
      initMarket();
    }
  }, [isLoaded, isMarketLoading, agents, today, db]);

  const handleBid = async (agent: any) => {
    if (!user || isBidding) return;

    if (agent.highestBidderId === user.uid) {
      toast({ title: language === 'ru' ? "Вы уже лидер" : "You are leading", description: language === 'ru' ? "Дождитесь, пока кто-то перебьет вашу ставку." : "Wait for someone to outbid you.", variant: "destructive" });
      return;
    }

    const minNextBid = Math.ceil(agent.currentBid * 1.03);
    
    if (credits < minNextBid) {
      toast({ title: language === 'ru' ? "Недостаточно средств" : "Insufficient funds", variant: "destructive" });
      return;
    }

    setIsBidding(agent.id);
    try {
      const agentRef = doc(db, 'market_v1', agent.id);
      
      // Update bid - validation happens in security rules (+3% check)
      updateDocumentNonBlocking(agentRef, {
        currentBid: minNextBid,
        highestBidderId: user.uid,
        highestBidderName: user.displayName || "Manager"
      });

      toast({ 
        title: language === 'ru' ? "Ставка принята!" : "Bid Placed!", 
        description: `€ ${minNextBid.toLocaleString()}` 
      });
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

  if (!isLoaded || isMarketLoading) return <LoadingScreen />;

  const t = {
    title: language === 'ru' ? "СВОБОДНЫЕ АГЕНТЫ" : "FREE AGENTS",
    subtitle: language === 'ru' ? "Глобальный рынок талантов" : "Global talent marketplace",
    overall: language === 'ru' ? "ОБЩ" : "OVR",
    bid: language === 'ru' ? "СТАВКА" : "BID",
    minNext: language === 'ru' ? "Мин. след." : "Min Next",
    leader: language === 'ru' ? "Лидер" : "Leader",
    startsIn: language === 'ru' ? "Начало через" : "Starts in",
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
            <Gavel className="w-6 h-6 text-primary" />
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
          const upcomingAgents = agents?.filter(a => a.heroData.role === role.id && new Date(a.dropTime).getTime() > now) || [];

          return (
            <TabsContent key={role.id} value={role.id} className="space-y-3 mt-0 animate-in fade-in slide-in-from-bottom-2 duration-300">
              {roleAgents.length > 0 ? (
                roleAgents.map((agent) => {
                  const player = agent.heroData;
                  const isLeading = agent.highestBidderId === user?.uid;
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
                          <div className="relative">
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
                              <span className="text-[8px] font-bold text-muted-foreground uppercase flex items-center gap-1">
                                <Zap className="w-2.5 h-2.5 text-primary" /> {player.age} yrs
                              </span>
                              <div className="flex items-center gap-1 text-[8px] font-mono text-accent bg-accent/5 px-1.5 py-0.5 rounded border border-accent/10">
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
                            {agent.highestBidderName && (
                              <p className="text-[7px] text-accent font-bold uppercase mt-1 truncate">{t.leader}: {agent.highestBidderName}</p>
                            )}
                          </div>
                          <div className="bg-secondary/40 p-2.5 rounded-xl border border-white/5">
                            <p className="text-[7px] uppercase font-black text-muted-foreground flex items-center gap-1 mb-1">
                              <TrendingUp className="w-2.5 h-2.5" /> {t.minNext}
                            </p>
                            <p className="text-sm font-headline font-bold text-primary">€{minNext.toLocaleString()}</p>
                            <p className="text-[7px] text-muted-foreground font-bold uppercase mt-1">+3% Increment</p>
                          </div>
                        </div>

                        <Button 
                          className={cn(
                            "w-full h-11 font-black text-[10px] tracking-widest uppercase shadow-lg transition-all active:scale-95",
                            isLeading ? "bg-green-600 hover:bg-green-700" : "hero-gradient"
                          )}
                          onClick={() => handleBid(agent)}
                          disabled={!!isBidding || isClosed || isLeading}
                        >
                          {isBidding === agent.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Gavel className="w-4 h-4 mr-2" />}
                          {isClosed ? "AUCTION CLOSED" : (isLeading ? "YOUR BID IS HIGHEST" : "PLACE BID")}
                        </Button>
                      </CardContent>
                    </Card>
                  );
                })
              ) : upcomingAgents.length > 0 ? (
                <div className="py-20 text-center opacity-40">
                  <Clock className="w-12 h-12 mx-auto mb-4 text-muted-foreground animate-pulse" />
                  <p className="text-xs uppercase font-black tracking-widest leading-relaxed">
                    {t.noPlayers}
                  </p>
                </div>
              ) : (
                <div className="py-20 text-center opacity-30 flex flex-col items-center gap-4">
                  <AlertTriangle className="w-16 h-16" />
                  <p className="text-xs font-bold uppercase tracking-widest">{t.noPlayers}</p>
                </div>
              )}
            </TabsContent>
          );
        })}
      </Tabs>
    </div>
  );
}
