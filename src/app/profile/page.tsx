
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

  const userRef = useMemoFirebase(() => user ? doc(db, 'players_v11', user.uid) : null, [db, user]);
  const { data: profile, isLoading: isProfileLoading } = useDoc(userRef);

  useEffect(() => {
    if (!isUserLoading && !user) {
      router.push('/auth/register');
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
    const infraBonus = Math.floor(totalInfraLevels / 11);
    let licenseBonus = 0;
    if (activeLicenseTier === 3) licenseBonus = 3;
    else if (activeLicenseTier === 2) licenseBonus = 6;
    else if (activeLicenseTier === 1) licenseBonus = 9;
    const fanCount = (arena.capacity || 5000) * 1.5;
    const fanBonus = Math.floor(fanCount / 1000);
    const leagueBonus = (10 - leagueLevel) * 2;
    return 10 + infraBonus + licenseBonus + fanBonus + leagueBonus;
  }, [arena, hq, bootcamp, academy, medical, activeLicenseTier, leagueLevel]);

  if (!isStoreLoaded || isUserLoading || isProfileLoading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  const translations = {
    en: { title: "LEGENDARY MANAGER", backToMenu: "Back to Hub", heroes: "Heroes", popularity: "Club Popularity", logout: "LOG OUT", skills: { title: "STRATEGIC DEVELOPMENT", points: "Points Available" }, menu: [ { id: 'team', label: "My Team", desc: "Stats and Skills", icon: Users }, { id: 'daily', label: "Daily Bonuses", desc: "Claim Rewards", icon: Gift } ] },
    ru: { title: "ЛЕГЕНДАРНЫЙ МЕНЕДЖЕР", backToMenu: "Вернуться в хаб", heroes: "Героев", popularity: "Популярность", logout: "ВЫЙТИ", skills: { title: "РАЗВИТИЕ", points: "Очки навыков" }, menu: [ { id: 'team', label: "Моя команда", desc: "Статистика и навыки", icon: Users }, { id: 'daily', label: "Дневные бонусы", desc: "Награды за вход", icon: Gift } ] }
  };
  const t = translations[language as 'en' | 'ru'] || translations.ru;

  return (
    <div className="max-w-md mx-auto px-4 pt-8 pb-24">
      <header className="flex flex-col items-center mb-10 relative">
        <Button variant="ghost" size="icon" className="absolute left-0 top-0 rounded-full" onClick={() => activeTab === 'menu' ? router.push('/') : setActiveTab('menu')}><ChevronLeft className="w-6 h-6" /></Button>
        <div className="w-24 h-24 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-xl mb-4"><User className="w-12 h-12 text-white" /></div>
        <h1 className="text-2xl font-headline font-bold uppercase">{profile?.displayName || t.title}</h1>
      </header>
      
      {activeTab === 'menu' ? (
        <div className="space-y-2">
          {t.menu.map((item) => (
            <Card key={item.id} className="glass-card hover:bg-white/5 cursor-pointer" onClick={() => setActiveTab(item.id as ProfileTab)}>
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-4"><div className="p-2 bg-secondary/50 rounded-lg"><item.icon className="w-5 h-5 text-primary" /></div><div><h3 className="text-sm font-bold uppercase">{item.label}</h3><p className="text-[10px] text-muted-foreground">{item.desc}</p></div></div>
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </CardContent>
            </Card>
          ))}
          <Button variant="destructive" className="w-full h-12 mt-8 hero-gradient" onClick={async () => { setIsLoggingOut(true); await signOut(auth); router.push('/auth/register'); }} disabled={isLoggingOut}>{isLoggingOut ? <Loader2 className="animate-spin" /> : <LogOut className="w-4 h-4 mr-2" />} {t.logout}</Button>
        </div>
      ) : (
        <div className="animate-in fade-in duration-500">
           <div className="bg-secondary/20 p-8 text-center rounded-xl border border-white/5">
             <p className="text-xs text-muted-foreground">Operational Data Node Synchronized (v11)</p>
             <Button variant="ghost" className="mt-4 uppercase text-[10px] font-black" onClick={() => setActiveTab('menu')}>Return to Menu</Button>
           </div>
        </div>
      )}
    </div>
  );
}
