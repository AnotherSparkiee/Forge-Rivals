'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useUser, useAuth, useFirestore } from '@/firebase';
import { useGameState, checkIsMatchFinished } from './lib/store';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { 
  Users, Trophy, Zap, UserSearch, Swords, ChevronRight,
  MessageSquare, UserCog, Heart, Store, Shield, 
  ArrowRight, Loader2, Check, UserPlus,
  ShoppingCart, GraduationCap, CalendarDays, Medal,
  ArrowRightLeft, Timer, RefreshCw, Home as HomeIcon, MapPin, Calendar, User as UserIcon,
  Clock, Construction
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
import { getMoscowTime, getGlobalSeasonInfo } from './lib/time-utils';
import { LEAGUES } from './lib/leagues-data';
import { forceResolveGroupMatches } from '@/app/actions/mmo-engine';
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
    language, setLanguage, isLoaded, selectedLeagueId, leagueLevel, groupId,
    nextMatch, isDataReady
  } = useGameState();

  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [isAuthLoading, setIsAuthLoading] = useState(false);
  const [countdown, setCountdown] = useState('');
  
  const seasonInfo = useMemo(() => getGlobalSeasonInfo(), []);
  const league = useMemo(() => LEAGUES.find(l => l.id === selectedLeagueId) || LEAGUES[0], [selectedLeagueId]);

  useEffect(() => {
    const timer = setInterval(() => {
      const info = getGlobalSeasonInfo();
      
      if (info.isOffseason) {
        const diff = info.startsInMs || 0;
        const dd = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hh = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const mm = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const ss = Math.floor((diff % (1000 * 60)) / 1000);
        setCountdown(`${dd}д ${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`);
      } else if (nextMatch) {
        const mskNow = getMoscowTime();
        const matchStartTime = new Date(nextMatch.match.startTime).getTime();
        
        if (mskNow.getTime() >= matchStartTime) {
          setCountdown('00:00:00');
          if (!checkIsMatchFinished(nextMatch.match)) {
            const seasonId = `season_${info.activeSeasonNumber}`;
            const prefixedGroupId = `${seasonId}_league_${selectedLeagueId}_group_${groupId}`;
            forceResolveGroupMatches(selectedLeagueId!, Number(leagueLevel), prefixedGroupId);
          }
        } else {
          const diff = matchStartTime - mskNow.getTime();
          const hh = Math.floor(diff / 3600000);
          const mm = Math.floor((diff % 3600000) / 60000);
          const ss = Math.floor((diff % 60000) / 1000);
          setCountdown(`${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`);
        }
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [nextMatch, selectedLeagueId, leagueLevel, groupId]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsAuthLoading(true);
    let emailToUse = identifier;
    try {
      if (!identifier.includes('@')) {
        const usersRef = collection(db, 'players_v10');
        const q = query(usersRef, where('displayName', '==', identifier), limit(1));
        const querySnapshot = await getDocs(q);
        if (querySnapshot.empty) throw new Error(language === 'ru' ? "Клуб не найден" : "Team not found");
        emailToUse = querySnapshot.docs[0].data().email;
      }
      await signInWithEmailAndPassword(auth, emailToUse, password);
    } catch (error: any) {
      toast({ variant: "destructive", title: "Denied", description: error.message });
    } finally {
      setIsAuthLoading(false);
    }
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
              <DropdownMenuItem onClick={() => setLanguage('en')} className="flex items-center justify-between py-3 px-4 rounded-lg"><div className="flex items-center gap-3"><span>🇺🇸</span><span className="font-bold text-xs uppercase">English</span></div>{language === 'en' && <Check className="w-4 h-4" />}</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setLanguage('ru')} className="flex items-center justify-between py-3 px-4 rounded-lg"><div className="flex items-center gap-3"><span>🇷🇺</span><span className="font-bold text-xs uppercase">Русский</span></div>{language === 'ru' && <Check className="w-4 h-4" />}</DropdownMenuItem>
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
                  <button type="button" onClick={() => setAuthMode('register')} className="text-[10px] text-center text-muted-foreground uppercase font-bold hover:text-primary transition-colors">{tAuth.toggle}</button>
                </CardFooter>
              </form>
            ) : (
              <div className="p-6 text-center">
                <CardTitle className="font-headline uppercase tracking-widest text-accent text-lg mb-4">{tAuth.title}</CardTitle>
                <p className="text-xs text-muted-foreground mb-6 italic">"To initiate a new profile, navigate to the specialized registration terminal."</p>
                <Link href="/auth/register" className="block w-full"><Button className="w-full h-14 hero-gradient font-black text-xs uppercase"><UserPlus className="w-4 h-4 mr-2" /> {language === 'ru' ? 'К РЕГИСТРАЦИИ' : 'TO REGISTRATION'}</Button></Link>
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
    en: { nextMatch: "Next Engagement", offseason: "Offseason Protocol", battleBtn: "BATTLE OVERVIEW", navTitle: "Command Terminals", sync: "CALENDAR SYNC", noMatches: "NO UPCOMING MATCHES", startsIn: "SEASON 1 STARTS IN:" },
    ru: { nextMatch: "Следующий матч", offseason: "Межсезонье", battleBtn: "ОБЗОР МАТЧЕЙ", navTitle: "Командные Терминалы", sync: "СИНХРОНИЗАЦИЯ", noMatches: "НЕТ БУДУЩИХ МАТЧЕЙ", startsIn: "СТАРТ 1-ГО СЕЗОНА ЧЕРЕЗ:" }
  }[language as 'en' | 'ru'];

  const menu = [ 
    { label: language === 'ru' ? 'Ростер' : 'Roster', href: '/roster', icon: Users, desc: language === 'ru' ? 'Состав команды' : 'Squad management' }, 
    { label: language === 'ru' ? 'ИНФРАСТРУКТУРА' : 'Infrastructure', href: '/training', icon: Zap, desc: language === 'ru' ? 'База клуба' : 'Facility growth' }, 
    { label: language === 'ru' ? 'ТРАНСФЕРЫ' : 'Transfers', href: '/transfers', icon: ArrowRightLeft, desc: language === 'ru' ? 'Рынок героев' : 'Asset market' }, 
    { label: language === 'ru' ? 'МАГАЗИН' : 'Shop', icon: ShoppingCart, href: '/shop', desc: language === 'ru' ? 'Покупка ресурсов' : 'Resource acquisition' },
    { label: language === 'ru' ? 'ФАН-КЛУБ' : 'Fan-club', href: '/fanclub', icon: Heart, desc: language === 'ru' ? 'Болельщики' : 'Supporter management' },
    { label: language === 'ru' ? 'ЮНОШЕСКАЯ ШКОЛА' : 'Youth Academy', href: '/youth-academy', icon: GraduationCap, desc: language === 'ru' ? 'Центр талантов' : 'Rising stars' },
    { label: language === 'ru' ? 'ТАБЛИЦЫ' : 'Rankings', href: '/rankings', icon: Trophy, desc: language === 'ru' ? 'Рейтинги' : 'Official standings' }, 
    { label: language === 'ru' ? 'МАТЧИ' : 'Matches', href: '/matches', icon: CalendarDays, desc: language === 'ru' ? 'Расписание' : 'Schedule' }, 
    { label: language === 'ru' ? 'ТУРНИРЫ' : 'Tournaments', href: '/tournaments', icon: Medal, desc: language === 'ru' ? 'События' : 'Special events' }, 
    { label: language === 'ru' ? 'ЧАТЫ' : 'Communications', href: '/chats', icon: MessageSquare, desc: language === 'ru' ? 'Связь' : 'Messaging' }, 
    { label: language === 'ru' ? 'ПРОФИЛЬ' : 'Profile', href: '/profile', icon: UserCog, desc: language === 'ru' ? 'Настройки' : 'Operational dossier' } 
  ];

  return (
    <div className="max-w-md mx-auto px-4 pt-8 pb-4">
      <header className="mb-6">
        <h1 className="text-2xl font-headline font-bold tracking-tighter text-primary uppercase flex items-center gap-2">
          {seasonInfo.isOffseason ? <Construction className="w-6 h-6 text-accent animate-pulse" /> : <UserSearch className="w-6 h-6 text-accent" />} 
          {seasonInfo.isOffseason ? tHub.offseason : tHub.nextMatch}
        </h1>
      </header>

      <section className="mb-8">
        <Card className={cn(
          "glass-card border-primary/20 bg-gradient-to-br from-primary/10 to-transparent overflow-hidden",
          seasonInfo.isOffseason && "border-accent/30 from-accent/10"
        )}>
          <CardContent className="p-6">
            <div className="text-center space-y-4">
              {seasonInfo.isOffseason ? (
                <div className="py-4 space-y-6">
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-16 h-16 rounded-full bg-accent/20 flex items-center justify-center border border-accent/30">
                      <Clock className="w-8 h-8 text-accent animate-pulse" />
                    </div>
                    <Badge variant="outline" className="bg-accent/10 border-accent/20 text-accent text-[8px] font-black uppercase tracking-[0.2em] px-3 h-5">
                      STANDBY MODE
                    </Badge>
                  </div>
                  <div className="bg-background/60 py-5 rounded-2xl border border-white/5 shadow-inner">
                    <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-2">{tHub.startsIn}</p>
                    <p className="text-2xl font-headline font-bold tabular-nums tracking-tighter text-white animate-pulse">
                      {countdown || '--:--:--'}
                    </p>
                  </div>
                  <p className="text-[10px] text-muted-foreground italic px-6 leading-relaxed">
                    "Preparing tactical grids and operational maps for Season 1. Regroup your squad and upgrade infrastructure."
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex flex-col items-center gap-1">
                    <Badge variant="outline" className="bg-primary/10 border-primary/20 text-primary text-[8px] font-black uppercase tracking-[0.2em] px-3 h-5">
                      {nextMatch ? (language === 'ru' ? 'ПРОФ. ЛИГА' : 'PRO LEAGUE') : tHub.sync}
                    </Badge>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Calendar className="w-3 h-3" />
                      <span className="text-[10px] font-mono font-bold">{nextMatch?.dateLabel || '--.--.--'} {league.startTime || '--:--'}</span>
                    </div>
                  </div>

                  {nextMatch ? (
                    <div className="flex items-center justify-between gap-4 py-2">
                      <div className={cn("flex-1 text-right", nextMatch.isHome && "text-primary")}>
                        <p className="text-[7px] font-black uppercase opacity-40 mb-1">{nextMatch.isHome ? (language === 'ru' ? 'ДОМА' : 'HOME') : (language === 'ru' ? 'В ГОСТЯХ' : 'AWAY')}</p>
                        <p className="text-sm font-headline font-bold uppercase truncate italic">{nextMatch.match.homeName}</p>
                      </div>
                      <div className="px-3 py-1 rounded-lg bg-background/60 border border-white/5 flex flex-col items-center">
                        <Swords className="w-4 h-4 text-accent" />
                        <span className="text-[8px] font-black text-accent mt-1">VS</span>
                      </div>
                      <div className={cn("flex-1 text-left", !nextMatch.isHome && "text-primary")}>
                        <p className="text-[7px] font-black uppercase opacity-40 mb-1">{!nextMatch.isHome ? (language === 'ru' ? 'ДОМА' : 'HOME') : (language === 'ru' ? 'В ГОСТЯХ' : 'AWAY')}</p>
                        <p className="text-sm font-headline font-bold uppercase truncate italic">{nextMatch.match.awayName}</p>
                      </div>
                    </div>
                  ) : (
                    <div className="py-6 opacity-30 flex flex-col items-center">
                       <p className="text-[10px] font-bold uppercase tracking-widest">{tHub.noMatches}</p>
                    </div>
                  )}

                  <div className="bg-background/60 py-3 rounded-2xl border border-white/5 shadow-inner">
                    <p className="text-[8px] font-black text-muted-foreground uppercase tracking-widest mb-1">
                      {checkIsMatchFinished(nextMatch?.match) 
                        ? (language === 'ru' ? 'ОПЕРАЦИЯ ЗАВЕРШЕНА' : 'OPERATION CONCLUDED')
                        : 'TIME TO ENGAGEMENT'}
                    </p>
                    <p className="text-xl font-headline font-bold tabular-nums tracking-tighter text-white">
                      {checkIsMatchFinished(nextMatch?.match) 
                        ? `${nextMatch?.match.homeScore ?? 0}:${nextMatch?.match.awayScore ?? 0}`
                        : (countdown || '00:00:00')}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </section>

      {!seasonInfo.isOffseason && (
        <Link href={checkIsMatchFinished(nextMatch?.match) ? `/match?id=${nextMatch.match.id}` : "/matches"} className="block relative mb-8">
          <Button className="w-full h-20 hero-gradient border-none shadow-xl flex flex-col gap-1 transition-all active:scale-95">
            <div className="flex items-center gap-2">
              {checkIsMatchFinished(nextMatch?.match) ? <Trophy className="w-6 h-6" /> : <Swords className="w-6 h-6" />}
              <span className="text-xl font-headline font-bold italic uppercase">
                {checkIsMatchFinished(nextMatch?.match) ? (language === 'ru' ? 'РЕЗУЛЬТАТ МАТЧА' : 'MATCH OUTCOME') : tHub.battleBtn}
              </span>
            </div>
          </Button>
        </Link>
      )}

      <div className="space-y-4">
        <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-accent px-1">{tHub.navTitle}</h2>
        <div className="grid grid-cols-1 gap-2">
          {menu.map((item) => (
            <Link key={item.label} href={item.href}>
              <Card className="glass-card hover:bg-white/5 transition-colors border-white/5 group">
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="p-2 rounded-lg bg-secondary/50 group-hover:bg-primary/20 transition-colors"><item.icon className="w-5 h-5 text-primary" /></div>
                    <div><h3 className="text-sm font-bold uppercase group-hover:text-white transition-colors">{item.label}</h3><p className="text-[10px] text-muted-foreground">{item.desc}</p></div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-all" />
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
