
'use client';

import { useGameState } from '../lib/store';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { 
  User, Settings, ShieldCheck, History, LogOut, 
  ChevronRight, Mail, ChevronLeft, Check, Loader2,
  Trophy, Star, Wallet, Gem, Flag, Zap, Trash2, AlertTriangle,
  BookOpen, Users, LayoutDashboard, Newspaper, Gift, Package, Heart
} from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { useAuth, useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { signOut, deleteUser } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { doc, deleteDoc } from 'firebase/firestore';
import { COUNTRIES } from '@/app/lib/countries-data';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';

type ProfileTab = 'training' | 'team' | 'page' | 'news' | 'daily' | 'bonuses' | 'gift';

export default function ProfilePage() {
  const { ownedHeroes, rank, language, setLanguage, isLoaded: isStoreLoaded, credits, crystals, leagueLevel, divisionSubId, groupId } = useGameState();
  const { user, isUserLoading } = useUser();
  const auth = useAuth();
  const db = useFirestore();
  const router = useRouter();
  const { toast } = useToast();
  
  const [activeTab, setActiveTab] = useState<ProfileTab>('team');
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const userRef = useMemoFirebase(() => user ? doc(db, 'players_v2', user.uid) : null, [db, user]);
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
      deleteAccount: "Delete Account",
      logout: "LOG OUT",
      langTitle: "System Language",
      langEn: "English",
      langRu: "Russian",
      logoutSuccess: "Logged Out",
      logoutDesc: "Successfully signed out.",
      logoutError: "Logout Error",
      division: "Division",
      group: "Group",
      deleteTitle: "ARE YOU SURE?",
      deleteDesc: "This action is irreversible. All your heroes, credits, and league progress will be permanently erased.",
      deleteConfirm: "YES, DELETE MY PROFILE",
      deleteCancel: "CANCEL",
      reloginRequired: "Security check required. Please relogin before deletion.",
      tabs: {
        training: "Training Task",
        team: "My Team",
        page: "My Page",
        news: "My News",
        daily: "Daily Bonuses",
        bonuses: "My Bonuses",
        gift: "Gift Bonuses"
      },
      emptyState: "Terminal data not yet synchronized. Feature coming soon."
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
      league: "Текущая Лига",
      country: "Страна",
      settings: "Настройки и Безопасность",
      account: "Настройки аккаунта",
      security: "Безопасность и 2FA",
      purchase: "История покупок",
      deleteAccount: "Удалить аккаунт",
      logout: "ВЫЙТИ ИЗ СИСТЕМЫ",
      langTitle: "Язык системы",
      langEn: "English",
      langRu: "Русский",
      logoutSuccess: "Сеанс завершен",
      logoutDesc: "Вы успешно вышли из системы.",
      logoutError: "Ошибка выхода",
      division: "Дивизион",
      group: "Группа",
      deleteTitle: "ВЫ УВЕРЕНЫ?",
      deleteDesc: "Это действие необратимо. Все ваши герои, кредиты и прогресс в лиге будут стерты навсегда.",
      deleteConfirm: "ДА, УДАЛИТЬ ПРОФИЛЬ",
      deleteCancel: "ОТМЕНА",
      reloginRequired: "Требуется проверка безопасности. Пожалуйста, перезайдите.",
      tabs: {
        training: "Задание обучения",
        team: "Моя команда",
        page: "Моя страница",
        news: "Мои новости",
        daily: "Дневные бонусы",
        bonuses: "Мои бонусы",
        gift: "Подарить бонусы"
      },
      emptyState: "Данные терминала еще не синхронизированы. Функция скоро появится."
    }
  };

  const t = translations[language as keyof typeof translations] || translations.ru;

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await signOut(auth);
      toast({ title: t.logoutSuccess, description: t.logoutDesc });
      router.push('/auth/login');
    } catch (error: any) {
      toast({ variant: "destructive", title: t.logoutError, description: error.message });
      setIsLoggingOut(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!user) return;
    setIsDeleting(true);
    try {
      await deleteDoc(doc(db, 'players_v2', user.uid));
      await deleteUser(user);
      router.push('/auth/register');
    } catch (error: any) {
      if (error.code === 'auth/requires-recent-login') {
        toast({ variant: "destructive", title: "Error", description: t.reloginRequired });
      } else {
        toast({ variant: "destructive", title: "Error", description: error.message });
      }
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const userCountry = COUNTRIES.find(c => c.name === profile?.country);
  const currentExp = profile?.experiencePoints || 0;
  const xpLevel = Math.floor(currentExp / 1000) + 1;
  const progress = (currentExp % 1000 / 1000) * 100;

  const tabList = [
    { id: 'training', icon: BookOpen },
    { id: 'team', icon: Users },
    { id: 'page', icon: LayoutDashboard },
    { id: 'news', icon: Newspaper },
    { id: 'daily', icon: Gift },
    { id: 'bonuses', icon: Package },
    { id: 'gift', icon: Heart },
  ];

  const renderTabContent = () => {
    if (activeTab === 'team') {
      return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
          <div className="space-y-4">
            <h2 className="text-xs font-headline font-bold text-accent uppercase tracking-[0.2em] px-1 flex items-center gap-2">
              <Zap className="w-3 h-3" /> {t.rosterInfo}
            </h2>
            
            <Card className="glass-card overflow-hidden">
              <CardContent className="p-0">
                <div className="p-4 bg-primary/5 border-b border-white/5 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center font-headline font-bold text-primary text-xl">
                      {xpLevel}
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase font-bold">{t.level}</p>
                      <p className="text-xs font-headline">{t.nextLevel}: 1000 XP</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-bold text-primary">{currentExp % 1000} / 1000 XP</p>
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
                    <p className="text-xs font-bold text-accent">{t.division} {leagueLevel}.{divisionSubId}</p>
                    <p className="text-[10px] uppercase font-bold text-muted-foreground">{t.group} {groupId}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-2 gap-3">
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

          <div className="space-y-4">
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
                  <p className="text-sm font-headline font-bold">{crystals.toLocaleString()}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-4">
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

          <div className="space-y-4">
            <h2 className="text-xs font-headline font-bold text-accent uppercase tracking-[0.2em] px-1">{t.settings}</h2>
            <div className="bg-secondary/20 rounded-xl border border-white/5 divide-y divide-white/5 overflow-hidden">
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
              <div 
                className="flex items-center justify-between p-4 hover:bg-red-500/10 transition-colors cursor-pointer group"
                onClick={() => setShowDeleteConfirm(true)}
              >
                <div className="flex items-center gap-3">
                  <Trash2 className="w-5 h-5 text-red-500 group-hover:animate-pulse" />
                  <span className="text-sm text-red-500 font-bold">{t.deleteAccount}</span>
                </div>
                <ChevronRight className="w-4 h-4 text-red-500/50" />
              </div>
            </div>
          </div>

          <Button 
            variant="destructive" 
            className="w-full h-12 hero-gradient border-none shadow-lg hover:opacity-90 transition-all font-bold flex items-center gap-2"
            onClick={handleLogout}
            disabled={isLoggingOut || isDeleting}
          >
            {isLoggingOut ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogOut className="w-4 h-4" />}
            {t.logout}
          </Button>
        </div>
      );
    }

    return (
      <div className="flex flex-col items-center justify-center py-20 text-center animate-in fade-in duration-500">
        <div className="w-16 h-16 rounded-full bg-secondary/50 flex items-center justify-center mb-4 border border-white/5">
          <Loader2 className="w-8 h-8 text-muted-foreground/30 animate-spin" />
        </div>
        <p className="text-xs text-muted-foreground uppercase tracking-widest max-w-[200px] leading-relaxed">
          {t.emptyState}
        </p>
      </div>
    );
  };

  return (
    <div className="max-w-md mx-auto px-4 pt-8 pb-24">
      <header className="flex flex-col items-center mb-6 relative">
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
        <p className="text-muted-foreground text-[10px] flex items-center gap-1 mt-1 opacity-70 uppercase font-bold tracking-widest">
          <Mail className="w-2 h-2" /> {user?.email}
        </p>
      </header>

      {/* Profile Tabs Navigation */}
      <div className="mb-8 -mx-4">
        <ScrollArea className="w-full whitespace-nowrap">
          <div className="flex w-max space-x-2 p-4">
            {tabList.map((tab) => (
              <Button
                key={tab.id}
                variant="ghost"
                size="sm"
                className={cn(
                  "flex flex-col items-center gap-1 h-auto py-2 px-4 rounded-xl border border-white/5 transition-all",
                  activeTab === tab.id ? "bg-primary/10 text-primary border-primary/30" : "bg-secondary/20 text-muted-foreground hover:bg-secondary/40"
                )}
                onClick={() => setActiveTab(tab.id as ProfileTab)}
              >
                <tab.icon className={cn("w-5 h-5", activeTab === tab.id ? "text-primary" : "text-muted-foreground")} />
                <span className="text-[8px] font-black uppercase tracking-tighter">
                  {t.tabs[tab.id as keyof typeof t.tabs]}
                </span>
              </Button>
            ))}
          </div>
          <ScrollBar orientation="horizontal" className="hidden" />
        </ScrollArea>
      </div>

      {renderTabContent()}

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent className="bg-card border-white/10">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-headline text-red-500 flex items-center gap-2 uppercase tracking-tighter">
              <AlertTriangle className="w-5 h-5" /> {t.deleteTitle}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground text-xs leading-relaxed">
              {t.deleteDesc}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-4 gap-2">
            <AlertDialogCancel className="bg-secondary/50 border-white/5 font-bold uppercase text-[10px]">
              {t.deleteCancel}
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={(e) => { e.preventDefault(); handleDeleteAccount(); }}
              className="bg-red-600 hover:bg-red-700 text-white font-bold uppercase text-[10px] gap-2"
              disabled={isDeleting}
            >
              {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              {t.deleteConfirm}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
