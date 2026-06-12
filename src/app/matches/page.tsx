
'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useGameState } from '../lib/store';
import { 
  ChevronLeft, CalendarDays, UserSearch, CalendarClock, 
  History, Calendar, CheckSquare, ChevronRight, Shield,
  Clock, Swords, Trophy, EyeOff, FileText, User
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
import { getGlobalCupParticipants, getWinnerOfBranch, getEntryRound } from '../lib/cup-utils';

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
    isLoaded, language, leagueLevel, groupId, seasonDay, rank, 
    lastLeagueMatchDate, lastCupMatchDate, seasonNumber, matchHistory, 
    groupMatches, displayName
  } = useGameState();
  const db = useFirestore();
  
  const [activeTab, setActiveTab] = useState<MatchTab>('menu');
  const [countdown, setCountdown] = useState('');
  const winnersCache = useRef<Map<string, any>>(new Map());

  const userRef = useMemoFirebase(() => user ? doc(db, 'players_v10', user.uid) : null, [db, user]);
  const { data: profile, isLoading: isProfileLoading } = useDoc(userRef);

  useEffect(() => {
    if (!isUserLoading && !user) {
      router.push('/auth/register');
    }
  }, [user, isUserLoading, router]);

  const league = useMemo(() => LEAGUES.find(l => l.id === profile?.selectedLeagueId) || LEAGUES[0], [profile?.selectedLeagueId]);
  const isTodayPlayed = useMemo(() => lastLeagueMatchDate === getMoscowDateString(), [lastLeagueMatchDate]);
  const isCupPlayedToday = useMemo(() => lastCupMatchDate === getMoscowDateString(), [lastCupMatchDate]);

  const cupNextMatch = useMemo(() => {
    // Cup Logic (Remains deterministic but prioritized)
    if (!isLoaded || !profile || seasonDay > 14) return null;
    const wasEliminated = matchHistory.some(m => (m.type === 'cup' || m.type === 'tournament') && m.seasonNumber === seasonNumber && m.opponentName !== 'SEEDED' && m.opponentName !== 'WAITING' && m.scoreA < m.scoreB);
    if (wasEliminated) return null;
    const targetDay = isCupPlayedToday ? seasonDay + 1 : (seasonDay === 0 ? 1 : seasonDay);
    if (targetDay > 14) return null;
    return { opponent: { name: "WAITING", isPlayer: false }, time: "07:00", isNextDay: isCupPlayedToday, type: 'cup', isCup: true, label: language === 'ru' ? 'КУБОК ПИРАМИДЫ' : 'PYRAMID CUP' };
  }, [isLoaded, profile, seasonDay, matchHistory, seasonNumber, isCupPlayedToday, language]);

  const leagueNextMatch = useMemo(() => {
    if (!isLoaded || !groupMatches || seasonDay > 14 || seasonDay === 0) return null;
    const targetDay = isTodayPlayed ? seasonDay + 1 : seasonDay;
    if (targetDay > 14) return null;

    const myMatch = groupMatches.find((m: any) => m.day === targetDay && (m.homeId === user?.uid || m.awayId === user?.uid));
    if (!myMatch) return null;

    const isHome = myMatch.homeId === user?.uid;
    const oppName = isHome ? myMatch.awayName : myMatch.homeName;

    return { 
      opponent: { name: oppName, isPlayer: !oppName.includes('Bot') }, 
      day: targetDay, 
      time: league.startTime, 
      isNextDay: targetDay > seasonDay, 
      type: 'league', 
      isCup: false 
    };
  }, [isLoaded, groupMatches, seasonDay, isTodayPlayed, league, user?.uid]);

  const nextMatchInfo = useMemo(() => {
    if (cupNextMatch && leagueNextMatch) {
      const mskNow = getMoscowTime();
      const getMs = (time: string, nextDay: boolean) => {
        const [h, m] = time.split(':').map(Number);
        const d = new Date(mskNow); d.setHours(h, m, 0, 0);
        if (nextDay) d.setDate(d.getDate() + 1);
        return d.getTime();
      };
      return getMs(cupNextMatch.time, cupNextMatch.isNextDay) < getMs(leagueNextMatch.time, leagueNextMatch.isNextDay) ? cupNextMatch : leagueNextMatch;
    }
    return leagueNextMatch || cupNextMatch;
  }, [cupNextMatch, leagueNextMatch]);

  useEffect(() => {
    const interval = setInterval(() => {
      const mskNow = getMoscowTime();
      const info = nextMatchInfo as any;
      if (!info || !info.time) return;
      
      const [h, m] = info.time.split(':').map(Number);
      const targetDate = new Date(mskNow); targetDate.setHours(h, m, 0, 0);
      if (info.isNextDay) targetDate.setDate(targetDate.getDate() + 1);
      const diff = targetDate.getTime() - mskNow.getTime();
      if (diff <= 0) setCountdown('00:00:00');
      else setCountdown(`${String(Math.floor(diff/3600000)).padStart(2,'0')}:${String(Math.floor((diff%3600000)/60000)).padStart(2,'0')}:${String(Math.floor((diff%60000)/1000)).padStart(2,'0')}`);
    }, 1000);
    return () => clearInterval(interval);
  }, [nextMatchInfo]);

  if (isUserLoading || !isLoaded || !user || isProfileLoading) return <LoadingScreen />;

  const t = {
    title: language === 'ru' ? "СПИСОК МАТЧЕЙ" : "OPERATIONAL MATCHES",
    subtitle: language === 'ru' ? "Расписание и История" : "Tactical Schedule & History",
    day: language === 'ru' ? "День" : "Day",
    startsIn: language === 'ru' ? "ДО МАТЧА ОСТАЛОСЬ:" : "TIME UNTIL MATCH:",
    tabs: {
      next_opponent: { label: language === 'ru' ? "Следующий соперник" : "Next Opponent", desc: language === 'ru' ? "Досье на ближайшего врага" : "Detailed brief on your next rival", icon: UserSearch },
      my_future: { label: language === 'ru' ? "Свои будущие" : "My Future", desc: language === 'ru' ? "Предстоящие игры команды" : "Upcoming matches for your team", icon: CalendarClock },
      my_played: { label: language === 'ru' ? "Свои сыгранные" : "My Played", desc: language === 'ru' ? "История ваших сражений" : "History of your previous encounters", icon: History },
      league_calendar: { label: language === 'ru' ? "Календарь лиги" : "League Calendar", desc: language === 'ru' ? "Полное расписание сезона" : "Full season schedule", icon: Calendar },
      league_played: { label: language === 'ru' ? "Сыгранные в лиге" : "Played in League", desc: language === 'ru' ? "Все результаты группы" : "All group results", icon: CheckSquare }
    }
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'next_opponent':
        if (!nextMatchInfo) return <p className="text-center py-10 text-muted-foreground uppercase text-xs">Season Finished</p>;
        const info = nextMatchInfo as any;
        return (
          <div className="space-y-6 animate-in fade-in duration-500">
            <Card className={cn("glass-card border-primary/20 bg-primary/5", (info.type === 'cup') && "border-accent/30 bg-accent/5")}>
              <CardHeader className="text-center">
                <CardTitle className="text-lg font-headline font-bold uppercase tracking-tighter text-accent">{info.label || "Intelligence Report"}</CardTitle>
                <div className="flex flex-col items-center mt-4">
                  <div className="bg-background/50 px-6 py-2 rounded-xl border border-white/5">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase mb-1">{t.startsIn}</p>
                    <p className="text-3xl font-headline font-bold tabular-nums tracking-tighter text-primary">{countdown || '00:00:00'}</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="flex flex-col items-center space-y-4">
                <div className="w-20 h-20 rounded-full bg-secondary/50 flex items-center justify-center border-2 border-primary shadow-[0_0_15px_rgba(var(--primary),0.2)]">
                  <User className="w-10 h-10 text-primary" />
                </div>
                <h3 className="text-xl font-headline font-bold italic uppercase truncate w-full px-4 text-center">{(info.opponent as any).name}</h3>
                <Badge variant="secondary" className="mt-2 text-[10px]">{(info.opponent as any).isPlayer ? 'REAL MANAGER' : 'ELITE BOT'} | {info.label || `DIV ${leagueLevel}.${groupId}`}</Badge>
              </CardContent>
            </Card>
          </div>
        );
      case 'my_future':
        const startIdx = isTodayPlayed ? seasonDay + 1 : seasonDay;
        const future = groupMatches.filter(m => m.day >= startIdx && (m.homeId === user?.uid || m.awayId === user?.uid)).sort((a,b) => a.day - b.day);
        return <div className="space-y-3">
          {future.map(m => (
            <div key={m.id} className="bg-secondary/20 p-3 rounded-xl border border-white/5 flex items-center justify-between gap-3">
              <div className="flex flex-col items-center w-12 border-r border-white/5 pr-2"><span className="text-[10px] font-mono font-bold text-accent">{m.day}</span></div>
              <div className="flex-1 flex items-center justify-between min-w-0">
                 <span className={cn("flex-1 text-right text-[10px] font-bold uppercase truncate", m.homeId === user.uid && "text-primary")}>{m.homeName}</span>
                 <div className="px-3 flex flex-col items-center"><Badge variant="outline" className="text-[7px] px-1 py-0 border-accent/20 text-accent">VS</Badge><span className="text-[8px] text-primary font-mono font-bold">{league.startTime}</span></div>
                 <span className={cn("flex-1 text-left text-[10px] font-bold uppercase truncate", m.awayId === user.uid && "text-primary")}>{m.awayName}</span>
              </div>
            </div>
          ))}
        </div>;
      case 'league_calendar':
        const days = Array.from({ length: 14 }, (_, i) => i + 1);
        return (
          <div className="space-y-4 animate-in fade-in duration-500">
            {days.map(d => (
              <div key={d} className="space-y-2">
                <h3 className="text-[10px] font-black uppercase text-accent tracking-widest px-1">{t.day} {d}</h3>
                <div className="grid gap-2">
                  {groupMatches.filter(m => m.day === d).map((m: any) => (
                    <div key={m.id} className="bg-secondary/20 p-3 rounded-xl border border-white/5 flex items-center justify-between text-[10px] font-bold uppercase">
                      <span className={cn("flex-1 text-right truncate", m.homeId === user.uid && "text-primary")}>{m.homeName}</span>
                      <span className="px-4 opacity-30 italic">VS</span>
                      <span className={cn("flex-1 text-left truncate", m.awayId === user.uid && "text-primary")}>{m.awayName}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        );
      default: return <p className="text-center opacity-30 uppercase text-xs py-10">Data syncing...</p>;
    }
  };

  return (
    <div className="max-w-md mx-auto px-4 pt-8 pb-24">
      <header className="mb-6 flex items-center gap-4">
        <Button variant="ghost" size="icon" className="rounded-full" onClick={() => activeTab === 'menu' ? router.push('/') : setActiveTab('menu')}>
          <ChevronLeft className="w-6 h-6" />
        </Button>
        <div>
          <h1 className="text-2xl font-headline font-bold uppercase tracking-tighter">
            {activeTab === 'menu' ? t.title : (t.tabs as any)[activeTab].label}
          </h1>
          <p className="text-muted-foreground text-[10px] uppercase tracking-widest">{t.subtitle}</p>
        </div>
      </header>

      {activeTab === 'menu' ? (
        <div className="space-y-2">
          {(Object.entries(t.tabs) as [MatchTab, any][]).map(([id, data]) => (
            <Card key={id} className="glass-card hover:bg-white/5 cursor-pointer transition-all border-white/5" onClick={() => setActiveTab(id)}>
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={cn("p-2.5 rounded-xl bg-secondary/50")}>
                    <data.icon className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold uppercase group-hover:text-white transition-colors">{data.label}</h3>
                    <p className="text-[10px] text-muted-foreground leading-tight">{data.desc}</p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : renderContent()}
    </div>
  );
}
