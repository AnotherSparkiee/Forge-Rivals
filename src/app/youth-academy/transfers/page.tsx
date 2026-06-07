
'use client';

import { useState, useEffect, useRef, memo } from 'react';
import { useGameState } from '@/app/lib/store';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { 
  ChevronLeft, Loader2, Gavel, ShieldCheck, 
  Timer, Star, ShoppingCart, X, Check 
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { LoadingScreen } from '@/components/game/LoadingScreen';
import { Slider } from '@/components/ui/slider';
import { useUser, useFirestore, useCollection, useMemoFirebase, useDoc } from '@/firebase';
import { collection, query, doc, arrayUnion, serverTimestamp, updateDoc } from 'firebase/firestore';
import { addDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';
import { calculateLiveAge } from '@/app/lib/time-utils';

// Isolated Card Component to prevent full-list re-renders on slider move
const YouthTransferCard = memo(({ 
  agent, 
  user, 
  profile, 
  onBid, 
  now,
  language 
}: { 
  agent: any, 
  user: any, 
  profile: any, 
  onBid: (agent: any, amount: number) => Promise<void>,
  now: number,
  language: string
}) => {
  const [isConfiguring, setIsConfiguring] = useState(false);
  const [bidPercent, setBidPercent] = useState(5);
  const [isProcessing, setIsProcessing] = useState(false);

  const isLeading = agent.highestBidderId === user?.uid;
  const isOwner = agent.sellerId === user?.uid;
  const nextBidValue = Math.ceil(agent.currentBid * (1 + bidPercent / 100));
  const liveAge = calculateLiveAge(agent.heroData.baseAge, agent.heroData.hiredAt);
  const avgTalent = Object.values(agent.heroData.proTalents || {}).reduce((a: any, b: any) => a + b, 0) as number / 10;

  const rolesRu: Record<string, string> = {
    'Carry': 'Керри',
    'Midlaner': 'Мидер',
    'Tank': 'Танк',
    'Jungler': 'Лес',
    'Support': 'Саппорт'
  };

  const getCountdown = (expiryIso: string) => {
    const diff = new Date(expiryIso).getTime() - now;
    if (diff <= 0) return "00:00:00";
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const s = Math.floor((diff % 60000) / 1000);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const renderStars = (rating: number) => (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => {
        const fill = Math.min(Math.max(rating - i, 0), 1);
        return (
          <div key={i} className="relative w-2 h-2">
            <Star className="absolute inset-0 w-2 h-2 text-muted-foreground/20" />
            <div className="absolute inset-0 overflow-hidden" style={{ width: `${fill * 100}%` }}>
              <Star className="w-2 h-2 text-yellow-500 fill-yellow-500" />
            </div>
          </div>
        );
      })}
    </div>
  );

  return (
    <Card className={cn(
      "glass-card border-white/5 overflow-hidden transition-all", 
      isLeading && "border-green-500/40 bg-green-500/5",
      isOwner && "border-blue-500/40 bg-blue-500/5"
    )}>
      <CardContent className="p-3">
        <div className="flex items-center justify-between mb-2">
           <div className="flex items-center gap-1.5 text-accent">
             <Timer className="w-3 h-3 animate-pulse" />
             <span className="text-[9px] font-mono font-bold tracking-tighter">{getCountdown(agent.expiresAt)}</span>
           </div>
           <div className="flex gap-1.5">
             {isOwner && <Badge className="bg-blue-600 text-white text-[6px] font-black uppercase px-1.5 h-3.5 border-none">{language === 'ru' ? 'ВАШ ЮНИОР' : 'YOUR LOT'}</Badge>}
             {isLeading && <Badge className="bg-green-600 text-white text-[6px] font-black uppercase px-1.5 h-3.5 border-none">{language === 'ru' ? 'ВЫ ЛИДИРУЕТЕ' : 'LEADING'}</Badge>}
           </div>
        </div>

        <div className="flex items-center gap-3 mb-3">
          <div className="w-20 h-20 rounded-xl overflow-hidden bg-secondary/30 border border-white/5 shrink-0 relative">
            <img src={agent.heroData?.image} alt="" className="w-full h-full object-cover" />
            <div className="absolute top-1 left-1 bg-black/60 rounded px-1 py-0.5 border border-white/10 backdrop-blur-sm">
              <span className="text-[10px]">{agent.heroData.country?.flag}</span>
            </div>
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-sm font-bold uppercase truncate text-white tracking-tight leading-tight">{agent.heroData?.name}</h3>
              <Badge variant="outline" className="text-[7px] h-3.5 py-0 border-white/10 uppercase font-black text-accent/80">
                {rolesRu[agent.heroData.role] || agent.heroData.role}
              </Badge>
            </div>
            
            <div className="grid grid-cols-2 gap-2 mt-2">
               <div className="flex flex-col bg-white/5 p-1.5 rounded-lg border border-white/5">
                 <p className="text-[7px] font-black text-muted-foreground uppercase leading-none mb-1">{language === 'ru' ? 'ТАЛАНТ' : 'TALENT'}</p>
                 {renderStars(avgTalent)}
               </div>
               <div className="flex flex-col bg-white/5 p-1.5 rounded-lg border border-white/5">
                 <p className="text-[7px] font-black text-muted-foreground uppercase leading-none mb-1">{language === 'ru' ? 'ВОЗРАСТ' : 'AGE'}</p>
                 <p className="text-[10px] font-bold text-white leading-none mt-0.5">{liveAge.display}</p>
               </div>
            </div>
          </div>
          
          <div className="text-right flex flex-col items-end shrink-0 justify-center pr-1">
            <p className="text-2xl font-headline font-bold text-accent italic leading-none">{agent.heroData?.overallRating}</p>
            <p className="text-[8px] font-black text-muted-foreground uppercase mt-0.5">OVR</p>
          </div>
        </div>

        {isConfiguring && !isOwner && !isLeading && (
          <div className="bg-secondary/20 p-3 rounded-xl border border-white/10 space-y-3 mb-3 animate-in slide-in-from-top-1">
            <div className="flex justify-between items-center px-1">
              <span className="text-[9px] font-black uppercase text-muted-foreground flex items-center gap-1.5">
                <Gavel className="w-2.5 h-2.5 text-primary" /> {language === 'ru' ? 'НОВАЯ СТАВКА' : 'NEW BID'}
              </span>
              <span className="text-xs font-headline font-bold text-primary italic">€ {nextBidValue.toLocaleString()}</span>
            </div>
            <Slider
              value={[bidPercent]}
              onValueChange={(val) => setBidPercent(val[0])}
              min={3}
              max={300}
              step={1}
              className="py-1"
            />
          </div>
        )}
        
        <div className="flex items-center justify-between gap-4 pt-3 border-t border-white/5">
          <div className="flex flex-col">
            <p className="text-[7px] uppercase text-muted-foreground font-black tracking-widest leading-none mb-1">{language === 'ru' ? 'ЦЕНА' : 'PRICE'}</p>
            <p className="text-base font-headline font-bold text-white">€{agent.currentBid?.toLocaleString()}</p>
          </div>
          
          <div className="flex gap-1.5">
            {isConfiguring ? (
              <>
                <Button variant="outline" size="icon" className="h-10 w-10 rounded-lg border-white/10" onClick={() => setIsConfiguring(false)}>
                  <X className="w-4 h-4 text-muted-foreground" />
                </Button>
                <Button 
                  className="h-10 font-black text-[9px] px-4 rounded-lg uppercase tracking-widest hero-gradient"
                  onClick={async () => {
                    setIsProcessing(true);
                    await onBid(agent, nextBidValue);
                    setIsProcessing(false);
                    setIsConfiguring(false);
                  }}
                  disabled={isProcessing}
                >
                  {isProcessing ? <Loader2 className="w-3 h-3 animate-spin" /> : (language === 'ru' ? 'ПОДТВЕРДИТЬ' : 'CONFIRM')}
                </Button>
              </>
            ) : (
              <Button 
                className={cn(
                  "h-10 font-black text-[9px] px-5 rounded-lg uppercase tracking-widest transition-all", 
                  isLeading ? "bg-green-600/20 text-green-400 border border-green-500/30" : 
                  (isOwner ? "bg-secondary/50 text-muted-foreground border border-white/5" : "hero-gradient shadow-lg shadow-primary/20")
                )} 
                onClick={() => !isLeading && !isOwner && setIsConfiguring(true)} 
                disabled={isLeading || isOwner}
              >
                {isOwner ? (language === 'ru' ? 'ВАШ ЮНИОР' : 'YOUR UNIT') : (
                  isLeading ? <><ShieldCheck className="w-3 h-3 mr-2" /> {language === 'ru' ? 'ЛИДИРУЕТЕ' : 'LEADING'}</> : (
                    <>{language === 'ru' ? 'ПОСТАВИТЬ' : 'PLACE BID'}</>
                  )
                )}
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
});

YouthTransferCard.displayName = 'YouthTransferCard';

export default function YouthTransfersPage() {
  const { language, isLoaded: isStoreLoaded, credits, addCredits } = useGameState();
  const { user, isUserLoading } = useUser();
  const db = useFirestore();
  const router = useRouter();
  const { toast } = useToast();

  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const marketQuery = useMemoFirebase(() => {
    if (!user?.uid) return null;
    return query(collection(db, 'market_v7'));
  }, [db, user?.uid]);

  const { data: allAgents, isLoading: isMarketLoading } = useCollection(marketQuery);
  const { data: profile } = useDoc(user?.uid ? doc(db, 'players_v10', user.uid) : null);

  const youthAgents = (allAgents?.filter(a => a.heroData?.baseAge && Number(a.heroData.baseAge) < 18) || [])
    .filter(a => new Date(a.expiresAt).getTime() > now);

  const handleGlobalBid = async (agent: any, amount: number) => {
    if (!user || !profile) return;
    if (credits < amount) { 
      toast({ title: language === 'ru' ? "Недостаточно средств" : "Insufficient funds", variant: "destructive" }); 
      return; 
    }
    try {
      const prevBidder = agent.highestBidderId;
      const heroName = agent.heroData?.name || "Player";
      await updateDoc(doc(db, 'market_v7', agent.id), { 
        currentBid: amount, highestBidderId: user.uid, highestBidderName: profile.displayName || "Unknown Manager", 
        bidders: arrayUnion(user.uid), updatedAt: serverTimestamp() 
      });
      addCredits(-amount);
      if (prevBidder && prevBidder !== user.uid) {
        addDocumentNonBlocking(collection(db, 'notifications_v6'), {
          userId: prevBidder, title: language === 'ru' ? "Ставка перебита!" : "Outbid!",
          description: language === 'ru' ? `Ставка на "${heroName}" перебита ${new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}` : `Bid on "${heroName}" outbid ${new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}`,
          type: 'market', read: false, createdAt: new Date().toISOString()
        });
      }
      toast({ title: language === 'ru' ? "Ставка принята!" : "Bid Placed!" });
    } catch (e) {
      toast({ title: "Error placing bid", variant: "destructive" });
    }
  };

  if (isUserLoading || !isStoreLoaded) return <LoadingScreen />;

  return (
    <div className="max-w-md mx-auto px-4 pt-8 pb-32">
      <header className="mb-6 flex items-center gap-4">
        <Button variant="ghost" size="icon" className="rounded-full" onClick={() => router.push('/youth-academy')}><ChevronLeft className="w-6 h-6" /></Button>
        <div>
          <h1 className="text-2xl font-headline font-bold uppercase tracking-tighter text-primary flex items-center gap-2">
            <ShoppingCart className="w-6 h-6 text-primary" />
            {language === 'ru' ? 'ТРАНСФЕРЫ ЮНИОРОВ' : 'YOUTH TRANSFERS'}
          </h1>
          <p className="text-muted-foreground text-[10px] uppercase tracking-widest font-bold opacity-60">
            Academy Market Stream
          </p>
        </div>
      </header>

      <div className="space-y-2">
        {isMarketLoading ? (
          <div className="py-20 text-center flex flex-col items-center gap-4 opacity-50"><Loader2 className="w-8 h-8 animate-spin text-primary" /><p className="text-[10px] uppercase font-bold tracking-[0.2em]">Syncing Records...</p></div>
        ) : youthAgents.length > 0 ? (
          youthAgents.map((agent) => (
            <YouthTransferCard 
              key={agent.id} 
              agent={agent} 
              user={user} 
              profile={profile} 
              onBid={handleGlobalBid}
              now={now}
              language={language}
            />
          ))
        ) : (
          <div className="py-20 text-center opacity-30 border border-dashed border-white/10 rounded-2xl flex flex-col items-center gap-4 p-10">
            <ShoppingCart className="w-12 h-12" />
            <p className="text-[10px] uppercase font-black">{language === 'ru' ? 'Нет молодежных лотов' : 'No youth listings'}</p>
          </div>
        )}
      </div>
    </div>
  );
}
