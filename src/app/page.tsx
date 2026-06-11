
'use client';

import { useEffect, useMemo, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useUser, useAuth, useFirestore, useDoc, useMemoFirebase, useCollection } from '@/firebase';
import { useGameState } from './lib/store';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { 
  Users, Trophy, Zap, Clock,
  UserSearch, ShieldAlert, Medal, User, Swords, ChevronRight,
  CalendarDays, PlayCircle, MessageSquare, UsersRound, Target, ShoppingCart,
  GraduationCap, UserCog, Coins, Heart, Store, Shield, Radar, Timer,
  ArrowRight, ShieldCheck, Loader2, Globe, Check
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { LoadingScreen } from '@/components/game/LoadingScreen';
import { doc, collection, query, where, onSnapshot, getDocs, limit } from 'firebase/firestore';
import { getMockGroupTeams, getSchedule, LEAGUES } from './lib/leagues-data';
import { getMoscowDateString, getMoscowTime, getPyramidCupTime } from './lib/time-utils';
import { cn } from '@/lib/utils';
import { getDeterministicTournament } from './tournaments/iron-globe/page';
import { getGlobalCupParticipants, getWinnerOfBranch, getEntryRound } from './lib/cup-utils';
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
 * ГЛАВНАЯ СТРАНИЦА - ШЛЮЗ
 * Если пользователь не вошел -> Показывает форму входа/регистрации.
 * Если вошел -> Показывает Терминал Управления (Hub).
 */
export default function Home() {
  const { user, isUserLoading } = useUser();
  const auth = useAuth();
  const router = useRouter();
  const db = useFirestore();
  const { toast } = useToast();
  const { 
    rank, leagueLevel, divisionSubId, groupId, 
    language, setLanguage, isLoaded, lastLeagueMatchDate, lastCupMatchDate, seasonDay,
    matchHistory, lastSeenMatchDay, strategy, team, seasonNumber, country, selectedLeagueId
  } = useGameState();

  const [countdown, setCountdown] = useState<string>('');
  const [activeFriendly, setActiveFriendly] = useState<any | null>(null);
  const winnersCache = useRef<Map<string, any>>(new Map());

  // Auth States
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [isAuthLoading, setIsAuthLoading] = useState(false);

  useEffect(() => {
    if (isLoaded && user && (!country || !selectedLeagueId)) {
      router.replace('/setup');
    }
  }, [user, isLoaded, country, selectedLeagueId, router]);

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
      sessionStorage.setItem('lote_hub_entered', 'true');
      toast({ title: language === 'ru' ? "Связь установлена" : "Link Established" });
    } catch (error: any) {
      toast({ variant: "destructive", title: "Denied", description: error.message });
    } finally {
      setIsAuthLoading(false);
    }
  };

  // --- Real-time Listeners for Hub ---
  useEffect(() => {
    if (!user || isUserLoading) return;
    const unsub = onSnapshot(doc(db, 'friendly_lobbies_v3', user.uid), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.status === 'accepted') {
          const acceptedAt = data.acceptedAt?.toMillis() || Date.now(); 
          if (Date.now() - acceptedAt < 16 * 60 * 1000) {
            setActiveFriendly({ ...data, id: docSnap.id });
          } else setActiveFriendly(null);
        } else setActiveFriendly(null);
      } else {
        const q = query(collection(db, 'friendly_lobbies_v3'), where('challengerId', '==', user.uid), where('status', '==', 'accepted'));
        const unsubInner = onSnapshot(q, (snap) => {
          if (!snap.empty) {
            const d = snap.docs[0].data();
            const acceptedAt = d.acceptedAt?.toMillis() || Date.now();
            if (Date.now() - acceptedAt < 16 * 60 * 1000) {
              setActiveFriendly({ ...d, id: snap.docs[0].id });
            } else setActiveFriendly(null);
          } else setActiveFriendly(null);
        });
        return () => unsubInner();
      }
    });
    return () => unsub();
  }, [user, isUserLoading, db]);

  // --- RENDERING AUTH (IF NOT LOGGED IN) ---
  if (!isUserLoading && !user) {
    const tAuth = {
      en: { title: "Sync Credentials", userLabel: "Email or Team Name", passLabel: "Access Key", submit: "ESTABLISH LINK", new: "New manager?", register: "Initialize new profile", subtitle: "COMMAND CENTER ACCESS" },
      ru: { title: "Синхронизация", userLabel: "Почта или Название клуба", passLabel: "Ключ доступа (Пароль)", submit: "УСТАНОВИТЬ СВЯЗЬ", new: "Новый менеджер?", register: "Создать новый профиль", subtitle: "ДОСТУП К КОМАНДНОМУ ЦЕНТРУ" }
    }[language as 'en' | 'ru'] || { title: "Sync", userLabel: "User", passLabel: "Pass", submit: "Connect", new: "New?", register: "Join", subtitle: "ACCESS" };

    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-background relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none opacity-20 bg-[radial-gradient(circle_at_50%_50%,_hsl(var(--primary)/0.15),_transparent_70%)]" />
        <div className="fixed top-4 right-4 z-[9999]">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="w-10 h-10 p-0 rounded-full text-xl bg-card/80 backdrop-blur-xl border-white/10">{language === 'en' ? '🇺🇸' : '🇷🇺'}</Button>
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
                <p className="text-[10px] text-center text-muted-foreground uppercase font-bold">
                  {tAuth.new} <Link href="/auth/register" className="text-primary hover:underline">{tAuth.register}</Link>
                </p>
              </CardFooter>
            </form>
          </Card>
        </div>
      </div>
    );
  }

  // --- RENDERING HUB (IF LOGGED IN AND SETUP) ---
  if (isUserLoading || !isLoaded) return <LoadingScreen />;

  const tHub = {
    en: { nextMatch: "Next Engagement", startsIn: "STARTS IN:", battleBtn: "BATTLE OVERVIEW", navTitle: "Command Terminals" },
    ru: { nextMatch: "Следующий матч", startsIn: "ДО МАТЧА ОСТАЛОСЬ:", battleBtn: "ОБЗОР МАТЧЕЙ", navTitle: "Командные Терминалы" }
  }[language as 'en' | 'ru'] || { nextMatch: "Match", startsIn: "Time:", battleBtn: "Overview", navTitle: "Terminals" };

  const menu = [ 
    { label: language === 'ru' ? 'Ростер' : 'Roster', href: '/roster', icon: Users, desc: language === 'ru' ? 'Состав команды' : 'Squad management' }, 
    { label: language === 'ru' ? 'Инфраструктура' : 'Infrastructure', href: '/training', icon: Zap, desc: language === 'ru' ? 'База клуба' : 'Facility growth' }, 
    { label: language === 'ru' ? 'Персонал' : 'Staff', href: '/staff', icon: UserCog, desc: language === 'ru' ? 'Штат специалистов' : 'Expert personnel' },
    { label: language === 'ru' ? 'Трансферы' : 'Transfers', href: '/transfers', icon: ShoppingCart, desc: language === 'ru' ? 'Рынок героев' : 'Asset market' }, 
    { label: language === 'ru' ? 'Юношеская школа' : 'Youth Academy', href: '/youth-academy', icon: GraduationCap, desc: language === 'ru' ? 'Центр талантов' : 'Rising stars' },
    { label: language === 'ru' ? 'Таблицы' : 'Rankings', href: '/rankings', icon: Trophy, desc: language === 'ru' ? 'Рейтинги' : 'Official standings' }, 
    { label: language === 'ru' ? 'Матчи' : 'Matches', href: '/matches', icon: CalendarDays, desc: language === 'ru' ? 'Расписание' : 'Schedule' }, 
    { label: language === 'ru' ? 'Турниры' : 'Tournaments', href: '/tournaments', icon: Medal, desc: language === 'ru' ? 'События' : 'Special events' }, 
    { label: language === 'ru' ? 'Финансы' : 'Finances', href: '/finances', icon: Coins, desc: language === 'ru' ? 'Бюджет' : 'Economic node' },
    { label: language === 'ru' ? 'Фанклуб' : 'Fanclub', href: '/fanclub', icon: Heart, desc: language === 'ru' ? 'Болельщики' : 'Supporter loyalty' },
    { label: language === 'ru' ? 'Чаты' : 'Communications', href: '/chats', icon: MessageSquare, desc: language === 'ru' ? 'Связь' : 'Messaging' }, 
    { label: language === 'ru' ? 'Менеджеры' : 'Managers', href: '/managers', icon: UsersRound, desc: language === 'ru' ? 'Сообщество' : 'Personnel network' },
    { label: language === 'ru' ? 'Ассоциация' : 'Alliance', href: '/associations', icon: Shield, desc: language === 'ru' ? 'Объединения' : 'Strategic coalitions' },
    { label: language === 'ru' ? 'Магазин' : 'Shop', href: '/shop', icon: Store, desc: language === 'ru' ? 'Ресурсы' : 'Resource node' },
    { label: language === 'ru' ? 'Профиль' : 'Profile', href: '/profile', icon: User, desc: language === 'ru' ? 'Настройки' : 'Operational dossier' } 
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
             <ShieldAlert className="w-12 h-12 mx-auto mb-4" />
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
