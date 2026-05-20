'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import { useGameState, LineupSlot } from '../../lib/store';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { 
  Sword, Shield, Sparkles, Plus, 
  ChevronLeft, ChevronRight, UserPlus, X,
  ShieldCheck, Zap, Crosshair, HeartPulse,
  Star, Box, Undo2, Info, GraduationCap,
  TrendingUp, Eye, Target, Brain, Map, Users, AlertCircle, Award, Clock, 
  ShoppingCart, Loader2, Coins, ArrowUpCircle
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
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { LoadingScreen } from '@/components/game/LoadingScreen';

export default function YouthSquadPage() {
  const { youthAcademyHeroes, language, isLoaded, promoteYouthPlayer, updateHero } = useGameState();
  const { user } = useUser();
  const db = useFirestore();
  const { toast } = useToast();
  
  const [selectedHero, setSelectedHero] = useState<Hero | null>(null);
  const [isTransferring, setIsTransferring] = useState(false);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const userRef = useMemoFirebase(() => (user?.uid ? doc(db, 'players_v5', user.uid) : null), [db, user?.uid]);
  const { data: profile } = useDoc(userRef);

  if (!isLoaded) return <LoadingScreen />;

  const t = {
    title: language === 'ru' ? "СОСТАВ АКАДЕМИИ" : "ACADEMY SQUAD",
    subtitle: language === 'ru' ? "Будущие звезды вашего клуба" : "Future stars of your club",
    promote: language === 'ru' ? "ПЕРЕВЕСТИ В ОСНОВУ" : "PROMOTE TO SQUAD",
    notReady: language === 'ru' ? "НЕ ГОТОВ (НУЖНО 18 ЛЕТ)" : "NOT READY (NEED 18 YRS)",
    overall: language === 'ru' ? "ОБЩ" : "OVR",
    age: language === 'ru' ? "Возраст" : "Age",
    years: language === 'ru' ? "лет" : "yrs",
    stats: language === 'ru' ? "Навыки и потенциал" : "Skills & Potential",
    onTransfer: language === 'ru' ? "ВЫСТАВИТЬ НА РЫНОК" : "PUT ON TRANSFER",
    transferDesc: language === 'ru' ? "Юниор будет выставлен на аукцион на 5 минут (ТЕСТ). Если ставок не будет, он останется в академии." : "Junior will be listed for 5 minutes (TEST). If no bids are placed, he remains in the academy.",
    success: language === 'ru' ? "Игрок переведен в состав!" : "Player promoted to squad!",
    proStatsLabels: {
      lastHitting: language === 'ru' ? "Добив крипов" : "Last Hitting",
      mapAwareness: language === 'ru' ? "Контроль карты" : "Map Awareness",
      positioning: language === 'ru' ? "Позиционка" : "Positioning",
      reflexes: language === 'ru' ? "Рефлексы" : "Reflexes",
      manaManagement: language === 'ru' ? "Менеджмент маны" : "Mana Management",
      objectiveControl: language === 'ru' ? "Объекты" : "Objective Control",
      communication: language === 'ru' ? "Коммуникация" : "Communication",
      tiltResistance: language === 'ru' ? "Стрессоустойчивость" : "Tilt Resistance",
      versatility: language === 'ru' ? "Универсальность" : "Versatility",
      ganking: language === 'ru' ? "Ганкинг" : "Ganking",
    }
  };

  const handlePromote = (heroId: string) => {
    promoteYouthPlayer(heroId);
    toast({ title: t.success });
    setSelectedHero(null);
  };

  const handleTransfer = async () => {
    if (!selectedHero || !user || !profile) return;
    setIsTransferring(true);
    try {
      const today = getMoscowDateString();
      const mskNow = getMoscowTime();
      
      // TEST: 5 minutes
      const expiryTime = new Date(mskNow);
      expiryTime.setMinutes(expiryTime.getMinutes() + 5);
      
      const startPrice = (selectedHero.overallRating * 5000) + 25000;
      const agentId = `youth_${user.uid}_${Date.now()}`;
      
      const agentData = {
        id: agentId,
        heroData: JSON.parse(JSON.stringify(selectedHero)),
        currentBid: startPrice,
        startingPrice: startPrice,
        highestBidderId: null,
        highestBidderName: null,
        bidders: [],
        sellerId: user.uid,
        sellerName: profile.displayName || "Manager",
        expiresAt: expiryTime.toISOString(),
        dropDate: today,
        dropTime: mskNow.toISOString(),
        isYouth: true,
        createdAt: serverTimestamp()
      };

      await setDoc(doc(db, 'market_v2', agentId), agentData);
      
      updateHero(selectedHero.id, { 
        onTransferUntil: expiryTime.toISOString(),
        transferMarketId: agentId
      });
      
      toast({ 
        title: language === 'ru' ? "Юниор выставлен на трансфер" : "Junior Listed for Transfer",
        description: language === 'ru' ? "На аукционе 5 минут. Юниор остается в академии." : "On auction for 5 minutes. Junior remains in academy."
      });
      setSelectedHero(null);
    } catch (e: any) {
      console.error(e);
      toast({ title: "Transfer Failed", description: e.message, variant: "destructive" });
    } finally {
      setIsTransferring(false);
    }
  };

  const renderStars = (rating: number) => (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => {
        const fill = Math.min(Math.max(rating - i, 0), 1);
        return (
          <div key={i} className="relative w-2.5 h-2.5">
            <Star className="absolute inset-0 w-2.5 h-2.5 text-muted-foreground/20" />
            <div className="absolute inset-0 overflow-hidden" style={{ width: `${fill * 100}%` }}>
              <Star className="w-2.5 h-2.5 text-yellow-500 fill-yellow-500" />
            </div>
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="max-w-md mx-auto px-4 pt-8 pb-32">
      <header className="mb-6 flex items-center gap-4">
        <Link href="/youth-academy">
          <Button variant="ghost" size="icon" className="rounded-full">
            <ChevronLeft className="w-6 h-6" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-headline font-bold uppercase tracking-tighter flex items-center gap-2 text-primary">
            <GraduationCap className="w-6 h-6 text-primary" />
            {t.title}
          </h1>
          <p className="text-muted-foreground text-[10px] uppercase tracking-widest">{t.subtitle}</p>
        </div>
      </header>

      <div className="space-y-2">
        {youthAcademyHeroes.length > 0 ? youthAcademyHeroes.map((hero) => {
          const liveAge = calculateLiveAge(hero.baseAge, hero.hiredAt);
          const isReady = liveAge.numeric >= 18;
          const onAuction = hero.onTransferUntil && new Date(hero.onTransferUntil).getTime() > now;

          return (
            <Card 
              key={hero.id} 
              className={cn(
                "glass-card border-white/5 hover:bg-white/5 cursor-pointer transition-all",
                onAuction && "border-yellow-500/30 bg-yellow-500/5"
              )}
              onClick={() => setSelectedHero(hero)}
            >
              <CardContent className="p-3 flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl overflow-hidden bg-secondary/50 border border-white/10 shrink-0">
                  <img src={hero.image} alt={hero.name} className="w-full h-full object-cover" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold truncate uppercase">{hero.name}</h3>
                    <Badge variant="outline" className="text-[7px] h-3 px-1 border-white/10 uppercase opacity-60">{hero.role}</Badge>
                    {onAuction && (
                      <Badge className="bg-yellow-500 text-black text-[6px] h-3 px-1 font-black animate-pulse uppercase">Auction</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <p className="text-[9px] text-muted-foreground font-black uppercase tracking-widest">
                      {t.age}: {liveAge.display} {t.years}
                    </p>
                    {isReady && !onAuction && (
                      <Badge className="bg-green-500/20 text-green-400 text-[6px] h-3 px-1 font-black animate-pulse uppercase tracking-widest">Ready</Badge>
                    )}
                  </div>
                </div>
                <div className="flex flex-col items-center justify-center min-w-[40px] border-l border-white/5 pl-3">
                  <span className="text-lg font-headline font-bold text-accent italic">{hero.overallRating}</span>
                </div>
              </CardContent>
            </Card>
          );
        }) : (
          <div className="py-20 text-center opacity-30 flex flex-col items-center gap-4">
            <Users className="w-16 h-16" />
            <p className="text-xs font-bold uppercase tracking-widest">Academy is currently empty</p>
          </div>
        )}
      </div>

      <Dialog open={!!selectedHero} onOpenChange={() => setSelectedHero(null)}>
        <DialogPortal>
          {selectedHero && (
            <DialogContent className="fixed inset-0 z-[100] max-w-none w-full h-full m-0 p-0 bg-background border-none flex flex-col rounded-none sm:rounded-none overflow-hidden outline-none translate-x-0 translate-y-0 top-0 left-0 animate-in fade-in zoom-in duration-300">
              <DialogHeader className="p-4 pt-12 pb-0 text-center">
                <DialogTitle className="text-2xl font-headline font-bold uppercase text-white tracking-tight leading-none">
                  {selectedHero.name}
                </DialogTitle>
                <DialogDescription className="text-[10px] text-muted-foreground mt-2 uppercase tracking-widest font-bold">
                  Detailed player profile and statistics dossier.
                </DialogDescription>
              </DialogHeader>

              <div className="flex-1 overflow-y-auto scrollbar-hide">
                <div className="p-4 py-8 bg-gradient-to-br from-primary/20 via-background to-accent/5 flex flex-col items-center text-center gap-4 border-b border-white/5">
                  <div className="relative">
                    <div className="w-24 h-24 rounded-2xl overflow-hidden border border-primary/50 shadow-[0_0_30px_rgba(var(--primary),0.3)] bg-secondary/50">
                      <img src={selectedHero.image} alt={selectedHero.name} className="w-full h-full object-cover" />
                    </div>
                    <div className="absolute -bottom-1 -right-1 w-8 h-8 rounded-lg bg-background border border-white/10 flex items-center justify-center shadow-xl">
                      <span className="text-base">{selectedHero.country?.flag || '🏳️'}</span>
                    </div>
                  </div>
                  
                  <div className="space-y-1">
                    <div className="flex items-center justify-center gap-2">
                      <Badge className="bg-primary text-primary-foreground text-[10px] font-black uppercase px-2 h-5">{selectedHero.role}</Badge>
                      {selectedHero.onTransferUntil && new Date(selectedHero.onTransferUntil).getTime() > now && (
                        <Badge className="bg-yellow-500 text-black text-[10px] font-black uppercase px-2 h-5 flex gap-1 items-center animate-pulse">
                          <Clock className="w-3 h-3" /> ON AUCTION
                        </Badge>
                      )}
                    </div>
                  </div>

                  <div className="w-full grid grid-cols-2 gap-3 max-w-[300px] mx-auto">
                    <div className="bg-background/40 p-3 rounded-xl border border-white/10">
                      <p className="text-[8px] font-black text-muted-foreground uppercase tracking-widest">{t.overall}</p>
                      <p className="text-xl font-headline font-bold text-accent italic leading-none">{selectedHero.overallRating}</p>
                    </div>
                    <div className="bg-background/40 p-3 rounded-xl border border-white/10">
                      <p className="text-[8px] font-black text-muted-foreground uppercase tracking-widest">{t.age}</p>
                      <p className="text-xl font-headline font-bold text-primary italic leading-none">
                        {calculateLiveAge(selectedHero.baseAge, selectedHero.hiredAt).display}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="p-4 space-y-8 pb-32">
                  <section className="space-y-3">
                    <h3 className="text-[9px] font-black text-accent uppercase tracking-[0.2em] mb-4 flex items-center gap-2 opacity-80 px-1">
                      <Coins className="w-3.5 h-3.5" /> MARKET ACTIONS
                    </h3>
                    <div className="bg-primary/5 border border-primary/20 rounded-xl p-3 flex gap-3">
                       <Info className="w-4 h-4 text-primary shrink-0" />
                       <p className="text-[9px] text-muted-foreground leading-tight italic">{t.transferDesc}</p>
                     </div>
                     <Button 
                       variant="outline" 
                       className="w-full h-12 border-primary/20 bg-primary/10 hover:bg-primary/20 text-primary group" 
                       onClick={handleTransfer}
                       disabled={isTransferring || (selectedHero.onTransferUntil !== null && new Date(selectedHero.onTransferUntil).getTime() > now)}
                     >
                       {isTransferring ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <ShoppingCart className="w-4 h-4 mr-3" />}
                       <span className="text-[9px] font-black uppercase tracking-widest">
                         {selectedHero.onTransferUntil && new Date(selectedHero.onTransferUntil).getTime() > now ? 'ACTIVE AUCTION' : t.onTransfer}
                       </span>
                     </Button>
                  </section>

                  <section>
                    <h3 className="text-[9px] font-black text-muted-foreground uppercase tracking-[0.2em] mb-4 flex items-center gap-2 opacity-80 px-1">
                      <Award className="w-3.5 h-3.5" /> {t.stats}
                    </h3>
                    <div className="space-y-5">
                      {Object.entries(selectedHero.proStats).map(([key, value]) => {
                        const talent = selectedHero.proTalents ? (selectedHero.proTalents as any)[key] : 3.0;
                        const icons: Record<string, any> = {
                          lastHitting: Target, mapAwareness: Eye, positioning: Map, reflexes: Zap,
                          manaManagement: Sparkles, objectiveControl: Sword, communication: Users,
                          tiltResistance: Brain, versatility: TrendingUp, ganking: Crosshair,
                        };
                        const Icon = icons[key] || Info;
                        return (
                          <div key={key} className="space-y-2 bg-secondary/10 p-3 rounded-xl border border-white/5">
                            <div className="flex justify-between items-center px-0.5">
                              <div className="flex items-center gap-2">
                                <Icon className="w-3.5 h-3.5 text-muted-foreground/60" />
                                <span className="text-[10px] font-bold uppercase tracking-widest">{t.proStatsLabels[key as keyof typeof t.proStatsLabels]}</span>
                              </div>
                              <div className="flex flex-col items-end">
                                <span className="text-[10px] font-mono font-bold text-primary">{value} / 100</span>
                                {renderStars(talent)}
                              </div>
                            </div>
                            <Progress value={value} className="h-1 rounded-full bg-secondary/40" />
                          </div>
                        );
                      })}
                    </div>
                  </section>
                </div>
              </div>

              <div className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-background via-background/95 to-transparent pt-12 flex-shrink-0 z-[110] flex flex-col gap-2">
                <Button 
                  className={cn(
                    "w-full h-14 font-black text-[11px] tracking-[0.2em] shadow-xl rounded-xl active:scale-95 transition-all uppercase",
                    (calculateLiveAge(selectedHero.baseAge, selectedHero.hiredAt).numeric >= 18 && !(selectedHero.onTransferUntil && new Date(selectedHero.onTransferUntil).getTime() > now)) ? "hero-gradient" : "bg-secondary/50 border border-white/5 text-muted-foreground cursor-not-allowed"
                  )}
                  disabled={calculateLiveAge(selectedHero.baseAge, selectedHero.hiredAt).numeric < 18 || (selectedHero.onTransferUntil && new Date(selectedHero.onTransferUntil).getTime() > now)}
                  onClick={() => handlePromote(selectedHero.id)}
                >
                  <ArrowUpCircle className="w-4 h-4 mr-2" />
                  {selectedHero.onTransferUntil && new Date(selectedHero.onTransferUntil).getTime() > now ? 'ON AUCTION' : (calculateLiveAge(selectedHero.baseAge, selectedHero.hiredAt).numeric >= 18 ? t.promote : t.notReady)}
                </Button>
                <Button 
                  variant="ghost"
                  className="w-full h-12 text-[9px] font-bold tracking-widest text-muted-foreground uppercase"
                  onClick={() => setSelectedHero(null)}
                >
                  {language === 'ru' ? 'ВЕРНУТЬСЯ' : 'BACK'}
                </Button>
              </div>
            </DialogContent>
          )}
        </DialogPortal>
      </Dialog>
    </div>
  );
}
