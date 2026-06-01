'use client';

import { useState, useEffect, useMemo } from 'react';
import { useGameState, LineupSlot } from '../../lib/store';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { 
  ChevronLeft, Star, Clock, ShoppingCart, Loader2, 
  ArrowUpCircle, Info, Award, Target, Eye, Map, 
  Zap, Sparkles, Brain, TrendingUp, Crosshair, Sword,
  ShieldCheck, AlertCircle
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
  const { youthAcademyHeroes, language, isLoaded, promoteYouthPlayer, updateHero, managerSkills } = useGameState();
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

  const userRef = useMemoFirebase(() => (user?.uid ? doc(db, 'players_v10', user.uid) : null), [db, user?.uid]);
  const { data: profile } = useDoc(userRef);

  const t = {
    title: language === 'ru' ? "СОСТАВ АКАДЕМИИ" : "ACADEMY SQUAD",
    promote: language === 'ru' ? "В ОСНОВУ" : "PROMOTE",
    notReady: language === 'ru' ? "МОЛОД (НУЖНО 18)" : "TOO YOUNG (NEED 18)",
    overall: language === 'ru' ? "ОБЩ" : "OVR",
    onTransfer: language === 'ru' ? "НА РЫНОК" : "TRANSFER",
    years: language === 'ru' ? "лет" : "yrs",
    stats: language === 'ru' ? "Навыки и таланты" : "Skills & Talents",
    salary: language === 'ru' ? "Зарплата" : "Salary",
    status: language === 'ru' ? "Статус" : "Status",
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
    toast({ title: language === 'ru' ? "Игрок переведен!" : "Player Promoted!" });
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
        isYouth: true
      };
      
      setDocumentNonBlocking(doc(db, 'market_v7', agentId), agentData);
      updateHero(selectedHero.id, { onTransferUntil: expiryTime.toISOString(), transferMarketId: agentId });
      toast({ title: language === 'ru' ? "Выставлен на рынок" : "Listed on Market" });
      setSelectedHero(null);
    } finally { setIsTransferring(false); }
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

  if (!isLoaded || isUserLoading) return <LoadingScreen />;

  return (
    <div className="max-w-md mx-auto px-4 pt-8 pb-32">
      <header className="mb-6 flex items-center gap-4">
        <Link href="/youth-academy">
          <Button variant="ghost" size="icon" className="rounded-full">
            <ChevronLeft className="w-6 h-6" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-headline font-bold uppercase tracking-tighter text-primary">{t.title}</h1>
          <p className="text-muted-foreground text-[10px] uppercase tracking-widest">Future tactical assets</p>
        </div>
      </header>

      <div className="space-y-2">
        {youthAcademyHeroes.length > 0 ? youthAcademyHeroes.map((hero) => {
          const liveAge = calculateLiveAge(hero.baseAge, hero.hiredAt);
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
                <div className="w-12 h-12 rounded-xl overflow-hidden bg-secondary/50 border border-white/10">
                  <img src={hero.image} alt="" className="w-full h-full object-cover" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold uppercase truncate">{hero.name}</h3>
                    <Badge variant="outline" className="text-[7px] h-3 px-1 border-white/10 uppercase opacity-60">{hero.role}</Badge>
                  </div>
                  <p className="text-[9px] text-muted-foreground uppercase font-black tracking-widest mt-0.5">
                    Age: {liveAge.display} {t.years}
                  </p>
                </div>
                <div className="text-right border-l border-white/5 pl-3">
                  <p className="text-[7px] font-black text-accent uppercase tracking-tighter leading-none mb-0.5">{t.overall}</p>
                  <span className="text-lg font-headline font-bold text-accent italic">{hero.overallRating}</span>
                </div>
              </CardContent>
            </Card>
          );
        }) : (
          <div className="py-20 text-center opacity-30 flex flex-col items-center gap-4 border border-dashed border-white/10 rounded-2xl">
            <Users className="w-12 h-12" />
            <p className="text-xs font-black uppercase tracking-widest">Academy slots empty</p>
          </div>
        )}
      </div>

      <Dialog open={!!selectedHero} onOpenChange={() => setSelectedHero(null)}>
        <DialogPortal>
          {selectedHero && (
            <DialogContent className="fixed inset-0 z-[100] max-w-none w-full h-full m-0 p-0 bg-background border-none flex flex-col rounded-none overflow-hidden outline-none animate-in fade-in zoom-in duration-300">
              <div className="flex-1 overflow-y-auto scrollbar-hide pb-32">
                <div className="p-4 pt-12 pb-8 bg-gradient-to-br from-primary/20 via-background to-accent/10 border-b border-white/5 flex flex-col items-center text-center gap-4">
                  <div className="relative">
                    <div className="w-24 h-24 rounded-2xl overflow-hidden border border-primary/50 shadow-2xl bg-secondary/50">
                      <img src={selectedHero.image} alt="" className="w-full h-full object-cover" />
                    </div>
                    <div className="absolute -bottom-1 -right-1 w-8 h-8 rounded-lg bg-background border border-white/10 flex items-center justify-center shadow-xl">
                      <span className="text-base">{selectedHero.country?.flag || '🏳️'}</span>
                    </div>
                  </div>
                  
                  <div className="space-y-1">
                    <DialogTitle className="text-2xl font-headline font-bold uppercase text-white tracking-tight leading-none">{selectedHero.name}</DialogTitle>
                    <div className="flex items-center justify-center gap-2">
                      <Badge className="bg-primary text-primary-foreground text-[10px] font-black uppercase px-2 h-5">{selectedHero.role}</Badge>
                      <Badge variant="outline" className="border-accent text-accent text-[10px] font-black uppercase px-2 h-5">ACADEMY PUPIL</Badge>
                    </div>
                  </div>

                  <div className="w-full grid grid-cols-2 gap-3 max-w-[300px] mx-auto">
                    <div className="bg-background/40 p-3 rounded-xl border border-white/10">
                      <p className="text-[8px] font-black text-muted-foreground uppercase tracking-widest">{t.overall}</p>
                      <p className="text-xl font-headline font-bold text-accent italic leading-none">{selectedHero.overallRating}</p>
                    </div>
                    <div className="bg-background/40 p-3 rounded-xl border border-white/10">
                      <p className="text-[8px] font-black text-muted-foreground uppercase tracking-widest">{t.salary}</p>
                      <p className="text-sm font-headline font-bold text-primary">€{(selectedHero.salary || 0).toLocaleString()}</p>
                    </div>
                  </div>
                </div>

                <div className="p-4 space-y-8">
                  <section>
                    <h3 className="text-[9px] font-black text-primary uppercase tracking-[0.2em] mb-4 flex items-center gap-2 opacity-80 px-1">
                      <Info className="w-3.5 h-3.5" /> BIOMETRICS
                    </h3>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-secondary/20 p-3 rounded-xl border border-white/5 space-y-0.5">
                        <p className="text-[7px] font-black text-muted-foreground uppercase">Age</p>
                        <p className={cn("text-xs font-bold", calculateLiveAge(selectedHero.baseAge, selectedHero.hiredAt).numeric < 18 ? "text-red-400" : "text-white")}>
                          {calculateLiveAge(selectedHero.baseAge, selectedHero.hiredAt).display} {t.years}
                        </p>
                      </div>
                      <div className="bg-secondary/20 p-3 rounded-xl border border-white/5 space-y-0.5">
                        <p className="text-[7px] font-black text-muted-foreground uppercase">{t.status}</p>
                        <p className="text-[10px] font-bold text-green-400 flex items-center gap-1.5">
                          <ShieldCheck className="w-3 h-3" /> ACADEMY LEVEL 1
                        </p>
                      </div>
                    </div>
                  </section>

                  <section className="space-y-3">
                    <h3 className="text-[9px] font-black text-accent uppercase tracking-[0.2em] mb-4 flex items-center gap-2 opacity-80 px-1">
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

              <div className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-background via-background/95 to-transparent pt-12 flex flex-col gap-2 flex-shrink-0 z-[110]">
                <div className="grid grid-cols-2 gap-2">
                  <Button 
                    variant="outline" 
                    className="h-14 border-primary/20 bg-primary/5 hover:bg-primary/10 text-primary font-bold uppercase text-[10px]" 
                    onClick={handleTransfer}
                    disabled={isTransferring}
                  >
                    {isTransferring ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <ShoppingCart className="w-4 h-4 mr-2" />} {t.onTransfer}
                  </Button>
                  <Button 
                    className="h-14 hero-gradient font-black uppercase text-[10px] shadow-xl" 
                    onClick={() => handlePromote(selectedHero.id)} 
                    disabled={calculateLiveAge(selectedHero.baseAge, selectedHero.hiredAt).numeric < 18}
                  >
                    <ArrowUpCircle className="w-4 h-4 mr-2" /> 
                    {calculateLiveAge(selectedHero.baseAge, selectedHero.hiredAt).numeric < 18 ? t.notReady : t.promote}
                  </Button>
                </div>
                <Button 
                  variant="ghost" 
                  className="w-full h-10 text-[9px] font-black uppercase tracking-widest text-muted-foreground" 
                  onClick={() => setSelectedHero(null)}
                >
                  {language === 'ru' ? 'ЗАКРЫТЬ' : 'CLOSE'}
                </Button>
              </div>
            </DialogContent>
          )}
        </DialogPortal>
      </Dialog>
    </div>
  );
}
