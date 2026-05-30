'use client';

import { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useGameState } from '../lib/store';
import { 
  ChevronLeft, CalendarDays, UserSearch, CalendarClock, 
  History, Calendar, CheckSquare, ChevronRight, Shield,
  Clock, Swords, Trophy, EyeOff
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { useUser, useFirestore, useDoc, useCollection, useMemoFirebase } from '@/firebase';
import { doc, collection, query, where } from 'firebase/firestore';
import { getMockGroupTeams, getSchedule, LEAGUES, getMatchResult } from '../lib/leagues-data';
import { getMoscowDateString, getMoscowTime } from '../lib/time-utils';
import { LoadingScreen } from '@/components/game/LoadingScreen';
import { getDeterministicTournament } from '../tournaments/iron-globe/page';

type MatchTab = 
  | 'menu'
  | 'next_opponent' 
  | 'my_future' 
  | 'my_played' 
  | 'league_calendar' 
  | 'league_played';

export default function MatchesPage() {
  const { user, isUserLoading } = useUser();
  const router = useRouter();
  const { 
    isLoaded, language, leagueLevel, divisionSubId, groupId, seasonDay, rank, 
    lastLeagueMatchDate, lastCupMatchDate, seasonNumber, matchHistory, seasonStartDate,
    lastSeenMatchDay
  } = useGameState();
  const db = useFirestore();
  const [activeTab, setActiveTab] = useState<MatchTab>('menu');
  const [countdown, setCountdown] = useState('');

  useEffect(() => {
    if (!isUserLoading && !user) {
      router.push('/auth/register');
    }
  }, [user, isUserLoading, router]);

  const userRef = useMemoFirebase(() => user ? doc(db, 'players_v8', user.uid) : null, [db, user]);
  const { data: profile, isLoading: isProfileLoading } = useDoc(userRef);

  const groupQuery = useMemoFirebase(() => {
    if (!profile?.selectedLeagueId) return null;
    return query(
      collection(db, 'players_v8'),
      where('selectedLeagueId', '==', profile.selectedLeagueId),
      where('leagueLevel', '==', profile.leagueLevel),
      where('groupId', '==', profile.groupId)
    );
  }, [db, profile?.selectedLeagueId, profile?.leagueLevel, profile?.groupId]);

  const { data: groupPlayers, isLoading: isGroupLoading } = useCollection(groupQuery);

  const myLobbyRef = useMemoFirebase(() => user ? doc(db, 'friendly_lobbies_v2', user.uid) : null, [db, user]);
  const { data: myLobby } = useDoc(myLobbyRef);

  const challengerLobbyQuery = useMemoFirebase(() => {
    if (!user?.uid) return null;
    return query(
      collection(db, 'friendly_lobbies_v2'), 
      where('challengerId', '==', user.uid), 
      where('status', '==', 'accepted')
    );
  }, [db, user?.uid]);
  const { data: challengerLobbies } = useCollection(challengerLobbyQuery);

  const globeParticipantsQuery = useMemoFirebase(() => {
    return query(collection(db, 'players_v8'), where('tournaments', 'array-contains', 'iron-globe'));
  }, [db]);
  const { data: globeParticipants } = useCollection(globeParticipantsQuery);

  const brickParticipantsQuery = useMemoFirebase(() => {
    return query(collection(db, 'players_v8'), where('tournaments', 'array-contains', 'iron-brick'));
  }, [db]);
  const { data: brickParticipants } = useCollection(brickParticipantsQuery);

  const myBasketRef = useMemoFirebase(() => user ? doc(db, 'cw_basket_v2', user.uid) : null, [db, user]);
  const { data: basketEntry } = useDoc(myBasketRef);

  const league = useMemo(() => {
    return LEAGUES.find(l => l.id === profile?.selectedLeagueId) || LEAGUES[0];
  }, [profile?.selectedLeagueId]);

  const isTodayPlayed = useMemo(() => {
    const todayStr = getMoscowDateString();
    return lastLeagueMatchDate === todayStr;
  }, [lastLeagueMatchDate]);

  const isCupPlayedToday = useMemo(() => lastCupMatchDate === getMoscowDateString(), [lastCupMatchDate]);

  const groupTeams = useMemo(() => {
    if (!isLoaded || !profile || !groupPlayers) return [];
    const completedDays = isTodayPlayed ? seasonDay : seasonDay - 1;
    return getMockGroupTeams(
      rank, 
      profile.displayName || "My Team", 
      leagueLevel, 
      divisionSubId, 
      groupId, 
      profile.selectedLeagueId || "ALPHA",
      groupPlayers,
      user?.uid,
      Math.max(0, completedDays)
    );
  }, [isLoaded, profile, groupPlayers, leagueLevel, divisionSubId, groupId, seasonDay, rank, isTodayPlayed, user?.uid]);

  const schedule = useMemo(() => {
    if (groupTeams.length === 0) return [];
    return getSchedule(groupTeams);
  }, [groupTeams]);

  const friendlyInfo = useMemo(() => {
    const activeLobby = (myLobby?.status === 'accepted') ? myLobby : (challengerLobbies?.[0]);
    if (activeLobby && activeLobby.acceptedAt) {
      const acceptedAt = activeLobby.acceptedAt.toMillis();
      if (Date.now() < acceptedAt + (15 * 60 * 1000)) {
        return {
          opponent: { 
            name: activeLobby.hostId === user?.uid ? activeLobby.challengerName : activeLobby.hostName, 
            isPlayer: !activeLobby.isTrial 
          },
          time: new Date(acceptedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          type: activeLobby.isTrial ? 'trial' : 'friendly',
          acceptedAt
        };
      }
    }
    return null;
  }, [myLobby, challengerLobbies, user]);

  const tournamentInfo = useMemo(() => {
    if (!isLoaded || !user) return null;
    const mskNow = getMoscowTime();
    const dateStr = getMoscowDateString();
    const totalMins = mskNow.getHours() * 60 + mskNow.getMinutes();

    if (profile?.tournaments?.includes('iron-globe')) {
      if (totalMins >= (20 * 60 + 50) && totalMins < (21 * 60 + 40)) {
        const isLive = totalMins >= (21 * 60 + 5);
        const tour = getDeterministicTournament(dateStr, globeParticipants || [], user.uid, mskNow, "21:05");
        return {
          opponent: tour.myOpponent || { name: "Bot Team", isPlayer: false },
          time: "21:05",
          isLive,
          type: 'tournament',
          tourName: language === 'ru' ? 'ЧУГУННЫЙ ГЛОБУС' : 'CAST IRON GLOBE'
        };
      }
    }

    if (profile?.tournaments?.includes('iron-brick')) {
      if (totalMins >= (21 * 60 + 20) && totalMins < (22 * 60 + 10)) {
        const isLive = totalMins >= (21 * 60 + 35);
        const tour = getDeterministicTournament(dateStr, brickParticipants || [], user.uid, mskNow, "21:35");
        return {
          opponent: tour.myOpponent || { name: "Bot Team", isPlayer: false },
          time: "21:35",
          isLive,
          type: 'tournament',
          tourName: language === 'ru' ? 'ЧУГУННЫЙ КИРПИЧ' : 'CAST IRON BRICK'
        };
      }
    }

    return null;
  }, [isLoaded, profile, globeParticipants, brickParticipants, user, language]);

  const basketInfo = useMemo(() => {
    if (basketEntry?.status === 'matched' && basketEntry.matchStartTime) {
      const startTime = new Date(basketEntry.matchStartTime).getTime();
      if (Date.now() < startTime) {
        return {
          opponent: { name: basketEntry.matchedWithName, isPlayer: true },
          time: new Date(startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          type: 'basket',
          startTime
        };
      }
    }
    return null;
  }, [basketEntry]);

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

    const cupTime = "07:00";
    return { 
      opponent: { name: "Tournament Rival", isPlayer: false },
      time: cupTime,
      isNextDay: isCupPlayedToday,
      type: 'cup',
      isCup: true,
      label: language === 'ru' ? 'КУБОК ПИРАМИДЫ' : 'PYRAMID CUP'
    };
  }, [isLoaded, profile, seasonDay, matchHistory, seasonNumber, isCupPlayedToday, language]);

  const leagueNextMatch = useMemo(() => {
    if (!isLoaded || !profile || !groupTeams.length || !schedule.length || seasonDay > 14) return null;
    
    const targetDay = seasonDay === 0 ? 1 : (isTodayPlayed ? seasonDay + 1 : seasonDay);
    if (targetDay > 14) return null;

    const dayMatches = schedule[targetDay - 1];
    const myMatch = dayMatches?.find((m: any) => m.home.id === user?.uid || m.away.id === user?.uid);
    
    if (!myMatch) return null;

    const opponent = myMatch.home.id === user?.uid ? myMatch.away : myMatch.home;

    return {
      opponent,
      day: targetDay,
      time: league.startTime,
      isNextDay: targetDay > seasonDay,
      type: 'league',
      isCup: false
    };
  }, [isLoaded, profile, groupTeams, schedule, seasonDay, isTodayPlayed, league, user?.uid]);

  const nextMatchInfo = useMemo(() => {
    if (friendlyInfo) return friendlyInfo;
    if (tournamentInfo) return tournamentInfo;
    if (basketInfo) return basketInfo;
    
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
  }, [friendlyInfo, tournamentInfo, basketInfo, cupNextMatch, leagueNextMatch]);

  useEffect(() => {
    const interval = setInterval(() => {
      const mskNow = getMoscowTime();
      const info = nextMatchInfo as any;
      if (!info) return;
      
      if (info.type === 'friendly' || info.type === 'trial') {
        const diff = (info.acceptedAt + 15 * 60 * 1000) - Date.now();
        if (diff <= 0) setCountdown('00:00:00');
        else {
          const m = Math.floor(diff / 60000);
          const s = Math.floor((diff % 60000) / 1000);
          setCountdown(`00:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`);
        }
        return;
      }

      if (info.type === 'basket') {
        const diff = info.startTime - Date.now();
        if (diff <= 0) {
          setCountdown('00:00:00');
        } else {
          const h = Math.floor(diff / 3600000);
          const m = Math.floor((diff % 3600000) / 60000);
          const s = Math.floor((diff % 60000) / 1000);
          setCountdown(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`);
        }
        return;
      }

      if (info.time) {
        const [hours, minutes] = info.time.split(':').map(Number);
        const targetDate = new Date(mskNow);
        targetDate.setHours(hours, minutes, 0, 0);
        
        if (info.isNextDay) {
          targetDate.setDate(targetDate.getDate() + 1);
        }

        const diff = targetDate.getTime() - mskNow.getTime();
        if (diff <= 0) {
          setCountdown('00:00:00');
        } else {
          const h = Math.floor(diff / 3600000);
          const m = Math.floor((diff % 3600000) / 60000);
          const s = Math.floor((diff % 60000) / 1000);
          setCountdown(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`);
        }
      } else {
        setCountdown('');
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [nextMatchInfo]);

  const getDateForDay = (day: number) => {
    if (!seasonStartDate) return "";
    const date = new Date(seasonStartDate);
    date.setDate(date.getDate() + (day - 1));
    return date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
  };

  if (isUserLoading || !isLoaded || !user || isProfileLoading || isGroupLoading) {
    return <LoadingScreen />;
  }

  const translations = {
    en: {
      title: "OPERATIONAL MATCHES",
      subtitle: "Tactical Schedule & History",
      menuTitle: "Match Terminals",
      backToMenu: "Back to Menu",
      status: "Operational Status",
      day: "Day",
      vs: "VS",
      matchTime: "Deployment Window",
      startTime: "Start Time",
      noData: "No records found for this sector.",
      today: "TODAY",
      tomorrow: "TOMORROW",
      startsIn: "TIME UNTIL MATCH:",
      tourLive: "LIVE TOURNAMENT MATCH",
      friendlyLive: "LIVE ENGAGEMENT",
      hiddenScore: "HIDDEN",
      tabs: {
        next_opponent: { label: "Next Opponent", desc: "Detailed brief on your next rival", icon: UserSearch },
        my_future: { label: "My Future", desc: "Upcoming matches for your team", icon: CalendarClock },
        my_played: { label: "My Played", desc: "History of your previous encounters", icon: History },
        league_calendar: { label: "League Calendar", desc: "Full season schedule", icon: Calendar },
        league_played: { label: "Played in League", desc: "All group results", icon: CheckSquare }
      }
    },
    ru: {
      title: "СПИСОК МАТЧЕЙ",
      subtitle: "Расписание и История",
      menuTitle: "Тактические Терминалы",
      backToMenu: "В меню",
      status: "Статус операций",
      day: "День",
      vs: "ПРОТИВ",
      matchTime: "Окно развертывания",
      startTime: "Начало",
      noData: "Записей в данном секторе не обнаружено.",
      today: "СЕГОДНЯ",
      tomorrow: "ЗАВТРА",
      startsIn: "ДО МАТЧА ОСТАЛОСЬ:",
      tourLive: "ТУРНИРНЫЙ БОЙ В ЭФИРЕ",
      friendlyLive: "ТЕКУЩИЙ МАТЧ",
      hiddenScore: "СКРЫТО",
      tabs: {
        next_opponent: { label: "Следующий соперник", desc: "Досье на ближайшего врага", icon: UserSearch },
        my_future: { label: "Свои будущие", desc: "Предстоящие игры команды", icon: CalendarClock },
        my_played: { label: "Свои сыгранные", desc: "История ваших сражений", icon: History },
        league_calendar: { label: "Календарь лиги", desc: "Полное расписание сезона", icon: Calendar },
        league_played: { label: "Сыгранные в лиге", desc: "Все результаты группы", icon: CheckSquare }
      }
    }
  };

  const t = translations[language as keyof typeof translations] || translations.ru;

  const renderMatchRow = (match: any, dayIdx: number) => {
    const day = dayIdx + 1;
    const isPlayed = seasonDay > 0 && (day < seasonDay || (day === seasonDay && isTodayPlayed));
    const isSeen = day <= lastSeenMatchDay;
    const startHour = league.startTime;
    const matchDate = getDateForDay(day);

    let hScore = 0;
    let aScore = 0;

    if (isPlayed) {
      const historicalMatch = matchHistory.find(m => 
        m.day === day && 
        m.type === 'league' && 
        (match.home.id === user.uid || match.away.id === user.uid)
      );

      if (historicalMatch) {
        hScore = match.home.id === user.uid ? historicalMatch.scoreA : historicalMatch.scoreB;
        aScore = match.away.id === user.uid ? historicalMatch.scoreA : historicalMatch.scoreB;
      } else {
        [hScore, aScore] = getMatchResult(match.home.id, match.away.id, day);
      }
    }

    return (
      <div key={`match-${day}-${match.home.id}-${match.away.id}`} className="bg-secondary/20 p-3 rounded-xl border border-white/5 flex items-center justify-between gap-3">
        <div className="flex flex-col items-center w-12 flex-shrink-0 border-r border-white/5 pr-2">
          <span className="text-[10px] font-mono font-bold text-accent">{matchDate}</span>
          <span className="text-[8px] uppercase font-bold text-muted-foreground">{t.day} {day}</span>
        </div>
        <div className="flex-1 flex items-center justify-between gap-1 min-w-0">
          <div className={cn("flex-1 text-right text-[10px] font-bold uppercase truncate", match.home.id === user.uid && "text-primary")}>
            {match.home.name}
          </div>
          <div className="flex flex-col items-center px-2 min-w-[70px]">
            {isPlayed ? (
              isSeen || (match.home.id !== user.uid && match.away.id !== user.uid) ? (
                <div className="flex items-center gap-1.5">
                  <span className="text-base font-headline font-bold">{hScore}</span>
                  <span className="text-muted-foreground text-[10px]">:</span>
                  <span className="text-base font-headline font-bold">{aScore}</span>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-0.5 opacity-50">
                  <EyeOff className="w-3 h-3 text-muted-foreground" />
                  <span className="text-[7px] font-black uppercase text-muted-foreground tracking-tighter">{t.hiddenScore}</span>
                </div>
              )
            ) : (
              <div className="flex flex-col items-center gap-0.5">
                <Badge variant="outline" className="text-[7px] px-1 py-0 uppercase border-accent/20 text-accent leading-none">{t.vs}</Badge>
                <div className="flex items-center gap-0.5 text-[8px] text-primary font-mono font-bold leading-none mt-1 bg-primary/5 px-1 rounded">
                  {startHour}
                </div>
              </div>
            )}
          </div>
          <div className={cn("flex-1 text-left text-[10px] font-bold uppercase truncate", match.away.id === user.uid && "text-primary")}>
            {match.away.name}
          </div>
        </div>
      </div>
    );
  };

  const renderHistoryRow = (match: any, index: number) => {
    const isWin = (match.scoreA > match.scoreB);
    const isDraw = (match.scoreA === match.scoreB);
    const isSeen = match.day <= lastSeenMatchDay;
    
    let dateStr = "??.??";
    try {
      if (match.playedAt) {
        const d = new Date(match.playedAt);
        if (!isNaN(d.getTime())) {
          dateStr = d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' }) + 
                    " " + d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
        }
      }
    } catch (e) {
      console.warn("Date formatting error in history row", e);
    }

    return (
      <Link key={`history-${match.id}-${index}`} href={`/match?id=${match.id}`} className="block group">
        <div className="bg-secondary/20 p-3 rounded-xl border border-white/5 flex items-center justify-between gap-3 group-hover:bg-white/5 transition-colors">
          <div className="flex flex-col items-center w-16 flex-shrink-0 border-r border-white/5 pr-2">
            <span className="text-[10px] font-mono font-bold text-accent whitespace-nowrap">{dateStr}</span>
            <span className="text-[7px] uppercase font-black text-muted-foreground text-center leading-none mt-1">
              {match.type === 'league' ? `DAY ${match.day}` : (match.type === 'cup' ? 'CUP' : (match.type === 'basket' ? 'BASKET' : (match.type === 'trial' ? 'TRIAL' : 'FRIENDLY')))}
            </span>
          </div>
          <div className="flex-1 flex items-center justify-between gap-1 min-w-0 px-2">
            <div className="flex-1 text-right text-[10px] font-bold uppercase truncate text-primary">
              {profile?.displayName || 'My Team'}
            </div>
            <div className="flex flex-col items-center px-4">
              {isSeen || match.type !== 'league' ? (
                <div className="flex items-center gap-1.5">
                  <span className={cn("text-base font-headline font-bold", isWin ? "text-primary" : isDraw ? "text-accent" : "text-destructive")}>
                    {match.scoreA}
                  </span>
                  <span className="text-muted-foreground text-[10px]">:</span>
                  <span className={cn("text-base font-headline font-bold")}>
                    {match.scoreB}
                  </span>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-0.5 opacity-50">
                  <EyeOff className="w-3 h-3 text-muted-foreground" />
                  <span className="text-[7px] font-black uppercase text-muted-foreground">{t.hiddenScore}</span>
                </div>
              )}
            </div>
            <div className="flex-1 text-left text-[10px] font-bold uppercase truncate">
              {match.opponentName || 'Unknown Team'}
            </div>
          </div>
          <div className="flex-shrink-0">
            <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
          </div>
        </div>
      </Link>
    );
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'next_opponent': {
        if (!nextMatchInfo) return <p className="text-center py-10 text-muted-foreground uppercase text-xs">Season Finished or Pre-season</p>;
        
        const info = nextMatchInfo as any;
        const opponent = info.opponent;
        const isTourSpecial = info.type === 'tournament';
        const isBasket = info.type === 'basket';
        const isFriendly = info.type === 'friendly';
        const isTrial = info.type === 'trial';
        const isCup = info.isCup;
        const isLive = info.isLive || isFriendly || isTrial;
        
        return (
          <div className="space-y-6 animate-in fade-in duration-500">
            <Card className={cn(
              "glass-card border-primary/20 bg-primary/5",
              (isTourSpecial || isCup) && "border-accent/30 bg-accent/5",
              isBasket && "border-green-500/30 bg-green-500/5",
              isLive && "border-green-500/30 bg-green-500/5"
            )}>
              <CardHeader className="text-center pb-2">
                <CardTitle className="text-lg font-headline font-bold uppercase tracking-tighter text-accent">
                  {info.tourName || info.label || "Intelligence Report"}
                </CardTitle>
                <div className="flex flex-col items-center gap-2 mt-4">
                  <div className="bg-background/50 px-6 py-2 rounded-xl border border-white/5">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase text-center mb-1">{isLive ? (isFriendly || isTrial ? t.friendlyLive : t.tourLive) : t.startsIn}</p>
                    <p className={cn(
                      "text-3xl font-headline font-bold tabular-nums tracking-tighter",
                      isLive ? "text-green-400" : "text-primary"
                    )}>
                      {isLive ? (isFriendly || isTrial ? countdown || '00:00' : 'LIVE') : countdown || '00:00:00'}
                    </p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="flex flex-col items-center space-y-4">
                <div className={cn(
                  "w-20 h-20 rounded-full bg-secondary/50 flex items-center justify-center border-2 shadow-[0_0_15px_rgba(var(--accent),0.2)]",
                  (isTourSpecial || isBasket || isFriendly || isTrial || isCup) ? "border-accent" : "border-primary"
                )}>
                  {isCup ? <Trophy className="w-10 h-10 text-accent" /> : 
                   (isBasket || isFriendly || isTrial ? <Swords className="w-10 h-10 text-green-400" /> : 
                    <Shield className="w-10 h-10 text-primary" />)}
                </div>
                <div className="text-center">
                  <h3 className={cn("text-xl font-headline font-bold italic uppercase truncate max-w-[250px]", (isBasket || isFriendly || isTrial) ? "text-green-400" : "text-primary")}>{opponent.name}</h3>
                  <Badge variant="secondary" className="mt-2 text-[10px]">
                    {opponent.isPlayer ? 'REAL MANAGER' : 'ELITE BOT'} | {info.label || (isBasket ? 'CW BASKET' : (isFriendly ? 'FRIENDLY MATCH' : (isTrial ? 'TRIAL MATCH' : `DIV ${leagueLevel}.${divisionSubId}`)))}
                  </Badge>
                </div>
                
                <div className="w-full bg-accent/10 p-4 rounded-xl border border-accent/20 text-center shadow-[0_0_20px_rgba(var(--accent),0.1)]">
                  <p className="text-[10px] uppercase text-accent font-bold mb-1 flex items-center justify-center gap-1">
                    <Calendar className="w-3 h-3" /> {t.matchTime}
                  </p>
                  <p className="text-xl font-headline font-bold tracking-tight">
                    {(isBasket || isFriendly || isTrial) ? 'IN 15 MIN' : (info.isCup ? t.today : (info.isNextDay ? t.tomorrow : t.today))} {(isBasket || isFriendly || isTrial) ? '' : (info.type === 'league' ? getDateForDay(info.day) : '')} @ {info.time}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        );
      }

      case 'my_future': {
        const startIdx = isTodayPlayed ? seasonDay : (seasonDay === 0 ? 0 : seasonDay - 1);
        const futureMatches = schedule.slice(startIdx).map((dayMatches: any, i) => {
          const m = dayMatches.find((match: any) => match.home.id === user?.uid || match.away.id === user?.uid);
          return { match: m, dayIdx: startIdx + i };
        }).filter(item => !!item.match);

        return (
          <div className="space-y-3 animate-in slide-in-from-bottom-4 duration-500">
            {futureMatches.length > 0 ? (
              futureMatches.map(item => renderMatchRow(item.match, item.dayIdx))
            ) : (
              <p className="text-center py-10 text-muted-foreground uppercase text-xs">No upcoming matches</p>
            )}
          </div>
        );
      }

      case 'my_played': {
        const history = [...matchHistory].sort((a, b) => {
          const timeA = a.playedAt ? new Date(a.playedAt).getTime() : 0;
          const timeB = b.playedAt ? new Date(b.playedAt).getTime() : 0;
          return timeB - timeA;
        }).slice(0, 50);

        if (history.length === 0) return (
          <div className="text-center py-20 opacity-50 space-y-4">
            <History className="w-12 h-12 mx-auto" />
            <p className="text-xs uppercase font-bold tracking-widest">{t.noData}</p>
          </div>
        );

        return (
          <div className="space-y-3 animate-in slide-in-from-bottom-4 duration-500">
            {history.map((match, index) => renderHistoryRow(match, index))}
          </div>
        );
      }

      case 'league_calendar': {
        return (
          <div className="space-y-8 animate-in fade-in duration-500">
            {schedule.map((dayMatches: any, dIdx: number) => (
              <div key={`calendar-${dIdx}`} className="space-y-3">
                <div className="flex items-center gap-2 px-1">
                  <span className="text-[10px] uppercase font-bold tracking-widest text-accent font-mono flex items-center gap-2">
                    <Clock className="w-3 h-3" /> {getDateForDay(dIdx + 1)} @ {league.startTime}
                  </span>
                  <div className="h-px flex-1 bg-white/5"></div>
                  <Badge variant="outline" className="text-[8px] border-primary/20 text-primary">DAY {dIdx + 1}</Badge>
                </div>
                <div className="space-y-2">
                  {dayMatches.map((m: any) => renderMatchRow(m, dIdx))}
                </div>
              </div>
            ))}
          </div>
        );
      }

      case 'league_played': {
        const endIdx = isTodayPlayed ? seasonDay : (seasonDay === 0 ? 0 : seasonDay - 1);
        if (endIdx === 0) return <p className="text-center py-10 text-muted-foreground">No matches played in league yet.</p>;
        const allPlayed = schedule.slice(0, endIdx).reverse();
        return (
          <div className="space-y-8 animate-in fade-in duration-500">
            {allPlayed.map((dayMatches: any, dIdx: number) => {
              const actualDayIdx = endIdx - 1 - dIdx;
              return (
                <div key={`played-${actualDayIdx}`} className="space-y-3">
                  <div className="flex items-center gap-2 px-1">
                    <span className="text-[10px] uppercase font-bold tracking-widest text-accent font-mono">{getDateForDay(actualDayIdx + 1)} @ {league.startTime}</span>
                    <div className="h-px flex-1 bg-white/5"></div>
                    <Badge variant="outline" className="text-[8px] border-primary/20 text-primary">DAY {actualDayIdx + 1}</Badge>
                  </div>
                  <div className="space-y-2">
                    {dayMatches.map((m: any) => renderMatchRow(m, actualDayIdx))}
                  </div>
                </div>
              );
            })}
          </div>
        );
      }

      default: return null;
    }
  };

  if (activeTab === 'menu') {
    return (
      <div className="max-w-md mx-auto px-4 pt-8 pb-20">
        <header className="mb-6 flex items-center gap-4">
          <Link href="/">
            <Button variant="ghost" size="icon" className="rounded-full">
              <ChevronLeft className="w-6 h-6" />
            </Button>
          </Link>
          <div className="flex-1">
            <h1 className="text-2xl font-headline font-bold flex items-center gap-2 uppercase tracking-tighter">
              <CalendarDays className="text-primary w-5 h-5" />
              {t.title}
            </h1>
            <p className="text-muted-foreground text-[10px] uppercase tracking-widest">
              Daily @ {league.startTime} MSK | Div {leagueLevel}.{divisionSubId}
            </p>
          </div>
        </header>

        <div className="space-y-4">
          <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-accent px-1">Tactical Terminals</h2>
          <div className="space-y-2">
            {(Object.entries(t.tabs) as [MatchTab, any][]).map(([tabId, tabData]) => (
              <Card 
                key={tabId} 
                className="glass-card hover:bg-white/5 transition-colors border-white/5 cursor-pointer"
                onClick={() => setActiveTab(tabId)}
              >
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="p-2 rounded-lg bg-secondary/50">
                      <tabData.icon className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold uppercase">{tabData.label}</h3>
                      <p className="text-[10px] text-muted-foreground">{tabData.desc}</p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto px-4 pt-8 pb-20">
      <header className="mb-6 flex items-center gap-4">
        <Button variant="ghost" size="icon" className="rounded-full" onClick={() => setActiveTab('menu')}>
          <ChevronLeft className="w-6 h-6" />
        </Button>
        <div className="flex-1">
          <h1 className="text-xl font-headline font-bold uppercase">
            {t.tabs[activeTab as keyof typeof t.tabs].label}
          </h1>
          <p className="text-muted-foreground text-[10px] uppercase tracking-widest">
            {t.subtitle} | {t.backToMenu}
          </p>
        </div>
      </header>

      <div className="space-y-6">
        {renderContent()}
      </div>
    </div>
  );
}
