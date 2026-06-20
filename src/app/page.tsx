
'use client';

import { useState, useEffect, useMemo } from 'react';
import { useUser, useAuth, useFirestore } from '@/firebase';
import { useGameState } from './lib/store';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { 
  Users, Trophy, Zap, UserSearch, Swords, ChevronRight,
  MessageSquare, UserCog, ShoppingCart, 
  Loader2, Check, UserPlus,
  GraduationCap, CalendarDays, Medal,
  ArrowRightLeft, 
  Clock, Radio
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { LoadingScreen } from '@/components/game/LoadingScreen';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { getMoscowTime, getGlobalSeasonInfo, isMatchLive } from './lib/time-utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function Home() {
  const { user, isUserLoading } = useUser();
  const auth = useAuth();
  const db = useFirestore();
  const { toast } = useToast();
  const { 
    language, setLanguage, isLoaded, 
    nextMatch, allSeasonMatches, lastSeenMatchDay, matchHistory
  } = useGameState();

  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [isAuthLoading, setIsAuthLoading] = useState(false);
  const [countdown, setCountdown] = useState('');
  const [isMatchActive, setIsMatchActive] = useState(false);
  
  const seasonInfo = useMemo(() => getGlobalSeasonInfo(), []);

  const unreadMatches = useMemo(() => {
    if (!user || !isLoaded) return [];
    
    // 1. Лига (непросмотренные дни)
    const leagueUnread = (allSeasonMatches || []).filter(m => 
      (m.homeId === user.uid || m.awayId === user.uid) && 
      m.isFinished && 
      Number(m.day) > (lastSeenMatchDay || 0) &&
      m.version === 32
    );

    // 2. Другие (seen: false)
    const historyUnread = (matchHistory || []).filter(m => m.seen === false);
    
    // Объединяем и сортируем по дате (старые первыми)
    return [...leagueUnread, ...historyUnread].sort((a, b) => {
      const timeA = new Date(a.playedAt || a.startTime || 0).getTime();
      const timeB = new Date(b.playedAt || b.startTime || 0).getTime();
      return timeA - timeB;
    });
  }, [allSeasonMatches, user, lastSeenMatchDay, matchHistory, isLoaded]);

  const latestUnreadId = unreadMatches[0]?.id;
  
  const lastPlayedId = useMemo(() => {
    if (matchHistory && matchHistory.length > 0) return matchHistory[matchHistory.length - 1].id;
    const finishedLeague = (allSeasonMatches || []).filter(m => 
      (m.homeId === user?.uid || m.awayId === user?.uid) && 
      m.isFinished
    ).sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
    return finishedLeague[0]?.id || null;
  }, [matchHistory, allSeasonMatches, user?.uid]);

  useEffect(() => {
    const timer = setInterval(() => {
      const info = getGlobalSeasonInfo();
      const mskNow = getMoscowTime();
      if (info.isOffseason) {
        const targetTime = info.nextSeasonStart.getTime();
        const diff = targetTime - mskNow.getTime();
        const hh = Math.floor(diff / 3600000);
        const mm = Math.floor((diff % 3600000) / 60000);
        const ss = Math.floor((diff % 60000) / 1000);
        setCountdown(`${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`);
        setIsMatchActive(false);
      } else if (nextMatch) {
        const live = isMatchLive(nextMatch.match.startTime);
        setIsMatchActive(live);
        if (live) setCountdown('LIVE');
        else {
          const diff = new Date(nextMatch.match.startTime).getTime() - mskNow.getTime();
          const hh = Math.floor(diff / 3600000);
          const mm = Math.floor((diff % 3600000) / 60000);
          const ss = Math.floor((diff % 60000) / 1000);
          setCountdown(`${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`);
        }
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [nextMatch]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsAuthLoading(true);
    let emailToUse = identifier;
    try {
      if (!identifier.includes('@')) {
        const q = query(collection(db, 'players_v10'), where('displayName', '==', identifier), limit(1));
        const snap = await getDocs(q);
        if (snap.empty) throw new Error(language === 'ru' ? "Клуб не найден" : "Team not found");
        emailToUse = snap.docs[0].data().email;
      }
      await signInWithEmailAndPassword(auth, emailToUse, password);
    } catch (error: any) {
      toast({ variant: "destructive", title: "Denied", description: error.message });
    } finally { setIsAuthLoading(false); }
  };

  if (isUserLoading) return <LoadingScreen />;
  if (!user) {
    const tAuth = {
      en: { title: authMode === 'login' ? "Sync Credentials" : "Initiate Profile", userLabel: "Email or Team Name", passLabel: "Access Key", submit: authMode === 'login' ? "ESTABLISH LINK" : "INITIALIZE", toggle: authMode === 'login' ? "New manager? Create profile" : "Already registered? Sync link", subtitle: "COMMAND CENTER ACCESS" },
      ru: { title: authMode === 'login' ? "Синхронизация" : "Создание профиля", userLabel: "Почта или Название клуба", passLabel: "Ключ доступа (Пароль)", submit: authMode === 'login' ? "УСТАНОВИТЬ СВЯЗЬ" : "СОЗДАТЬ", toggle: authMode === 'login' ? "Новый менеджер? Создать профиль" : "Есть аккаунт? Войти", subtitle: "ДОСТУК К КОМАНДНОМУ ЦЕНТРУ" }
    }[language as 'en' | 'ru'] || { title: "Auth", userLabel: "User", passLabel: "Pass", submit: "Connect", toggle: "Switch", subtitle: "ACCESS" };
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-background relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none opacity-20 bg-[radial-gradient(circle_at_50%_50%,_hsl(var(--primary)/0.15),_transparent_70%)]" />
        <div className="fixed top-4 right-4 z-[9999]">
          <DropdownMenu>
            <DropdownMenuTrigger asChild><Button variant="outline" size="sm" className="w-10 h-10 p-0 rounded-full text-xl bg-card/80 backdrop-blur-xl border-white/10">{language === 'en' ? '🇺🇸' : '🇷🇺'}</Button></DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-card/95 backdrop-blur-2xl border-white/10 p-1">
              <DropdownMenuItem onClick={() => setLanguage('en')} className="flex items-center justify-between py-3 px-4 rounded-lg"><span>🇺🇸 English</span>{language === 'en' && <Check className="w-4 h-4" />}</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setLanguage('ru')} className="flex items-center justify-between py-3 px-4 rounded-lg"><span>🇷🇺 Русский</span>{language === 'ru' && <Check className="w-4 h-4" />}</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <div className="w-full max-sm space-y-8 relative z-10">
          <div className="text-center">
            <div className="mx-auto w-24 h-24 mb-6 relative"><div className="absolute inset-0 bg-primary/20 blur-2xl rounded-full" /><img src="https://i.postimg.cc/8cpvcNZ9/logo-lote.png" alt="Logo" className="w-full h-full object-contain relative z-10" /></div>
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
                  <Button type="submit" className="w-full h-14 hero-gradient font-black text-xs uppercase" disabled={isAuthLoading}>{isAuthLoading ? <Loader2 className="animate-spin" /> : tAuth.submit}</Button>
                  <button type="button" onClick={() => setAuthMode('register')} className="text-[10px] text-center text-muted-foreground uppercase font-bold hover:text-primary">{tAuth.toggle}</button>
                </CardFooter>
              </form>
            ) : (
              <div className="p-6 text-center">
                <CardTitle className="font-headline uppercase tracking-widest text-accent text-lg mb-4">{tAuth.title}</CardTitle>
                <Link href="/auth/register" className="block w-full"><Button className="w-full h-14 hero-gradient font-black text-xs uppercase"><UserPlus className="w-4 h-4 mr-2" /> К РЕГИСТРАЦИИ</Button></Link>
                <button onClick={() => setAuthMode('login')} className="mt-4 text-[10px] text-muted-foreground uppercase font-bold hover:text-primary">{tAuth.toggle}</button>
              </div>
            )}
          </Card>
        </div>
      </div>
    );
  }

  if (!isLoaded) return <LoadingScreen />;

  const tHub = {
    en: { nextMatch: "Next Engagement", offseason: "OFFSEASON", battleBtn: "MATCH OVERVIEW", navTitle: "Command Terminals", startsIn: "S1 STARTS IN:", live: "LIVE: ENGAGEMENT IN PROGRESS" },
    ru: { nextMatch: "Следующий матч", offseason: "МЕЖСЕЗОНЬЕ", battleBtn: "ОБЗОР МАТЧЕЙ", navTitle: "Командные Терминалы", startsIn: "СЕЗОН 1 ЧЕРЕЗ:", live: "В ЭФИРЕ: ИДЕТ СРАЖЕНИЕ" }
  }[language as 'en' | 'ru'];

  const menu = [ 
    { label: language === 'ru' ? 'СОСТАВ' : 'ROSTER', href: '/roster', icon: Users, desc: language === 'ru' ? 'Ваши игроки' : 'Squad management' }, 
    { label: language === 'ru' ? 'ИНФРАСТРУКТУРА' : 'Infrastructure', href: '/training', icon: Zap, desc: language === 'ru' ? 'База клуба' : 'Facility growth' }, 
    { label: language === 'ru' ? 'ТРАНСФЕРЫ' : 'Transfers', href: '/transfers', icon: ArrowRightLeft, desc: language === 'ru' ? 'Рынок игроков' : 'Asset market' }, 
    { label: language === 'ru' ? 'МАГАЗИН' : 'Shop', icon: ShoppingCart, href: '/shop', desc: language === 'ru' ? 'Покупка ресурсов' : 'Resource acquisition' },
    { label: language === 'ru' ? 'ЮНОШЕСКАЯ ШКОЛА' : 'Youth Academy', href: '/youth-academy', icon: GraduationCap, desc: language === 'ru' ? 'Центр талантов' : 'Rising stars' },
    { label: language === 'ru' ? 'ТАБЛИЦЫ' : 'Rankings', href: '/rankings', icon: Trophy, desc: language === 'ru' ? 'Рейтинги' : 'Standings' }, 
    { label: language === 'ru' ? 'МАТЧИ' : 'Matches', href: '/matches', icon: CalendarDays, desc: language === 'ru' ? 'Расписание' : 'Schedule' }, 
    { label: language === 'ru' ? 'ТУРНИРЫ' : 'Tournaments', href: '/tournaments', icon: Medal, desc: language === 'ru' ? 'События' : 'Special events' }, 
    { label: language === 'ru' ? 'ЧАТЫ' : 'Communications', href: '/chats', icon: MessageSquare, desc: language === 'ru' ? 'Связь' : 'Messaging' }, 
    { label: language === 'ru' ? 'ПРОФИЛЬ' : 'Profile', href: '/profile', icon: UserCog, desc: language === 'ru' ? 'Настройки' : 'Dossier' } 
  ];

  return (
    <div className="max-w-md mx-auto px-4 pt-8 pb-4">
      <header className="mb-6 flex flex-col gap-1">
        <div className="flex items-center gap-2"><Radio className="w-3 h-3 text-red-500 animate-pulse" /><span className="text-[7px] font-black text-muted-foreground uppercase tracking-widest">System Online: v1.0.36</span></div>
        <h1 className="text-2xl font-headline font-bold tracking-tighter text-primary uppercase flex items-center gap-2">{seasonInfo.isOffseason ? <Clock className="w-6 h-6 text-accent animate-pulse" /> : <UserSearch className="w-6 h-6 text-accent" />} {seasonInfo.isOffseason ? tHub.offseason : `SEASON ${seasonInfo.seasonNumber}`}</h1>
      </header>

      <section className="mb-8">
        <Card className={cn("glass-card border-primary/20 bg-gradient-to-br from-primary/10 to-transparent overflow-hidden shadow-xl", isMatchActive && "border-red-500/40 bg-red-500/5")}>
          <CardContent className="p-6">
            <div className="text-center space-y-4">
              <Badge variant="outline" className={cn("text-[8px] font-black uppercase tracking-[0.2em] px-3 h-5", isMatchActive ? "bg-red-500/20 text-white animate-pulse" : "bg-primary/10 text-primary")}>{isMatchActive ? tHub.live : 'PRO LEAGUE'}</Badge>
              {nextMatch ? (
                <div className="flex items-center justify-between gap-4 py-2">
                  <div className="flex-1 text-right truncate"><p className="text-[10px] font-headline font-bold uppercase italic text-white">{nextMatch.match.homeName}</p></div>
                  <div className="px-3 py-1 rounded-lg bg-background/60 border border-white/5"><Swords className={cn("w-4 h-4", isMatchActive ? "text-red-500 animate-bounce" : "text-accent")} /></div>
                  <div className="flex-1 text-left truncate"><p className="text-[10px] font-headline font-bold uppercase italic text-white">{nextMatch.match.awayName}</p></div>
                </div>
              ) : <div className="py-6 opacity-30 text-[10px] font-bold uppercase">NO MATCHES</div>}
              <div className="bg-background/60 py-3 rounded-2xl border border-white/5"><p className="text-[8px] font-black text-muted-foreground uppercase tracking-widest mb-1">{isMatchActive ? 'ENGAGEMENT PHASE' : 'TIME TO ENGAGEMENT'}</p><p className={cn("text-xl font-headline font-bold tabular-nums tracking-tighter text-white", isMatchActive && "text-red-500 animate-pulse")}>{countdown || '00:00:00'}</p></div>
            </div>
          </CardContent>
        </Card>
      </section>

      <Link href={latestUnreadId ? `/match?id=${latestUnreadId}` : (lastPlayedId ? `/match?id=${lastPlayedId}` : '/matches')} className="block relative mb-8">
        <div className={cn("absolute -inset-1 bg-gradient-to-r from-accent to-primary rounded-2xl blur opacity-30", unreadMatches.length > 0 && "animate-pulse")}></div>
        <Button className="w-full h-20 bg-accent text-accent-foreground border-none shadow-xl flex items-center justify-center gap-3 relative z-10 group overflow-hidden">
          <Swords className={cn("w-6 h-6", unreadMatches.length > 0 && "animate-bounce")} />
          <div className="flex flex-col items-start">
            <span className="text-xl font-headline font-bold italic uppercase leading-none">{tHub.battleBtn}</span>
            <span className="text-[9px] font-black uppercase tracking-[0.2em] opacity-80 mt-1">{unreadMatches.length > 0 ? (language === 'ru' ? 'ЕСТЬ НОВЫЕ РЕЗУЛЬТАТЫ' : 'NEW RESULTS AVAILABLE') : (language === 'ru' ? 'АРХИВ ТРАНСЛЯЦИЙ' : 'MATCH ARCHIVE')}</span>
          </div>
          {unreadMatches.length > 0 && (
            <div className="ml-auto w-10 h-10 rounded-full bg-red-600 flex items-center justify-center border-2 border-white shadow-lg">
              <span className="text-sm font-headline font-bold text-white">{unreadMatches.length}</span>
            </div>
          )}
          {unreadMatches.length === 0 && <ChevronRight className="ml-auto w-5 h-5 opacity-40 group-hover:translate-x-1 transition-transform" />}
        </Button>
      </Link>

      <div className="space-y-4">
        <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-accent px-1">{tHub.navTitle}</h2>
        <div className="grid grid-cols-1 gap-2">
          {menu.map((item) => (
            <Link key={item.label} href={item.href}>
              <Card className="glass-card hover:bg-white/5 transition-all border-white/5 group"><CardContent className="p-4 flex items-center justify-between"><div className="flex items-center gap-4"><div className="p-2.5 rounded-xl bg-secondary/50 group-hover:bg-primary/20 transition-colors border border-white/5"><item.icon className="w-5 h-5 text-primary" /></div><div><h3 className="text-sm font-bold uppercase group-hover:text-white transition-colors">{item.label}</h3><p className="text-[10px] text-muted-foreground leading-tight">{item.desc}</p></div></div><ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-all" /></CardContent></Card>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
