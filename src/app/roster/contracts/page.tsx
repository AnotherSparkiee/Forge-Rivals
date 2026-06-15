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
  Zap, Sword, Crosshair, Activity, ShoppingCart, Loader2, Clock, UserCog, Sparkles, X, ShieldCheck, Timer
} from 'lucide-react';
import { cn, formatCurrency } from '@/lib/utils';
import Link from 'next/link';
import { LoadingScreen } from '@/components/game/LoadingScreen';
import { Hero } from '../../lib/moba-data';
import { useToast } from '@/hooks/use-toast';
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { getMoscowDateString, getMoscowTime, calculateLiveAge } from '@/app/lib/time-utils';
import { renderStars, STAT_KEYS } from '@/app/transfers/quick-search/page';

const normTalent = (val: any) => {
  const n = Number(val);
  if (isNaN(n)) return 0;
  return n < 10 ? Math.round(n * 10) : Math.round(n);
};

export default function ContractsPage() {
  const { ownedHeroes, language, isLoaded, credits, crystals, updateHero, removeHero, managerSkills, displayName } = useGameState();
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
    sell: language === 'ru' ? "ПРОДАЖА" : "SELL",
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
    skills: language === 'ru' ? "Навыки" : "SKILLS",
    talents: language === 'ru' ? "Таланты" : "TALENTS",
    transferDesc: language === 'ru' ? "Игрок будет выставлен на аукцион на 12 часов." : "The player will be listed for 12 hours.",
    close: language === 'ru' ? "ВЕРНУТЬСЯ" : "BACK",
    healthy: language === 'ru' ? "Здоров" : "Healthy",
    salary: language === 'ru' ? "Зарплата" : "Salary",
    owner: language === 'ru' ? "ВЛАДЕЛЕЦ" : "OWNER",
    sale: language === 'ru' ? "ПРОДАЖА" : "SALE",
    priceTitle: language === 'ru' ? "ЦЕНА ИГРОКА" : "UNIT PRICE",
    talent: language === 'ru' ? "Талант" : "Talent",
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

  const icons: Record<string, any> = {
    lastHitting: Target, mapAwareness: Eye, positioning: Map, reflexes: Zap,
    manaManagement: Sparkles, objectiveControl: Sword, communication: Users,
    tiltResistance: Brain, versatility: TrendingUp, ganking: Crosshair,
  };

  const handleAction = async (action: string) => {
    if (!profileHero) return;
    switch (action) {
      case 'recoverEuro':
        if (credits >= 5000) {
          updateHero(profileHero.id, { fatigue: Math.max(0, profileHero.fatigue - 25) }, 5000, 0);
          setProfileHero(prev => prev ? { ...prev, fatigue: Math.max(0, prev.fatigue - 25) } : null);
        } else toast({ title: t.insufficient, variant: "destructive" });
        break;
      case 'boostForm':
        if (credits >= 10000) {
          updateHero(profileHero.id, { form: Math.min(100 + managerSkills.medical, profileHero.form + 15) }, 10000, 0);
          setProfileHero(prev => prev ? { ...prev, form: Math.min(100 + managerSkills.medical, prev.form + 15) } : null);
        } else toast({ title: t.insufficient, variant: "destructive" });
        break;
    }
  };

  if (profileHero) {
    const liveAge = calculateLiveAge(profileHero.baseAge, profileHero.hiredAt);
    const talentsValues = Object.values(profileHero.proTalents || {}).map(v => normTalent(v));
    const maxTalentValue = Math.max(...talentsValues);
    const onAuction = profileHero.onTransferUntil && new Date(profileHero.onTransferUntil).getTime() > now;

    return (
      <div className="fixed inset-0 z-[100] bg-background overflow-y-auto animate-in fade-in slide-in-from-right-4 duration-300">
        <div className="max-w-md mx-auto min-h-screen flex flex-col pb-10">
          <div className="p-4 pt-12 pb-8 bg-gradient-to-br from-primary/20 via-background to-accent/10 border-b border-white/5 flex flex-col items-center text-center gap-4 relative shrink-0">
            <Button variant="ghost" size="icon" className="absolute left-4 top-10 rounded-full bg-black/20" onClick={() => setProfileHero(null)}><X className="w-5 h-5" /></Button>
            <div className="relative">
              <div className={cn("w-24 h-24 rounded-2xl overflow-hidden border-2 shadow-2xl bg-secondary/50", profileHero.isPro ? "border-yellow-500" : "border-primary/50")}>
                <img src={profileHero.image} alt={profileHero.name} className="w-full h-full object-cover" />
              </div>
              <div className="absolute -bottom-1 -right-1 w-8 h-8 rounded-lg bg-background border border-white/10 flex items-center justify-center shadow-xl"><span className="text-base">{profileHero.country?.flag}</span></div>
            </div>
            <div className="space-y-1">
              <h1 className="text-2xl font-headline font-bold uppercase text-white tracking-tight leading-none">{profileHero.name}</h1>
              <div className="flex items-center justify-center gap-2 mt-2">
                <Badge className="bg-primary text-primary-foreground text-[10px] font-black uppercase px-2 h-5">{profileHero.role}</Badge>
              </div>
            </div>
          </div>

          <div className="p-4 space-y-8">
              <section className="grid grid-cols-2 gap-3">
                <div className="bg-secondary/20 p-3 rounded-xl border border-white/5 space-y-1">
                  <p className="text-[8px] font-black text-muted-foreground uppercase tracking-widest">{t.owner}</p>
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-3 h-3 text-primary" />
                    <p className="text-[10px] font-bold uppercase truncate">{displayName || "Manager"}</p>
                  </div>
                </div>
                <div className="bg-secondary/20 p-3 rounded-xl border border-white/5 space-y-1">
                  <p className="text-[8px] font-black text-muted-foreground uppercase tracking-widest">{t.sale}</p>
                  <div className="flex items-center gap-2">
                    {onAuction ? (
                      <>
                        <Timer className="w-3 h-3 text-accent animate-pulse" />
                        <p className="text-[10px] font-mono font-bold text-accent">
                          {new Date(profileHero.onTransferUntil!).toLocaleTimeString()}
                        </p>
                      </>
                    ) : (
                      <>
                        <ShieldAlert className="w-3 h-3 text-muted-foreground opacity-30" />
                        <p className="text-[10px] font-bold text-muted-foreground opacity-50 uppercase tracking-tighter">OFF MARKET</p>
                      </>
                    )}
                  </div>
                </div>
              </section>

              <section className="space-y-3">
                <h3 className="text-[9px] font-black text-primary uppercase tracking-[0.2em] mb-4 flex items-center gap-2 opacity-80 px-1">
                  <Info className="w-3.5 h-3.5" /> {language === 'ru' ? 'ОБЩИЕ ДАННЫЕ' : 'GENERAL INTEL'}
                </h3>
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex items-center justify-between p-3 bg-secondary/10 rounded-xl border border-white/5">
                     <span className="text-[9px] font-bold text-muted-foreground uppercase">{t.age}</span>
                     <span className="text-[10px] font-bold">{liveAge.display} {t.years}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-secondary/10 rounded-xl border border-white/5 min-h-[64px]">
                     <span className="text-[9px] font-bold text-muted-foreground uppercase whitespace-nowrap">{t.talent}</span>
                     <div className="flex items-center">
                       {renderStars(maxTalentValue, 'intel')}
                     </div>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-secondary/10 rounded-xl border border-white/5">
                     <span className="text-[9px] font-bold text-muted-foreground uppercase">{t.salary}</span>
                     <span className="text-[10px] font-bold text-primary">€{(profileHero.salary || 0).toLocaleString()}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-secondary/10 rounded-xl border border-white/5">
                     <span className="text-[9px] font-bold text-muted-foreground uppercase">{language === 'ru' ? 'Роль' : 'Role'}</span>
                     <span className="text-[10px] font-bold uppercase">{profileHero.role}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-secondary/10 rounded-xl border border-white/5">
                     <span className="text-[9px] font-bold text-muted-foreground uppercase">{language === 'ru' ? 'Страна' : 'Country'}</span>
                     <span className="text-[10px] font-bold">{profileHero.country?.flag} {profileHero.country?.code}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-secondary/10 rounded-xl border border-white/5">
                     <span className="text-[9px] font-bold text-muted-foreground uppercase">{language === 'ru' ? 'Травма' : 'Injury'}</span>
                     <span className={cn("text-[9px] font-bold uppercase", profileHero.isInjured ? "text-red-400" : "text-green-400")}>
                       {profileHero.isInjured ? (language === 'ru' ? 'Есть' : 'Yes') : (language === 'ru' ? 'Нет' : 'No')}
                     </span>
                  </div>
                </div>
              </section>

              <section className="space-y-3">
                <h3 className="text-[9px] font-black text-accent uppercase tracking-[0.2em] mb-4 flex items-center gap-2 opacity-80 px-1"><Scroll className="w-3.5 h-3.5" /> CONTRACT ACTIONS</h3>
                <div className="grid grid-cols-1 gap-2">
                  <Button variant="outline" className="justify-start h-12 border-white/5 bg-secondary/20" onClick={() => handleAction('recoverEuro')}><Coins className="w-4 h-4 mr-3 text-yellow-500" /><div className="text-left"><p className="text-[9px] font-bold uppercase">{t.recoverEuro}</p><p className="text-[8px] text-muted-foreground">-25% Fatigue | 5,000 €</p></div></Button>
                  <Button variant="outline" className="justify-start h-12 border-white/5 bg-secondary/20" onClick={() => handleAction('boostForm')}><Activity className="w-4 h-4 mr-3 text-primary" /><div className="text-left"><p className="text-[9px] font-bold uppercase">{t.boostForm}</p><p className="text-[8px] text-muted-foreground">+15% Form | 10,000 €</p></div></Button>
                </div>
              </section>

              <section>
                <h3 className="text-[9px] font-black text-primary uppercase tracking-[0.2em] mb-4 flex items-center gap-2 opacity-80 px-1">
                  <Activity className="w-3.5 h-3.5" /> {t.skills}
                </h3>
                <div className="space-y-3">
                  {STAT_KEYS.map((key) => { 
                    const Icon = icons[key] || Info;
                    const displayValue = Math.round(Number((profileHero.proStats as any)[key]));
                    const talentLimit = normTalent((profileHero.proTalents as any)[key] || 10);

                    return (
                      <div key={`skill-${key}`} className="space-y-2 p-3 rounded-xl border border-white/5 bg-secondary/10">
                        <div className="flex justify-between items-center px-0.5">
                          <div className="flex items-center gap-2">
                            <Icon className="w-4 h-4 text-muted-foreground/60" />
                            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{t.proStatsLabels[key as keyof typeof t.proStatsLabels]}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] font-mono font-bold text-white">{displayValue}</span>
                            <span className="text-[8px] text-muted-foreground/50">/</span>
                            <span className="text-[9px] font-mono font-bold text-primary/70">{talentLimit}</span>
                          </div>
                        </div>
                        <Progress value={(displayValue / talentLimit) * 100} max={100} className="h-1 rounded-full bg-secondary/40" />
                      </div>
                    ); 
                  })}
                </div>
              </section>

              <section>
                <h3 className="text-[9px] font-black text-accent uppercase tracking-[0.2em] mb-4 flex items-center gap-2 opacity-80 px-1">
                  <Zap className="w-3.5 h-3.5" /> {t.talents}
                </h3>
                <div className="space-y-2">
                  {STAT_KEYS.map((key) => {
                    const talentLimit = normTalent((profileHero.proTalents as any)[key]);
                    const Icon = icons[key] || Info;
                    return (
                      <div key={`talent-${key}`} className="p-3 bg-secondary/10 rounded-xl border border-white/5 min-h-[48px] flex flex-col justify-center">
                        <div className="flex justify-between items-center px-0.5">
                          <div className="flex items-center gap-2">
                            <Icon className="w-4 h-4 text-accent/50" />
                            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{t.proStatsLabels[key as keyof typeof t.proStatsLabels]}</span>
                          </div>
                          <div className="flex items-center gap-3">
                             {renderStars(talentLimit, 'list')}
                             <span className="text-xs font-mono font-bold text-accent">{talentLimit}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>

              <section className="pt-4 border-t border-white/5">
                <h3 className="text-[9px] font-black text-yellow-500 uppercase tracking-[0.2em] mb-4 flex items-center gap-2 opacity-80 px-1">
                  <Gem className="w-3.5 h-3.5" /> {t.priceTitle}
                </h3>
                <div className="bg-secondary/30 p-4 rounded-xl border border-white/5">
                   <p className="text-[8px] font-black text-muted-foreground uppercase">{language === 'ru' ? 'РЫНОЧНАЯ СТОИМОСТЬ' : 'ESTIMATED VALUE'}</p>
                   <p className="text-xl font-headline font-bold text-white italic">€ {(profileHero.overallRating * 15000 + 100000).toLocaleString()}</p>
                </div>
              </section>
              
              <Button variant="ghost" className="w-full h-12 text-[9px] font-black uppercase tracking-widest text-muted-foreground" onClick={() => setProfileHero(null)}>{t.close}</Button>
          </div>
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
      <div className="space-y-1.5">
        {ownedHeroes.map((hero) => {
          const onAuction = hero.onTransferUntil && new Date(hero.onTransferUntil) > new Date();
          const talentsValues = Object.values(hero.proTalents || {}).map(v => normTalent(v));
          const maxTalent = Math.max(...talentsValues);
          return (
            <Card key={hero.id} className={cn("glass-card border-white/5 hover:bg-white/5 cursor-pointer transition-all", onAuction && "border-yellow-500/30 bg-yellow-500/5")} onClick={() => setProfileHero(hero)}>
              <CardContent className="p-2 flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg overflow-hidden bg-secondary/50 border border-white/10 shrink-0"><img src={hero.image} alt={hero.name} className="w-full h-full object-cover" /></div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-[11px] font-bold truncate uppercase">{hero.name}</h3>
                    <Badge variant="outline" className="text-[6px] h-3 px-1 border-white/10 uppercase opacity-60">{hero.role}</Badge>
                    {onAuction && <Badge className="bg-yellow-500 text-black text-[6px] h-3 px-1 font-black animate-pulse uppercase">Auction</Badge>}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    {renderStars(maxTalent, 'card')}
                    <p className="text-[7px] text-muted-foreground font-black uppercase tracking-widest">Age: {calculateLiveAge(hero.baseAge, hero.hiredAt).display} {t.years}</p>
                  </div>
                </div>
                <div className="flex flex-col items-center justify-center min-w-[35px] border-l border-white/5 pl-2">
                  <p className="text-[6px] font-black text-primary uppercase tracking-tighter leading-none mb-0.5">ОБЩ</p>
                  <span className="text-lg font-headline font-bold text-accent italic leading-none">{hero.overallRating}</span>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
