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
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import { getMockGroupTeams, getSchedule, LEAGUES } from '../lib/leagues-data';

type MatchTab = 
  | 'menu'
  | 'next_opponent' 
  | 'my_future' 
  | 'my_played' 
  | 'league_calendar' 
  | 'league_played';

export default function MatchesPage() {
  const { isLoaded, language, leagueLevel, divisionSubId, groupId, seasonDay } = useGameState();
  const { user, isUserLoading } = useUser();
  const db = useFirestore();
  const [activeTab, setActiveTab] = useState<MatchTab>('menu');

  const userRef = useMemoFirebase(() => user ? doc(db, 'users', user.uid) : null, [db, user]);
  const { data: profile, isLoading: isProfileLoading } = useDoc(userRef);

  // Find user league info
  const userLeague = useMemo(() => {
    if (!profile?.selectedLeagueId) return null;
    return LEAGUES.find(l => l.id === profile.selectedLeagueId);
  }, [profile?.selectedLeagueId]);

  // Generate group data
  const groupTeams = useMemo(() => {
    if (!isLoaded) return [];
    return getMockGroupTeams(0, profile?.displayName || "My Team", leagueLevel, divisionSubId, groupId, true, seasonDay);
  }, [isLoaded, profile?.displayName, leagueLevel, divisionSubId, groupId, seasonDay]);

  const schedule = useMemo(() => {
    if (groupTeams.length === 0) return [];
    return getSchedule(groupTeams);
  }, [groupTeams]);

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
      noData: "No records found for this sector.",
      tabs: {
        next_opponent: { label: "Next Opponent", desc: "Detailed brief on your next rival", icon: UserSearch },
        my_future: { label: "My Future", desc: "Upcoming matches for your team", icon: CalendarClock },
        my_played: { label: "My Played", desc: "History of your previous encounters", icon: History },
        league_calendar: { label: "League Calendar", desc: "Full season schedule of the group", icon: Calendar },
        league_played: { label: "Played in League", desc: "All results from your current league", icon: CheckSquare }
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
      noData: "Записей в данном секторе не обнаружено.",
      tabs: {
        next_opponent: { label: "Следующий соперник", desc: "Досье на вашего ближайшего врага", icon: UserSearch },
        my_future: { label: "Свои будущие", desc: "Предстоящие игры вашей команды", icon: CalendarClock },
        my_played: { label: "Свои сыгранные", desc: "История ваших прошлых сражений", icon: History },
        league_calendar: { label: "Календарь лиги", desc: "Полное расписание сезона в группе", icon: Calendar },
        league_played: { label: "Сыгранные в лиге", desc: "Все результаты вашей текущей лиги", icon: CheckSquare }
      }
    }
  };

  const t = labels[language as keyof typeof labels] || labels.ru;

  if (!isLoaded || isUserLoading || isProfileLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const renderMatchRow = (match: any, dayIdx: number) => {
    const day = dayIdx + 1;
    const [hScore, aScore] = getMatchResult(match.home.id, match.away.id, day);
    const isPlayed = day < seasonDay;

    return (
      <div key={`${day}-${match.home.id}`} className="bg-secondary/20 p-3 rounded-xl border border-white/5 flex items-center justify-between gap-4">
        <div className="flex flex-col items-center w-12 flex-shrink-0">
          <span className="text-[8px] uppercase font-bold text-muted-foreground">{t.day}</span>
          <span className="text-sm font-headline font-bold">{day}</span>
          {!isPlayed && userLeague && (
            <span className="text-[7px] text-accent font-bold mt-1">{userLeague.startTime.split(' ')[0]}</span>
          )}
        </div>
        <div className="flex-1 flex items-center justify-between gap-2">
          <div className={cn("flex-1 text-right text-xs font-bold uppercase truncate", match.home.isPlayer && "text-primary")}>
            {match.home.name}
          </div>
          <div className="flex flex-col items-center px-2 min-w-[60px]">
            {isPlayed ? (
              <div className="flex items-center gap-2">
                <span className="text-lg font-headline font-bold">{hScore}</span>
                <span className="text-muted-foreground text-[10px]">:</span>
                <span className="text-lg font-headline font-bold">{aScore}</span>
              </div>
            ) : (
              <Badge variant="outline" className="text-[8px] uppercase border-accent/20 text-accent">{t.vs}</Badge>
            )}
          </div>
          <div className={cn("flex-1 text-left text-xs font-bold uppercase truncate", match.away.isPlayer && "text-primary")}>
            {match.away.name}
          </div>
        </div>
      </div>
    );
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'next_opponent': {
        const todayMatches = schedule[seasonDay - 1];
        const myMatch = todayMatches?.find((m: any) => m.home.isPlayer || m.away.isPlayer);
        if (!myMatch) return <p className="text-center text-muted-foreground py-10 uppercase text-xs">{t.noData}</p>;
        const opponent = myMatch.home.isPlayer ? myMatch.away : myMatch.home;
        
        return (
          <div className="space-y-6 animate-in fade-in duration-500">
            <Card className="glass-card border-primary/20 bg-primary/5">
              <CardHeader className="text-center pb-2">
                <CardTitle className="text-lg font-headline font-bold uppercase tracking-tighter text-accent">Strategic Intelligence</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col items-center space-y-4">
                <div className="w-20 h-20 rounded-full bg-secondary/50 flex items-center justify-center border-2 border-accent shadow-[0_0_15px_rgba(var(--accent),0.2)]">
                  <Shield className="w-10 h-10 text-accent" />
                </div>
                <div className="text-center">
                  <h3 className="text-2xl font-headline font-bold text-primary italic uppercase">{opponent.name}</h3>
                  <Badge variant="secondary" className="mt-2">LEVEL {leagueLevel} | GROUP {groupId}</Badge>
                </div>
                
                {userLeague && (
                  <div className="w-full bg-accent/10 p-3 rounded-lg border border-accent/20 text-center">
                    <p className="text-[10px] uppercase text-accent font-bold mb-1 flex items-center justify-center gap-1">
                      <Clock className="w-3 h-3" /> {t.matchTime}
                    </p>
                    <p className="text-sm font-headline font-bold">{userLeague.startTime}</p>
                  </div>
                )}

                <div className="w-full grid grid-cols-2 gap-3 pt-4 border-t border-white/5">
                   <div className="text-center">
                     <p className="text-[10px] uppercase text-muted-foreground font-bold">Wins-Draws-Losses</p>
                     <p className="text-sm font-bold">{opponent.wins}-{opponent.draws}-{opponent.losses}</p>
                   </div>
                   <div className="text-center">
                     <p className="text-[10px] uppercase text-muted-foreground font-bold">Total Points</p>
                     <p className="text-sm font-bold text-accent">{opponent.points}</p>
                   </div>
                </div>
              </CardContent>
            </Card>
            <div className="flex items-center gap-3 p-4 bg-secondary/30 rounded-xl border border-white/5 italic text-xs text-muted-foreground leading-relaxed">
              <Shield className="w-5 h-5 text-primary flex-shrink-0" />
              "Opponent tends to focus on late-game carry transitions. Strategic recommendation: High pressure in early lanes."
            </div>
          </div>
        );
      }

      case 'my_future': {
        const futureMatches = schedule.slice(seasonDay - 1).map((dayMatches: any, i) => {
          const m = dayMatches.find((match: any) => match.home.isPlayer || match.away.isPlayer);
          return { match: m, dayIdx: seasonDay - 1 + i };
        }).filter(item => !!item.match);

        return (
          <div className="space-y-3 animate-in slide-in-from-bottom-4 duration-500">
            {futureMatches.map(item => renderMatchRow(item.match, item.dayIdx))}
          </div>
        );
      }

      case 'my_played': {
        const playedMatches = schedule.slice(0, seasonDay - 1).map((dayMatches: any, i) => {
          const m = dayMatches.find((match: any) => match.home.isPlayer || match.away.isPlayer);
          return { match: m, dayIdx: i };
        }).filter(item => !!item.match).reverse();

        if (playedMatches.length === 0) return <p className="text-center text-muted-foreground py-10 uppercase text-xs">{t.noData}</p>;
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
                  <div className="h-px flex-1 bg-gradient-to-r from-transparent to-white/10"></div>
                  <span className="text-[10px] uppercase font-bold tracking-widest text-accent">DAY {dIdx + 1}</span>
                  {userLeague && <span className="text-[9px] text-muted-foreground font-mono">{userLeague.startTime.split(' ')[0]}</span>}
                  <div className="h-px flex-1 bg-gradient-to-l from-transparent to-white/10"></div>
                </div>
                <div className="space-y-2">
                  {dayMatches.map((m: any, mIdx: number) => renderMatchRow(m, dIdx))}
                </div>
              </div>
            ))}
          </div>
        );
      }

      case 'league_played': {
        const allPlayed = schedule.slice(0, seasonDay - 1).reverse();
        if (allPlayed.length === 0) return <p className="text-center text-muted-foreground py-10 uppercase text-xs">{t.noData}</p>;
        
        return (
          <div className="space-y-8 animate-in fade-in duration-500">
            {allPlayed.map((dayMatches: any, dIdx: number) => {
              const actualDayIdx = seasonDay - 2 - dIdx;
              return (
                <div key={actualDayIdx} className="space-y-3">
                  <div className="flex items-center gap-2 px-1">
                    <span className="text-[10px] uppercase font-bold tracking-widest text-accent">DAY {actualDayIdx + 1}</span>
                    <div className="h-px flex-1 bg-white/5"></div>
                  </div>
                  <div className="space-y-2">
                    {dayMatches.map((m: any, mIdx: number) => renderMatchRow(m, actualDayIdx))}
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

  const getMatchResult = (homeId: string, awayId: string, day: number): [number, number] => {
    const hId = parseInt(homeId.replace('bot_', '').replace('player_team', '99999'));
    const aId = parseInt(awayId.replace('bot_', '').replace('player_team', '99999'));
    const seed = hId + aId + day;
    const val = seed % 10;
    if (val < 4) return [2, 0];
    if (val < 7) return [1, 1];
    return [0, 2];
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
              {t.subtitle} | Div {leagueLevel}.{divisionSubId}
            </p>
          </div>
        </header>

        <div className="space-y-4">
          <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-accent px-1">{t.menuTitle}</h2>
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

      <div className="mb-6">
        <Card className="bg-secondary/20 border-white/5">
          <CardContent className="p-3 flex justify-between items-center">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-[10px] uppercase border-primary/20 text-primary">Season Day {seasonDay}</Badge>
              {userLeague && (
                <Badge variant="outline" className="text-[10px] uppercase border-accent/20 text-accent flex items-center gap-1">
                  <Clock className="w-3 h-3" /> {userLeague.startTime.split(' ')[0]}
                </Badge>
              )}
            </div>
            <span className="text-[8px] uppercase font-bold text-muted-foreground">Div {leagueLevel}.{divisionSubId}</span>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-6">
        {renderContent()}
      </div>
      
      <Button 
        variant="outline" 
        className="w-full mt-10 border-white/10 text-[10px] uppercase tracking-widest font-bold"
        onClick={() => setActiveTab('menu')}
      >
        {t.backToMenu}
      </Button>
    </div>
  );
}
