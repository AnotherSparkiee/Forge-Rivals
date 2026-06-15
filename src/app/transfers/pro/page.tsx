
'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useGameState } from '@/app/lib/store';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { 
  ChevronLeft, Loader2, Star, ShoppingCart, 
  Crown, Zap, Award, Target, Trophy, Info, Users
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { LoadingScreen } from '@/components/game/LoadingScreen';
import { useUser, useFirestore, useCollection, useMemoFirebase, useDoc } from '@/firebase';
import { collection, query, doc, arrayUnion, serverTimestamp, setDoc, getDoc, updateDoc, getDocs, deleteDoc, where } from 'firebase/firestore';
import { addDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { useToast } from '@/hooks/use-toast';
import { generateVtuneHero } from '@/app/lib/moba-data';
import { getMoscowTime, getMoscowDateString } from '@/app/lib/time-utils';
import { TransferHeroCard } from '../quick-search/page';
import Link from 'next/link';

export default function ProTransfersPage() {
  const { language, isLoaded: isStoreLoaded, credits, crystals, addCredits, addCrystals } = useGameState();
  const { user, isUserLoading } = useUser();
  const db = useFirestore();
  const { toast } = useToast();
  
  const [now, setNow] = useState(Date.now());
  const initTriggeredRef = useRef(false);

  useEffect(() => {
    const timer = setInterval(() => setNow(getMoscowTime().getTime()), 1000);
    return () => clearInterval(timer);
  }, []);

  const marketQuery = useMemoFirebase(() => {
    if (!user?.uid) return null;
    return query(collection(db, 'market_v7'));
  }, [db, user?.uid]);

  const { data: agents, isLoading: isMarketLoading } = useCollection(marketQuery);
  const userDocRef = useMemoFirebase(() => user?.uid ? doc(db, 'players_v10', user.uid) : null, [db, user?.uid]);
  const { data: profile } = useDoc(userDocRef);

  useEffect(() => {
    if (isMarketLoading || !user?.uid || !isStoreLoaded) return;

    const checkAndDropLegends = async () => {
      const today = getMoscowDateString();
      const vtuneId = `sys_vtune_v900_final_standard_${today}`;
      const vtuneRef = doc(db, 'market_v7', vtuneId);
      const vtuneSnap = await getDoc(vtuneRef);

      // CRITICAL: CLEANUP ALL PREVIOUS SYSTEM VERSIONS
      try {
        const q = query(collection(db, 'market_v7'), where('isSystem', '==', true));
        const allSystemSnap = await getDocs(q);
        for (const d of allSystemSnap.docs) {
          if (d.id !== vtuneId) {
            await deleteDoc(d.ref);
            console.log(`[Cleanup] Deleted legacy system agent: ${d.id}`);
          }
        }
      } catch (e) {
        console.error("Cleanup failed", e);
      }

      if (!vtuneSnap.exists()) {
        const hero = generateVtuneHero(today);
        const mskNow = getMoscowTime();
        
        const expiry = new Date(mskNow);
        expiry.setDate(expiry.getDate() + 2);
        expiry.setHours(23, 59, 59, 999);

        await setDoc(vtuneRef, {
          id: vtuneId,
          heroData: JSON.parse(JSON.stringify(hero)),
          currentBid: 2000,
          startingPrice: 2000,
          highestBidderId: null,
          highestBidderName: null,
          bidders: [],
          expiresAt: expiry.toISOString(),
          dropDate: today,
          createdAt: serverTimestamp(),
          isSystem: true,
          isPro: true,
          currency: 'crystals',
          sellerId: 'system'
        });
        console.log(`[Market] New V-Tune v900 listed for ${today}`);
      }
    };

    if (!initTriggeredRef.current) {
      initTriggeredRef.current = true;
      checkAndDropLegends().catch(e => console.error("Legend drop failed", e));
    }
  }, [isMarketLoading, user?.uid, isStoreLoaded, db]);

  const handleGlobalBid = useCallback(async (agent: any, amount: number) => {
    if (!user || !profile) return;
    
    const currency = agent.currency || 'credits';
    const balance = currency === 'crystals' ? crystals : credits;

    if (balance < amount) { 
      toast({ title: language === 'ru' ? "Недостаточно ресурсов" : "Insufficient resources", variant: "destructive" }); 
      return; 
    }

    try {
      const prevBidder = agent.highestBidderId;
      const heroName = agent.heroData?.name || "Player";
      
      const mskNow = getMoscowTime().getTime();
      const expiryTime = new Date(agent.expiresAt).getTime();
      const timeLeft = expiryTime - mskNow;
      let finalExpiresAt = agent.expiresAt;
      
      if (timeLeft < 600000) { 
        finalExpiresAt = new Date(mskNow + 600000).toISOString(); 
      }

      await updateDoc(doc(db, 'market_v7', agent.id), { 
        currentBid: amount, highestBidderId: user.uid, highestBidderName: profile.displayName || "Unknown Manager", 
        bidders: arrayUnion(user.uid), updatedAt: serverTimestamp(),
        expiresAt: finalExpiresAt
      });

      if (currency === 'crystals') {
        addCrystals(-amount);
      } else {
        addCredits(-amount);
      }

      if (prevBidder && prevBidder !== user.uid) {
        addDocumentNonBlocking(collection(db, 'notifications_v7'), {
          userId: prevBidder, title: language === 'ru' ? "Ставка перебита!" : "Outbid!",
          description: language === 'ru' ? `Ставка на PRO-игрока "${heroName}" перебита!` : `Bid on PRO unit "${heroName}" outbid!`,
          type: 'market', read: false, createdAt: new Date().toISOString()
        });
      }
      
      toast({ title: language === 'ru' ? "Ставка принята!" : "Elite Bid Confirmed!" });
    } catch (e) {
      toast({ title: "Ошибка при ставке", variant: "destructive" });
    }
  }, [user, profile, credits, crystals, language, toast, db, addCredits, addCrystals]);

  const proAgents = useMemo(() => {
    if (!agents) return [];
    
    return agents.filter(a => {
      // ONLY SHOW V900 AND HIDE OTHERS
      if (a.isSystem && !a.id.includes('v900')) return false;
      if (!a.isPro || new Date(a.expiresAt).getTime() <= now) return false;
      return true;
    }).sort((a, b) => new Date(a.expiresAt).getTime() - new Date(b.expiresAt).getTime());
  }, [agents, now]);

  const t = {
    title: language === 'ru' ? 'ЭЛИТНЫЕ ПРОФИ' : 'PRO MARKET',
    subtitle: language === 'ru' ? 'РЫНОК ЛЕГЕНДАРНЫХ АТЛЕТОВ' : 'Elite Strategic Assets',
    benefits: language === 'ru' ? 'ПРЕИМУЩЕСТВА PRO-СТАТУСА' : 'PRO UNIT ADVANTAGES',
    talent: language === 'ru' ? 'Запредельный талант (до 100 единиц)' : 'Extreme Talent (Up to 100 units)',
    tactics: language === 'ru' ? 'Тактическая точность в важных моментах' : 'Tactical Precision (Clutch moments)',
    status: language === 'ru' ? 'Высокий статус (Буст посещаемости)' : 'High Media Status (Attendance boost)',
    noUnits: language === 'ru' ? 'Все легенды законтрактованы' : 'All elite assets commissioned'
  };

  if (isUserLoading || !isStoreLoaded || isMarketLoading) return <LoadingScreen />;

  return (
    <div className="max-w-md mx-auto px-4 pt-8 pb-32">
      <header className="mb-6 flex items-center gap-4">
        <Link href="/transfers">
          <Button variant="ghost" size="icon" className="rounded-full"><ChevronLeft className="w-6 h-6" /></Button>
        </Link>
        <div>
          <h1 className="text-2xl font-headline font-bold uppercase tracking-tighter text-white flex items-center gap-2">
            <Crown className="w-6 h-6 text-yellow-500" />
            {t.title}
          </h1>
          <p className="text-muted-foreground text-[10px] uppercase tracking-widest font-bold opacity-60">
            {t.subtitle}
          </p>
        </div>
      </header>

      <div className="space-y-6">
        <Card className="glass-card border-yellow-500/30 bg-gradient-to-br from-yellow-500/10 to-transparent">
          <CardContent className="p-4 space-y-4">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-yellow-500 flex items-center gap-2">
              <Info className="w-3.5 h-3.5" /> {t.benefits}
            </h3>
            <div className="grid grid-cols-1 gap-2">
               <div className="flex items-center gap-3 text-[10px] font-bold uppercase text-white/80">
                 <Zap className="w-3.5 h-3.5 text-yellow-500" /> 
                 {t.talent}
               </div>
               <div className="flex items-center gap-3 text-[10px] font-bold uppercase text-white/80">
                 <Target className="w-3.5 h-3.5 text-primary" /> 
                 {t.tactics}
               </div>
               <div className="flex items-center gap-3 text-[10px] font-bold uppercase text-white/80">
                 <Users className="w-3.5 h-3.5 text-accent" /> 
                 {t.status}
               </div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-3">
          {proAgents.length > 0 ? (
            proAgents.map((agent) => (
              <div key={agent.id} className="relative group">
                <div className="absolute -inset-0.5 bg-gradient-to-r from-yellow-500/30 to-accent/30 rounded-2xl blur opacity-30 group-hover:opacity-60 transition duration-500"></div>
                <TransferHeroCard 
                  agent={agent} 
                  user={user} 
                  profile={profile} 
                  onBid={handleGlobalBid}
                  now={now}
                  language={language}
                />
              </div>
            ))
          ) : (
            <div className="py-20 text-center opacity-30 border border-dashed border-white/10 rounded-2xl flex flex-col items-center gap-4 p-10">
              <Trophy className="w-12 h-12" />
              <p className="text-[10px] uppercase font-black">{t.noUnits}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
