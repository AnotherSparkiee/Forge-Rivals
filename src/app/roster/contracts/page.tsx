'use client';

import { useState, useEffect } from 'react';
import { useGameState } from '../../lib/store';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  ChevronLeft, Scroll, User, Star, Trash2, 
  Coins, Gem, HeartPulse, ShieldAlert, Award,
  Info, TrendingUp, Eye, Target, Brain, Map, Users,
  Zap, Sword, Crosshair, Activity, ShoppingCart, Loader2, Clock, UserCog, Sparkles
} from 'lucide-react';
import { cn, formatCurrency } from '@/lib/utils';
import Link from 'next/link';
import { LoadingScreen } from '@/components/game/LoadingScreen';
import { Hero } from '../../lib/moba-data';
import { useToast } from '@/hooks/use-toast';
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { getMoscowDateString, getMoscowTime, calculateLiveAge } from '@/app/lib/time-utils';

export default function ContractsPage() {
  const { ownedHeroes, language, isLoaded, credits, crystals, updateHero, removeHero, managerSkills } = useGameState();
  const { user } = useUser();
  const db = useFirestore();
  const [profileHero, setProfileHero] = useState<Hero | null>(null);
  const [isTransferring, setIsTransferring] = useState(false);
  const [now, setNow] = useState(Date.now());
  const { toast } = useToast();

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const userRef = useMemoFirebase(() => (user?.uid ? doc(db, 'players_v10', user.uid) : null), [db, user?.uid]);
  const { data: profile } = useDoc(userRef);

  if (!isLoaded) return <LoadingScreen />;

  const t = {
    title: language === 'ru' ? "КОНТРАКТЫ" : "CONTRACTS",
    subtitle: language === 'ru' ? "Администрирование состава" : "Squad administration",
    sell: language === 'ru' ? "ПРОДАТЬ" : "SELL",
    dismiss: language === 'ru' ? "УВОЛИТЬ" : "DISMISS",
    onTransfer: language === 'ru' ? "ВЫСТАВИТЬ НА РЫНОК" : "PUT ON TRANSFER",
    recoverEuro: language === 'ru' ? "СНЯТЬ УСТАЛОСТЬ (ЕВРО)" : "REMOVE FATIGUE (EURO)",
    recoverGems: language === 'ru' ? "СНЯТЬ УСТАЛОСТЬ (ГЕМЫ)" : "REMOVE FATIGUE (GEMS)",
    boostForm: language === 'ru' ? "ПОДНЯТЬ ФОРМУ" : "BOOST FORM",
    heal: language === 'ru' ? "ВЫЛЕЧИТЬ ТРАВМУ" : "HEAL INJURY",
    insufficient: language === 'ru' ? "Недостаточно средств" : "Insufficient funds",
    tooYoung: language === 'ru' ? "Игрок слишком молод! Мин. возраст — 18.0" : "Player is too young! Min age — 18.0",
    overall: language === 'ru' ? "ОБЩ" : "OVR",
    years: language === 'ru' ? "лет" : "yrs",
    stats: language === 'ru' ? "Навыки и таланты" : "Skills & Talents",
    transferDesc: language === 'ru' ? "Игрок будет выставлен на аукцион на 12 часов. Если ставок не будет, он останется в клубе." : "The player will be listed for 12 hours. If no bids are placed, he remains in the club.",
    close: language === 'ru' ? "ВЕРНУТЬСЯ" : "BACK",
    healthy: language === 'ru' ? "Здоров" : "Healthy",
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

  const handleAction = async (action: string) => {
    if (!profileHero) return;
    switch (action) {
      case 'onTransfer':
        const liveAge = calculateLiveAge(profileHero.baseAge, profileHero.hiredAt);
        if (liveAge.numeric < 18) { toast({ variant: "destructive", title: t.tooYoung }); return; }
        if (!user || !profile) return;
        setIsTransferring(true);
        try {
          const today = getMoscowDateString();
          const mskNow = getMoscowTime();
          const expiryTime = new Date(mskNow.getTime() + 12 * 60 * 60 * 1000);
          const startPrice = (profileHero.overallRating * 15000) + 100000;
          const agentId = `user_${user.uid}_${Date.now()}`;
          const agentData = { id: agentId, heroData: JSON.parse(JSON.stringify(profileHero)), currentBid: startPrice, startingPrice: startPrice, highestBidderId: null, highestBidderName: null, bidders: [], sellerId: user.uid, sellerName: profile.displayName || "Manager", expiresAt: expiryTime.toISOString(), dropDate: today, dropTime: mskNow.toISOString() };
          await setDoc(doc(db, 'market_v7', agentId), agentData);
          updateHero(profileHero.id, { onTransferUntil: expiryTime.toISOString(), transferMarketId: agentId });
          toast({ title: language === 'ru' ? "Игрок выставлен на трансфер" : "Player Listed for Transfer" });
          setProfileHero(null);
        } finally { setIsTransferring(false); }
        break;
      case 'sell':
        removeHero(profileHero.id, 50000);
        toast({ title: language === 'ru' ? "Игрок продан" : "Hero Sold" });
        setProfileHero(null);
        break;
      case 'dismiss':
        removeHero(profileHero.id, 0);
        toast({ title: language === 'ru' ? "Контракт расторгнут" : "Contract Terminated" });
        setProfileHero(null);
        break;
      case 'recoverEuro':
        if (credits >= 5000) {
          updateHero(profileHero.id, { fatigue: Math.max(0, profileHero.fatigue - 25) }, 5000, 0);
          setProfileHero(prev => prev ? { ...prev, fatigue: Math.max(0, prev.fatigue - 25) } : null);
        } else toast({ title: t.insufficient, variant: "destructive" });
        break;
      case 'recoverGems':
        if (crystals >= 50) {
          updateHero(profileHero.id, { fatigue: 0 }, 0, 50);
          setProfileHero(prev => prev ? { ...prev, fatigue: 0 } : null);
        } else toast({ title: t.insufficient, variant: "destructive" });
        break;
      case 'boostForm':
        if (credits >= 10000) {
          updateHero(profileHero.id, { form: Math.min(100 + managerSkills.medical, profileHero.form + 15) }, 10000, 0);
          setProfileHero(prev => prev ? { ...prev, form: Math.min(100 + managerSkills.medical, prev.form + 15) } : null);
        } else toast({ title: t.insufficient, variant: "destructive" });
        break;
      case 'heal':
        if (credits >= 25000) {
          updateHero(profileHero.id, { isInjured: false }, 25000, 0);
          setProfileHero(prev => prev ? { ...prev, isInjured: false } : null);
        } else toast({ title: t.insufficient, variant: "destructive" });
        break;
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

  if (profileHero) {
    const liveAge = calculateLiveAge(profileHero.baseAge, profileHero.hiredAt);
    return (
      <div className="min-h-screen bg-background text-foreground animate-in fade-in slide-in-from-right-4 duration-300 overflow-y-auto scrollbar-hide pb-6">
        <div className="p-4 pt-12 pb-8 bg-gradient-to-br from-primary/20 via-background to-accent/10 border-b border-white/5 flex flex-col items-center text-center gap-4 relative">
          <Button variant="ghost" size="icon" className="absolute left-4 top-10 rounded-full" onClick={() => setProfileHero(null)}>
            <ChevronLeft className="w-6 h-6" />
          </Button>
          <div className="relative">
            <div className="w-24 h-24 rounded-2xl overflow-hidden border border-primary/50 shadow-2xl bg-secondary/50">
              <img src={profileHero.image} alt={profileHero.name} className="w-full h-full object-cover" />
            </div>
            <div className="absolute -bottom-1 -right-1 w-8 h-8 rounded-lg bg-background border border-white/10 flex items-center justify-center shadow-xl">
              <span className="text-base">{profileHero.country?.flag || '🏳️'}</span>
            </div>
          </div>
          <div className="space-y-1">
            <h1 className="text-2xl font-headline font-bold uppercase text-white tracking-tight leading-none">{profileHero.name}</h1>
            <div className="flex items-center justify-center gap-2">
              <Badge className="bg-primary text-primary-foreground text-[10px] font-black uppercase px-2 h-5">{profileHero.role}</Badge>
            </div>
          </div>
          <div className="w-full grid grid-cols-2 gap-3 max-w-[300px] mx-auto">
            <div className="bg-background/40 p-3 rounded-xl border border-white/10">
              <p className="text-[8px] font-black text-muted-foreground uppercase tracking-widest">{t.overall}</p>
              <p className="text-xl font-headline font-bold text-accent italic leading-none">{profileHero.overallRating}</p>
            </div>
            <div className="bg-background/40 p-3 rounded-xl border border-white/10">
              <p className="text-[8px] font-black text-muted-foreground uppercase tracking-widest">{t.salary}</p>
              <p className="text-sm font-headline font-bold text-primary">€{(profileHero.salary || 0).toLocaleString()}</p>
            </div>
          </div>
        </div>

        <div className="p-4 space-y-8">
            <section>
              <h3 className="text-[9px] font-black text-primary uppercase tracking-[0.2em] mb-4 flex items-center gap-2 opacity-80 px-1">
                <Info className="w-3.5 h-3.5" /> STATUS & BIOMETRICS
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-secondary/20 p-3 rounded-xl border border-white/5 space-y-0.5">
                  <p className="text-[7px] font-black text-muted-foreground uppercase">Age</p>
                  <p className={cn("text-xs font-bold", liveAge.numeric < 18 ? "text-red-400" : "text-white")}>{liveAge.display} {t.years}</p>
                </div>
                <div className="bg-secondary/20 p-3 rounded-xl border border-white/5 space-y-0.5">
                  <p className="text-[7px] font-black text-muted-foreground uppercase">Status</p>
                  <p className={cn("text-[10px] font-bold flex items-center gap-1.5", profileHero.isInjured ? "text-red-400" : "text-green-400")}>
                    {profileHero.isInjured ? <ShieldAlert className="w-3 h-3" /> : <Award className="w-3 h-3" />}
                    {profileHero.isInjured ? t.heal : t.healthy}
                  </p>
                </div>
                <div className="bg-secondary/20 p-3 rounded-xl border border-white/5 space-y-2">
                  <div className="flex justify-between items-center"><p className="text-[7px] font-black text-muted-foreground uppercase">Form</p><p className="text-[9px] font-bold text-primary">{profileHero.form}%</p></div>
                  <Progress value={profileHero.form} max={100 + managerSkills.medical} className="h-1" />
                </div>
                <div className="bg-secondary/20 p-3 rounded-xl border border-white/5 space-y-2">
                  <div className="flex justify-between items-center"><p className="text-[7px] font-black text-muted-foreground uppercase">Fatigue</p><p className="text-[9px] font-bold text-accent">{profileHero.fatigue}%</p></div>
                  <Progress value={profileHero.fatigue} className="h-1 bg-accent/20" />
                </div>
              </div>
            </section>

            <section className="space-y-3">
              <h3 className="text-[9px] font-black text-accent uppercase tracking-[0.2em] mb-4 flex items-center gap-2 opacity-80 px-1">
                <Scroll className="w-3.5 h-3.5" /> CONTRACT ACTIONS
              </h3>
              <div className="grid grid-cols-1 gap-2">
                <Button variant="outline" className="justify-start h-12 border-white/5 bg-secondary/20 hover:bg-primary/10" onClick={() => handleAction('recoverEuro')}><Coins className="w-4 h-4 mr-3 text-yellow-500" /><div className="text-left"><p className="text-[9px] font-bold uppercase">{t.recoverEuro}</p><p className="text-[8px] text-muted-foreground">-25% Fatigue | Cost: 5,000 €</p></div></Button>
                <Button variant="outline" className="justify-start h-12 border-white/5 bg-secondary/20 hover:bg-accent/10" onClick={() => handleAction('recoverGems')}><Gem className="w-4 h-4 mr-3 text-blue-400" /><div className="text-left"><p className="text-[9px] font-bold uppercase">{t.recoverGems}</p><p className="text-[8px] text-muted-foreground">Reset to 0% | Cost: 50 Gems</p></div></Button>
                <Button variant="outline" className="justify-start h-12 border-white/5 bg-secondary/20 hover:bg-primary/10" onClick={() => handleAction('boostForm')}><Activity className="w-4 h-4 mr-3 text-primary" /><div className="text-left"><p className="text-[9px] font-bold uppercase">{t.boostForm}</p><p className="text-[8px] text-muted-foreground">+15% Form | Cost: 10,000 €</p></div></Button>
                <div className="pt-4 space-y-2">
                   <div className="bg-primary/5 border border-primary/20 rounded-xl p-3 flex gap-3"><Info className="w-4 h-4 text-primary shrink-0" /><p className="text-[9px] text-muted-foreground leading-tight italic">{t.transferDesc}</p></div>
                   <Button variant="outline" className="w-full h-12 border-primary/20 bg-primary/10 hover:bg-primary/20 text-primary" onClick={() => handleAction('onTransfer')} disabled={isTransferring || (profileHero.onTransferUntil !== null && new Date(profileHero.onTransferUntil) > new Date())}>{isTransferring ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <ShoppingCart className="w-4 h-4 mr-3" />}<span className="text-[9px] font-black uppercase tracking-widest">{profileHero.onTransferUntil && new Date(profileHero.onTransferUntil) > new Date() ? 'ACTIVE AUCTION' : t.onTransfer}</span></Button>
                </div>
                {profileHero.isInjured && <Button variant="outline" className="justify-start h-12 border-red-500/20 bg-red-500/5 hover:bg-red-500/10" onClick={() => handleAction('heal')}><HeartPulse className="w-4 h-4 mr-3 text-red-400" /><div className="text-left"><p className="text-[9px] font-bold uppercase text-red-400">{t.heal}</p><p className="text-[8px] text-red-400/60">Instant Recovery | Cost: 25,000 €</p></div></Button>}
                <div className="grid grid-cols-2 gap-2 mt-4"><Button variant="outline" className="h-14 border-red-500/20 bg-red-500/5 text-red-400 font-bold text-[10px] uppercase" onClick={() => handleAction('sell')} disabled={profileHero.onTransferUntil !== null && new Date(profileHero.onTransferUntil) > new Date()}><UserCog className="w-4 h-4 mr-2" /> {t.sell}</Button><Button variant="outline" className="h-14 border-white/5 bg-secondary/20 text-muted-foreground font-bold text-[10px] uppercase" onClick={() => handleAction('dismiss')} disabled={profileHero.onTransferUntil !== null && new Date(profileHero.onTransferUntil) > new Date()}><Trash2 className="w-4 h-4 mr-2" /> {t.dismiss}</Button></div>
              </div>
            </section>

            <section>
              <h3 className="text-[9px] font-black text-muted-foreground uppercase tracking-[0.2em] mb-4 flex items-center gap-2 opacity-80 px-1">
                <Award className="w-3.5 h-3.5" /> {t.stats}
              </h3>
              <div className="space-y-3">
                {Object.entries(profileHero.proStats).map(([key, value]) => {
                  const talent = profileHero.proTalents ? (profileHero.proTalents as any)[key] : 3.0;
                  const icons: Record<string, any> = {
                    lastHitting: Target, mapAwareness: Eye, positioning: Map, reflexes: Zap,
                    manaManagement: Sparkles, objectiveControl: Sword, communication: Users,
                    tiltResistance: Brain, versatility: TrendingUp, ganking: Crosshair,
                  };
                  const Icon = icons[key] || Info;
                  return (
                    <div key={key} className="space-y-2 p-3 rounded-xl border border-white/5 bg-secondary/10 transition-all">
                      <div className="flex justify-between items-center px-0.5">
                        <div className="flex items-center gap-2">
                          <Icon className="w-3.5 h-3.5 text-muted-foreground/60" />
                          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{t.proStatsLabels[key as keyof typeof t.proStatsLabels]}</span>
                        </div>
                        <div className="flex flex-col items-end"><span className="text-[10px] font-mono font-bold text-primary">{value} / 100</span>{renderStars(talent)}</div>
                      </div>
                      <Progress value={value} className="h-1 rounded-full bg-secondary/40" />
                    </div>
                  );
                })}
              </div>
            </section>
            <Button variant="ghost" className="w-full h-12 text-[9px] font-black uppercase tracking-widest text-muted-foreground" onClick={() => setProfileHero(null)}>{t.close}</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto px-4 pt-8 pb-6">
      <header className="mb-6 flex items-center gap-4">
        <Link href="/roster"><Button variant="ghost" size="icon" className="rounded-full"><ChevronLeft className="w-6 h-6" /></Button></Link>
        <div><h1 className="text-2xl font-headline font-bold uppercase tracking-tighter flex items-center gap-2 text-primary"><Scroll className="w-6 h-6 text-primary" /> {t.title}</h1><p className="text-muted-foreground text-[10px] uppercase tracking-widest">{t.subtitle}</p></div>
      </header>
      <div className="space-y-2">
        {ownedHeroes.map((hero) => {
          const onAuction = hero.onTransferUntil && new Date(hero.onTransferUntil) > new Date();
          return (
            <Card key={hero.id} className={cn("glass-card border-white/5 hover:bg-white/5 cursor-pointer transition-all", onAuction && "border-yellow-500/30 bg-yellow-500/5")} onClick={() => setProfileHero(hero)}>
              <CardContent className="p-3 flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl overflow-hidden bg-secondary/50 border border-white/10 shrink-0"><img src={hero.image} alt={hero.name} className="w-full h-full object-cover" /></div>
                <div className="flex-1 min-w-0"><div className="flex items-center gap-2"><h3 className="text-sm font-bold truncate uppercase">{hero.name}</h3><Badge variant="outline" className="text-[7px] h-3 px-1 border-white/10 uppercase opacity-60">{hero.role}</Badge>{onAuction && <Badge className="bg-yellow-500 text-black text-[6px] h-3 px-1 font-black animate-pulse uppercase">Auction</Badge>}</div><div className="flex items-center gap-2 mt-0.5"><p className="text-[9px] text-muted-foreground font-black uppercase tracking-widest">Age: {calculateLiveAge(hero.baseAge, hero.hiredAt).display} {t.years}</p><p className="text-[9px] text-muted-foreground font-black uppercase tracking-widest">Salary: €{hero.salary.toLocaleString()}</p></div></div>
                <div className="flex flex-col items-center justify-center min-w-[40px] border-l border-white/5 pl-3"><span className="text-lg font-headline font-bold text-accent italic">{hero.overallRating}</span></div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
