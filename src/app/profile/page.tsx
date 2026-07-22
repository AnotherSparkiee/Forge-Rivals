'use client';

import { useGameState, getLevelThreshold, Gift } from '../lib/store';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { 
  User, ShieldCheck, LogOut, RefreshCw,
  ChevronRight, ChevronLeft, Loader2,
  Trophy, Star, Wallet, Gem, Flag, Zap, 
  Award, ScrollText, CircleDollarSign, 
  UserCog, HeartPulse, GraduationCap, 
  TrendingUp, BarChart3, Building2, MapPin,
  Shield, Activity, Settings2, Info, AlertTriangle, Trash2, Medal,
  Gift as GiftIcon, Package, CheckCircle2, Clock, Crown, Coins
} from 'lucide-react';
import { cn, formatCurrency } from '@/lib/utils';
import { useAuth, useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { signOut } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import { useState, useEffect, useMemo } from 'react';
import { useToast } from '@/hooks/use-toast';
import { doc } from 'firebase/firestore';
import { COUNTRIES } from '@/app/lib/countries-data';
import { Badge } from '@/components/ui/badge';
import { LoadingScreen } from '@/components/game/LoadingScreen';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

type ProfileTab = 'menu' | 'team' | 'gifts';

export default function ProfilePage() {
  const { 
    ownedPlayers, language, isLoaded: isStoreLoaded, 
    credits, crystals, leagueLevel, 
    experiencePoints, activeLicenseTier, hq, managerLevel,
    skillPoints, managerSkills, upgradeManagerSkill, arena, bootcamp, academy, medical,
    isPremium, premiumUntil, resetProfile, trophies, receivedGifts = [], claimGift
  } = useGameState();
  const { user, isUserLoading } = useUser();
  const auth = useAuth();
  const db = useFirestore();
  const router = useRouter();
  const { toast } = useToast();
  
  const [activeTab, setActiveTab] = useState<ProfileTab>('menu');
  const [isResetting, setIsResetting] = useState(false);
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [isClaiming, setIsClaiming] = useState<string | null>(null);

  const userRef = useMemoFirebase(() => user ? doc(db, 'players_v10', user.uid) : null, [db, user]);
  const { data: profile, isLoading: isProfileLoading } = useDoc(userRef);

  useEffect(() => {
    if (!isUserLoading && !user) {
      router.push('/');
    }
  }, [user, isUserLoading, router]);

  // Переработанная система популярности в числовом виде
  const popularityPoints = useMemo(() => {
    // 1. Лига (от 1000 до 9000 очков)
    const leaguePoints = (10 - (leagueLevel || 9)) * 1000;

    // 2. Инфраструктура (+150 за каждый уровень постройки)
    const totalInfraLevels = (
      (arena.pressCenterLevel || 0) + (arena.cafeLevel || 0) + (arena.shopLevel || 0) + 
      (arena.screensLevel || 0) + (arena.parkingLevel || 0) + (arena.lightingLevel || 0) +
      (hq.hrLevel || 0) + (hq.financeLevel || 0) + (hq.scoutsLevel || 0) + 
      (hq.pressOfficeLevel || 0) + (hq.adminLevel || 0) +
      (bootcamp.bootcampLevel || 0) + (bootcamp.tacticsHallLevel || 0) + 
      (bootcamp.poolLevel || 0) + (bootcamp.researchLevel || 0) +
      (academy.youthBootcampLevel || 0) + (academy.streamingLevel || 0) + 
      (academy.scoutsLevel || 0) + (academy.discoLevel || 0) +
      (medical.physiotherapyLevel || 0) + (medical.massageLevel || 0) + 
      (medical.psychiatristLevel || 0) + (medical.labLevel || 0) + (medical.psychologistLevel || 0)
    );
    const infraPoints = totalInfraLevels * 150;
    
    // 3. PRO игроки (+5000 за каждого)
    const proPlayerPoints = ownedPlayers.filter(p => p.isPro).length * 5000;
    
    // 4. Фан-база (+0.5 за каждое место)
    const fanPoints = Math.floor((arena.capacity || 5000) * 0.5);

    // 5. Премиум бонус (+25000)
    const premiumPoints = isPremium ? 25000 : 0;

    // 6. Лицензия
    let licensePoints = 0;
    if (activeLicenseTier === 3) licensePoints = 5000;
    else if (activeLicenseTier === 2) licensePoints = 15000;
    else if (activeLicenseTier === 1) licensePoints = 35000;
    
    return 5000 + leaguePoints + infraPoints + proPlayerPoints + fanPoints + premiumPoints + licensePoints;
  }, [arena, hq, bootcamp, academy, medical, activeLicenseTier, leagueLevel, isPremium, ownedPlayers]);

  const currentXp = experiencePoints || 0;
  const xpThreshold = getLevelThreshold(managerLevel || 1);
  const xpProgress = Math.min(100, (currentXp / xpThreshold) * 100);

  if (!isStoreLoaded || isUserLoading || isProfileLoading) {
    return <LoadingScreen />;
  }

  const translations = {
    en: {
      title: "LEGENDARY MANAGER",
      backToMenu: "Back to Hub",
      lvl: "УР",
      xp: "XP Progress",
      popularity: "Global Status",
      resetBtn: "RESET PROFILE",
      resetTitle: "ABSOLUTE RESET",
      resetDesc: "This action will PERMANENTLY delete your team, progress, and assets. You will have to initialize your club again. THIS CANNOT BE UNDONE.",
      teamStats: "Operational Balance",
      premiumActive: "ELITE STATUS ACTIVE",
      premiumExp: "Expires",
      trophies: "TROPHIES",
      noTrophies: "No trophies won yet. Win tournaments to see them here.",
      skills: {
        title: "STRATEGIC DEVELOPMENT",
        points: "Points Available",
        sponsors: "Sponsor Relations",
        agents: "Transfer Agents",
        training: "Training Methods",
        medical: "Medical Center"
      },
      tabs: {
        team: "MY TEAM",
        gifts: "GIFTS",
        menu: "DASHBOARD"
      },
      gifts: {
        title: "DIPLOMATIC STORAGE",
        received: "Incoming Shipments",
        activate: "ACTIVATE",
        noGifts: "Storage empty",
        noGiftsDesc: "Connect with S-Tier allies to receive support packages.",
        success: "Bonus Applied!",
        fail: "No targets available",
        failDesc: "Ensure you have active construction, staff, or youth players."
      }
    },
    ru: {
      title: "ЛЕГЕНДАРНЫЙ МЕНЕДЖЕР",
      backToMenu: "Вернуться в хаб",
      lvl: "УР",
      xp: "Опыт менеджера",
      popularity: "Статус в мире",
      resetBtn: "СБРОСИТЬ ПРОФИЛЬ",
      resetTitle: "ПОЛНЫЙ СБРОС",
      resetDesc: "Это действие НАВСЕГДА удалит вашу команду, весь прогресс и активы. Вам придется заново инициализировать клуб. ЭТО ДЕЙСТВИЕ НЕЛЬЗЯ ОТМЕНИТЬ.",
      teamStats: "Операционный баланс",
      premiumActive: "ЭЛИТНЫЙ СТАТУС АКТИВЕН",
      premiumExp: "Истекает",
      trophies: "ТРОФЕИ",
      noTrophies: "Трофеев пока нет. Выигрывайте турниры, чтобы они появились здесь.",
      skills: {
        title: "РАЗВИТИЕ КЛУБА",
        points: "Очки навыков",
        sponsors: "Спонсоры",
        agents: "Агенты",
        training: "Тренировки",
        medical: "Медицина"
      },
      tabs: {
        team: "МОЯ КОМАНДА",
        gifts: "ПОДАРКИ",
        menu: "ГЛАВНАЯ"
      },
      gifts: {
        title: "СКЛАД ПОДАРКОВ",
        received: "Входящие грузы",
        activate: "АКТИВИРОВАТЬ",
        noGifts: "Склад пуст",
        noGiftsDesc: "Дружите с игроками ранга S-Tier, чтобы получать поддержку.",
        success: "Бонус применен!",
        fail: "Нет цели для бонуса",
        failDesc: "Убедитесь, что у вас есть активная постройка, персонал или юниоры."
      }
    }
  };

  const t = translations[language as 'en' | 'ru'] || translations.ru;

  const handleReset = async () => {
    setIsResetting(true);
    try {
      await resetProfile();
      toast({ title: language === 'ru' ? "Профиль сброшен" : "Profile Reset Complete" });
    } catch (e) {
      toast({ variant: "destructive", title: "Reset Failed" });
    } finally {
      setIsResetting(false);
      setShowResetDialog(false);
    }
  };

  const handleClaimGiftAction = async (gift: Gift) => {
    setIsClaiming(gift.id);
    const success = await claimGift(gift);
    if (success) {
      toast({ title: t.gifts.success });
    } else {
      toast({ 
        variant: "destructive", 
        title: t.gifts.fail, 
        description: t.gifts.failDesc 
      });
    }
    setIsClaiming(null);
  };

  const renderGiftsView = () => (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
      <Card className="glass-card border-accent/20 bg-accent/5 overflow-hidden">
        <CardContent className="p-6 text-center">
          <GiftIcon className="w-12 h-12 text-accent mx-auto mb-4 animate-bounce" />
          <h2 className="text-xl font-headline font-bold uppercase tracking-tight text-white">{t.gifts.title}</h2>
          <p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest mt-1">Operational Support Terminal</p>
        </CardContent>
      </Card>

      <div className="space-y-3">
        <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-1">{t.gifts.received}</h3>
        {(receivedGifts?.length || 0) > 0 ? (
          <div className="grid grid-cols-1 gap-2">
            {receivedGifts.map((gift) => (
              <Card key={gift.id} className="glass-card border-white/5 bg-secondary/10 overflow-hidden">
                <CardContent className="p-4 flex items-center justify-between">
                   <div className="flex items-center gap-4">
                      <div className="p-2.5 rounded-xl bg-accent/10 border border-accent/20">
                        <Package className="w-5 h-5 text-accent" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold uppercase text-white leading-tight">{gift.label}</h4>
                        <p className="text-[9px] text-muted-foreground uppercase font-black mt-1">From: {gift.senderName || 'Unknown'}</p>
                      </div>
                   </div>
                   <Button 
                    size="sm" 
                    className="hero-gradient font-black text-[9px] h-9 px-4 uppercase tracking-widest shadow-lg shadow-primary/20"
                    onClick={() => handleClaimGiftAction(gift)}
                    disabled={isClaiming === gift.id}
                   >
                     {isClaiming === gift.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : t.gifts.activate}
                   </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="py-20 text-center opacity-30 border border-dashed border-white/10 rounded-2xl flex flex-col items-center gap-4 px-10">
             <Package className="w-12 h-12" />
             <div>
               <p className="text-sm font-bold uppercase text-white">{t.gifts.noGifts}</p>
               <p className="text-[9px] font-black uppercase mt-1 leading-relaxed">{t.gifts.noGiftsDesc}</p>
             </div>
          </div>
        )}
      </div>
    </div>
  );

  const renderTeamView = () => (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-6">
      {isPremium && (
        <Card className="glass-card bg-accent/5 border-accent/20 overflow-hidden relative">
          <CardContent className="p-4 flex items-center gap-4">
             <div className="p-3 rounded-full bg-accent/20 border border-accent/50 shadow-[0_0_15px_rgba(var(--accent),0.2)]">
               <ShieldCheck className="w-6 h-6 text-accent" />
             </div>
             <div>
               <p className="text-xs font-black text-accent uppercase tracking-widest">{t.premiumActive}</p>
               <p className="text-[10px] text-muted-foreground uppercase">{t.premiumExp}: {new Date(premiumUntil!).toLocaleDateString()}</p>
             </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Card className="glass-card bg-primary/5 border-primary/20">
          <CardContent className="p-4 flex flex-col items-center text-center">
            <TrendingUp className="w-5 h-5 text-primary mb-2" />
            <p className="text-[8px] font-black text-muted-foreground uppercase mb-1">{t.popularity}</p>
            <p className="text-2xl font-headline font-black italic text-primary">{popularityPoints.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card className="glass-card bg-accent/5 border-accent/20">
          <CardContent className="p-4 flex flex-col items-center text-center">
            <ScrollText className="w-5 h-5 text-accent mb-2" />
            <p className="text-[8px] font-black text-muted-foreground uppercase mb-1">XP LICENSE</p>
            <p className="text-lg font-headline font-black italic text-accent">
              {activeLicenseTier ? `TIER ${activeLicenseTier}` : 'NONE'}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="glass-card border-white/5 bg-secondary/10">
        <CardContent className="p-4 space-y-4">
          <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
            <BarChart3 className="w-3.5 h-3.5" /> {t.teamStats}
          </h3>
          <div className="grid grid-cols-1 gap-2">
            <div className="flex items-center justify-between p-3 bg-background/40 rounded-xl border border-white/5">
              <span className="text-[9px] font-bold text-muted-foreground uppercase flex items-center gap-1.5"><Coins className="w-3 h-3 text-yellow-500" /> Euro Balance</span>
              <span className="text-xs font-mono font-bold text-white">€ {credits.toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-background/40 rounded-xl border border-white/5">
              <span className="text-[9px] font-bold text-muted-foreground uppercase flex items-center gap-1.5"><Gem className="w-3 h-3 text-blue-400" /> Crystals</span>
              <span className="text-xs font-mono font-bold text-blue-400">{crystals.toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-background/40 rounded-xl border border-white/5">
              <span className="text-[9px] font-bold text-muted-foreground uppercase">Squad Evaluation</span>
              <span className="text-xs font-mono font-bold text-white">€ {(ownedPlayers.length * 250000).toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-background/40 rounded-xl border border-white/5">
              <span className="text-[9px] font-bold text-muted-foreground uppercase">Squad Size</span>
              <span className="text-xs font-mono font-bold text-white">{ownedPlayers.length} / {isPremium ? 15 : (activeLicenseTier === 1 ? 12 : (activeLicenseTier === 2 ? 10 : (activeLicenseTier === 3 ? 8 : 7)))}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-background/40 rounded-xl border border-white/5">
              <span className="text-[9px] font-bold text-muted-foreground uppercase">Arena Capacity</span>
              <span className="text-xs font-mono font-bold text-white">{arena.capacity.toLocaleString()}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-accent flex items-center gap-2 px-1">
            <Award className="w-4 h-4" /> {t.skills.title}
          </h3>
          <Badge className="bg-accent text-accent-foreground text-[9px] font-black px-3 animate-pulse">
            {skillPoints} {t.skills.points}
          </Badge>
        </div>
        <div className="grid grid-cols-1 gap-3">
          {[
            { key: 'sponsors', icon: CircleDollarSign, label: t.skills.sponsors, color: 'text-yellow-400', desc: isPremium ? '+200% Active' : '+10% Income' },
            { key: 'agents', icon: UserCog, label: t.skills.agents, color: 'text-blue-400', desc: '+10% Sale Fee' },
            { key: 'training', icon: GraduationCap, label: t.skills.training, color: 'text-primary', colorVal: 'hsl(var(--primary))', desc: isPremium ? '5x XP Active' : '+10% XP Rate' },
            { key: 'medical', icon: HeartPulse, label: t.skills.medical, color: 'text-red-400', desc: '+10% Form Limit' }
          ].map((skill) => (
            <Card key={skill.key} className="glass-card border-white/5 overflow-hidden group">
              <CardContent className="p-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className={cn("p-2.5 rounded-xl bg-secondary/50 border border-white/5 transition-transform group-hover:scale-110", skill.color)}>
                    <skill.icon className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold uppercase text-white tracking-tight">{skill.label}</h4>
                    <div className="flex items-center gap-2 mt-0.5">
                      <p className="text-[9px] text-muted-foreground font-black">Ур {(managerSkills as any)[skill.key]}</p>
                      <span className="w-1 h-1 rounded-full bg-white/10"></span>
                      <p className="text-[8px] text-accent font-bold uppercase">{skill.desc}</p>
                    </div>
                  </div>
                </div>
                <Button 
                  size="sm" 
                  className={cn(
                    "h-9 px-4 font-black text-[9px] uppercase tracking-widest transition-all shadow-lg",
                    skillPoints > 0 ? "hero-gradient shadow-primary/20" : "bg-secondary/50 text-muted-foreground opacity-50"
                  )}
                  disabled={skillPoints <= 0}
                  onClick={() => upgradeManagerSkill(skill.key as any)}
                >
                  {skillPoints > 0 ? 'UPGRADE' : 'LOCKED'}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <div className="max-w-md mx-auto px-4 pt-8 pb-6">
      <header className="flex flex-col items-center mb-10 relative">
        <Button variant="ghost" size="icon" className="absolute left-0 top-0 rounded-full" onClick={() => router.push('/')}><ChevronLeft className="w-6 h-6" /></Button>
        <div className="relative group mb-4">
          <div className={cn("absolute -inset-4 rounded-full blur-2xl transition-all", isPremium ? "bg-accent/30 group-hover:bg-accent/40" : "bg-primary/20 group-hover:bg-primary/30")}></div>
          <div className={cn("w-24 h-24 rounded-full flex items-center justify-center shadow-2xl relative z-10 border-2", isPremium ? "bg-gradient-to-br from-accent to-blue-600 border-accent/40" : "bg-gradient-to-br from-primary to-accent border-white/10")}>
            <User className="w-12 h-12 text-white" />
          </div>
          <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-background border border-white/10 px-3 py-0.5 rounded-full z-20 shadow-xl">
            <span className="text-[10px] font-black text-primary uppercase tracking-widest whitespace-nowrap">{t.lvl} {managerLevel || 1}</span>
          </div>
        </div>
        <div className="text-center space-y-3">
          {isPremium ? (
            <div className="relative inline-flex items-center min-w-0 max-w-full">
              <div className="absolute inset-0 bg-gradient-to-r from-accent/30 via-accent/5 to-transparent border-l-2 border-accent -z-10" />
              <h1 className="px-6 py-1 text-2xl font-headline font-black uppercase tracking-tight text-white truncate">
                {profile?.displayName || 'Syncing...'}
              </h1>
            </div>
          ) : (
            <h1 className="text-2xl font-headline font-black uppercase tracking-tight text-white">
              {profile?.displayName || 'Syncing...'}
            </h1>
          )}
          <p className="text-[10px] text-muted-foreground uppercase font-black tracking-[0.2em] opacity-60 flex items-center justify-center gap-2">
            <MapPin className="w-3 h-3 text-primary" /> {profile?.country || 'International'}
          </p>
        </div>
        <div className="w-full max-w-[240px] mt-6 space-y-2">
           <div className="flex justify-between items-center text-[9px] font-black uppercase tracking-widest px-1"><span className="text-muted-foreground">{t.xp}</span><span className="text-primary">{currentXp.toLocaleString()} / {xpThreshold.toLocaleString()}</span></div>
           <div className="relative h-2 w-full bg-secondary/50 rounded-full overflow-hidden border border-white/5"><div className="absolute top-0 left-0 h-full hero-gradient transition-all duration-1000 ease-out shadow-[0_0_10px_rgba(var(--primary),0.5)]" style={{ width: `${xpProgress}%` }} /></div>
        </div>
      </header>

      <div className="grid grid-cols-3 gap-2 mb-8 bg-secondary/20 p-1 rounded-xl border border-white/5">
        {(['menu', 'team', 'gifts'] as const).map((tab) => (
          <Button 
            key={tab} 
            variant="ghost" 
            size="sm" 
            onClick={() => setActiveTab(tab)} 
            className={cn(
              "relative h-10 text-[10px] font-black uppercase tracking-widest transition-all", 
              activeTab === tab ? "bg-white/10 text-primary shadow-inner" : "text-muted-foreground hover:text-white"
            )}
          >
            {t.tabs[tab]}
            {tab === 'gifts' && (receivedGifts?.length || 0) > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full flex items-center justify-center text-[8px] font-black animate-pulse">
                {receivedGifts.length}
              </span>
            )}
          </Button>
        ))}
      </div>

      {activeTab === 'menu' && (
        <div className="space-y-4 animate-in fade-in duration-500 pb-20">
          <Card className="glass-card border-primary/20 bg-primary/5 p-6">
             <div className="flex items-center gap-2 mb-4">
               <Trophy className="w-5 h-5 text-yellow-500" />
               <h3 className="text-sm font-black uppercase text-white tracking-widest">{t.trophies}</h3>
             </div>
             
             {trophies && trophies.length > 0 ? (
               <div className="grid grid-cols-1 gap-2">
                 {trophies.map((trophy: any, idx: number) => (
                   <div key={idx} className="bg-secondary/30 p-3 rounded-xl border border-white/5 flex items-center justify-between">
                     <div className="flex items-center gap-3">
                       <div className="p-2 rounded-lg bg-yellow-500/10"><Medal className="w-4 h-4 text-yellow-500" /></div>
                       <div>
                         <p className="text-[10px] font-bold text-white uppercase">{trophy.name}</p>
                         <p className="text-[8px] text-muted-foreground uppercase">{new Date(trophy.date).toLocaleDateString()}</p>
                       </div>
                     </div>
                     {trophy.reward && <Badge variant="outline" className="text-[8px] text-green-400 border-green-500/30">+{trophy.reward.toLocaleString()} €</Badge>}
                   </div>
                 ))}
               </div>
             ) : (
               <div className="py-8 text-center opacity-30 flex flex-col items-center gap-3 border border-dashed border-white/10 rounded-xl">
                 <Trophy className="w-8 h-8" />
                 <p className="text-[9px] uppercase font-bold max-w-[180px] leading-relaxed">{t.noTrophies}</p>
               </div>
             )}
          </Card>

          <div className="grid grid-cols-1 gap-2">
            <Button variant="outline" className="h-12 border-white/5 bg-secondary/20 hover:bg-white/5 justify-between px-4 group" onClick={() => setActiveTab('team')}><div className="flex items-center gap-3"><Shield className="w-4 h-4 text-primary group-hover:scale-110 transition-transform" /><span className="text-[10px] font-black uppercase">Club Infrastructure Overview</span></div><ChevronRight className="w-4 h-4 text-muted-foreground" /></Button>
            <Button variant="outline" className="h-12 border-white/5 bg-secondary/20 hover:bg-white/5 justify-between px-4 group"><div className="flex items-center gap-3"><Settings2 className="w-4 h-4 text-accent group-hover:scale-110 transition-transform" /><span className="text-[10px] font-black uppercase">Security & Account Settings</span></div><ChevronRight className="w-4 h-4 text-muted-foreground" /></Button>
          </div>
          <div className="pt-6">
            <Button 
              variant="destructive" 
              className="w-full h-14 hero-gradient border-none font-black text-xs tracking-[0.2em] uppercase shadow-2xl active:scale-95 transition-all" 
              onClick={() => setShowResetDialog(true)}
              disabled={isResetting}
            >
              {isResetting ? <Loader2 className="animate-spin" /> : <><RefreshCw className="w-4 h-4 mr-2" /> {t.resetBtn}</>}
            </Button>
          </div>
        </div>
      )}

      {activeTab === 'team' && renderTeamView()}
      {activeTab === 'gifts' && renderGiftsView()}
      
      <Dialog open={showResetDialog} onOpenChange={setShowResetDialog}>
        <DialogContent className="max-w-xs bg-card border-white/10 p-6">
          <DialogHeader>
            <div className="mx-auto w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mb-4 border border-red-500/20">
              <AlertTriangle className="w-8 h-8 text-red-500 animate-pulse" />
            </div>
            <DialogTitle className="text-center font-headline font-bold uppercase text-red-500">
              {t.resetTitle}
            </DialogTitle>
            <DialogDescription className="text-center text-xs text-muted-foreground mt-2">{t.resetDesc}</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2 mt-6">
            <Button 
              variant="destructive" 
              className="h-12 font-black uppercase text-[10px]" 
              onClick={handleReset}
              disabled={isResetting}
            >
              {isResetting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4 mr-2" />} 
              {language === 'ru' ? 'ПОДТВЕРДИТЬ СБРОС' : 'CONFIRM RESET'}
            </Button>
            <Button 
              variant="outline" 
              className="h-12 font-bold uppercase text-[10px] border-white/10" 
              onClick={() => setShowResetDialog(false)}
              disabled={isResetting}
            >
              {language === 'ru' ? 'ОТМЕНА' : 'CANCEL'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
