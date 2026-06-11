
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useUser, useAuth, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { useGameState } from './lib/store';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { 
  Users, Trophy, Zap, UserSearch, Swords, ChevronRight,
  MessageSquare, UserCog, Coins, Heart, Store, Shield, 
  ArrowRight, Loader2, Check, Lock, UserPlus
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { LoadingScreen } from '@/components/game/LoadingScreen';
import { collection, query, where, getDocs, limit, doc } from 'firebase/firestore';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/**
 * ГЛАВНАЯ СТРАНИЦА - ИНТЕЛЛЕКТУАЛЬНЫЙ ШЛЮЗ
 * 1. Не авторизован -> Форма Входа / Регистрации.
 * 2. Авторизован, но нет лиги -> Переход в /setup (через AuthGuard).
 * 3. Авторизован и настроен -> Командный Хаб.
 */
export default function Home() {
  const { user, isUserLoading } = useUser();
  const auth = useAuth();
  const db = useFirestore();
  const { toast } = useToast();
  const { 
    language, setLanguage, isLoaded, country, selectedLeagueId,
    displayName, credits, crystals, managerLevel, experiencePoints
  } = useGameState();

  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [isAuthLoading, setIsAuthLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsAuthLoading(true);
    let emailToUse = identifier;
    try {
      if (!identifier.includes('@')) {
        const usersRef = collection(db, 'players_v11');
        const q = query(usersRef, where('displayName', '==', identifier), limit(1));
        const querySnapshot = await getDocs(q);
        if (querySnapshot.empty) throw new Error(language === 'ru' ? "Клуб не найден" : "Team not found");
        emailToUse = querySnapshot.docs[0].data().email;
      }
      await signInWithEmailAndPassword(auth, emailToUse, password);
      toast({ title: language === 'ru' ? "Связь установлена" : "Link Established" });
    } catch (error: any) {
      toast({ variant: "destructive", title: "Denied", description: error.message });
    } finally {
      setIsAuthLoading(false);
    }
  };

  // 1. ЭКРАН ЗАГРУЗКИ
  if (isUserLoading || !isLoaded) return <LoadingScreen />;

  // 2. ЭКРАН ВХОДА (Если не авторизован)
  if (!user) {
    const tAuth = {
      en: { 
        title: authMode === 'login' ? "Sync Credentials" : "Initiate Profile", 
        userLabel: "Email or Team Name", 
        passLabel: "Access Key", 
        submit: authMode === 'login' ? "ESTABLISH LINK" : "INITIALIZE", 
        toggle: authMode === 'login' ? "New manager? Create profile" : "Already registered? Sync link",
        subtitle: "COMMAND CENTER ACCESS" 
      },
      ru: { 
        title: authMode === 'login' ? "Синхронизация" : "Создание профиля", 
        userLabel: "Почта или Название клуба", 
        passLabel: "Ключ доступа (Пароль)", 
        submit: authMode === 'login' ? "УСТАНОВИТЬ СВЯЗЬ" : "СОЗДАТЬ", 
        toggle: authMode === 'login' ? "Новый менеджер? Создать профиль" : "Есть аккаунт? Войти",
        subtitle: "ДОСТУП К КОМАНДНОМУ ЦЕНТРУ" 
      }
    }[language as 'en' | 'ru'] || { title: "Auth", userLabel: "User", passLabel: "Pass", submit: "Connect", toggle: "Switch", subtitle: "ACCESS" };

    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-background relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none opacity-20 bg-[radial-gradient(circle_at_50%_50%,_hsl(var(--primary)/0.15),_transparent_70%)]" />
        
        <div className="fixed top-4 right-4 z-[9999]">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="w-10 h-10 p-0 rounded-full text-xl bg-card/80 backdrop-blur-xl border-white/10">
                {language === 'en' ? '🇺🇸' : '🇷🇺'}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-card/95 backdrop-blur-2xl border-white/10 p-1">
              <DropdownMenuItem onClick={() => setLanguage('en')} className="flex items-center justify-between py-3 px-4 rounded-lg">
                <div className="flex items-center gap-3"><span>🇺🇸</span><span className="font-bold text-xs uppercase">English</span></div>
                {language === 'en' && <Check className="w-4 h-4" />}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setLanguage('ru')} className="flex items-center justify-between py-3 px-4 rounded-lg">
                <div className="flex items-center gap-3"><span>🇷🇺</span><span className="font-bold text-xs uppercase">Русский</span></div>
                {language === 'ru' && <Check className="w-4 h-4" />}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="w-full max-w-sm space-y-8 relative z-10">
          <div className="text-center">
            <div className="mx-auto w-24 h-24 mb-6 relative">
              <div className="absolute inset-0 bg-primary/20 blur-2xl rounded-full" />
              <img src="https://i.postimg.cc/8cpvcNZ9/logo-lote.png" alt="Logo" className="w-full h-full object-contain relative z-10" />
            </div>
            <h1 className="text-3xl font-headline font-bold tracking-tighter text-primary">LINES OF ENMITY</h1>
            <p className="text-muted-foreground mt-2 text-[10px] uppercase tracking-[0.3em] font-black">{tAuth.subtitle}</p>
          </div>

          <Card className="glass-card">
            {authMode === 'login' ? (
              <form onSubmit={handleLogin}>
                <CardHeader><CardTitle className="font-headline text-center uppercase tracking-widest text-accent text-lg">{tAuth.title}</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2"><Label>{tAuth.userLabel}</Label><Input value={identifier} onChange={e => setIdentifier(e.target.value)} required className="bg-secondary/50 h-12" /></div>
                  <div className="space-y-2"><Label>{tAuth.passLabel}</Label><Input type="password" value={password} onChange={e => setPassword(e.target.value)} required className="bg-secondary/50 h-12" /></div>
                </CardContent>
                <CardFooter className="flex flex-col gap-4">
                  <Button type="submit" className="w-full h-14 hero-gradient font-black text-xs uppercase" disabled={isAuthLoading}>
                    {isAuthLoading ? <Loader2 className="animate-spin" /> : tAuth.submit}
                  </Button>
                  <button type="button" onClick={() => setAuthMode('register')} className="text-[10px] text-center text-muted-foreground uppercase font-bold hover:text-primary transition-colors">
                    {tAuth.toggle}
                  </button>
                </CardFooter>
              </form>
            ) : (
              <div className="p-6 text-center">
                <CardTitle className="font-headline uppercase tracking-widest text-accent text-lg mb-4">{tAuth.title}</CardTitle>
                <p className="text-xs text-muted-foreground mb-6 italic">"To initiate a new profile, navigate to the specialized registration terminal."</p>
                <Link href="/auth/register" className="block w-full">
                  <Button className="w-full h-14 hero-gradient font-black text-xs uppercase">
                    <UserPlus className="w-4 h-4 mr-2" /> {language === 'ru' ? 'К РЕГИСТРАЦИИ' : 'TO REGISTRATION'}
                  </Button>
                </Link>
                <button onClick={() => setAuthMode('login')} className="mt-4 text-[10px] text-muted-foreground uppercase font-bold hover:text-primary">
                  {tAuth.toggle}
                </button>
              </div>
            )}
          </Card>
        </div>
      </div>
    );
  }

  // 3. ЭКРАН ХАБА (Если авторизован и профиль полный)
  const tHub = {
    en: { nextMatch: "Next Engagement", battleBtn: "BATTLE OVERVIEW", navTitle: "Command Terminals" },
    ru: { nextMatch: "Следующий матч", battleBtn: "ОБЗОР МАТЧЕЙ", navTitle: "Командные Терминалы" }
  }[language as 'en' | 'ru'] || { nextMatch: "Match", battleBtn: "Overview", navTitle: "Terminals" };

  const menu = [ 
    { label: language === 'ru' ? 'Ростер' : 'Roster', href: '/roster', icon: Users, desc: language === 'ru' ? 'Состав команды' : 'Squad management' }, 
    { label: language === 'ru' ? 'Инфраструктура' : 'Infrastructure', href: '/training', icon: Zap, desc: language === 'ru' ? 'База клуба' : 'Facility growth' }, 
    { label: language === 'ru' ? 'Трансферы' : 'Transfers', href: '/transfers', icon: ShoppingCart, desc: language === 'ru' ? 'Рынок героев' : 'Asset market' }, 
    { label: language === 'ru' ? 'Юношеская школа' : 'Youth Academy', href: '/youth-academy', icon: GraduationCap, desc: language === 'ru' ? 'Центр талантов' : 'Rising stars' },
    { label: language === 'ru' ? 'Таблицы' : 'Rankings', href: '/rankings', icon: Trophy, desc: language === 'ru' ? 'Рейтинги' : 'Official standings' }, 
    { label: language === 'ru' ? 'Матчи' : 'Matches', href: '/matches', icon: CalendarDays, desc: language === 'ru' ? 'Расписание' : 'Schedule' }, 
    { label: language === 'ru' ? 'Турниры' : 'Tournaments', href: '/tournaments', icon: Medal, desc: language === 'ru' ? 'События' : 'Special events' }, 
    { label: language === 'ru' ? 'Чаты' : 'Communications', href: '/chats', icon: MessageSquare, desc: language === 'ru' ? 'Связь' : 'Messaging' }, 
    { label: language === 'ru' ? 'Профиль' : 'Profile', href: '/profile', icon: UserCog, desc: language === 'ru' ? 'Настройки' : 'Operational dossier' } 
  ];

  return (
    <div className="max-w-md mx-auto px-4 pt-8 pb-4">
      <header className="mb-6">
        <h1 className="text-2xl font-headline font-bold tracking-tighter text-primary uppercase flex items-center gap-2">
          <UserSearch className="w-6 h-6 text-accent" /> {tHub.nextMatch}
        </h1>
      </header>

      <section className="mb-8">
        <Card className="glass-card border-primary/20 bg-gradient-to-br from-primary/10 to-transparent overflow-hidden">
          <CardContent className="p-0 text-center py-10 opacity-40">
             <Shield className="w-12 h-12 mx-auto mb-4" />
             <p className="text-[10px] uppercase font-black tracking-widest">Awaiting match synchronization...</p>
          </CardContent>
        </Card>
      </section>

      <Link href="/match" className="block relative mb-8">
        <Button className="w-full h-20 hero-gradient border-none shadow-xl flex flex-col gap-1">
          <div className="flex items-center gap-2"><Swords className="w-6 h-6" /><span className="text-xl font-headline font-bold italic uppercase">{tHub.battleBtn}</span></div>
        </Button>
      </Link>

      <div className="space-y-4">
        <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-accent px-1">{tHub.navTitle}</h2>
        <div className="grid grid-cols-1 gap-2">
          {menu.map((item) => (
            <Link key={item.label} href={item.href}>
              <Card className="glass-card hover:bg-white/5 transition-colors border-white/5">
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="p-2 rounded-lg bg-secondary/50"><item.icon className="w-5 h-5 text-primary" /></div>
                    <div><h3 className="text-sm font-bold uppercase">{item.label}</h3><p className="text-[10px] text-muted-foreground">{item.desc}</p></div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
