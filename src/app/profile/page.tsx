'use client';

import { useGameState, getLevelThreshold } from '../lib/store';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { 
  User, ShieldCheck, LogOut, 
  ChevronRight, ChevronLeft, Loader2,
  Trophy, Star, Wallet, Gem, Flag, Zap, 
  Award, ScrollText, CircleDollarSign, 
  UserCog, HeartPulse, GraduationCap, 
  TrendingUp, BarChart3, Building2, MapPin,
  Shield, Activity, Settings2, Info
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

type ProfileTab = 'menu' | 'team' | 'daily';

export default function ProfilePage() {
  const { 
    ownedHeroes, language, isLoaded: isStoreLoaded, 
    credits, crystals, leagueLevel, 
    experiencePoints, activeLicenseTier, hq, managerLevel,
    skillPoints, managerSkills, upgradeManagerSkill, arena, bootcamp, academy, medical,
    isPremium, premiumUntil
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
    const premiumBonus = isPremium ? 25 : 0;
    
    return 10 + infraBonus + licenseBonus + fanBonus + leagueBonus + premiumBonus;
  }, [arena, hq, bootcamp, academy, medical, activeLicenseTier, leagueLevel, isPremium]);

  const currentXp = experiencePoints || 0;
  const xpThreshold = getLevelThreshold(managerLevel || 1);
  const xpProgress = Math.min(100, (currentXp / xpThreshold) * 100);

  if (!isStoreLoaded || isUserLoading || isProfileLoading) {
    return <div className="min-h-screen flex flex-col items-center justify-center p-6"><Loader2 className="w-8 h-8 animate-spin text-primary" /><p className="text-[10px] uppercase font-black text-muted-foreground tracking-widest mt-4">Accessing Dossier...</p></div>;
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
      premiumActive: "ELITE STATUS ACTIVE",
      premiumExp: "Expires",
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
        daily: "BONUSES",
        menu: "DASHBOARD"
      }
    },
    ru: {
      title: "ЛЕГЕНДАРНЫЙ МЕНЕДЖЕР",
      backToMenu: "Вернуться в хаб",
      lvl: "УР",
      xp: "Опыт менеджера",
      popularity: "Популярность клуба",
      logout: "ВЫЙТИ ИЗ АККАУНТА",
      teamStats: "Статус команды",
      premiumActive: "ЭЛИТНЫЙ СТАТУС АКТИВЕН",
      premiumExp: "Истекает",
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
        daily: "БОНУСЫ",
        menu: "ГЛАВНАЯ"
      }
    }
  };

  const t = translations[language as 'en' | 'ru'] || translations.ru;

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

      <Card className="glass-card border-white/5 bg-secondary/10">
        <CardContent className="p-4 space-y-4">
          <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
            <BarChart3 className="w-3.5 h-3.5" /> {t.teamStats}
          </h3>
          <div className="grid grid-cols-1 gap-2">
            <div className="flex items-center justify-between p-3 bg-background/40 rounded-xl border border-white/5">
              <span className="text-[9px] font-bold text-muted-foreground uppercase">Squad Valuation</span>
              <span className="text-xs font-mono font-bold text-white">€ {(ownedHeroes.length * 250000).toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-background/40 rounded-xl border border-white/5">
              <span className="text-[9px] font-bold text-muted-foreground uppercase">Squad Size</span>
              <span className="text-xs font-mono font-bold text-white">{ownedHeroes.length} / {isPremium ? 15 : 10}</span>
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
            { key: 'training', icon: GraduationCap, label: t.skills.training, color: 'text-primary', desc: isPremium ? '5x XP Active' : '+10% XP Rate' },
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
                      <p className="text-[9px] text-muted-foreground font-black">LVL {(managerSkills as any)[skill.key]}</p>
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
        {(['menu', 'team', 'daily'] as const).map((tab) => (<Button key={tab} variant="ghost" size="sm" onClick={() => setActiveTab(tab)} className={cn("h-10 text-[10px] font-black uppercase tracking-widest transition-all", activeTab === tab ? "bg-white/10 text-primary shadow-inner" : "text-muted-foreground hover:text-white")}>{t.tabs[tab]}</Button>))}
      </div>

      {activeTab === 'menu' && (
        <div className="space-y-4 animate-in fade-in duration-500">
          <Card className="glass-card border-primary/20 bg-primary/5 p-6 text-center">
             <Trophy className="w-12 h-12 text-primary mx-auto mb-4 opacity-20" />
             <h3 className="text-sm font-bold uppercase text-white">Career Performance</h3>
             <p className="text-[10px] text-muted-foreground mt-2 leading-relaxed">Official ranking and division data are synchronized at the start of each match window.</p>
          </Card>
          <div className="grid grid-cols-1 gap-2">
            <Button variant="outline" className="h-12 border-white/5 bg-secondary/20 hover:bg-white/5 justify-between px-4 group" onClick={() => setActiveTab('team')}><div className="flex items-center gap-3"><Shield className="w-4 h-4 text-primary group-hover:scale-110 transition-transform" /><span className="text-[10px] font-black uppercase">Club Infrastructure Overview</span></div><ChevronRight className="w-4 h-4 text-muted-foreground" /></Button>
            <Button variant="outline" className="h-12 border-white/5 bg-secondary/20 hover:bg-white/5 justify-between px-4 group"><div className="flex items-center gap-3"><Settings2 className="w-4 h-4 text-accent group-hover:scale-110 transition-transform" /><span className="text-[10px] font-black uppercase">Security & Account Settings</span></div><ChevronRight className="w-4 h-4 text-muted-foreground" /></Button>
          </div>
          <div className="pt-6">
            <Button variant="destructive" className="w-full h-14 hero-gradient border-none font-black text-xs tracking-[0.2em] uppercase shadow-2xl active:scale-95 transition-all" onClick={async () => { setIsLoggingOut(true); await signOut(auth); router.push('/auth/register'); }} disabled={isLoggingOut}>{isLoggingOut ? <Loader2 className="animate-spin" /> : <><LogOut className="w-4 h-4 mr-2" /> {t.logout}</>}</Button>
          </div>
        </div>
      )}

      {activeTab === 'team' && renderTeamView()}
      
      {activeTab === 'daily' && (
        <div className="animate-in fade-in duration-500 py-20 text-center">
          <div className="bg-secondary/20 p-8 rounded-2xl border border-white/5 max-w-[280px] mx-auto flex flex-col items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-background flex items-center justify-center border border-white/10">
              <Trophy className="w-8 h-8 text-primary opacity-20" />
            </div>
            <p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest leading-relaxed">Daily Deployment Node Sync in Progress...</p>
            <Button variant="ghost" className="mt-2 text-[10px] font-black uppercase text-primary" onClick={() => setActiveTab('menu')}>Return to Dashboard</Button>
          </div>
        </div>
      )}
    </div>
  );
}
