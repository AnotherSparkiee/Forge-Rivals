'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useGameState } from '../lib/store';
import { 
  Trophy, Medal, Star, ChevronLeft, ArrowUpCircle, 
  Users, Target, Shield, Zap, Swords, ChevronRight,
  LayoutDashboard, TrendingUp, Award, Loader2, Clock,
  ArrowLeft, Calendar
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import Link from 'next/link';
import { getMockGroupTeams, SEASON_DURATION_DAYS, LEAGUES } from '../lib/leagues-data';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useUser, useFirestore, useDoc, useCollection, useMemoFirebase } from '@/firebase';
import { doc, collection, query, where } from 'firebase/firestore';
import { getMoscowTime, formatMoscowTime, getMoscowDateString } from '../lib/time-utils';
import { LoadingScreen } from '@/components/game/LoadingScreen';

type RankingTab = 
  | 'menu'
  | 'my_league' 
  | 'champions_cup' 
  | 'masters_cup' 
  | 'my_pyramid' 
  | 'pyramid_cup' 
  | 'friendly' 
  | 'pyramids_list' 
  | 'pyramids_rating' 
  | 'kda_leaders';

export default function RankingsPage() {
  const { user, isUserLoading } = useUser();
  const router = useRouter();
  const { 
    rank, leagueLevel, divisionSubId, groupId, isLoaded, language, 
    lastLeagueMatchDate, seasonDay, seasonStartDate,
    wins, draws, losses, points
  } = useGameState();
  const db = useFirestore();
  const { toast } = useToast();
  
  const [activeTab, setActiveTab] = useState<RankingTab>('menu');
  const [serverTime, setServerTime] = useState<string>('');

  useEffect(() => {
    if (!isUserLoading && !user) {
      router.push('/auth/login');
    }
  }, [user, isUserLoading, router]);

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

  const myLeagueRankings = useMemo(() => {
    if (!isLoaded || !profile || !groupPlayers) return [];
    // If Day 0, show initial bot standings
    const calculationDay = seasonDay === 0 ? 1 : (isTodayPlayed ? seasonDay + 1 : seasonDay);
    const teams = getMockGroupTeams(
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
    // Sort for display by points and wins
    return [...teams].sort((a, b) => b.points - a.points || (b.wins - a.wins));
  }, [isLoaded, profile, groupPlayers, leagueLevel, divisionSubId, groupId, seasonDay, wins, draws, losses, points, isTodayPlayed, rank, user?.uid]);

  useEffect(() => {
    const timer = setInterval(() => {
      setServerTime(formatMoscowTime(getMoscowTime()));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  if (isUserLoading || !isLoaded || !user) {
    return <LoadingScreen />;
  }

  const labels = {
    en: {
      title: "TOURNAMENT TABLES",
      subtitle: "Pyramid Hierarchy",
      menuTitle: "Tournament Terminals",
      promote: "Promote",
      serverClock: "Server Clock (MSK)",
      matchStatus: "League Status",
      waiting: "Waiting for " + league.startTime,
      completed: "Match completed",
      upcoming: "Season starts tomorrow",
      div_label: "Division",
      level_label: "Level",
      season_label: "Season Day",
      bo2_format: `Bo2 Format (${league.startTime} daily)`,
      startsToday: `Starts TODAY ${league.startTime}`,
      tiers: ["Elite Tier", "Professional Tier", "Challenger Tier"],
      tabs: {
        my_league: { label: "My League", desc: "Current group rankings", icon: Trophy },
        champions_cup: { label: "Champions Cup", desc: "Top tier elite", icon: Award },
        masters_cup: { label: "Masters Cup", desc: "Pro division cup", icon: Star },
        my_pyramid: { label: "My Pyramid", desc: "Global hierarchy", icon: LayoutDashboard },
        pyramid_cup: { label: "Pyramid Cup", desc: "Inter-division KO", icon: Swords },
        friendly: { label: "Friendly", desc: "Training matches", icon: Users }
      }
    },
    ru: {
      title: "ТУРНИРНЫЕ ТАБЛИЦЫ",
      subtitle: "Иерархия Пирамиды",
      menuTitle: "Турнирные Терминалы",
      promote: "Повышить",
      serverClock: "Часы Сервера (МСК)",
      matchStatus: "Статус лиги",
      waiting: "Ожидание " + league.startTime,
      completed: "Матч завершен",
      upcoming: "Сезон начнется завтра",
      div_label: "Дивизион",
      level_label: "Уровень",
      season_label: "День сезона",
      bo2_format: `Формат Bo2 (Ежедневно ${league.startTime})`,
      startsToday: `Старт СЕГОДНЯ в ${league.startTime}`,
      tiers: ["Элитный уровень", "Профессиональный уровень", "Претендентский уровень"],
      tabs: {
        my_league: { label: "Своя лига", desc: "Рейтинг вашей группы", icon: Trophy },
        champions_cup: { label: "Кубок чемпионов", desc: "Элитный турнир", icon: Award },
        masters_cup: { label: "Кубок Мастеров", desc: "Профессиональный кубок", icon: Star },
        my_pyramid: { label: "Своя пирамида", desc: "Обзор иерархии", icon: LayoutDashboard },
        pyramid_cup: { label: "Кубок пирамиды", desc: "Плей-офф лиги", icon: Swords },
        friendly: { label: "Товарищеский", desc: "Тренировочные игры", icon: Users }
      }
    }
  };

  const t = labels[language as keyof typeof labels] || labels.ru;

  const renderRankingTable = (rankingsData: any[]) => (
    <div className="space-y-2 animate-in fade-in duration-300">
      <div className="flex items-center px-4 text-[10px] uppercase font-bold text-muted-foreground mb-1">
        <div className="w-8">#</div>
        <div className="flex-1">Team</div>
        <div className="w-16 text-center">W-D-L</div>
        <div className="w-12 text-right">Pts</div>
      </div>
      {rankingsData.map((entry, i) => {
        const isTop3 = i < 3;
        return (
          <div key={entry.id} className={cn("flex items-center gap-3 p-3 rounded-xl border", entry.isMe ? "bg-primary/20 border-primary/50" : "bg-secondary/20 border-white/5")}>
            <div className="w-6 text-center font-bold text-sm">{isTop3 ? <Medal className={cn("w-4 h-4 mx-auto", i === 0 ? "text-yellow-500" : i === 1 ? "text-gray-400" : "text-amber-600")} /> : i + 1}</div>
            <div className="flex-1 truncate">
              <span className={cn("font-bold text-[10px] uppercase flex items-center gap-1.5", entry.isMe && "text-primary")}>
                {entry.name}
                {entry.isPlayer && !entry.isMe && <Badge variant="outline" className="text-[6px] h-3 px-1 border-accent/30 text-accent">USER</Badge>}
              </span>
            </div>
            <div className="w-16 text-center text-[9px] font-mono opacity-70">{entry.wins}-{entry.draws}-{entry.losses}</div>
            <div className="w-10 text-right"><p className="text-sm font-headline font-bold text-accent">{entry.points}</p></div>
          </div>
        );
      })}
    </div>
  );

  if (activeTab === 'menu') {
    return (
      <div className="max-w-md mx-auto px-4 pt-8 pb-20">
        <header className="mb-6 flex items-center gap-4">
          <Link href="/"><Button variant="ghost" size="icon" className="rounded-full"><ChevronLeft className="w-6 h-6" /></Button></Link>
          <div className="flex-1">
            <h1 className="text-2xl font-headline font-bold flex items-center gap-2 uppercase tracking-tighter"><Trophy className="text-yellow-500 w-5 h-5" /> {t.title}</h1>
            <p className="text-muted-foreground text-[10px] uppercase tracking-widest">Global Pyramid System</p>
          </div>
        </header>

        {(isProfileLoading || isGroupLoading) ? (
          <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 mb-6">
              <Card className="glass-card bg-primary/5">
                <CardContent className="p-4 flex items-center gap-3">
                  <Calendar className="w-5 h-5 text-primary" />
                  <div><p className="text-[10px] uppercase text-muted-foreground font-bold">{t.season_label}</p><p className="text-lg font-headline font-bold">{seasonDay} / 14</p></div>
                </CardContent>
              </Card>
              <Card className="glass-card bg-accent/5">
                <CardContent className="p-4 flex items-center gap-3">
                  <Clock className="w-5 h-5 text-accent" />
                  <div><p className="text-[10px] uppercase text-muted-foreground font-bold">MSK TIME</p><p className="text-xs font-mono font-bold">{serverTime.split(' ')[1] || '00:00:00'}</p></div>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-2">
              {(Object.entries(t.tabs) as [RankingTab, any][]).map(([tabId, tabData]) => (
                <Card key={tabId} className="glass-card hover:bg-white/5 cursor-pointer" onClick={() => setActiveTab(tabId)}>
                  <CardContent className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="p-2 rounded-lg bg-secondary/50"><tabData.icon className="w-5 h-5 text-primary" /></div>
                      <div><h3 className="text-sm font-bold uppercase">{tabData.label}</h3><p className="text-[10px] text-muted-foreground">{tabData.desc}</p></div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  </CardContent>
                </Card>
              ))}
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto px-4 pt-8 pb-20">
      <header className="mb-6 flex items-center gap-4">
        <Button variant="ghost" size="icon" className="rounded-full" onClick={() => setActiveTab('menu')}><ChevronLeft className="w-6 h-6" /></Button>
        <div className="flex-1">
          <h1 className="text-xl font-headline font-bold uppercase">{t.tabs[activeTab as keyof typeof t.tabs].label}</h1>
          <p className="text-muted-foreground text-[10px] uppercase tracking-widest">Global Rankings | {t.div_label} {leagueLevel}.{divisionSubId}</p>
        </div>
      </header>

      {activeTab === 'my_league' && (
        <div className="space-y-6">
          <Card className="bg-secondary/20 border-white/5">
            <CardContent className="p-4 flex justify-between items-center">
              <div className="flex flex-col">
                <span className="text-xs uppercase font-bold text-accent">{t.bo2_format}</span>
                <span className="text-[11px] font-mono font-bold text-primary flex items-center gap-1 mt-1">
                  <Clock className="w-3.5 h-3.5" /> Start: {league.startTime} (MSK)
                </span>
              </div>
              <Badge variant="outline" className={cn("text-[10px] border-primary/20 text-primary", isTodayPlayed && "border-green-500 text-green-400")}>
                {seasonDay === 0 ? t.upcoming : (isTodayPlayed ? t.completed : t.waiting)}
              </Badge>
            </CardContent>
          </Card>
          {renderRankingTable(myLeagueRankings)}
        </div>
      )}

      {activeTab !== 'menu' && activeTab !== 'my_league' && (
        <div className="flex flex-col items-center justify-center py-12 text-center space-y-4">
          <Shield className="w-12 h-12 text-primary opacity-50" />
          <p className="text-xs text-muted-foreground uppercase tracking-widest">Access Restricted to Top Tier</p>
        </div>
      )}
    </div>
  );
}
