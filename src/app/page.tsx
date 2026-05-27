'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useUser, useFirestore, useDoc, useMemoFirebase, useCollection } from '@/firebase';
import { useGameState } from './lib/store';
import { 
  Users, Trophy, Zap, Clock,
  UserSearch, ShieldAlert, Medal, User, Swords, ChevronRight,
  CalendarDays, PlayCircle, Loader2, MessageSquare, UsersRound, Target, ShoppingCart,
  GraduationCap, UserCog, Coins, Heart, Store, Shield
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { LoadingScreen } from '@/components/game/LoadingScreen';
import { doc, collection, query, where, onSnapshot } from 'firebase/firestore';
import { getMockGroupTeams, getSchedule, LEAGUES } from './lib/leagues-data';
import { getMoscowDateString, getMoscowTime, getPyramidCupTime } from './lib/time-utils';
import { cn } from '@/lib/utils';
import { getDeterministicTournament } from './tournaments/iron-globe/page';

export default function Home() {
  const { user, isUserLoading } = useUser();
  const router = useRouter();
  const db = useFirestore();
  const { 
    rank, leagueLevel, divisionSubId, groupId, 
    language, isLoaded, lastLeagueMatchDate, lastCupMatchDate, seasonDay,
    matchHistory, lastSeenMatchDay, strategy, team, seasonNumber
  } = useGameState();

  const [countdown, setCountdown] = useState<string>('');
  const [activeFriendly, setActiveFriendly] = useState<any | null>(null);

  const userRef = useMemoFirebase(() => user ? doc(db, 'players_v5', user.uid) : null, [db, user]);
  const { data: profile, isLoading: isProfileLoading } = useDoc(userRef);

  const groupQuery = useMemoFirebase(() => {
    if (!profile?.selectedLeagueId) return null;
    return query(
      collection(db, 'players_v5'),
      where('selectedLeagueId', '==', profile.selectedLeagueId),
      where('leagueLevel', '==', profile.leagueLevel),
      where('groupId', '==', profile.groupId)
    );
  }, [db, profile?.selectedLeagueId, profile?.leagueLevel, profile?.groupId]);

  const { data: groupPlayers, isLoading: isGroupLoading } = useCollection(groupQuery);

  const globeParticipantsQuery = useMemoFirebase(() => {
    return query(collection(db, 'players_v5'), where('tournaments', 'array-contains', 'iron-globe'));
  }, [db]);
  const { data: globeParticipants } = useCollection(globeParticipantsQuery);

  const brickParticipantsQuery = useMemoFirebase(() => {
    return query(collection(db, 'players_v5'), where('tournaments', 'array-contains', 'iron-brick'));
  }, [db]);
  const { data: brickParticipants } = useCollection(brickParticipantsQuery);

  const myBasketRef = useMemoFirebase(() => user ? doc(db, 'cw_basket', user.uid) : null, [db, user]);
  const { data: basketEntry } = useDoc(myBasketRef);

  useEffect(() => {
    if (!isUserLoading && !user) {
      router.push('/auth/login');
    }
  }, [user, isUserLoading, router]);

  useEffect(() => {
    if (!user || isUserLoading) return;
    const q = query(collection(db, 'friendly_lobbies'), where('status', '==', 'accepted'));
    const unsub = onSnapshot(q, (snapshot) => {
      const matchDoc = snapshot.docs.find(d => {
        const data = d.data();
        return data.hostId === user.uid || data.challengerId === user.uid;
      });
      if (matchDoc) {
        const data = matchDoc.data();
        const acceptedAt = data.acceptedAt?.toMillis() || Date.now(); 
        if (Date.now() - acceptedAt < 16 * 60 * 1000) setActiveFriendly({ ...data, id: matchDoc.id });
        else setActiveFriendly(null);
      } else setActiveFriendly(null);
    });
    return () => unsub();
  }, [user, isUserLoading, db]);

  const isTodayPlayed = useMemo(() => lastLeagueMatchDate === getMoscowDateString(), [lastLeagueMatchDate]);
  const isCupPlayedToday = useMemo(() => lastCupMatchDate === getMoscowDateString(), [lastCupMatchDate]);

  const cupNextMatch = useMemo(() => {
    if (!isLoaded || !profile || seasonDay > 14) return null;
    const wasEliminated = matchHistory.some(m => 
      (m.type === 'cup' || m.type === 'tournament') && 
      m.seasonNumber === seasonNumber && 
      m.opponentName !== 'SEEDED' && 
      m.opponentName !== 'WAITING' &&
      m.scoreA < m.scoreB
    );
    if (wasEliminated) return null;
    const leagueInfo = LEAGUES.find(l => l.id === profile.selectedLeagueId) || LEAGUES[0];
    const cupTime = getPyramidCupTime(leagueInfo.startTime);
    return { 
      opponent: { name: "Tournament Rival", isPlayer: false },
      time: cupTime,
      isNextDay: isCupPlayedToday,
      isCup: true,
      label: language === 'ru' ? 'КУБОК ПИРАМИДЫ' : 'PYRAMID CUP'
    };
  }, [isLoaded, profile, seasonDay, matchHistory, seasonNumber, isCupPlayedToday, language]);

  const leagueNextMatch = useMemo(() => {
    if (!isLoaded || !profile || !groupPlayers || seasonDay > 14) return null;
    const league = LEAGUES.find(l => l.id === profile.selectedLeagueId) || LEAGUES[0];
    const targetDay = seasonDay === 0 ? 1 : (isTodayPlayed ? seasonDay + 1 : seasonDay);
    if (targetDay > 14) return null;
    const schedule = getSchedule(getMockGroupTeams(rank, profile.displayName || "My Team", leagueLevel, divisionSubId, groupId, profile.selectedLeagueId || "ALPHA", groupPlayers, user?.uid, 0));
    const myMatch = schedule[targetDay - 1]?.find((m: any) => m.home.id === user?.uid || m.away.id === user?.uid);
    if (!myMatch) return null;
    return { opponent: myMatch.home.id === user?.uid ? myMatch.away : myMatch.home, day: targetDay, time: league.startTime, isNextDay: targetDay > seasonDay, isCup: false };
  }, [isLoaded, profile, groupPlayers, seasonDay, isTodayPlayed, rank, leagueLevel, divisionSubId, groupId, user?.uid]);

  const tournamentNextMatch = useMemo(() => {
    if (!isLoaded || !user) return null;
    const mskNow = getMoscowTime();
    const dateStr = getMoscowDateString();
    const totalMins = mskNow.getHours() * 60 + mskNow.getMinutes();
    if (profile?.tournaments?.includes('iron-globe')) {
      const startTotal = 21 * 60 + 5;
      if (totalMins >= (20 * 60 + 50) && totalMins < (21 * 60 + 40)) {
        const tour = getDeterministicTournament(dateStr, globeParticipants || [], user.uid, mskNow, "21:05");
        return { opponent: tour.myOpponent || { name: "Bot Team", isPlayer: false }, isLive: totalMins >= startTotal, time: "21:05", tourName: language === 'ru' ? 'ЧУГУННЫЙ ГЛОБУС' : 'CAST IRON GLOBE' };
      }
    }
    if (profile?.tournaments?.includes('iron-brick')) {
      const startTotal = 21 * 60 + 35;
      if (totalMins >= (21 * 60 + 20) && totalMins < (22 * 60 + 10)) {
        const tour = getDeterministicTournament(dateStr, brickParticipants || [], user.uid, mskNow, "21:35");
        return { opponent: tour.myOpponent || { name: "Bot Team", isPlayer: false }, isLive: totalMins >= startTotal, time: "21:35", tourName: language === 'ru' ? 'ЧУГУННЫЙ КИРПИЧ' : 'CAST IRON BRICK' };
      }
    }
    return null;
  }, [isLoaded, profile, globeParticipants, brickParticipants, user, language]);

  const displayMatchInfo = useMemo(() => {
    if (activeFriendly) {
      const acceptedAt = activeFriendly.acceptedAt?.toMillis() || Date.now();
      const name = activeFriendly.hostId === user?.uid ? activeFriendly.challengerName : activeFriendly.hostName;
      return { 
        opponent: { name, isPlayer: !activeFriendly.isTrial }, 
        isFriendly: true, 
        acceptedAt,
        isTrial: activeFriendly.isTrial 
      };
    }
    
    if (tournamentNextMatch) return { ...tournamentNextMatch, isTournament: true };
    
    if (basketEntry?.status === 'matched') return { opponent: { name: basketEntry.matchedWithName, isPlayer: true }, isBasket: true, startTime: new Date(basketEntry.matchStartTime).getTime() };
    
    if (cupNextMatch && leagueNextMatch) {
      const mskNow = getMoscowTime();
      const getMs = (time: string, nextDay: boolean) => {
        const [h, m] = time.split(':').map(Number);
        const d = new Date(mskNow); d.setHours(h, m, 0, 0);
        if (nextDay) d.setDate(d.getDate() + 1);
        return d.getTime();
      };
      const cupMs = getMs(cupNextMatch.time, cupNextMatch.isNextDay);
      const leagueMs = getMs(leagueNextMatch.time, leagueNextMatch.isNextDay);
      return cupMs < leagueMs ? cupNextMatch : leagueNextMatch;
    }
    
    return leagueNextMatch || cupNextMatch;
  }, [activeFriendly, tournamentNextMatch, basketEntry, cupNextMatch, leagueNextMatch, user]);

  useEffect(() => {
    if (!displayMatchInfo) return;
    const interval = setInterval(() => {
      const info = displayMatchInfo as any;
      if (info.isFriendly) {
        const diff = (info.acceptedAt + 15 * 60 * 1000) - Date.now();
        if (diff <= 0) setCountdown('00:00');
        else {
          const m = Math.floor(diff / 60000);
          const s = Math.floor((diff % 60000) / 1000);
          setCountdown(`${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`);
        }
      } else if (info.isBasket) {
        const diff = info.startTime - Date.now();
        if (diff <= 0) setCountdown('00:00');
        else {
          const m = Math.floor(diff / 60000);
          const s = Math.floor((diff % 60000) / 1000);
          setCountdown(`${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`);
        }
      } else {
        const mskNow = getMoscowTime();
        if (!info.time) return;
        const [h, m] = info.time.split(':').map(Number);
        const targetDate = new Date(mskNow); targetDate.setHours(h, m, 0, 0);
        if (info.isNextDay) targetDate.setDate(targetDate.getDate() + 1);
        const diff = targetDate.getTime() - mskNow.getTime();
        if (diff <= 0) setCountdown('00:00:00');
        else setCountdown(`${String(Math.floor(diff / 3600000)).padStart(2, '0')}:${String(Math.floor((diff % 3600000) / 60000)).padStart(2, '0')}:${String(Math.floor((diff % 60000) / 1000)).padStart(2, '0')}`);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [displayMatchInfo]);

  const unseenCount = useMemo(() => matchHistory.filter(m => m.type === 'league' && m.day > lastSeenMatchDay).length, [matchHistory, lastSeenMatchDay]);

  if (isUserLoading || !isLoaded || !user || isProfileLoading || isGroupLoading) return <LoadingScreen />;

  const translations = {
    en: { 
      nextMatch: (displayMatchInfo as any)?.isFriendly ? ((displayMatchInfo as any)?.isTrial ? "Trial Battle" : "Live Friendly") : ((displayMatchInfo as any)?.isTournament ? "Tournament Battle" : ((displayMatchInfo as any)?.isBasket ? "CW Basket Engagement" : ((displayMatchInfo as any)?.isCup ? "Pyramid Cup Round" : "Next Engagement"))), 
      vs: "VS", today: "TODAY", tomorrow: "TOMORROW", battleBtn: "MATCH REVIEW", navTitle: "Navigation Terminals", 
      interSeason: "Inter-season", interSeasonDesc: "Calculating new hierarchies.", preSeason: "Pre-season Readiness", preSeasonDesc: "Matches resume soon.", 
      startsIn: ((displayMatchInfo as any)?.isFriendly || (displayMatchInfo as any)?.isBasket) ? "REMAINING TIME:" : "TIME UNTIL MATCH:",
      tourLive: "LIVE ENGAGEMENT",
      menu: [ 
        { label: 'Roster', href: '/roster', icon: Users, desc: 'Manage lineup' }, 
        { label: 'Infrastructure', href: '/training', icon: Zap, desc: 'Improve base' }, 
        { label: 'Staff', href: '/staff', icon: UserCog, desc: 'Professional team' },
        { label: 'Transfers', href: '/transfers', icon: ShoppingCart, desc: 'Market operations' }, 
        { label: 'Youth Academy', href: '/youth-academy', icon: GraduationCap, desc: 'Scout future stars' },
        { label: 'Rankings', href: '/rankings', icon: Trophy, desc: 'View tables' }, 
        { label: 'Matches', href: '/matches', icon: CalendarDays, desc: 'Schedule' }, 
        { label: 'Tournaments', href: '/tournaments', icon: Medal, desc: 'Global events' }, 
        { label: 'Finances', href: '/finances', icon: Coins, desc: 'Budget management' },
        { label: 'Fanclub', href: '/fanclub', icon: Heart, desc: 'Fanbase management' },
        { label: 'Chats', href: '/chats', icon: MessageSquare, desc: 'Comms' },
        { label: 'Managers', href: '/managers', icon: UsersRound, desc: 'Community hub' },
        { label: 'Association', href: '/associations', icon: Shield, desc: 'Clubs alliance' },
        { label: 'Shop', href: '/shop', icon: Store, desc: 'Acquire resources' },
        { label: 'Profile', href: '/profile', icon: User, desc: 'Settings' } 
      ]
    },
    ru: { 
      nextMatch: (displayMatchInfo as any)?.isFriendly ? ((displayMatchInfo as any)?.isTrial ? "Пробный бой" : "Текущий матч") : ((displayMatchInfo as any)?.isTournament ? "Турнирный бой" : ((displayMatchInfo as any)?.isBasket ? "Бой из КВ корзины" : ((displayMatchInfo as any)?.isCup ? "Раунд Кубка Пирамиды" : "Следующий матч"))), 
      vs: "ПРОТИВ", today: "СЕГОДНЯ", tomorrow: "ЗАВТРА", battleBtn: "ОБЗОР МАТЧЕЙ", navTitle: "Тактические Терминалы", 
      interSeason: "Межсезонье", interSeasonDesc: "Формирование новых групп.", preSeason: "Подготовка к лиге", preSeasonDesc: "Первая игра начнется завтра.", 
      startsIn: ((displayMatchInfo as any)?.isFriendly || (displayMatchInfo as any)?.isBasket) ? "ВРЕМЯ ДО КОНЦА:" : "ДО МАТЧА ОСТАЛОСЬ:",
      tourLive: "В ЭФИРЕ",
      menu: [ 
        { label: 'Ростер', href: '/roster', icon: Users, desc: 'Состав команды' }, 
        { label: 'Инфраструктура', href: '/training', icon: Zap, desc: 'Улучшение базы' }, 
        { label: 'Персонал', href: '/staff', icon: UserCog, desc: 'Профессиональная команда' },
        { label: 'Трансферы', href: '/transfers', icon: ShoppingCart, desc: 'Рынок игроков' }, 
        { label: 'Юношеская академия', href: '/youth-academy', icon: GraduationCap, desc: 'Развитие талантов' },
        { label: 'Таблицы', href: '/rankings', icon: Trophy, desc: 'Рейтинги' }, 
        { label: 'Матчи', href: '/matches', icon: CalendarDays, desc: 'Расписание' }, 
        { label: 'Турниры', href: '/tournaments', icon: Medal, desc: 'События' }, 
        { label: 'Финансы', href: '/finances', icon: Coins, desc: 'Управление бюджетом' },
        { label: 'Фанклуб', href: '/fanclub', icon: Heart, desc: 'Управление болельщиками' },
        { label: 'Чаты', href: '/chats', icon: MessageSquare, desc: 'Связь' }, 
        { label: 'Менеджеры', href: '/managers', icon: UsersRound, desc: 'Сообщество' },
        { label: 'Ассоциация', href: '/associations', icon: Shield, desc: 'Альянсы клубов' },
        { label: 'Магазин', href: '/shop', icon: Store, desc: 'Ресурсы и услуги' },
        { label: 'Профиль', href: '/profile', icon: User, desc: 'Настройки' } 
      ]
    }
  };

  const t = translations[language as keyof typeof translations] || translations.ru;

  return (
    <div className="max-w-md mx-auto px-4 pt-8 pb-12">
      <header className="mb-6">
        <h1 className="text-2xl font-headline font-bold tracking-tighter text-primary uppercase flex items-center gap-2">
          {(displayMatchInfo as any)?.isFriendly || (displayMatchInfo as any)?.isLive || (displayMatchInfo as any)?.isBasket ? <PlayCircle className="w-6 h-6 text-green-400 animate-pulse" /> : <UserSearch className="w-6 h-6 text-accent" />}
          {t.nextMatch}
        </h1>
      </header>
      
      <section className="mb-8">
        {displayMatchInfo ? (
          <Card className={cn(
            "glass-card border-primary/20 bg-gradient-to-br from-primary/10 to-transparent overflow-hidden", 
            ((displayMatchInfo as any).isFriendly || (displayMatchInfo as any).isLive || (displayMatchInfo as any).isBasket) && "border-green-500/30 bg-green-500/5",
            (displayMatchInfo as any).isCup && "border-accent/30 bg-accent/5"
          )}>
            <CardContent className="p-0">
              <div className="p-4 border-b border-white/5 flex items-center justify-center">
                <div className="flex flex-col items-center">
                  <span className={cn("text-[10px] font-bold uppercase tracking-tighter mb-1", ((displayMatchInfo as any).isFriendly || (displayMatchInfo as any).isLive || (displayMatchInfo as any).isBasket) ? "text-green-400" : "text-accent")}>
                    {(displayMatchInfo as any).isLive ? t.tourLive : t.startsIn}
                  </span>
                  <span className={cn("text-4xl font-headline font-bold tabular-nums tracking-tighter", ((displayMatchInfo as any).isFriendly || (displayMatchInfo as any).isLive || (displayMatchInfo as any).isBasket) ? "text-green-400" : "text-primary")}>
                    {(displayMatchInfo as any).isLive ? 'LIVE' : countdown || '00:00'}
                  </span>
                </div>
              </div>
              <div className="p-6 flex flex-col items-center text-center">
                <div className="relative mb-4">
                  <div className={cn("w-20 h-20 rounded-full bg-secondary/50 flex items-center justify-center border-2", ((displayMatchInfo as any).isFriendly || (displayMatchInfo as any).isLive || (displayMatchInfo as any).isBasket) ? "border-green-500" : "border-accent")}>
                    {(displayMatchInfo as any).isCup ? <Target className="w-10 h-10 text-accent" /> : <User className={cn("w-10 h-10", ((displayMatchInfo as any).isFriendly || (displayMatchInfo as any).isLive || (displayMatchInfo as any).isBasket) ? "text-green-400" : "text-accent")} />}
                  </div>
                  <div className="absolute -bottom-1 -right-1 bg-background rounded-full p-1.5 border border-white/10 shadow-lg">
                    <Swords className={cn("w-4 h-4", ((displayMatchInfo as any).isFriendly || (displayMatchInfo as any).isLive || (displayMatchInfo as any).isBasket) ? "text-green-400" : "text-primary")} />
                  </div>
                </div>
                <h3 className={cn("text-xl font-headline font-bold italic uppercase truncate w-full px-4", ((displayMatchInfo as any).isFriendly || (displayMatchInfo as any).isLive || (displayMatchInfo as any).isBasket) ? "text-green-400" : "text-primary")}>
                  {(displayMatchInfo as any).opponent.name}
                </h3>
                <div className="flex items-center gap-2 mt-2">
                  <Badge variant="secondary" className="text-[8px] uppercase tracking-tighter">
                    {(displayMatchInfo as any).opponent.isPlayer ? 'REAL MANAGER' : 'ELITE BOT'}
                  </Badge>
                  <div className={cn("text-[10px] font-bold", ((displayMatchInfo as any).isFriendly || (displayMatchInfo as any).isLive || (displayMatchInfo as any).isBasket) ? "text-green-400" : "text-accent")}>
                    {(displayMatchInfo as any).isCup ? (displayMatchInfo as any).label : 
                     (displayMatchInfo as any).tourName || 
                     ((displayMatchInfo as any).isFriendly ? ((displayMatchInfo as any).isTrial ? (language === 'ru' ? 'ПРОБНЫЙ МАТЧ' : 'TRIAL MATCH') : (language === 'ru' ? 'ТОВАРИЩЕСКИЙ МАТЧ' : 'FRIENDLY MATCH')) : 
                     ((displayMatchInfo as any).isBasket ? (language === 'ru' ? 'МАТЧ КВ КОРЗИНЫ' : 'CW BASKET MATCH') :
                     `DIV ${leagueLevel}.${divisionSubId} | Day ${(displayMatchInfo as any).day}`))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="glass-card border-accent/20 bg-accent/5">
            <CardContent className="p-8 flex flex-col items-center text-center space-y-4">
              {seasonDay === 15 ? (
                <><Loader2 className="w-12 h-12 text-accent animate-spin" /><div><h3 className="text-lg font-headline font-bold uppercase">{t.interSeason}</h3><p className="text-xs text-muted-foreground mt-1">{t.interSeasonDesc}</p></div></>
              ) : seasonDay === 16 ? (
                <><Clock className="w-12 h-12 text-primary animate-pulse" /><div><h3 className="text-lg font-headline font-bold uppercase">{t.preSeason}</h3><p className="text-xs text-muted-foreground mt-1">{t.preSeasonDesc}</p></div></>
              ) : (
                <><ShieldAlert className="w-12 h-12 text-muted-foreground" /><div><h3 className="text-lg font-headline font-bold uppercase">No Scheduled Match</h3><p className="text-xs text-muted-foreground mt-1">Operational status normal.</p></div></>
              )}
            </CardContent>
          </Card>
        )}
      </section>
      
      <div className="space-y-4 mb-12">
        <Link href="/match" className="block relative">
          <Button className="w-full h-20 hero-gradient border-none shadow-xl hover:opacity-90 transition-all flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <Swords className="w-6 h-6" />
              <span className="text-xl font-headline font-bold italic uppercase">{t.battleBtn}</span>
            </div>
          </Button>
          {unseenCount > 0 && (
            <div className="absolute -top-2 -right-2 w-7 h-7 bg-red-600 rounded-full flex items-center justify-center border-2 border-background shadow-lg animate-bounce z-20">
              <span className="text-[10px] font-black text-white">{unseenCount}</span>
            </div>
          )}
        </Link>
      </div>
      
      <div className="space-y-4">
        <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-accent px-1">{t.navTitle}</h2>
        <div className="space-y-2">
          {t.menu.map((item) => (
            <Link key={item.label} href={item.href} className='block'>
              <Card className="glass-card hover:bg-white/5 transition-colors border-white/5">
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
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
