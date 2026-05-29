
'use client';

import { useGameState, getLevelThreshold } from '../lib/store';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { 
  User, ShieldCheck, LogOut, 
  ChevronRight, Mail, ChevronLeft, Loader2,
  Trophy, Star, Wallet, Gem, Flag, Zap, 
  BookOpen, Users, LayoutDashboard, Newspaper, Gift, Package, Heart,
  Lock, CheckCircle2, Sparkles, Award, ScrollText, ZapIcon,
  CircleDollarSign, UserCog, HeartPulse, GraduationCap, ArrowUpCircle,
  TrendingUp
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

type ProfileTab = 'menu' | 'training' | 'team' | 'page' | 'news' | 'daily' | 'bonuses' | 'gift';

export default function ProfilePage() {
  const { 
    ownedHeroes, language, isLoaded: isStoreLoaded, 
    credits, crystals, leagueLevel, divisionSubId, groupId, rewardDay, 
    hasEliteTrophy, experiencePoints, activeLicenseTier, hq, managerLevel,
    skillPoints, managerSkills, upgradeManagerSkill, arena, bootcamp, academy, medical
  } = useGameState();
  const { user, isUserLoading } = useUser();
  const auth = useAuth();
  const db = useFirestore();
  const router = useRouter();
  const { toast } = useToast();
  
  const [activeTab, setActiveTab] = useState<ProfileTab>('menu');
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [showSkillTree, setShowSkillTree] = useState(false);

  const userRef = useMemoFirebase(() => user ? doc(db, 'players_v6', user.uid) : null, [db, user]);
  const { data: profile, isLoading: isProfileLoading } = useDoc(userRef);

  useEffect(() => {
    if (!isUserLoading && !user) {
      router.push('/auth/login');
    }
  }, [user, isUserLoading, router]);

  useEffect(() => {
    if (skillPoints > 0) {
      setShowSkillTree(true);
    }
  }, [skillPoints]);

  const calendarRewards = useMemo(() => {
    return Array.from({ length: 30 }, (_, i) => {
      const day = i + 1;
      const dayCredits = 100000 + (i * 150000) + (Math.floor(i / 7) * 500000);
      const dayCrystals = 10 + (i * 15) + (day % 7 === 0 ? 50 : 0);
      return { day, credits: dayCredits, crystals: dayCrystals };
    });
  }, []);

  // Popularity Calculation
  const popularity = useMemo(() => {
    // 1. Infrastructure: +1 for every 11 building levels total
    const totalInfraLevels = (
      (arena.pressCenterLevel || 0) + (arena.cafeLevel || 0) + (arena.shopLevel || 0) + 
      (arena.screensLevel || 0) + (arena.roofLevel || 0) + (arena.lightingLevel || 0) +
      (hq.hrLevel || 0) + (hq.financeLevel || 0) + (hq.scoutsLevel || 0) + 
      (hq.pressOfficeLevel || 0) + (hq.adminLevel || 0) +
      (bootcamp.bootcampLevel || 0) + (bootcamp.tacticsHallLevel || 0) + 
      (bootcamp.poolLevel || 0) + (bootcamp.researchLevel || 0) +
      (academy.youthBootcampLevel || 0) + (academy.streamingLevel || 0) + 
      (academy.scoutsLevel || 0) + (academy.discoLevel || 0) +
      (medical.physiotherapyLevel || 0) + (medical.massageLevel || 0) + 
      (medical.psychiatristLevel || 0) + (medical.labLevel || 0) + (medical.psychologistLevel || 0)
    );
    const infraBonus = Math.floor(totalInfraLevels / 11);

    // 2. Licenses: +3 for each license (3 -> 2 -> 1)
    let licenseBonus = 0;
    if (activeLicenseTier === 3) licenseBonus = 3;
    else if (activeLicenseTier === 2) licenseBonus = 6;
    else if (activeLicenseTier === 1) licenseBonus = 9;

    // 3. Fans: +1 for every 1000 fans (Assume fans = capacity * 1.5)
    const fanCount = (arena.capacity || 5000) * 1.5;
    const fanBonus = Math.floor(fanCount / 1000);

    // 4. League: (10 - leagueLevel) * 2
    const leagueBonus = (10 - leagueLevel) * 2;

    return 10 + infraBonus + licenseBonus + fanBonus + leagueBonus;
  }, [arena, hq, bootcamp, academy, medical, activeLicenseTier, leagueLevel]);

  if (!isStoreLoaded || isUserLoading || isProfileLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const translations = {
    en: {
      title: "LEGENDARY MANAGER",
      backToMenu: "Back to Hub",
      rosterInfo: "Roster Status",
      heroes: "Heroes",
      popularity: "Club Popularity",
      level: "Manager Level",
      nextLevel: "Next Skill Point",
      balance: "Financial Status",
      currency: "Balance €",
      crystals: "Crystals",
      league: "Current League",
      country: "Operational Sector",
      achievements: "Achievements & Trophies",
      eliteTrophy: "Elite Champion Cup",
      eliteTrophyDesc: "Awarded for winning Div 9 Group 1",
      noTrophies: "No Trophies Yet",
      logout: "LOG OUT",
      license: "Active License",
      multiplier: "XP Multiplier",
      noLicense: "None",
      hqBonus: "HQ Admin Bonus",
      skills: {
        title: "STRATEGIC DEVELOPMENT",
        points: "Skill Points Available",
        sponsors: { name: "Sponsors", desc: "+10% Income per level" },
        agents: { name: "Agents", desc: "+10% Sale profit & Agent Buyouts" },
        training: { name: "Training", desc: "+10% Player XP from matches" },
        medical: { name: "Medical", desc: "-10% Injury chance & Form boost" }
      },
      menu: [
        { id: 'training', label: "Training Task", desc: "Tutorial and progression rewards", icon: BookOpen },
        { id: 'team', label: "My Team", desc: "Personal stats, finances and skills", icon: Users },
        { id: 'page', label: "My Page", desc: "Manager profile and achievements", icon: LayoutDashboard },
        { id: 'news', label: "My News", desc: "Personal achievement feed", icon: Newspaper },
        { id: 'daily', label: "Daily Bonuses", desc: "Claim login rewards", icon: Gift },
        { id: 'bonuses', label: "My Bonuses", desc: "Active and stored boosters", icon: Package },
        { id: 'gift', label: "Gift Bonuses", desc: "Send items to other managers", icon: Heart },
      ]
    },
    ru: {
      title: "ЛЕГЕНДАРНЫЙ МЕНЕДЖЕР",
      backToMenu: "Вернуться в хаб",
      rosterInfo: "Информация о Росторе",
      heroes: "Героев",
      popularity: "Популярность клуба",
      level: "Уровень менеджера",
      nextLevel: "До очка навыков",
      balance: "Финансовый баланс",
      currency: "Баланс €",
      crystals: "Кристаллы",
      league: "Текущая Лига",
      country: "Страна",
      achievements: "Достижения и Трофеи",
      eliteTrophy: "Кубок Элитного Чемпиона",
      eliteTrophyDesc: "Награда за победу в Дивизионе 9 Группе 1",
      noTrophies: "Трофеев пока нет",
      logout: "ВЫЙТИ ИЗ СИСТЕМЫ",
      license: "Активная лицензия",
      multiplier: "Множитель XP",
      noLicense: "Отсутствует",
      hqBonus: "Бонус Администрации",
      skills: {
        title: "ОЧКИ РАЗВИТИЯ",
        points: "Доступно очков навыков",
        sponsors: { name: "Спонсоры", desc: "+10% ко всем доходам за уровень" },
        agents: { name: "Агенты", desc: "+10% к продаже и шанс выкупа 200%" },
        training: { name: "Тренировка", desc: "+10% опыта игрокам за матчи" },
        medical: { name: "Медицина", desc: "-10% шанс травм и буст формы" }
      },
      menu: [
        { id: 'training', label: "Задание обучения", desc: "Обучающие квесты и награды", icon: BookOpen },
        { id: 'team', label: "Моя команда", desc: "Статистика, навыки и настройки", icon: Users },
        { id: 'page', label: "Моя страница", desc: "Профиль и достижения", icon: LayoutDashboard },
        { id: 'news', label: "Мои новости", desc: "Лента ваших достижений", icon: Newspaper },
        { id: 'daily', label: "Дневные бонусы", desc: "Получить награды за вход", icon: Gift },
        { id: 'bonuses', label: "Мои бонусы", desc: "Активные и складские бусты", icon: Package },
        { id: 'gift', label: "Подарить бонусы", desc: "Отправить бонусы другим", icon: Heart },
      ]
    }
  };

  const t = translations[language as keyof typeof translations] || translations.ru;

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await signOut(auth);
      router.push('/auth/login');
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: error.message });
      setIsLoggingOut(false);
    }
  };

  const userCountry = COUNTRIES.find(c => c.name === profile?.country);
  const currentExp = experiencePoints || 0;
  const currentThreshold = getLevelThreshold(managerLevel);
  const progress = (currentExp / currentThreshold) * 100;

  // Multiplier Breakdown
  const hqAdminLevel = hq?.adminLevel || 0;
  const hqBonus = Math.floor(hqAdminLevel / 10) * 0.5;
  const hqMultiplier = 1 + hqBonus;

  let licenseMultiplier = 1;
  if (activeLicenseTier === 3) licenseMultiplier = 2;
  else if (activeLicenseTier === 2) licenseMultiplier = 4;
  else if (activeLicenseTier === 1) licenseMultiplier = 8;

  const totalMultiplier = hqMultiplier * licenseMultiplier;

  const skillList = [
    { key: 'sponsors', icon: CircleDollarSign, color: 'text-yellow-400', label: t.skills.sponsors.name, desc: t.skills.sponsors.desc },
    { key: 'agents', icon: UserCog, color: 'text-blue-400', label: t.skills.agents.name, desc: t.skills.agents.desc },
    { key: 'training', icon: GraduationCap, color: 'text-green-400', label: t.skills.training.name, desc: t.skills.training.desc },
    { key: 'medical', icon: HeartPulse, color: 'text-red-400', label: t.skills.medical.name, desc: t.skills.medical.desc },
  ];

  const renderContent = () => {
    if (activeTab === 'menu') {
      return (
        <div className="space-y-2 animate-in fade-in duration-500">
          {t.menu.map((item) => (
            <Card 
              key={item.id} 
              className="glass-card hover:bg-white/5 transition-all border-white/5 cursor-pointer"
              onClick={() => setActiveTab(item.id as ProfileTab)}
            >
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-2 rounded-lg bg-secondary/50">
                    <item.icon className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold uppercase">{item.label}</h3>
                    <p className="text-[10px] text-muted-foreground">{item.desc}</p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </CardContent>
            </Card>
          ))}
        </div>
      );
    }

    if (activeTab === 'team') {
      return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
          <Card className="glass-card overflow-hidden">
            <CardContent className="p-0">
              <div className="p-4 bg-primary/5 border-b border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center font-headline font-bold text-primary text-xl">
                    {managerLevel}
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase font-bold">{t.level}</p>
                    <p className="text-xs font-headline">{t.nextLevel}: {currentThreshold} XP</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs font-bold text-primary">{currentExp} / {currentThreshold} XP</p>
                </div>
              </div>
              <div className="px-4 py-2">
                <Progress value={progress} className="h-1.5" />
              </div>
              
              <div className="grid grid-cols-2 divide-x divide-white/5 border-t border-white/5">
                <div className="p-4 flex flex-col items-center gap-1">
                  <Flag className="w-4 h-4 text-muted-foreground" />
                  <p className="text-xs text-muted-foreground uppercase">{t.country}</p>
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{userCountry?.flag || '🏳️'}</span>
                    <span className="text-xs font-bold">{profile?.country || 'Unknown'}</span>
                  </div>
                </div>
                <div className="p-4 flex flex-col items-center gap-1 text-center">
                  <Trophy className="w-4 h-4 text-yellow-500" />
                  <p className="text-xs text-muted-foreground uppercase">{t.league}</p>
                  <p className="text-xs font-bold text-accent">Division {leagueLevel}.{divisionSubId}</p>
                  <p className="text-[10px] uppercase font-bold text-muted-foreground">Group {groupId}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* SKILLS OVERVIEW */}
          <div className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-accent flex items-center gap-2">
                <ArrowUpCircle className="w-3 h-3" /> {t.skills.title}
              </h2>
              {skillPoints > 0 && (
                <Badge className="bg-primary text-primary-foreground text-[8px] animate-pulse">
                  {skillPoints} POINTS
                </Badge>
              )}
            </div>
            <Card className="glass-card border-white/10 hover:border-primary/30 transition-all cursor-pointer" onClick={() => setShowSkillTree(true)}>
              <CardContent className="p-4">
                 <div className="grid grid-cols-2 gap-4">
                   {skillList.map(s => (
                     <div key={s.key} className="flex items-center gap-2">
                       <s.icon className={cn("w-3.5 h-3.5", s.color)} />
                       <div className="flex-1">
                         <div className="flex justify-between items-center">
                           <span className="text-[9px] font-bold uppercase">{s.label}</span>
                           <span className="text-[9px] font-mono font-bold text-white">LVL {(managerSkills as any)[s.key]}</span>
                         </div>
                         <Progress value={((managerSkills as any)[s.key] / 100) * 100} className="h-0.5 mt-1" />
                       </div>
                     </div>
                   ))}
                 </div>
              </CardContent>
            </Card>
          </div>

          {/* XP MULTIPLIERS SECTION */}
          <div className="space-y-3">
            <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-accent px-1 flex items-center gap-2">
               <ZapIcon className="w-3 h-3" /> {t.multiplier}
            </h2>
            <Card className="glass-card bg-gradient-to-br from-primary/5 to-transparent border-primary/20">
               <CardContent className="p-4 space-y-4">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                       <ScrollText className="w-4 h-4 text-red-400" />
                       <span className="text-xs font-bold uppercase">{t.license}</span>
                    </div>
                    <Badge variant="outline" className={cn("text-[10px] font-black", activeLicenseTier ? "border-red-500/50 text-red-400" : "opacity-30")}>
                       {activeLicenseTier ? `TIER ${activeLicenseTier} (x${licenseMultiplier})` : t.noLicense}
                    </Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                       <ShieldCheck className="w-4 h-4 text-blue-400" />
                       <span className="text-xs font-bold uppercase">{t.hqBonus}</span>
                    </div>
                    <Badge variant="outline" className={cn("text-[10px] font-black", hqBonus > 0 ? "border-blue-500/50 text-blue-400" : "opacity-30")}>
                       LVL {hqAdminLevel} (+{hqBonus}x)
                    </Badge>
                  </div>
                  <div className="pt-2 border-t border-white/5 flex justify-between items-center">
                     <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Final Boost</span>
                     <span className="text-lg font-headline font-black italic text-primary">x{totalMultiplier.toFixed(1)}</span>
                  </div>
               </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Card className="glass-card text-center bg-gradient-to-b from-primary/10 to-transparent border-primary/20">
              <CardContent className="p-4 flex flex-col items-center gap-1">
                <TrendingUp className="w-4 h-4 text-primary" />
                <p className="text-2xl font-headline font-bold text-primary">{popularity}</p>
                <p className="text-[9px] text-muted-foreground uppercase font-bold tracking-widest">{t.popularity}</p>
              </CardContent>
            </Card>
            <Card className="glass-card text-center bg-gradient-to-b from-accent/10 to-transparent border-accent/20">
              <CardContent className="p-4 flex flex-col items-center gap-1">
                <Zap className="w-4 h-4 text-accent" />
                <p className="text-2xl font-headline font-bold text-accent">{ownedHeroes.length}</p>
                <p className="text-[9px] text-muted-foreground uppercase font-bold tracking-widest">{t.heroes}</p>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-4">
            <h2 className="text-xs font-headline font-bold text-accent uppercase tracking-[0.2em] px-1 flex items-center gap-2">
              <Wallet className="w-3.5 h-3.5" /> {t.balance}
            </h2>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-secondary/30 rounded-xl border border-white/5 p-4 flex items-center gap-3">
                <div className="p-2 rounded-lg bg-yellow-500/20"><span className="text-yellow-500 font-bold">€</span></div>
                <div>
                  <p className="text-[9px] text-muted-foreground uppercase font-bold">{t.currency}</p>
                  <p className="text-sm font-headline font-bold">{formatCurrency(credits)}</p>
                </div>
              </div>
              <div className="bg-secondary/30 rounded-xl border border-white/5 p-4 flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-500/20"><Gem className="w-4 h-4 text-blue-400" /></div>
                <div>
                  <p className="text-[9px] text-muted-foreground uppercase font-bold">{t.crystals}</p>
                  <p className="text-sm font-headline font-bold">{formatCurrency(crystals || 0)}</p>
                </div>
              </div>
            </div>
          </div>

          <Button 
            variant="destructive" 
            className="w-full h-12 hero-gradient border-none shadow-lg hover:opacity-90 transition-all font-bold flex items-center gap-2"
            onClick={handleLogout}
            disabled={isLoggingOut}
          >
            {isLoggingOut ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogOut className="w-4 h-4" />}
            {t.logout}
          </Button>
        </div>
      );
    }

    if (activeTab === 'page') {
      return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
          <div className="space-y-4">
            <h2 className="text-xs font-headline font-bold text-accent uppercase tracking-[0.2em] px-1 flex items-center gap-2">
              <Award className="w-3 h-3" /> {t.achievements}
            </h2>
            
            {hasEliteTrophy ? (
              <Card className="glass-card bg-gradient-to-br from-yellow-500/20 to-transparent border-yellow-500/30 overflow-hidden">
                <CardContent className="p-6 flex items-center gap-6">
                  <div className="w-20 h-20 rounded-full bg-yellow-500/20 flex items-center justify-center border-2 border-yellow-500 shadow-[0_0_30px_rgba(234,179,8,0.3)] animate-pulse">
                    <Trophy className="w-10 h-10 text-yellow-500" />
                  </div>
                  <div>
                    <h3 className="text-lg font-headline font-bold text-yellow-500 uppercase tracking-tight">{t.eliteTrophy}</h3>
                    <p className="text-xs text-muted-foreground italic mt-1">{t.eliteTrophyDesc}</p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="py-12 flex flex-col items-center justify-center text-center space-y-4 opacity-40">
                <Trophy className="w-12 h-12 text-muted-foreground" />
                <p className="text-xs font-bold uppercase tracking-widest">{t.noTrophies}</p>
              </div>
            )}
          </div>
        </div>
      );
    }

    if (activeTab === 'daily') {
      return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500 pb-10">
          <div className="grid grid-cols-3 gap-2">
            {calendarRewards.map((reward) => {
              const isClaimed = reward.day < rewardDay;
              const isToday = reward.day === rewardDay;
              const isUpcoming = reward.day > rewardDay;

              return (
                <div key={reward.day} className={cn(
                  "relative p-3 rounded-xl border flex flex-col items-center justify-center transition-all",
                  isClaimed ? "bg-secondary/20 border-white/5 opacity-50" : 
                  isToday ? "bg-primary/10 border-primary shadow-[0_0_15px_rgba(var(--primary),0.2)] ring-1 ring-primary/50" : 
                  "bg-secondary/40 border-white/5"
                )}>
                  <span className={cn("text-[8px] font-black uppercase tracking-tighter mb-1", isToday ? "text-primary" : "text-muted-foreground")}>Day {reward.day}</span>
                  <div className="space-y-1 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <CircleDollarSign className={cn("w-2.5 h-2.5", isToday ? "text-yellow-500" : "text-muted-foreground")} />
                      <span className="text-[9px] font-bold">{formatCurrency(reward.credits)}</span>
                    </div>
                    <div className="flex items-center justify-center gap-1">
                      <Gem className={cn("w-2.5 h-2.5", isToday ? "text-accent" : "text-muted-foreground")} />
                      <span className="text-[9px] font-bold">{formatCurrency(reward.crystals)}</span>
                    </div>
                  </div>
                  {isClaimed && <div className="absolute inset-0 flex items-center justify-center bg-background/40 backdrop-blur-[1px] rounded-xl"><CheckCircle2 className="w-5 h-5 text-green-500" /></div>}
                  {isUpcoming && <div className="absolute top-1 right-1"><Lock className="w-2 h-2 text-muted-foreground/50" /></div>}
                  {isToday && <div className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-[6px] font-black px-1 rounded uppercase flex items-center gap-0.5"><Sparkles className="w-1.5 h-1.5" /> TODAY</div>}
                </div>
              );
            })}
          </div>
        </div>
      );
    }

    return (
      <div className="flex flex-col items-center justify-center py-20 text-center animate-in fade-in duration-500">
        <div className="w-16 h-16 rounded-full bg-secondary/50 flex items-center justify-center mb-4 border border-white/5">
          <Loader2 className="w-8 h-8 text-muted-foreground/30 animate-spin" />
        </div>
        <p className="text-xs text-muted-foreground uppercase tracking-widest max-w-[200px] leading-relaxed">Terminal data not yet synchronized.</p>
      </div>
    );
  };

  return (
    <div className="max-w-md mx-auto px-4 pt-8 pb-24">
      <header className="flex flex-col items-center mb-10 relative">
        <div className="absolute left-0 top-0">
          <Button variant="ghost" size="icon" className="rounded-full" onClick={() => activeTab === 'menu' ? router.push('/') : setActiveTab('menu')}><ChevronLeft className="w-6 h-6" /></Button>
        </div>
        <div className="w-24 h-24 rounded-full border-4 border-primary/20 p-1 mb-4 bg-secondary shadow-[0_0_20px_rgba(var(--primary),0.3)]">
          <div className="w-full h-full rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center"><User className="w-12 h-12 text-primary-foreground" /></div>
        </div>
        <h1 className="text-2xl font-headline font-bold uppercase tracking-tight text-center">{profile?.displayName || t.title}</h1>
        <p className="text-muted-foreground text-[10px] flex items-center gap-1 mt-1 opacity-70 uppercase font-bold tracking-widest"><Mail className="w-2 h-2" /> {user?.email}</p>
      </header>
      {renderContent()}

      <Dialog open={showSkillTree} onOpenChange={setShowSkillTree}>
        <DialogContent className="max-w-sm bg-card border-white/10 p-0 overflow-hidden shadow-2xl">
          <div className="p-6 text-center bg-gradient-to-br from-primary/20 via-background to-accent/10 border-b border-white/5">
            <DialogTitle className="text-xl font-headline font-bold uppercase tracking-tight text-primary">
              {t.skills.title}
            </DialogTitle>
            <DialogDescription className="text-[10px] text-muted-foreground mt-2 uppercase tracking-widest font-bold">
              {t.skills.points}: {skillPoints}
            </DialogDescription>
          </div>

          <div className="p-4 space-y-3 overflow-y-auto max-h-[60vh] scrollbar-hide">
             {skillList.map((skill) => {
               const currentLvl = (managerSkills as any)[skill.key];
               return (
                 <Card key={skill.key} className="glass-card border-white/5 bg-secondary/10">
                   <CardContent className="p-4 flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className={cn("p-2 rounded-lg bg-secondary/50", skill.color)}>
                          <skill.icon className="w-5 h-5" />
                        </div>
                        <div>
                          <h4 className="text-[10px] font-black uppercase text-white">{skill.label}</h4>
                          <p className="text-[8px] text-muted-foreground italic leading-tight">{skill.desc}</p>
                          <div className="flex items-center gap-2 mt-1.5">
                            <Progress value={(currentLvl / 100) * 100} className="h-0.5 w-20" />
                            <span className="text-[8px] font-black text-primary">LVL {currentLvl} / 100</span>
                          </div>
                        </div>
                      </div>
                      <Button 
                        size="icon" 
                        className={cn(
                          "w-8 h-8 rounded-lg hero-gradient shadow-lg",
                          (skillPoints <= 0 || currentLvl >= 100) && "opacity-20 grayscale"
                        )}
                        disabled={skillPoints <= 0 || currentLvl >= 100}
                        onClick={() => upgradeManagerSkill(skill.key as any)}
                      >
                        <Zap className="w-4 h-4" />
                      </Button>
                   </CardContent>
                 </Card>
               );
             })}
          </div>

          <div className="p-4 bg-secondary/20 border-t border-white/5">
             <Button variant="outline" className="w-full h-11 text-[10px] font-bold uppercase border-white/10" onClick={() => setShowSkillTree(false)}>
               {language === 'ru' ? 'ЗАКРЫТЬ' : 'CLOSE'}
             </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
