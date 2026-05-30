'use client';

import { useState, useEffect } from 'react';
import { useGameState, LineupSlot } from '../../lib/store';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { 
  ChevronLeft, Star, Clock, ShoppingCart, Loader2, Coins, ArrowUpCircle, Info, ShieldCheck, Users, Target, Eye, Map, Zap, Sparkles, Brain, TrendingUp, Crosshair
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Hero } from '../../lib/moba-data';
import Link from 'next/link';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogPortal
} from "@/components/ui/dialog";
import { calculateLiveAge, getMoscowDateString, getMoscowTime } from '@/app/lib/time-utils';
import { useToast } from '@/hooks/use-toast';
import { useUser, useFirestore, useDoc, useMemoFirebase, setDocumentNonBlocking } from '@/firebase';
import { doc } from 'firebase/firestore';
import { LoadingScreen } from '@/components/game/LoadingScreen';

export default function YouthSquadPage() {
  const { youthAcademyHeroes, language, isLoaded, promoteYouthPlayer, updateHero } = useGameState();
  const { user, isUserLoading } = useUser();
  const db = useFirestore();
  const { toast } = useToast();
  
  const [selectedHero, setSelectedHero] = useState<Hero | null>(null);
  const [isTransferring, setIsTransferring] = useState(false);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const userRef = useMemoFirebase(() => (user?.uid ? doc(db, 'players_v8', user.uid) : null), [db, user?.uid]);
  const { data: profile } = useDoc(userRef);

  if (!isLoaded || isUserLoading) return <LoadingScreen />;

  const t = {
    title: language === 'ru' ? "СОСТАВ АКАДЕМИИ" : "ACADEMY SQUAD",
    promote: language === 'ru' ? "ПЕРЕВЕСТИ В ОСНОВУ" : "PROMOTE TO SQUAD",
    notReady: language === 'ru' ? "НЕ ГОТОВ (НУЖНО 18 ЛЕТ)" : "NOT READY (NEED 18 YRS)",
    overall: language === 'ru' ? "ОБЩ" : "OVR",
    onTransfer: language === 'ru' ? "ВЫСТАВИТЬ НА РЫНОК" : "PUT ON TRANSFER",
    proStatsLabels: { lastHitting: "Last Hitting", mapAwareness: "Map Awareness", positioning: "Positioning", reflexes: "Reflexes", manaManagement: "Mana Management", objectiveControl: "Objective Control", communication: "Communication", tiltResistance: "Tilt Resistance", versatility: "Versatility", ganking: "Ganking" }
  };

  const handlePromote = (heroId: string) => {
    promoteYouthPlayer(heroId);
    toast({ title: "Success" });
    setSelectedHero(null);
  };

  const handleTransfer = async () => {
    if (!selectedHero || !user || !profile || isTransferring) return;
    setIsTransferring(true);
    try {
      const today = getMoscowDateString();
      const mskNow = getMoscowTime();
      const expiryTime = new Date(mskNow.getTime() + 12 * 60 * 60 * 1000); 
      const startPrice = Math.floor((selectedHero.overallRating * 5000) + 25000);
      const agentId = `youth_${user.uid}_${Date.now()}`;
      const agentData = { id: agentId, heroData: JSON.parse(JSON.stringify(selectedHero)), currentBid: startPrice, startingPrice: startPrice, highestBidderId: "", highestBidderName: "", bidders: [], sellerId: user.uid, sellerName: profile.displayName || "Manager", expiresAt: expiryTime.toISOString(), dropDate: today, dropTime: mskNow.toISOString() };
      setDocumentNonBlocking(doc(db, 'market_v5', agentId), agentData);
      updateHero(selectedHero.id, { onTransferUntil: expiryTime.toISOString(), transferMarketId: agentId });
      toast({ title: "Player Listed" });
      setSelectedHero(null);
    } finally { setIsTransferring(false); }
  };

  return (
    <div className="max-w-md mx-auto px-4 pt-8 pb-32">
      <header className="mb-6 flex items-center gap-4"><Link href="/youth-academy"><Button variant="ghost" size="icon" className="rounded-full"><ChevronLeft className="w-6 h-6" /></Button></Link><div><h1 className="text-2xl font-headline font-bold uppercase">{t.title}</h1></div></header>
      <div className="space-y-2">
        {youthAcademyHeroes.map((hero) => {
          const liveAge = calculateLiveAge(hero.baseAge, hero.hiredAt);
          const onAuction = hero.onTransferUntil && new Date(hero.onTransferUntil).getTime() > now;
          return (
            <Card key={hero.id} className={cn("glass-card", onAuction && "border-yellow-500/30")} onClick={() => setSelectedHero(hero)}>
              <CardContent className="p-3 flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl overflow-hidden"><img src={hero.image} alt="" className="w-full h-full object-cover" /></div>
                <div className="flex-1">
                  <h3 className="text-sm font-bold uppercase">{hero.name}</h3>
                  <p className="text-[9px] text-muted-foreground uppercase">Age: {liveAge.display}</p>
                </div>
                <div className="text-lg font-headline font-bold text-accent italic">{hero.overallRating}</div>
              </CardContent>
            </Card>
          );
        })}
      </div>
      <Dialog open={!!selectedHero} onOpenChange={() => setSelectedHero(null)}>
        <DialogPortal>
          {selectedHero && (
            <DialogContent className="fixed inset-0 z-[100] max-w-none w-full h-full bg-background flex flex-col p-0 rounded-none">
              <div className="flex-1 overflow-y-auto p-4 pt-12 text-center">
                <img src={selectedHero.image} className="w-24 h-24 rounded-2xl mx-auto border-2 border-primary" />
                <DialogTitle className="text-2xl font-headline font-bold mt-4 uppercase">{selectedHero.name}</DialogTitle>
                <div className="grid grid-cols-2 gap-4 mt-8">
                   <Button variant="outline" className="h-12 border-primary/20" onClick={handleTransfer} disabled={isTransferring}><ShoppingCart className="w-4 h-4 mr-2" /> {t.onTransfer}</Button>
                   <Button className="hero-gradient h-12" onClick={() => handlePromote(selectedHero.id)} disabled={calculateLiveAge(selectedHero.baseAge, selectedHero.hiredAt).numeric < 18}><ArrowUpCircle className="w-4 h-4 mr-2" /> {t.promote}</Button>
                </div>
              </div>
            </DialogContent>
          )}
        </DialogPortal>
      </Dialog>
    </div>
  );
}
