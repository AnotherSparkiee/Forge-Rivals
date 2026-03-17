'use client';

import { useState, useMemo } from 'react';
import { useGameState } from '../lib/store';
import { 
  ChevronLeft, CalendarDays, UserSearch, CalendarClock, 
  History, Calendar, CheckSquare, ChevronRight, Shield,
  Loader2, Clock
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { useUser, useFirestore, useDoc, useCollection, useMemoFirebase } from '@/firebase';
import { doc, collection, query, where } from 'firebase/firestore';
import { getMockGroupTeams, getSchedule, LEAGUES, getMatchResult } from '../lib/leagues-data';
import { getMoscowDateString } from '../lib/time-utils';

type MatchTab = 
  | 'menu'
  | 'next_opponent' 
  | 'my_future' 
  | 'my_played' 
  | 'league_calendar' 
  | 'league_played';

export default function MatchesPage() {
  const { 
    isLoaded, language, leagueLevel, divisionSubId, groupId, seasonDay, rank, 
    wins, draws, losses, points, lastLeagueMatchDate, matchHistory, seasonStartDate
  } = useGameState();
  const { user, isUserLoading } = useUser();
  const db = useFirestore();
  const [activeTab, setActiveTab] = useState<MatchTab>('menu');

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

  const league = useMemo(() => {
    return LEAGUES.find(l => l.id === profile?.selectedLeagueId) || LEAGUES[0];
  }, [profile?.selectedLeagueId]);

  const isTodayPlayed = useMemo(() => {
    const todayStr = getMoscowDateString();
    return lastLeagueMatchDate === todayStr;
  }, [lastLeagueMatchDate]);

  const groupTeams = useMemo(() => {
    if (!isLoaded || !profile || !groupPlayers) return [];
    const calculationDay = seasonDay === 0 ? 1 : (isTodayPlayed ? seasonDay + 1 : seasonDay);
    return getMockGroupTeams(
      rank, 
      profile.displayName || "My Team", 
      leagueLevel, 
      divisionSubId, 
      groupId, 
      true, 
      calculationDay,
      { wins, draws, losses, points },
      profile.selectedLeagueId || "ALPHA",
      groupPlayers,
      user?.uid
    );
  }, [isLoaded, profile, groupPlayers, leagueLevel, divisionSubId, groupId, seasonDay, rank, wins, draws, losses, points, isTodayPlayed, user?.uid]);

  const schedule = useMemo(() => {
    if (groupTeams.length === 0) return [];
    return getSchedule(groupTeams);
  }, [groupTeams]);

  const getDateForDay = (day: number) => {
    if (!seasonStartDate) return "";
    const date = new Date(seasonStartDate);
    date.setDate(date.getDate() + (day - 1));
    return date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
  };

  const labels = {
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
      atTime: "at",
      today: "TODAY",
      tomorrow: "TOMORROW",
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
      atTime: "в",
      today: "СЕГОДНЯ",
      tomorrow: "ЗАВТРА",
      tabs: {
        next_opponent: { label: "Следующий соперник", desc: "Досье на ближайшего врага", icon: UserSearch },
        my_future: { label: "Свои будущие", desc: "Предстоящие игры команды", icon: CalendarClock },
        my_played: { label: "Свои сыгранные", desc: "История ваших сражений", icon: History },
        league_calendar: { label: "Календарь лиги", desc: "Полное расписание сезона", icon: Calendar },
        league_played: { label: "Сыгранные в лиге", desc: "Все результаты группы", icon: CheckSquare }
      }
    }
  };

  const t = labels[language as keyof typeof labels] || labels.ru;

  if (!isLoaded || isUserLoading || isProfileLoading || isGroupLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (seasonDay === 0 && activeTab !== 'menu') {
    return (
      <div className="max-w-md mx-auto px-4 pt-8 pb-20 text-center">
        <Button variant="ghost" onClick={() => setActiveTab('menu')} className="mb-4"><ChevronLeft className="mr-2 h-4 w-4" /> Back</Button>
        <div className="py-20 space-y-4">
          <Clock className="w-12 h-12 mx-auto text-muted-foreground animate-pulse" />
          <h2 className="text-xl font-headline font-bold">Season Starts Tomorrow</h2>
          <p className="text-sm text-muted-foreground">The tactical link is establishing. First matches will be deployed on Day 1.</p>
        </div>
      </div>
    );
  }

  const renderMatchRow = (match: any, dayIdx: number) => {
    const day = dayIdx + 1;
    const isPlayed = seasonDay > 0 && (day < seasonDay || (day === seasonDay && isTodayPlayed));
    const startHour = league.startTime;
    const matchDate = getDateForDay(day);

    let hScore = 0;
    let aScore = 0;

    if (isPlayed) {
      if (day === seasonDay && isTodayPlayed && (match.home.isMe || match.away.isMe)) {
        const lastResult = matchHistory[0];
        if (lastResult) {
            hScore = match.home.isMe ? lastResult.scoreA : lastResult.scoreB;
            aScore = match.away.isMe ? lastResult.scoreA : lastResult.scoreB;
        } else {
            [hScore, aScore] = getMatchResult(match.home.id, match.away.id, day);
        }
      } else {
        [hScore, aScore] = getMatchResult(match.home.id, match.away.id, day);
      }
    }

    return (
      <div key={`${day}-${match.home.id}-${match.away.id}`} className="bg-secondary/20 p-3 rounded-xl border border-white/5 flex items-center justify-between gap-3">
        <div className="flex flex-col items-center w-12 flex-shrink-0 border-r border-white/5 pr-2">
          <span className="text-[10px] font-mono font-bold text-accent">{matchDate}</span>
          <span className="text-[8px] uppercase font-bold text-muted-foreground">{t.day} {day}</span>
        </div>
        <div className="flex-1 flex items-center justify-between gap-1 min-w-0">
          <div className={cn("flex-1 text-right text-[10px] font-bold uppercase truncate", match.home.isMe && "text-primary")}>
            {match.home.name}
          </div>
          <div className="flex flex-col items-center px-2 min-w-[70px]">
            {isPlayed ? (
              <div className="flex items-center gap-1.5">
                <span className="text-base font-headline font-bold">{hScore}</span>
                <span className="text-muted-foreground text-[10px]">:</span>
                <span className="text-base font-headline font-bold">{aScore}</span>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-0.5">
                <Badge variant="outline" className="text-[7px] px-1 py-0 uppercase border-accent/20 text-accent leading-none">{t.vs}</Badge>
                <div className="flex items-center gap-0.5 text-[8px] text-primary font-mono font-bold leading-none mt-1 bg-primary/5 px-1 rounded">
                  {startHour}
                </div>
              </div>
            )}
          </div>
          <div className={cn("flex-1 text-left text-[10px] font-bold uppercase truncate", match.away.isMe && "text-primary")}>
            {match.away.name}
          </div>
        </div>
      </div>
    );
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'next_opponent': {
        const targetDay = isTodayPlayed ? seasonDay + 1 : (seasonDay === 0 ? 1 : seasonDay);
        if (targetDay > 14) return <p className="text-center py-10 text-muted-foreground uppercase text-xs">Season Finished</p>;
        
        const targetMatches = schedule[targetDay - 1];
        const myMatch = targetMatches?.find((m: any) => m.home.id === user?.uid || m.away.id === user?.uid);
        
        if (!myMatch) return <p className="text-center py-10 text-muted-foreground">{t.noData}</p>;
        
        const opponent = myMatch.home.id === user?.uid ? myMatch.away : myMatch.home;
        const startHour = league.startTime;
        const matchDate = getDateForDay(targetDay);
        const isTargetToday = targetDay === seasonDay;
        
        return (
          <div className="space-y-6 animate-in fade-in duration-500">
            <Card className="glass-card border-primary/20 bg-primary/5">
              <CardHeader className="text-center pb-2">
                <CardTitle className="text-lg font-headline font-bold uppercase tracking-tighter text-accent">Intelligence Report</CardTitle>
                <Badge variant="outline" className="mx-auto text-[10px] uppercase border-primary/50 text-primary flex items-center gap-1.5 py-1">
                  <Clock className="w-3 h-3" /> {isTargetToday ? t.today : t.tomorrow} {t.atTime} {startHour}
                </Badge>
              </CardHeader>
              <CardContent className="flex flex-col items-center space-y-4">
                <div className="w-20 h-20 rounded-full bg-secondary/50 flex items-center justify-center border-2 border-accent shadow-[0_0_15px_rgba(var(--accent),0.2)]">
                  {opponent.isPlayer ? <CalendarClock className="w-10 h-10 text-accent" /> : <Shield className="w-10 h-10 text-accent" />}
                </div>
                <div className="text-center">
                  <h3 className="text-xl font-headline font-bold text-primary italic uppercase truncate max-w-[250px]">{opponent.name}</h3>
                  <Badge variant="secondary" className="mt-2 text-[10px]">
                    {opponent.isPlayer ? 'REAL MANAGER' : 'ELITE BOT'} | DIV {leagueLevel}.{divisionSubId}
                  </Badge>
                </div>
                
                <div className="w-full bg-accent/10 p-4 rounded-xl border border-accent/20 text-center shadow-[0_0_20px_rgba(var(--accent),0.1)]">
                  <p className="text-[10px] uppercase text-accent font-bold mb-1 flex items-center justify-center gap-1">
                    <Calendar className="w-3 h-3" /> {t.matchTime}
                  </p>
                  <p className="text-xl font-headline font-bold tracking-tight">{matchDate} @ {startHour}</p>
                  <p className="text-[9px] text-muted-foreground uppercase mt-1 italic font-bold">
                    {language === 'ru' ? `Синхронизация по МСК: ${startHour}` : `MSK Sync: ${startHour}`}
                  </p>
                </div>

                <div className="w-full grid grid-cols-2 gap-3 pt-4 border-t border-white/5">
                   <div className="text-center">
                     <p className="text-[10px] uppercase text-muted-foreground font-bold">W-D-L</p>
                     <p className="text-sm font-bold">{opponent.wins}-{opponent.draws}-{opponent.losses}</p>
                   </div>
                   <div className="text-center">
                     <p className="text-[10px] uppercase text-muted-foreground font-bold">Points</p>
                     <p className="text-sm font-bold text-accent">{opponent.points}</p>
                   </div>
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
            {futureMatches.map(item => renderMatchRow(item.match, item.dayIdx))}
          </div>
        );
      }

      case 'my_played': {
        const endIdx = isTodayPlayed ? seasonDay : (seasonDay === 0 ? 0 : seasonDay - 1);
        if (endIdx === 0) return <p className="text-center py-10 text-muted-foreground">No matches played yet.</p>;
        const playedMatches = schedule.slice(0, endIdx).map((dayMatches: any, i) => {
          const m = dayMatches.find((match: any) => match.home.id === user?.uid || match.away.id === user?.uid);
          return { match: m, dayIdx: i };
        }).filter(item => !!item.match).reverse();

        return (
          <div className="space-y-3 animate-in slide-in-from-bottom-4 duration-500">
            {playedMatches.map(item => renderMatchRow(item.match, item.dayIdx))}
          </div>
        );
      }

      case 'league_calendar': {
        return (
          <div className="space-y-8 animate-in fade-in duration-500">
            {schedule.map((dayMatches: any, dIdx: number) => (
              <div key={dIdx} className="space-y-3">
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
                <div key={actualDayIdx} className="space-y-3">
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
