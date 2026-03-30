
'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useUser, useFirestore, useDoc, useCollection, useMemoFirebase } from '@/firebase';
import { useGameState } from './lib/store';
import { 
  Users, Trophy, Zap, Clock,
  UserSearch, ShieldAlert, Medal, User, Swords, ChevronRight,
  CalendarDays, PlayCircle, Loader2, MessageSquare
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { LoadingScreen } from '@/components/game/LoadingScreen';
import { doc, collection, query, where, onSnapshot } from 'firebase/firestore';
import { getMockGroupTeams, getSchedule, LEAGUES } from './lib/leagues-data';
import { getMoscowDateString, getMoscowTime } from './lib/time-utils';
import { cn } from '@/lib/utils';
import { getDeterministicTournament } from './tournaments/iron-globe/page';

export default function Home() {
  const { user, isUserLoading } = useUser();
  const router = useRouter();
  const db = useFirestore();
  const { 
    rank, leagueLevel, divisionSubId, groupId, 
    language, isLoaded, lastLeagueMatchDate, seasonDay,
    matchHistory, lastSeenMatchDay, strategy, team
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

  const tourParticipantsQuery = useMemoFirebase(() => {
    return query(collection(db, 'players_v5'), where('tournaments', 'array-contains', 'iron-globe'));
  }, [db]);
  const { data: tourParticipants } = useCollection(tourParticipantsQuery);

  // Listen for CW Basket matches
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

  // Determine if tournament is active and showing next opponent
  const tournamentNextMatch = useMemo(() => {
    if (!isLoaded || !profile?.tournaments?.includes('iron-globe') || !user) return null;
    const mskNow = getMoscowTime();
    const dateStr = getMoscowDateString();
    
    const [ch, cm] = "20:50".split(':').map(Number);
    const cutoff = new Date(mskNow); cutoff.setHours(ch, cm, 0, 0);
    
    const [fh, fm] = "21:35".split(':').map(Number);
    const finish = new Date(mskNow); finish.setHours(fh, fm, 0, 0);

    if (mskNow.getTime() >= cutoff.getTime() && mskNow.getTime() < finish.getTime()) {
      const tour = getDeterministicTournament(dateStr, tourParticipants || [], user.uid);
      const isLive = mskNow.getHours() === 21 && mskNow.getMinutes() >= 5;
      
      return {
        opponent: tour.myOpponent || { name: "Bot Team", isPlayer: false },
        isFriendly: false,
        isTournament: true,
        isBasket: false,
        isLive,
        time: "21:05"
      };
    }
    return null;
  }, [isLoaded, profile, tourParticipants, user]);

  const basketNextMatch = useMemo(() => {
    if (!basketEntry || basketEntry.status !== 'matched' || !basketEntry.matchStartTime) return null;
    const startTime = new Date(basketEntry.matchStartTime).getTime();
    if (Date.now() >= startTime) return null;

    return {
      opponent: { name: basketEntry.matchedWithName, isPlayer: true },
      isFriendly: false,
      isTournament: false,
      isBasket: true,
      isLive: false,
      startTime
    };
  }, [basketEntry]);

  const leagueNextMatch = useMemo(() => {
    if (!isLoaded || !profile || !groupPlayers || seasonDay > 14) return null;
    const league = LEAGUES.find(l => l.id === profile.selectedLeagueId) || LEAGUES[0];
    const targetDay = seasonDay === 0 ? 1 : (isTodayPlayed ? seasonDay + 1 : seasonDay);
    if (targetDay > 14) return null;
    const schedule = getSchedule(getMockGroupTeams(rank, profile.displayName || "My Team", leagueLevel, divisionSubId, groupId, profile.selectedLeagueId || "ALPHA", groupPlayers, user?.uid, 0));
    const myMatch = schedule[targetDay - 1]?.find((m: any) => m.home.id === user?.uid || m.away.id === user?.uid);
    if (!myMatch) return null;
    return { opponent: myMatch.home.id === user?.uid ? myMatch.away : myMatch.home, day: targetDay, time: league.startTime, isNextDay: targetDay > seasonDay, isFriendly: false, isTournament: false, isBasket: false };
  }, [isLoaded, profile, groupPlayers, seasonDay, isTodayPlayed, rank, leagueLevel, divisionSubId, groupId, user?.uid]);

  const friendlyMatchInfo = useMemo(() => {
    if (!activeFriendly || !user) return null;
    const acceptedAt = activeFriendly.acceptedAt?.toMillis() || Date.now();
    if (Date.now() - acceptedAt > 15.5 * 60 * 1000) return null;
    return { opponent: { name: activeFriendly.hostId === user.uid ? activeFriendly.challengerName : activeFriendly.hostName, isPlayer: true }, day: 0, isFriendly: true, isTournament: false, isBasket: false, acceptedAt };
  }, [activeFriendly, user]);

  // Order of priority: Friendly > Tournament > Basket > League
  const displayMatchInfo = friendlyMatchInfo || tournamentNextMatch || basketNextMatch || leagueNextMatch;

  useEffect(() => {
    if (!displayMatchInfo) return;
    const interval = setInterval(() => {
      if (displayMatchInfo.isFriendly) {
        const diff = ((displayMatchInfo as any).acceptedAt + 15 * 60 * 1000) - Date.now();
        if (diff <= 0) setCountdown('00:00');
        else setCountdown(`${String(Math.floor(diff / 60000)).padStart(2, '0')}:${String(Math.floor((diff % 60000) / 1000)).padStart(2, '0')}`);
      } else if (displayMatchInfo.isBasket) {
        const diff = (displayMatchInfo as any).startTime - Date.now();
        if (diff <= 0) setCountdown('00:00');
        else setCountdown(`${String(Math.floor(diff / 60000)).padStart(2, '0')}:${String(Math.floor((diff % 60000) / 1000)).padStart(2, '0')}`);
      } else {
        const mskNow = getMoscowTime();
        const info = displayMatchInfo as any;
        if (!info.time) return;
        const [h, m] = info.time.split(':').map(Number);
        const targetDate = new Date(mskNow); targetDate.setHours(h, m, 0, 0);
        if (info.isNextDay && mskNow.getTime() >= targetDate.getTime()) targetDate.setDate(targetDate.getDate() + 1);
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
      nextMatch: displayMatchInfo?.isFriendly ? "Live Friendly" : (displayMatchInfo?.isTournament ? "Tournament Battle" : (displayMatchInfo?.isBasket ? "CW Basket Engagement" : "Next Engagement")), 
      vs: "VS", today: "TODAY", tomorrow: "TOMORROW", battleBtn: "MATCH REVIEW", navTitle: "Navigation Terminals", 
      interSeason: "Inter-season", interSeasonDesc: "Calculating new hierarchies.", preSeason: "Pre-season Readiness", preSeasonDesc: "Matches resume soon.", 
      startsIn: (displayMatchInfo?.isFriendly || displayMatchInfo?.isBasket) ? "REMAINING TIME:" : "TIME UNTIL MATCH:",
      tourLive: "TOURNAMENT LIVE",
      menu: [ { label: 'Roster', href: '/roster', icon: Users, desc: 'Manage lineup' }, { label: 'Training', href: '/training', icon: Zap, desc: 'Improve infrastructure' }, { label: 'Rankings', href: '/rankings', icon: Trophy, desc: 'View tables' }, { label: 'Matches', href: '/matches', icon: CalendarDays, desc: 'Schedule' }, { label: 'Tournaments', href: '/tournaments', icon: Medal, desc: 'Global events' }, { label: 'Chats', href: '/chats', icon: MessageSquare, desc: 'Comms' }, { label: 'Profile', href: '/profile', icon: User, desc: 'Settings' } ]
    },
    ru: { 
      nextMatch: displayMatchInfo?.isFriendly ? "Текущий матч" : (displayMatchInfo?.isTournament ? "Турнирный бой" : (displayMatchInfo?.isBasket ? "Бой из КВ корзины" : "Следующий матч")), 
      vs: "ПРОТИВ", today: "СЕГОДНЯ", tomorrow: "ЗАВТРА", battleBtn: "ОБЗОР МАТЧЕЙ", navTitle: "Тактические Терминалы", 
      interSeason: "Межсезонье", interSeasonDesc: "Формирование новых групп.", preSeason: "Подготовка к лиге", preSeasonDesc: "Первая игра начнется завтра.", 
      startsIn: (displayMatchInfo?.isFriendly || displayMatchInfo?.isBasket) ? "ВРЕМЯ ДО КОНЦА:" : "ДО МАТЧА ОСТАЛОСЬ:",
      tourLive: "ТУРНИР В ЭФИРЕ",
      menu: [ { label: 'Ростер', href: '/roster', icon: Users, desc: 'Состав команды' }, { label: 'Инфраструктура', href: '/training', icon: Zap, desc: 'Улучшение базы' }, { label: 'Таблицы', href: '/rankings', icon: Trophy, desc: 'Рейтинги' }, { label: 'Матчи', href: '/matches', icon: CalendarDays, desc: 'Расписание' }, { label: 'Турниры', href: '/tournaments', icon: Medal, desc: 'События' }, { label: 'Чаты', href: '/chats', icon: MessageSquare, desc: 'Связь' }, { label: 'Профиль', href: '/profile', icon: User, desc: 'Настройки' } ]
    }
  };

  const t = translations[language as keyof typeof translations] || translations.ru;

  return (
    <div className="max-w-md mx-auto px-4 pt-8 pb-12">
      <header className="mb-6">
        <h1 className="text-2xl font-headline font-bold tracking-tighter text-primary uppercase flex items-center gap-2">
          {displayMatchInfo?.isFriendly || displayMatchInfo?.isLive || displayMatchInfo?.isBasket ? <PlayCircle className="w-6 h-6 text-green-400 animate-pulse" /> : <UserSearch className="w-6 h-6 text-accent" />}
          {t.nextMatch}
        </h1>
      </header>
      
      <section className="mb-8">
        {displayMatchInfo ? (
          <Card className={cn(
            "glass-card border-primary/20 bg-gradient-to-br from-primary/10 to-transparent overflow-hidden", 
            (displayMatchInfo.isFriendly || displayMatchInfo.isLive || displayMatchInfo.isBasket) && "border-green-500/30 bg-green-500/5",
            displayMatchInfo.isTournament && !displayMatchInfo.isLive && "border-accent/30 bg-accent/5"
          )}>
            <CardContent className="p-0">
              <div className="p-4 border-b border-white/5 flex items-center justify-center">
                <div className="flex flex-col items-center">
                  <span className={cn("text-[10px] font-bold uppercase tracking-tighter mb-1", (displayMatchInfo.isFriendly || displayMatchInfo.isLive || displayMatchInfo.isBasket) ? "text-green-400" : "text-accent")}>
                    {displayMatchInfo.isLive ? t.tourLive : t.startsIn}
                  </span>
                  <span className={cn("text-4xl font-headline font-bold tabular-nums tracking-tighter", (displayMatchInfo.isFriendly || displayMatchInfo.isLive || displayMatchInfo.isBasket) ? "text-green-400" : "text-primary")}>
                    {displayMatchInfo.isLive ? 'LIVE' : countdown || '00:00:00'}
                  </span>
                </div>
              </div>
              <div className="p-6 flex flex-col items-center text-center">
                <div className="relative mb-4">
                  <div className={cn("w-20 h-20 rounded-full bg-secondary/50 flex items-center justify-center border-2", (displayMatchInfo.isFriendly || displayMatchInfo.isLive || displayMatchInfo.isBasket) ? "border-green-500" : "border-accent")}>
                    <User className={cn("w-10 h-10", (displayMatchInfo.isFriendly || displayMatchInfo.isLive || displayMatchInfo.isBasket) ? "text-green-400" : "text-accent")} />
                  </div>
                  <div className="absolute -bottom-1 -right-1 bg-background rounded-full p-1.5 border border-white/10">
                    <Swords className={cn("w-4 h-4", (displayMatchInfo.isFriendly || displayMatchInfo.isLive || displayMatchInfo.isBasket) ? "text-green-400" : "text-primary")} />
                  </div>
                </div>
                <h3 className={cn("text-xl font-headline font-bold italic uppercase truncate w-full px-4", (displayMatchInfo.isFriendly || displayMatchInfo.isLive || displayMatchInfo.isBasket) ? "text-green-400" : "text-primary")}>
                  {displayMatchInfo.opponent.name}
                </h3>
                <div className="flex items-center gap-2 mt-2">
                  <Badge variant="secondary" className="text-[8px] uppercase tracking-tighter">
                    {displayMatchInfo.opponent.isPlayer ? 'REAL MANAGER' : 'ELITE BOT'}
                  </Badge>
                  <div className={cn("text-[10px] font-bold", (displayMatchInfo.isFriendly || displayMatchInfo.isLive || displayMatchInfo.isBasket) ? "text-green-400" : "text-accent")}>
                    {displayMatchInfo.isTournament ? (language === 'ru' ? 'ЧУГУННЫЙ ГЛОБУС' : 'CAST IRON GLOBE') : 
                     displayMatchInfo.isFriendly ? (language === 'ru' ? 'ТОВАРИЩЕСКИЙ МАТЧ' : 'FRIENDLY MATCH') : 
                     displayMatchInfo.isBasket ? (language === 'ru' ? 'МАТЧ КВ КОРЗИНЫ' : 'CW BASKET MATCH') :
                     `DIV ${leagueLevel}.${divisionSubId} | Day ${displayMatchInfo.day}`}
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
