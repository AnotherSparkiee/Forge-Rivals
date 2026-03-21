
'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useUser, useFirestore, useDoc, useCollection, useMemoFirebase } from '@/firebase';
import { useGameState } from './lib/store';
import { 
  Users, Trophy, Zap, Clock,
  UserSearch, ShieldAlert, Medal, User, Swords, ChevronRight,
  CalendarDays, PlayCircle
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

  const userRef = useMemoFirebase(() => user ? doc(db, 'players_v2', user.uid) : null, [db, user]);
  const { data: profile, isLoading: isProfileLoading } = useDoc(userRef);

  const groupQuery = useMemoFirebase(() => {
    if (!profile?.selectedLeagueId) return null;
    return query(
      collection(db, 'players_v2'),
      where('selectedLeagueId', '==', profile.selectedLeagueId),
      where('leagueLevel', '==', profile.leagueLevel),
      where('groupId', '==', profile.groupId)
    );
  }, [db, profile?.selectedLeagueId, profile?.leagueLevel, profile?.groupId]);

  const { data: groupPlayers, isLoading: isGroupLoading } = useCollection(groupQuery);

  useEffect(() => {
    if (!isUserLoading && !user) {
      router.push('/auth/login');
    }
  }, [user, isUserLoading, router]);

  // Listen for active friendly match ONLY when accepted and involving THIS user
  useEffect(() => {
    if (!user || isUserLoading) return;
    
    // Listen for any lobby where status is accepted
    const q = query(collection(db, 'friendly_lobbies'), where('status', '==', 'accepted'));
    
    const unsub = onSnapshot(q, (snapshot) => {
      const matchDoc = snapshot.docs.find(d => {
        const data = d.data();
        return data.hostId === user.uid || data.challengerId === user.uid;
      });
      
      if (matchDoc) {
        const data = matchDoc.data();
        const acceptedAt = data.acceptedAt?.toMillis() || Date.now(); // Fallback to now if serverTimestamp is pending
        
        // If match is older than 16 minutes, it's stale
        if (Date.now() - acceptedAt < 16 * 60 * 1000) {
          setActiveFriendly({ ...data, id: matchDoc.id });
        } else {
          setActiveFriendly(null);
        }
      } else {
        setActiveFriendly(null);
      }
    });
    return () => unsub();
  }, [user, isUserLoading, db]);

  const isTodayPlayed = useMemo(() => {
    const todayStr = getMoscowDateString();
    return lastLeagueMatchDate === todayStr;
  }, [lastLeagueMatchDate]);

  const leagueNextMatch = useMemo(() => {
    if (!isLoaded || !profile || !groupPlayers) return null;
    
    const league = LEAGUES.find(l => l.id === profile.selectedLeagueId) || LEAGUES[0];
    const [matchH, matchM] = league.startTime.split(':').map(Number);
    const mskNow = getMoscowTime();
    
    const isPastMatchTimeToday = mskNow.getHours() > matchH || (mskNow.getHours() === matchH && mskNow.getMinutes() >= (matchM || 0));
    
    const targetDay = seasonDay === 0 ? 1 : (isTodayPlayed || isPastMatchTimeToday ? seasonDay + 1 : seasonDay);
    if (targetDay > 14) return null;

    const groupTeams = getMockGroupTeams(
      rank, 
      profile.displayName || "My Team", 
      leagueLevel, 
      divisionSubId, 
      groupId, 
      profile.selectedLeagueId || "ALPHA",
      groupPlayers,
      user?.uid,
      0 
    );
    
    const schedule = getSchedule(groupTeams);
    const dayMatches = schedule[targetDay - 1];
    const myMatch = dayMatches?.find((m: any) => m.home.id === user?.uid || m.away.id === user?.uid);
    
    if (!myMatch) return null;

    const opponent = myMatch.home.id === user?.uid ? myMatch.away : myMatch.home;

    return {
      opponent,
      day: targetDay,
      time: league.startTime,
      isNextDay: isTodayPlayed || isPastMatchTimeToday,
      isFriendly: false
    };
  }, [isLoaded, profile, groupPlayers, seasonDay, isTodayPlayed, rank, leagueLevel, divisionSubId, groupId, user?.uid]);

  const friendlyMatchInfo = useMemo(() => {
    if (!activeFriendly || !user) return null;
    
    // Allow a null acceptedAt for 1 second during initial server write
    const acceptedAt = activeFriendly.acceptedAt?.toMillis() || Date.now();
    const now = Date.now();
    
    if (now - acceptedAt > 15.5 * 60 * 1000) return null;

    const isHost = activeFriendly.hostId === user.uid;
    const opponentName = isHost ? activeFriendly.challengerName : activeFriendly.hostName;
    
    return {
      opponent: { name: opponentName, isPlayer: true },
      day: 0,
      isFriendly: true,
      acceptedAt
    };
  }, [activeFriendly, user]);

  const displayMatchInfo = friendlyMatchInfo || leagueNextMatch;

  useEffect(() => {
    if (!displayMatchInfo) return;

    const interval = setInterval(() => {
      if (displayMatchInfo.isFriendly) {
        const acceptedAt = (displayMatchInfo as any).acceptedAt;
        const finishTime = acceptedAt + (15 * 60 * 1000);
        const diff = finishTime - Date.now();
        if (diff <= 0) {
          setCountdown('00:00');
        } else {
          const m = Math.floor(diff / 60000);
          const s = Math.floor((diff % 60000) / 1000);
          setCountdown(`${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`);
        }
      } else {
        const mskNow = getMoscowTime();
        const info = displayMatchInfo as any;
        if (!info.time) return;
        const [hours, minutes] = info.time.split(':').map(Number);
        const targetDate = new Date(mskNow);
        targetDate.setHours(hours, minutes, 0, 0);
        
        if (info.isNextDay) {
          if (mskNow.getTime() >= targetDate.getTime()) {
            targetDate.setDate(targetDate.getDate() + 1);
          }
        } else {
          if (mskNow.getTime() >= targetDate.getTime()) {
            setCountdown('00:00:00');
            return;
          }
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
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [displayMatchInfo]);

  const unseenCount = useMemo(() => {
    return matchHistory.filter(m => m.type === 'league' && m.day > lastSeenMatchDay).length;
  }, [matchHistory, lastSeenMatchDay]);

  if (isUserLoading || !isLoaded || !user || isProfileLoading || isGroupLoading) {
    return <LoadingScreen />;
  }

  const translations = {
    en: {
      nextMatch: displayMatchInfo?.isFriendly ? "Live Friendly" : "Next Engagement",
      vs: "VS",
      today: "TODAY",
      tomorrow: "TOMORROW",
      battleBtn: "MATCH REVIEW",
      navTitle: "Navigation Terminals",
      preSeason: "Season Preparation",
      preSeasonDesc: "Calculating league brackets. First matches start tomorrow.",
      seasonEnded: "Season Finished",
      seasonEndedDesc: "The championship cycle is over. Final results are being calculated.",
      noOpponent: "No Active Opponents",
      noOpponentDesc: "The tactical link is clear. No scheduled engagements in this sector.",
      startsIn: displayMatchInfo?.isFriendly ? "REMAINING TIME:" : "TIME UNTIL MATCH:",
      menu: [
        { label: 'Battle Simulation', desc: 'Deploy team for automated matches' },
        { label: 'Team Roster', desc: 'Manage your active hero lineup' },
        { label: 'Tournament Tables', desc: 'Pyramid hierarchy and standings' },
        { label: 'Matches', desc: 'Schedule, history and next opponents' },
        { label: 'Marketplace', desc: 'Purchase new heroes and boosts' },
        { label: 'Team Stats', desc: 'Detailed performance analytics' },
        { label: 'Clubhouse', desc: 'Join associations and tournaments' },
        { label: 'News Feed', desc: 'Latest updates from the MOBA world' },
        { label: 'Training Base', desc: 'Improve hero characteristics' },
        { label: 'Tournaments', desc: 'Global events and friendly matches' },
        { label: 'Manager Profile', desc: 'Operational status and settings' },
      ]
    },
    ru: {
      nextMatch: displayMatchInfo?.isFriendly ? "Текущий матч" : "Следующий матч",
      vs: "ПРОТИВ",
      today: "СЕГОДНЯ",
      tomorrow: "ЗАВТРА",
      battleBtn: "ОБЗОР МАТЧЕЙ",
      navTitle: "Тактические Терминалы",
      preSeason: "Подготовка к сезону",
      preSeasonDesc: "Формирование дивизионов. Первые игры начнутся завтра.",
      seasonEnded: "Сезон завершен",
      seasonEndedDesc: "Цикл чемпионата окончен. Идет подведение итоговых результатов.",
      noOpponent: "Нет активных соперников",
      noOpponentDesc: "Тактический канал чист. Запланированных встреч в данном секторе нет.",
      startsIn: displayMatchInfo?.isFriendly ? "ВРЕМЯ ДО КОНЦА:" : "ДО МАТЧА ОСТАЛОСЬ:",
      menu: [
        { label: 'Боевая Симуляция', desc: 'Развертывание команды для матча' },
        { label: 'Ростер Команды', desc: 'Управление активным составом' },
        { label: 'Турнирные таблицы', desc: 'Иерархия пирамиды и положение' },
        { label: 'Матчи', desc: 'Расписание, история и будущие игры' },
        { label: 'Магазин', desc: 'Покупка героев и бонусов' },
        { label: 'Статистика', desc: 'Аналитика эффективности' },
        { label: 'Клуб', desc: 'Ассоциации и турниры' },
        { label: 'Новости', desc: 'События мира MOBA' },
        { label: 'Тренировочная база', desc: 'Повышение характеристик героев' },
        { label: 'Турниры', desc: 'Глобальные ивенты и товарищеские игры' },
        { label: 'Профиль Менеджера', desc: 'Статус операций и настройки' },
      ]
    }
  };

  const t = translations[language as keyof typeof translations] || translations.ru;

  const menuItems = [
    { label: t.menu[1].label, href: '/roster', icon: Users, desc: t.menu[1].desc, active: true },
    { label: t.menu[8].label, href: '/training', icon: Zap, desc: t.menu[8].desc, active: true },
    { label: t.menu[2].label, href: '/rankings', icon: Trophy, desc: t.menu[2].desc, active: true },
    { label: t.menu[3].label, href: '/matches', icon: CalendarDays, desc: t.menu[3].desc, active: true },
    { label: t.menu[9].label, href: '/tournaments', icon: Medal, desc: t.menu[9].desc, active: true },
    { label: t.menu[10].label, href: '/profile', icon: User, desc: t.menu[10].desc, active: true },
  ];

  return (
    <div className="max-w-md mx-auto px-4 pt-8 pb-12">
      <header className="mb-6">
        <h1 className="text-2xl font-headline font-bold tracking-tighter text-primary uppercase flex items-center gap-2">
          {displayMatchInfo?.isFriendly ? <PlayCircle className="w-6 h-6 text-green-400 animate-pulse" /> : <UserSearch className="w-6 h-6 text-accent" />}
          {t.nextMatch}
        </h1>
      </header>

      <section className="mb-8">
        {displayMatchInfo ? (
          <Card className={cn(
            "glass-card border-primary/20 bg-gradient-to-br from-primary/10 to-transparent overflow-hidden",
            displayMatchInfo.isFriendly && "border-green-500/30 bg-green-500/5"
          )}>
            <CardContent className="p-0">
              <div className="p-4 border-b border-white/5 flex items-center justify-center">
                <div className="flex flex-col items-center">
                  <span className={cn("text-[10px] font-bold uppercase tracking-tighter mb-1", displayMatchInfo.isFriendly ? "text-green-400" : "text-accent")}>
                    {t.startsIn}
                  </span>
                  <span className={cn(
                    "text-4xl font-headline font-bold tabular-nums tracking-tighter drop-shadow-[0_0_10px_rgba(var(--primary),0.5)]",
                    displayMatchInfo.isFriendly ? "text-green-400" : "text-primary"
                  )}>
                    {countdown || (displayMatchInfo.isFriendly ? '15:00' : '00:00:00')}
                  </span>
                </div>
              </div>
              <div className="p-6 flex flex-col items-center text-center">
                <div className="relative mb-4">
                  <div className={cn(
                    "w-20 h-20 rounded-full bg-secondary/50 flex items-center justify-center border-2 shadow-[0_0_20px_rgba(var(--accent),0.2)]",
                    displayMatchInfo.isFriendly ? "border-green-500" : "border-accent"
                  )}>
                    <User className={cn("w-10 h-10", displayMatchInfo.isFriendly ? "text-green-400" : "text-accent")} />
                  </div>
                  <div className="absolute -bottom-1 -right-1 bg-background rounded-full p-1.5 border border-white/10">
                    <Swords className={cn("w-4 h-4", displayMatchInfo.isFriendly ? "text-green-400" : "text-primary")} />
                  </div>
                </div>
                <h3 className={cn("text-xl font-headline font-bold italic uppercase truncate w-full px-4", displayMatchInfo.isFriendly ? "text-green-400" : "text-primary")}>
                  {displayMatchInfo.opponent.name}
                </h3>
                <div className="flex items-center gap-2 mt-2">
                  <Badge variant="secondary" className="text-[8px] uppercase tracking-tighter">
                    {displayMatchInfo.opponent.isPlayer ? 'REAL MANAGER' : 'ELITE BOT'}
                  </Badge>
                  <div className={cn("text-[10px] font-bold", displayMatchInfo.isFriendly ? "text-green-400" : "text-accent")}>
                    {displayMatchInfo.isFriendly ? 
                      (language === 'ru' ? 'ТОВАРИЩЕСКИЙ МАТЧ' : 'FRIENDLY MATCH') : 
                      `DIV ${leagueLevel}.${divisionSubId} | Day ${displayMatchInfo.day}`}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="glass-card border-accent/20 bg-accent/5">
            <CardContent className="p-8 flex flex-col items-center text-center space-y-4">
              {seasonDay === 0 ? (
                <>
                  <Clock className="w-12 h-12 text-accent animate-pulse" />
                  <div>
                    <h3 className="text-lg font-headline font-bold uppercase">{t.preSeason}</h3>
                    <p className="text-xs text-muted-foreground mt-1">{t.preSeasonDesc}</p>
                  </div>
                </>
              ) : seasonDay > 14 ? (
                <>
                  <Trophy className="w-12 h-12 text-yellow-500 animate-bounce" />
                  <div>
                    <h3 className="text-lg font-headline font-bold uppercase">{t.seasonEnded}</h3>
                    <p className="text-xs text-muted-foreground mt-1">{t.seasonEndedDesc}</p>
                  </div>
                </>
              ) : (
                <>
                  <ShieldAlert className="w-12 h-12 text-muted-foreground" />
                  <div>
                    <h3 className="text-lg font-headline font-bold uppercase">{t.noOpponent}</h3>
                    <p className="text-xs text-muted-foreground mt-1">{t.noOpponentDesc}</p>
                  </div>
                </>
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
          {menuItems.map((item) => (
            <Link 
              key={item.label} 
              href={item.href} 
              className='block'
            >
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
