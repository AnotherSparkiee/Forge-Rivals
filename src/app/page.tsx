
'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useUser, useFirestore, useDoc, useMemoFirebase, useCollection } from '@/firebase';
import { useGameState } from './lib/store';
import { 
  Users, Trophy, Zap, Clock,
  UserSearch, ShieldAlert, Medal, User, Swords, ChevronRight,
  CalendarDays, PlayCircle, MessageSquare, UsersRound, Target, ShoppingCart,
  GraduationCap, UserCog, Coins, Heart, Store, Shield, Radar, Timer
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

  const userRef = useMemoFirebase(() => user ? doc(db, 'players_v10', user.uid) : null, [db, user]);
  const { data: profile, isLoading: isProfileLoading } = useDoc(userRef);

  const groupQuery = useMemoFirebase(() => {
    if (!profile?.selectedLeagueId || !user?.uid) return null;
    return query(
      collection(db, 'players_v10'),
      where('selectedLeagueId', '==', profile.selectedLeagueId),
      where('leagueLevel', '==', profile.leagueLevel),
      where('groupId', '==', profile.groupId)
    );
  }, [db, profile?.selectedLeagueId, profile?.leagueLevel, profile?.groupId, user?.uid]);

  const { data: groupPlayers, isLoading: isGroupLoading } = useCollection(groupQuery);

  const globeParticipantsQuery = useMemoFirebase(() => {
    return query(collection(db, 'players_v10'), where('tournaments', 'array-contains', 'iron-globe'));
  }, [db]);
  const { data: globeParticipants } = useCollection(globeParticipantsQuery);

  const brickParticipantsQuery = useMemoFirebase(() => {
    return query(collection(db, 'players_v10'), where('tournaments', 'array-contains', 'iron-brick'));
  }, [db]);
  const { data: brickParticipants } = useCollection(brickParticipantsQuery);

  const myBasketRef = useMemoFirebase(() => user ? doc(db, 'cw_basket_v2', user.uid) : null, [db, user]);
  const { data: basketEntry } = useDoc(myBasketRef);

  useEffect(() => {
    if (!isUserLoading && !user) {
      router.push('/auth/register');
      return;
    }
    
    // Safety check for session
    const isHubEntered = typeof window !== 'undefined' && sessionStorage.getItem('lote_hub_entered') === 'true';
    if (!isHubEntered && !isUserLoading) {
      router.replace('/auth/register');
    }
  }, [user, isUserLoading, router]);

  useEffect(() => {
    if (!user || isUserLoading) return;
    const unsub = onSnapshot(doc(db, 'friendly_lobbies_v3', user.uid), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.status === 'accepted') {
          const acceptedAt = data.acceptedAt?.toMillis() || Date.now(); 
          if (Date.now() - acceptedAt < 16 * 60 * 1000) {
            setActiveFriendly({ ...data, id: docSnap.id });
          } else {
            setActiveFriendly(null);
          }
        } else {
          setActiveFriendly(null);
        }
      } else {
        const q = query(collection(db, 'friendly_lobbies_v3'), where('challengerId', '==', user.uid), where('status', '==', 'accepted'));
        onSnapshot(q, (snap) => {
          if (!snap.empty) {
            const d = snap.docs[0].data();
            const acceptedAt = d.acceptedAt?.toMillis() || Date.now();
            if (Date.now() - acceptedAt < 16 * 60 * 1000) {
              setActiveFriendly({ ...d, id: snap.docs[0].id });
            } else {
              setActiveFriendly(null);
            }
          } else {
            setActiveFriendly(null);
          }
        });
      }
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
        time: activeFriendly.acceptedAt ? new Date(acceptedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '??:??',
        isTrial: activeFriendly.isTrial 
      };
    }
    if (tournamentNextMatch) return { ...tournamentNextMatch, isTournament: true };
    if (basketEntry?.status === 'matched') return { opponent: { name: basketEntry.matchedWithName, isPlayer: true }, isBasket: true, startTime: new Date(basketEntry.matchStartTime).getTime(), time: new Date(basketEntry.matchStartTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) };
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
    const interval = setInterval(() => {
      const mskNow = getMoscowTime();
      
      if (displayMatchInfo) {
        const info = displayMatchInfo as any;
        if (info.isFriendly) {
          const diff = (info.acceptedAt + 15 * 60 * 1000) - Date.now();
          if (diff <= 0) setCountdown('00:00:00');
          else {
            const h = Math.floor(diff / 3600000);
            const m = Math.floor((diff % 3600000) / 60000);
            const s = Math.floor((diff % 60000) / 1000);
            setCountdown(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`);
          }
          return;
        } else if (info.isBasket) {
          const diff = info.startTime - Date.now();
          if (diff <= 0) setCountdown('00:00:00');
          else {
            const h = Math.floor(diff / 3600000);
            const m = Math.floor((diff % 3600000) / 60000);
            const s = Math.floor((diff % 60000) / 1000);
            setCountdown(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`);
          }
          return;
        } else if (info.time) {
          const [h, m] = info.time.split(':').map(Number);
          const targetDate = new Date(mskNow); targetDate.setHours(h, m, 0, 0);
          if (info.isNextDay) targetDate.setDate(targetDate.getDate() + 1);
          const diff = targetDate.getTime() - mskNow.getTime();
          if (diff <= 0) setCountdown('00:00:00');
          else setCountdown(`${String(Math.floor(diff / 3600000)).padStart(2, '0')}:${String(Math.floor((diff % 3600000) / 60000)).padStart(2, '0')}:${String(Math.floor((diff % 60000) / 1000)).padStart(2, '0')}`);
          return;
        }
      }

      if (seasonDay === 15) {
        const targetDate = new Date(mskNow);
        targetDate.setHours(16, 0, 0, 0);
        const diff = targetDate.getTime() - mskNow.getTime();
        if (diff <= 0) setCountdown('PROCESSING');
        else {
          const h = Math.floor(diff / 3600000);
          const m = Math.floor((diff % 3600000) / 60000);
          const s = Math.floor((diff % 60000) / 1000);
          setCountdown(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`);
        }
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [displayMatchInfo, seasonDay]);

  const unseenCount = useMemo(() => {
    if (!profile) return 0;
    const setupTime = profile.setupDate ? new Date(profile.setupDate).getTime() : 0;
    return matchHistory.filter(m => {
      const matchTime = m.playedAt ? new Date(m.playedAt).getTime() : 0;
      return m.type === 'league' && m.day > lastSeenMatchDay && matchTime >= setupTime;
    }).length;
  }, [matchHistory, lastSeenMatchDay, profile]);

  if (isUserLoading || !isLoaded || !user || isProfileLoading || isGroupLoading) return <LoadingScreen />;

  const translations = {
    en: { 
      nextMatch: (displayMatchInfo as any)?.isFriendly ? "Live Match" : ((displayMatchInfo as any)?.isTournament ? "Tournament Battle" : ((displayMatchInfo as any)?.isBasket ? "CW Basket Match" : ((displayMatchInfo as any)?.isCup ? "Pyramid Cup" : "Next Engagement"))), 
      vs: "VS", today: "TODAY", tomorrow: "TOMORROW", battleBtn: "MATCH REVIEW", navTitle: "Command Terminals", 
      interSeason: "Inter-season", interSeasonDesc: "Recalculating league hierarchies.", startsIn: "TIME UNTIL MATCH:", tourLive: "LIVE ENGAGEMENT",
      menu: [ 
        { label: 'Roster', href: '/roster', icon: Users, desc: 'Manage lineup' }, 
        { label: 'Infrastructure', href: '/training', icon: Zap, desc: 'Improve base' }, 
        { label: 'Staff', href: '/staff', icon: UserCog, desc: 'Professional team' },
        { label: 'Transfers', href: '/transfers', icon: ShoppingCart, desc: 'Market operations' }, 
        { label: 'Youth Academy', href: '/youth-academy', icon: GraduationCap, desc: 'Scout stars' },
        { label: 'Rankings', href: '/rankings', icon: Trophy, desc: 'League tables' }, 
        { label: 'Matches', href: '/matches', icon: CalendarDays, desc: 'Schedule' }, 
        { label: 'Tournaments', href: '/tournaments', icon: Medal, desc: 'Global events' }, 
        { label: 'Finances', href: '/finances', icon: Coins, desc: 'Budget' },
        { label: 'Fanclub', href: '/fanclub', icon: Heart, desc: 'Supporters' },
        { label: 'Chats', href: '/chats', icon: MessageSquare, desc: 'Comms' },
        { label: 'Managers', href: '/managers', icon: UsersRound, desc: 'Global list' },
        { label: 'Association', href: '/associations', icon: Shield, desc: 'Alliances' },
        { label: 'Shop', href: '/shop', icon: Store, desc: 'Resources' },
        { label: 'Profile', href: '/profile', icon: User, desc: 'Settings' } 
      ]
    },
    ru: { 
      nextMatch: (displayMatchInfo as any)?.isFriendly ? "Текущий матч" : ((displayMatchInfo as any)?.isTournament ? "Турнирный бой" : ((displayMatchInfo as any)?.isBasket ? "Бой из корзины" : ((displayMatchInfo as any)?.isCup ? "Кубок Пирамиды" : "Следующий матч"))), 
      vs: "ПРОТИВ", today: "СЕГОДНЯ", tomorrow: "ЗАВТРА", battleBtn: "ОБЗОР МАТЧЕЙ", navTitle: "Командные Терминалы", 
      interSeason: "Межсезонье", interSeasonDesc: "Пересчет иерархии лиги.", startsIn: "ДО МАТЧА ОСТАЛОСЬ:", tourLive: "В ЭФИРЕ",
      menu: [ 
        { label: 'Ростер', href: '/roster', icon: Users, desc: 'Состав команды' }, 
        { label: 'Инфраструктура', href: '/training', icon: Zap, desc: 'Улучшение базы' }, 
        { label: 'Персонал', href: '/staff', icon: UserCog, desc: 'Проф. команда' },
        { label: 'Трансферы', href: '/transfers', icon: ShoppingCart, desc: 'Рынок игроков' }, 
        { label: 'Юношеская академия', href: '/youth-academy', icon: GraduationCap, desc: 'Поиск звезд' },
        { label: 'Таблицы', href: '/rankings', icon: Trophy, desc: 'Рейтинги' }, 
        { label: 'Матчи', href: '/matches', icon: CalendarDays, desc: 'Расписание' }, 
        { label: 'Турниры', href: '/tournaments', icon: Medal, desc: 'События' }, 
        { label: 'Финансы', href: '/finances', icon: Coins, desc: 'Бюджет' },
        { label: 'Фанклуб', href: '/fanclub', icon: Heart, desc: 'Болельщики' },
        { label: 'Чаты', href: '/chats', icon: MessageSquare, desc: 'Связь' }, 
        { label: 'Менеджеры', href: '/managers', icon: UsersRound, desc: 'Сообщество' },
        { label: 'Ассоциация', href: '/associations', icon: Shield, desc: 'Альянсы' },
        { label: 'Магазин', href: '/shop', icon: Store, desc: 'Ресурсы' },
        { label: 'Профиль', href: '/profile', icon: User, desc: 'Настройки' } 
      ]
    }
  };

  const t = translations[language as keyof typeof translations] || translations.ru;

  return (
    <div className="max-w-md mx-auto px-4 pt-8 pb-12">
      <header className="mb-6">
        <h1 className="text-2xl font-headline font-bold tracking-tighter text-primary uppercase flex items-center gap-2">
          {displayMatchInfo ? (
             (displayMatchInfo as any).isFriendly || (displayMatchInfo as any).isLive || (displayMatchInfo as any).isBasket ? <PlayCircle className="w-6 h-6 text-green-400 animate-pulse" /> : <UserSearch className="w-6 h-6 text-accent" />
          ) : <UserSearch className="w-6 h-6 text-accent" />}
          {displayMatchInfo ? t.nextMatch : t.nextMatch}
        </h1>
      </header>
      
      <section className="mb-8">
        {displayMatchInfo ? (
          <Card className={cn("glass-card border-primary/20 bg-gradient-to-br from-primary/10 to-transparent overflow-hidden", ((displayMatchInfo as any).isFriendly || (displayMatchInfo as any).isLive || (displayMatchInfo as any).isBasket) && "border-green-500/30 bg-green-500/5")}>
            <CardContent className="p-0">
              <div className="p-4 border-b border-white/5 flex items-center justify-center">
                <div className="flex flex-col items-center">
                  <span className={cn("text-[10px] font-bold uppercase mb-1", (displayMatchInfo as any).isLive ? "text-green-400" : "text-accent")}>{(displayMatchInfo as any).isLive ? t.tourLive : t.startsIn}</span>
                  <span className={cn("text-4xl font-headline font-bold tabular-nums tracking-tighter", (displayMatchInfo as any).isLive ? "text-green-400" : "text-primary")}>{countdown || '00:00:00'}</span>
                </div>
              </div>
              <div className="p-6 flex flex-col items-center text-center">
                <div className="relative mb-4">
                  <div className={cn("w-20 h-20 rounded-full bg-secondary/50 flex items-center justify-center border-2", ((displayMatchInfo as any).isFriendly || (displayMatchInfo as any).isLive || (displayMatchInfo as any).isBasket) ? "border-green-500" : "border-accent")}>
                    <User className={cn("w-10 h-10", ((displayMatchInfo as any).isFriendly || (displayMatchInfo as any).isLive || (displayMatchInfo as any).isBasket) ? "text-green-400" : "text-accent")} />
                  </div>
                </div>
                <h3 className="text-xl font-headline font-bold italic uppercase truncate w-full px-4">{(displayMatchInfo as any).opponent.name}</h3>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="glass-card border-accent/20 bg-accent/5">
            <CardContent className="p-8 flex flex-col items-center text-center space-y-4">
              <ShieldAlert className="w-12 h-12 text-muted-foreground" />
              <div><h3 className="text-lg font-headline font-bold uppercase">No Match</h3><p className="text-xs text-muted-foreground mt-1">Operational standby.</p></div>
            </CardContent>
          </Card>
        )}
      </section>
      
      <Link href="/match" className="block relative mb-8">
        <Button className="w-full h-20 hero-gradient border-none shadow-xl flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <Swords className="w-6 h-6" />
            <span className="text-xl font-headline font-bold italic uppercase">{t.battleBtn}</span>
          </div>
        </Button>
        {unseenCount > 0 && <div className="absolute -top-2 -right-2 w-7 h-7 bg-red-600 rounded-full flex items-center justify-center border-2 border-background shadow-lg animate-bounce z-20"><span className="text-[10px] font-black text-white">{unseenCount}</span></div>}
      </Link>
      
      <div className="space-y-4">
        <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-accent px-1">{t.navTitle}</h2>
        <div className="grid grid-cols-1 gap-2">
          {t.menu.map((item) => (
            <Link key={item.label} href={item.href}><Card className="glass-card hover:bg-white/5 transition-colors border-white/5"><CardContent className="p-4 flex items-center justify-between"><div className="flex items-center gap-4"><div className="p-2 rounded-lg bg-secondary/50"><item.icon className="w-5 h-5 text-primary" /></div><div><h3 className="text-sm font-bold uppercase">{item.label}</h3><p className="text-[10px] text-muted-foreground">{item.desc}</p></div></div><ChevronRight className="w-4 h-4 text-muted-foreground" /></CardContent></Card></Link>
          ))}
        </div>
      </div>
    </div>
  );
}
