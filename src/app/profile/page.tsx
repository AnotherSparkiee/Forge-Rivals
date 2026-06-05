
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
  TrendingUp, BarChart3, Building2, MapPin
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

  const userRef = useMemoFirebase(() => user ? doc(db, 'players_v10', user.uid) : null, [db, user]);
  const { data: profile, isLoading: isProfileLoading } = useDoc(userRef);

  useEffect(() => {
    if (!isUserLoading && !user) {
      router.push('/auth/register');
    }
  }, [user, isUserLoading, router]);

  const popularity = useMemo(() => {
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
    const infraBonus = Math.floor(totalInfraLevels / 10);
    let licenseBonus = 0;
    if (activeLicenseTier === 3) licenseBonus = 5;
    else if (activeLicenseTier === 2) licenseBonus = 10;
    else if (activeLicenseTier === 1) licenseBonus = 20;
    
    const fanCount = (arena.capacity || 5000) * 1.5;
    const fanBonus = Math.floor(fanCount / 1500);
    const leagueBonus = (10 - leagueLevel) * 3;
    
    return 10 + infraBonus + licenseBonus + fanBonus + leagueBonus;
  }, [arena, hq, bootcamp, academy, medical, activeLicenseTier, leagueLevel]);

  const currentXp = experiencePoints || 0;
  const xpThreshold = getLevelThreshold(managerLevel || 1);
  const xpProgress = Math.min(100, (currentXp / xpThreshold) * 100);

  if (!isStoreLoaded || isUserLoading || isProfileLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 space-y-4">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-[10px] uppercase font-black text-muted-foreground tracking-widest">Accessing Dossier...</p>
      </div>
    );
  }

  const translations = {
    en: {
      title: "LEGENDARY MANAGER",
      backToMenu: "Back to Hub",
      lvl: "LVL",
      xp: "XP Progress",
      popularity: "Club Popularity",
      logout: "LOG OUT",
      teamStats: "Club Status",
      skills: {
        title: "STRATEGIC DEVELOPMENT",
        points: "Points Available",
        sponsors: "Sponsor Relations",
        agents: "Transfer Agents",
        training: "Training Methods",
        medical: "Medical Center"
      },
      menu: [
        { id: 'team', label: "My Team", desc: "Status and Skills", icon: Users },
        { id: 'daily', label: "Daily Bonuses", desc: "Claim Rewards", icon: Gift }
      ]
    },
    ru: {
      title: "ЛЕГЕНДАРНЫЙ МЕНЕДЖЕР",
      backToMenu: "Вернуться в хаб",
      lvl: "УР",
      xp: "Опыт менеджера",
      popularity: "Популярность клуба",
      logout: "ВЫЙТИ ИЗ АККАУНТА",
      teamStats: "Статус команды",
      skills: {
        title: "РАЗВИТИЕ КЛУБА",
        points: "Очки навыков",
        sponsors: "Спонсоры",
        agents: "Агенты",
        training: "Тренировки",
        medical: "Медицина"
      },
      menu: [
        { id: 'team', label: "Моя команда", desc: "Статус и Навыки", icon: Users },
        { id: 'daily', label: "Дневные бонусы", desc: "Награды за вход", icon: Gift }
      ]
    }
  };

  const t = translations[language as 'en' | 'ru'] || translations.ru;

  const renderTeamTab = () => (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* CLUB POPULARITY & LICENSE */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="glass-card bg-primary/5 border-primary/20">
          <CardContent className="p-4 flex flex-col items-center text-center">
            <TrendingUp className="w-5 h-5 text-primary mb-2" />
            <p className="text-[8px] font-black text-muted-foreground uppercase mb-1">{t.popularity}</p>
            <p className="text-2xl font-headline font-black italic text-primary">{popularity}%</p>
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

      {/* DETAILED STATS */}
      <Card className="glass-card border-white/5 bg-secondary/10">
        <CardContent className="p-4 space-y-4">
          <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
            <BarChart3 className="w-3.5 h-3.5" /> {t.teamStats}
          </h3>
          <div className="grid grid-cols-1 gap-2">
            <div className="flex items-center justify-between p-2 bg-background/40 rounded-lg border border-white/5">
              <span className="text-[9px] font-bold text-muted-foreground uppercase">Squad Valuation</span>
              <span className="text-xs font-mono font-bold text-white">€ {(ownedHeroes.length * 250000).toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between p-2 bg-background/40 rounded-lg border border-white/5">
              <span className="text-[9px] font-bold text-muted-foreground uppercase">Avg Squad Age</span>
              <span className="text-xs font-mono font-bold text-white">21.4 yrs</span>
            </div>
            <div className="flex items-center justify-between p-2 bg-background/40 rounded-lg border border-white/5">
              <span className="text-[9px] font-bold text-muted-foreground uppercase">Arena Capacity</span>
              <span className="text-xs font-mono font-bold text-white">{arena.capacity.toLocaleString()}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* SKILL TREE */}
      <div className="space-y-4">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-accent flex items-center gap-2">
            <Award className="w-4 h-4" /> {t.skills.title}
          </h3>
          <Badge className="bg-accent text-accent-foreground text-[9px] font-black px-3 animate-pulse">
            {skillPoints} {t.skills.points}
          </Badge>
        </div>

        <div className="grid grid-cols-1 gap-3">
          {[
            { key: 'sponsors', icon: CircleDollarSign, label: t.skills.sponsors, color: 'text-yellow-400' },
            { key: 'agents', icon: UserCog, label: t.skills.agents, color: 'text-blue-400' },
            { key: 'training', icon: GraduationCap, label: t.skills.training, color: 'text-primary' },
            { key: 'medical', icon: HeartPulse, label: t.skills.medical, color: 'text-red-400' }
          ].map((skill) => (
            <Card key={skill.key} className="glass-card border-white/5 overflow-hidden">
              <CardContent className="p-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className={cn("p-2 rounded-xl bg-secondary/50", skill.color)}>
                    <skill.icon className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold uppercase text-white">{skill.label}</h4>
                    <p className="text-[9px] text-muted-foreground mt-0.5">Level {(managerSkills as any)[skill.key]}</p>
                  </div>
                </div>
                <Button 
                  size="sm" 
                  className={cn(
                    "h-8 px-4 font-black text-[9px] uppercase",
                    skillPoints > 0 ? "hero-gradient" : "bg-secondary text-muted-foreground opacity-50"
                  )}
                  disabled={skillPoints <= 0}
                  onClick={() => upgradeManagerSkill(skill.key as any)}
                >
                  UPGRADE
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <div className="max-w-md mx-auto px-4 pt-8 pb-32">
      <header className="flex flex-col items-center mb-10 relative">
        <Button 
          variant="ghost" 
          size="icon" 
          className="absolute left-0 top-0 rounded-full" 
          onClick={() => activeTab === 'menu' ? router.push('/') : setActiveTab('menu')}
        >
          <ChevronLeft className="w-6 h-6" />
        </Button>

        <div className="relative group mb-4">
          <div className="absolute -inset-4 bg-primary/20 rounded-full blur-2xl group-hover:bg-primary/30 transition-all"></div>
          <div className="w-24 h-24 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-2xl relative z-10 border-2 border-white/10">
            <User className="w-12 h-12 text-white" />
          </div>
          <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-background border border-white/10 px-3 py-0.5 rounded-full z-20 shadow-xl">
            <span className="text-[10px] font-black text-primary uppercase tracking-widest whitespace-nowrap">
              {t.lvl} {managerLevel || 1}
            </span>
          </div>
        </div>

        <div className="text-center space-y-1">
          <h1 className="text-2xl font-headline font-bold uppercase tracking-tight text-white">
            {profile?.displayName || t.title}
          </h1>
          <p className="text-[10px] text-muted-foreground uppercase font-black tracking-[0.2em] opacity-60 flex items-center justify-center gap-2">
            <MapPin className="w-3 h-3" /> {profile?.country || 'International'}
          </p>
        </div>

        {/* XP PROGRESS BAR */}
        <div className="w-full max-w-[200px] mt-6 space-y-1.5">
           <div className="flex justify-between items-center text-[8px] font-black uppercase text-muted-foreground tracking-widest px-1">
             <span>{t.xp}</span>
             <span className="text-primary">{currentXp} / {xpThreshold}</span>
           </div>
           <Progress value={xpProgress} className="h-1 bg-white/5" />
        </div>
      </header>
      
      {activeTab === 'menu' ? (
        <div className="space-y-2">
          {t.menu.map((item) => (
            <Card 
              key={item.id} 
              className="glass-card border-white/5 hover:bg-white/5 cursor-pointer transition-all active:scale-[0.98]" 
              onClick={() => setActiveTab(item.id as ProfileTab)}
            >
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-2.5 rounded-xl bg-secondary/50 border border-white/5">
                    <item.icon className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold uppercase tracking-tight">{item.label}</h3>
                    <p className="text-[10px] text-muted-foreground leading-none mt-1">{item.desc}</p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </CardContent>
            </Card>
          ))}
          
          <div className="pt-8">
            <Button 
              variant="destructive" 
              className="w-full h-12 hero-gradient border-none font-black text-[10px] tracking-widest uppercase shadow-xl" 
              onClick={async () => {
                setIsLoggingOut(true);
                await signOut(auth);
                router.push('/auth/register');
              }}
              disabled={isLoggingOut}
            >
              {isLoggingOut ? <Loader2 className="animate-spin" /> : <><LogOut className="w-4 h-4 mr-2" /> {t.logout}</>}
            </Button>
          </div>
        </div>
      ) : activeTab === 'team' ? (
        renderTeamTab()
      ) : (
        <div className="animate-in fade-in duration-500 py-20 text-center">
           <div className="bg-secondary/20 p-8 rounded-2xl border border-white/5 max-w-[280px] mx-auto flex flex-col items-center gap-4">
             <div className="w-16 h-16 rounded-full bg-background flex items-center justify-center">
                <Gift className="w-8 h-8 text-primary opacity-20" />
             </div>
             <p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest leading-relaxed">
               Daily Deployment Node Sync in Progress...
             </p>
             <Button 
                variant="ghost" 
                className="mt-2 text-[10px] font-black uppercase text-primary" 
                onClick={() => setActiveTab('menu')}
              >
                Return to Hub
              </Button>
           </div>
        </div>
      )}
    </div>
  );
}
