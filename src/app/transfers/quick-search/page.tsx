
'use client';

import { useState, useEffect, useRef } from 'react';
import { useGameState } from '@/app/lib/store';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ChevronLeft, Loader2, Gavel, AlertCircle, RefreshCw, ShoppingCart, Users, ShieldCheck, Clock, Timer } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { LoadingScreen } from '@/components/game/LoadingScreen';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useUser, useFirestore, useCollection, useMemoFirebase, useDoc, addDocumentNonBlocking } from '@/firebase';
import { collection, query, doc, arrayUnion, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { generateUniqueHero } from '@/app/lib/moba-data';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';

export default function QuickSearchPage() {
  const { language, isLoaded: isStoreLoaded, credits, addCredits } = useGameState();
  const { user, isUserLoading } = useUser();
  const db = useFirestore();
  const { toast } = useToast();
  const router = useRouter();
  
  const [isBidding, setIsBidding] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const initTriggeredRef = useRef(false);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const marketQuery = useMemoFirebase(() => {
    if (!user?.uid) return null;
    return query(collection(db, 'market_v7'));
  }, [db, user?.uid]);

  const { data: agents, isLoading: isMarketLoading, error: marketError } = useCollection(marketQuery);

  const userRef = useMemoFirebase(() => (user?.uid ? doc(db, 'players_v10', user.uid) : null), [db, user?.uid]);
  const { data: profile } = useDoc(userRef);

  useEffect(() => {
    if (!isMarketLoading && agents && agents.length === 0 && !initTriggeredRef.current && !marketError && user?.uid) {
      initTriggeredRef.current = true;
      const initializeMarket = async () => {
        const roles = ['Carry', 'Midlaner', 'Tank', 'Jungler', 'Support'] as const;
        for (const role of roles) {
          for (let i = 1; i <= 2; i++) {
            const hero = generateUniqueHero(role, i, false);
            const agentId = `system_bot_${role.toLowerCase()}_${i}_${Date.now()}`;
            const startPrice = (hero.overallRating * 18000) + 300000;
            const expiry = new Date();
            expiry.setHours(expiry.getHours() + 24);

            await setDoc(doc(db, 'market_v7', agentId), {
              id: agentId, 
              heroData: JSON.parse(JSON.stringify(hero)), 
              currentBid: startPrice, 
              startingPrice: startPrice, 
              highestBidderId: null, 
              highestBidderName: null, 
              bidders: [], 
              expiresAt: expiry.toISOString(), 
              createdAt: serverTimestamp(), 
              isSystem: true, 
              isYouth: false,
              sellerId: 'system' 
            });
          }
        }
      };
      initializeMarket().catch(e => console.error("Market init failed", e));
    }
  }, [isMarketLoading, agents, user?.uid, db, marketError]);

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
        currentBid: minNextBid, 
        highestBidderId: user.uid, 
        highestBidderName: profile.displayName || "Unknown Manager", 
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
        title: language === 'ru' ? "Ставка принята!" : "Bid Confirmed!",
        description: language === 'ru' ? `Вы лидируете: ${minNextBid.toLocaleString()} €` : `You are leading: ${minNextBid.toLocaleString()} €`
      });
    } catch (e: any) {
      console.error("Bidding error:", e.message);
      toast({ variant: "destructive", title: "Action Failed", description: "Market node rejected the transmission." });
    } finally { 
      setIsBidding(null); 
    }
  };

  const getCountdown = (expiryIso: string) => {
    const expiry = new Date(expiryIso).getTime();
    const diff = expiry - now;
    if (diff <= 0) return "00:00:00";
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const s = Math.floor((diff % 60000) / 1000);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  if (isUserLoading || !isStoreLoaded) return <LoadingScreen />;

  const roleList = [ 
    { id: 'Carry', label: language === 'ru' ? "Керри" : "Carry" }, 
    { id: 'Midlaner', label: language === 'ru' ? "Мидер" : "Midlaner" }, 
    { id: 'Tank', label: language === 'ru' ? "Танк" : "Tank" }, 
    { id: 'Jungler', label: language === 'ru' ? "Лес" : "Jungler" }, 
    { id: 'Support', label: language === 'ru' ? "Саппорт" : "Support" } 
  ];

  return (
    <div className="max-w-md mx-auto px-4 pt-8 pb-32">
      <header className="mb-6 flex items-center gap-4">
        <Button variant="ghost" size="icon" className="rounded-full" onClick={() => router.push('/transfers')}><ChevronLeft className="w-6 h-6" /></Button>
        <div>
          <h1 className="text-2xl font-headline font-bold uppercase tracking-tighter text-white">{language === 'ru' ? 'БЫСТРЫЙ ПОИСК' : 'QUICK SEARCH'}</h1>
          <p className="text-muted-foreground text-[10px] uppercase tracking-widest font-bold opacity-60">{language === 'ru' ? 'Рынок активен' : 'Real-time Market Active'}</p>
        </div>
      </header>
      
      <Tabs defaultValue="Carry" className="w-full">
        <TabsList className="bg-secondary/30 border border-white/5 h-11 w-full flex mb-4 p-1 rounded-xl">
          {roleList.map((role) => ( 
            <TabsTrigger key={role.id} value={role.id} className="flex-1 text-[9px] font-black uppercase rounded-lg">
              {role.label}
            </TabsTrigger> 
          ))}
        </TabsList>
        
        {roleList.map((role) => {
          const roleAgents = (agents?.filter(a => a.heroData?.role === role.id && a.isYouth !== true) || [])
            .filter(a => new Date(a.expiresAt).getTime() > now);

          return (
            <TabsContent key={role.id} value={role.id} className="space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
              {isMarketLoading ? ( 
                <div className="py-20 text-center opacity-50"><Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" /></div> 
              ) : roleAgents.length > 0 ? (
                roleAgents.map((agent) => {
                  const isLeading = agent.highestBidderId === user?.uid;
                  const isOwner = agent.sellerId === user?.uid;
                  
                  return (
                    <Card key={agent.id} className={cn(
                      "glass-card border-white/5 overflow-hidden transition-all", 
                      isLeading && "border-green-500/40 bg-green-500/5",
                      isOwner && "border-primary/40 bg-primary/5"
                    )}>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between mb-3">
                           <div className="flex items-center gap-1.5 text-accent">
                             <Timer className="w-3.5 h-3.5 animate-pulse" />
                             <span className="text-[10px] font-mono font-bold tracking-tighter">{getCountdown(agent.expiresAt)}</span>
                           </div>
                           <div className="flex gap-2">
                             {isOwner && <Badge className="bg-primary text-primary-foreground text-[7px] font-black uppercase px-2 h-4 border-none">{language === 'ru' ? 'Ваш лот' : 'Your Lot'}</Badge>}
                             {isLeading && <Badge className="bg-green-600 text-white text-[7px] font-black uppercase px-2 h-4 border-none">{language === 'ru' ? 'Вы лидируете' : 'Leading'}</Badge>}
                           </div>
                        </div>

                        <div className="flex items-center gap-4 mb-4">
                          <div className="w-14 h-14 rounded-2xl overflow-hidden bg-secondary/50 border border-white/10 shrink-0 shadow-lg">
                            <img src={agent.heroData?.image} alt="" className="w-full h-full object-cover" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="text-base font-bold uppercase truncate text-white tracking-tight">{agent.heroData?.name}</h3>
                            <div className="flex flex-col gap-1 mt-1">
                              <Badge variant="outline" className="text-[7px] py-0 border-white/10 uppercase w-fit">{agent.heroData?.role}</Badge>
                              {agent.highestBidderName ? (
                                <div className="flex items-center gap-1">
                                  <span className="text-[7px] font-black uppercase text-muted-foreground">{language === 'ru' ? 'Лидер:' : 'Highest Bid:'}</span>
                                  <span className="text-[8px] font-black uppercase text-primary truncate max-w-[100px]">{agent.highestBidderName}</span>
                                </div>
                              ) : (
                                <span className="text-[7px] font-black uppercase text-muted-foreground/40 italic">{language === 'ru' ? 'Ставок нету' : 'No bids yet'}</span>
                              )}
                            </div>
                          </div>
                          <div className="text-right flex flex-col items-end">
                            <p className="text-2xl font-headline font-bold text-accent italic leading-none">{agent.heroData?.overallRating}</p>
                            <p className="text-[8px] font-black text-muted-foreground uppercase mt-1">OVR</p>
                          </div>
                        </div>
                        
                        <div className="flex items-center justify-between gap-4 pt-4 border-t border-white/5">
                          <div className="flex flex-col">
                            <p className="text-[8px] uppercase text-muted-foreground font-black tracking-widest">{language === 'ru' ? 'Цена' : 'Price'}</p>
                            <p className="text-lg font-headline font-bold text-primary">€{agent.currentBid?.toLocaleString()}</p>
                          </div>
                          <Button 
                            className={cn(
                              "h-11 font-black text-[10px] px-5 rounded-xl uppercase tracking-widest", 
                              isLeading ? "bg-green-600/20 text-green-400 border border-green-500/30" : 
                              (isOwner ? "bg-secondary/50 text-muted-foreground border border-white/5" : "hero-gradient shadow-lg shadow-primary/20")
                            )} 
                            onClick={() => handleBid(agent)} 
                            disabled={!!isBidding || isLeading || isOwner}
                          >
                            {isBidding === agent.id ? <Loader2 className="w-4 h-4 animate-spin" /> : (
                              isOwner ? <><ShieldCheck className="w-4 h-4 mr-2" /> {language === 'ru' ? 'ВАШ ГЕРОЙ' : 'YOUR UNIT'}</> : (
                                isLeading ? <><ShieldCheck className="w-4 h-4 mr-2" /> {language === 'ru' ? 'ЛИДИРУЕТЕ' : 'LEADING'}</> : (
                                  language === 'ru' ? 'СДЕЛАТЬ СТАВКУ' : 'MAKE A BID'
                                )
                              )
                            )}
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })
              ) : ( 
                <div className="py-20 text-center opacity-30 border border-dashed border-white/10 rounded-2xl flex flex-col items-center gap-4 p-10">
                  <ShoppingCart className="w-12 h-12" />
                  <p className="text-[10px] uppercase font-black">{language === 'ru' ? 'Нет активных лотов' : 'No active listings'}</p>
                </div> 
              )}
            </TabsContent>
          );
        })}
      </Tabs>
    </div>
  );
}
