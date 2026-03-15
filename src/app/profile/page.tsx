'use client';

import { useGameState } from '../lib/store';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { 
  User, Settings, ShieldCheck, History, LogOut, 
  ChevronRight, Mail, ChevronLeft, Check, Loader2,
  Trophy, Star, Wallet, Gem, Flag, Zap
} from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { useAuth, useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { signOut } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { doc } from 'firebase/firestore';
import { COUNTRIES } from '@/app/lib/countries-data';
import { LEAGUES } from '@/app/lib/leagues-data';

export default function ProfilePage() {
  const { ownedHeroes, rank, language, setLanguage, isLoaded: isStoreLoaded, credits } = useGameState();
  const { user, isUserLoading } = useUser();
  const auth = useAuth();
  const db = useFirestore();
  const router = useRouter();
  const { toast } = useToast();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const userRef = useMemoFirebase(() => user ? doc(db, 'users', user.uid) : null, [db, user]);
  const { data: profile, isLoading: isProfileLoading } = useDoc(userRef);

  useEffect(() => {
    if (!isUserLoading && !user) {
      router.push('/auth/login');
    }
  }, [user, isUserLoading, router]);

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
      rosterInfo: "Roster Status",
      heroes: "Heroes",
      mmr: "MMR Points",
      level: "Level",
      nextLevel: "Next Level",
      balance: "Financial Status",
      currency: "Balance €",
      crystals: "Crystals",
      league: "Current League",
      country: "Operational Sector",
      settings: "Settings & Security",
      account: "Account Preferences",
      security: "Security & 2FA",
      purchase: "Purchase History",
      logout: "LOG OUT",
      langTitle: "System Language",
      langEn: "English",
      langRu: "Russian",
      logoutSuccess: "Logged Out",
      logoutDesc: "Successfully signed out.",
      logoutError: "Logout Error"
    },
    ru: {
      title: "ЛЕГЕНДАРНЫЙ МЕНЕДЖЕР",
      rosterInfo: "Информация о Росторе",
      heroes: "Героев",
      mmr: "Очки MMR",
      level: "Уровень",
      nextLevel: "След. Уровень",
      balance: "Финансовый баланс",
      currency: "Баланс €",
      crystals: "Кристаллы",
      league: "Название Лиги",
      country: "Страна",
      settings: "Настройки и Безопасность",
      account: "Настройки аккаунта",
      security: "Безопасность и 2FA",
      purchase: "История покупок",
      logout: "ВЫЙТИ ИЗ СИСТЕМЫ",
      langTitle: "Язык системы",
      langEn: "English",
      langRu: "Русский",
      logoutSuccess: "Сеанс завершен",
      logoutDesc: "Вы успешно вышли из системы.",
      logoutError: "Ошибка выхода"
    }
  };

  const t = translations[language as keyof typeof translations] || translations.ru;

  // Find country flag
  const userCountry = COUNTRIES.find(c => c.name === profile?.country);
  const userLeague = LEAGUES.find(l => l.id === profile?.selectedLeagueId);

  // Simulation of XP progress
  const currentExp = profile?.experiencePoints || 0;
  const level = Math.floor(currentExp / 1000) + 1;
  const expInLevel = currentExp % 1000;
  const progress = (expInLevel / 1000) * 100;

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await signOut(auth);
      toast({
        title: t.logoutSuccess,
        description: t.logoutDesc,
      });
      router.push('/auth/login');
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: t.logoutError,
        description: error.message,
      });
      setIsLoggingOut(false);
    }
  };

  return (
    <div className="max-w-md mx-auto px-4 pt-8 pb-24">
      <header className="flex flex-col items-center mb-8 relative">
        <Link href="/" className="absolute left-0 top-0">
          <Button variant="ghost" size="icon" className="rounded-full">
            <ChevronLeft className="w-6 h-6" />
          </Button>
        </Link>
        <div className="w-24 h-24 rounded-full border-4 border-primary/20 p-1 mb-4 bg-secondary shadow-[0_0_20px_rgba(var(--primary),0.3)]">
          <div className="w-full h-full rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center">
            <User className="w-12 h-12 text-primary-foreground" />
          </div>
        </div>
        <h1 className="text-2xl font-headline font-bold uppercase tracking-tight text-center">
          {profile?.displayName || t.title}
        </h1>
        <p className="text-muted-foreground text-xs flex items-center gap-1 mt-1 opacity-70">
          <Mail className="w-3 h-3" /> {user?.email}
        </p>
      </header>

      {/* Roster & Level Section */}
      <div className="space-y-4 mb-8">
        <h2 className="text-xs font-headline font-bold text-accent uppercase tracking-[0.2em] px-1 flex items-center gap-2">
          <Zap className="w-3 h-3" /> {t.rosterInfo}
        </h2>
        
        <Card className="glass-card overflow-hidden">
          <CardContent className="p-0">
            <div className="p-4 bg-primary/5 border-b border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center font-headline font-bold text-primary text-xl">
                  {level}
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase font-bold">{t.level}</p>
                  <p className="text-xs font-headline">{t.nextLevel}: 1000 XP</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs font-bold text-primary">{expInLevel} / 1000 XP</p>
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
                <p className="text-xs font-bold text-accent">{userLeague?.name || profile?.selectedLeagueId || 'None'}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Stats & Balance */}
      <div className="grid grid-cols-2 gap-3 mb-8">
        <Card className="glass-card text-center bg-gradient-to-b from-primary/10 to-transparent border-primary/20">
          <CardContent className="p-4 flex flex-col items-center gap-1">
            <Star className="w-4 h-4 text-primary" />
            <p className="text-2xl font-headline font-bold text-primary">{rank}</p>
            <p className="text-[9px] text-muted-foreground uppercase font-bold tracking-widest">{t.mmr}</p>
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

      {/* Currency Section */}
      <div className="space-y-4 mb-8">
        <h2 className="text-xs font-headline font-bold text-accent uppercase tracking-[0.2em] px-1 flex items-center gap-2">
          <Wallet className="w-3 h-3" /> {t.balance}
        </h2>
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-secondary/30 rounded-xl border border-white/5 p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-yellow-500/20">
              <span className="text-yellow-500 font-bold">€</span>
            </div>
            <div>
              <p className="text-[9px] text-muted-foreground uppercase font-bold">{t.currency}</p>
              <p className="text-sm font-headline font-bold">{credits.toLocaleString()}</p>
            </div>
          </div>
          <div className="bg-secondary/30 rounded-xl border border-white/5 p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-500/20">
              <Gem className="w-4 h-4 text-blue-400" />
            </div>
            <div>
              <p className="text-[9px] text-muted-foreground uppercase font-bold">{t.crystals}</p>
              <p className="text-sm font-headline font-bold">0</p>
            </div>
          </div>
        </div>
      </div>

      {/* Language Section */}
      <div className="space-y-4 mb-8">
        <h2 className="text-xs font-headline font-bold text-accent uppercase tracking-[0.2em] px-1">{t.langTitle}</h2>
        <div className="bg-secondary/20 rounded-xl border border-white/5 p-1 flex gap-1">
          <Button 
            variant="ghost" 
            className={cn("flex-1 text-xs gap-2 h-9", language === 'en' && "bg-white/10")}
            onClick={() => setLanguage('en')}
          >
            <span className="text-base">🇺🇸</span> {t.langEn}
            {language === 'en' && <Check className="w-3 h-3" />}
          </Button>
          <Button 
            variant="ghost" 
            className={cn("flex-1 text-xs gap-2 h-9", language === 'ru' && "bg-white/10")}
            onClick={() => setLanguage('ru')}
          >
            <span className="text-base">🇷🇺</span> {t.langRu}
            {language === 'ru' && <Check className="w-3 h-3" />}
          </Button>
        </div>
      </div>

      {/* Settings List */}
      <div className="space-y-4 mb-8">
        <h2 className="text-xs font-headline font-bold text-accent uppercase tracking-[0.2em] px-1">{t.settings}</h2>
        <div className="bg-secondary/20 rounded-xl border border-white/5 divide-y divide-white/5">
          <div className="flex items-center justify-between p-4 hover:bg-white/5 transition-colors cursor-pointer group">
            <div className="flex items-center gap-3">
              <Settings className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
              <span className="text-sm">{t.account}</span>
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </div>
          <div className="flex items-center justify-between p-4 hover:bg-white/5 transition-colors cursor-pointer group">
            <div className="flex items-center gap-3">
              <ShieldCheck className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
              <span className="text-sm">{t.security}</span>
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </div>
          <div className="flex items-center justify-between p-4 hover:bg-white/5 transition-colors cursor-pointer group">
            <div className="flex items-center gap-3">
              <History className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
              <span className="text-sm">{t.purchase}</span>
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </div>
        </div>
      </div>

      <Button 
        variant="destructive" 
        className="w-full mb-8 flex items-center gap-2 font-bold h-12 hero-gradient border-none shadow-lg hover:opacity-90 transition-all"
        onClick={handleLogout}
        disabled={isLoggingOut}
      >
        {isLoggingOut ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogOut className="w-4 h-4" />}
        {t.logout}
      </Button>
    </div>
  );
}
