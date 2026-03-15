'use client';

import { useState, useEffect, useMemo } from 'react';
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
import { getMockGroupTeams, SEASON_DURATION_DAYS } from '../lib/leagues-data';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import { getMoscowTime, formatMoscowTime } from '../lib/time-utils';

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

type PyramidViewMode = 'levels' | 'divisions' | 'table';

export default function RankingsPage() {
  const { 
    rank, leagueLevel, divisionSubId, groupId, isLoaded, language, 
    promoteLeague, lastLeagueMatchDate, seasonDay,
    wins, draws, losses, points
  } = useGameState();
  const { user, isUserLoading } = useUser();
  const db = useFirestore();
  const { toast } = useToast();
  
  const [activeTab, setActiveTab] = useState<RankingTab>('menu');
  const [serverTime, setServerTime] = useState<string>('');

  // Pyramid drill-down state
  const [pyramidMode, setPyramidMode] = useState<PyramidViewMode>('levels');
  const [viewingLevel, setViewingLevel] = useState<number>(1);
  const [viewingDiv, setViewingDiv] = useState<number>(1);

  const userRef = useMemoFirebase(() => user ? doc(db, 'users', user.uid) : null, [db, user]);
  const { data: profile, isLoading: isProfileLoading } = useDoc(userRef);

  // Generate group rankings once data is loaded
  const myLeagueRankings = useMemo(() => {
    if (!isLoaded) return [];
    
    // Check if the current day's match has been played to include it in the mock calculation
    const isTodayPlayed = lastLeagueMatchDate === new Date().toISOString().split('T')[0];
    const calculationDay = isTodayPlayed ? seasonDay + 1 : seasonDay;

    return getMockGroupTeams(
      rank, 
      profile?.displayName || "My Team", 
      leagueLevel, 
      divisionSubId, 
      groupId, 
      true, 
      calculationDay,
      { wins, draws, losses, points }
    );
  }, [isLoaded, rank, profile?.displayName, leagueLevel, divisionSubId, groupId, seasonDay, wins, draws, losses, points, lastLeagueMatchDate]);

  const isPlayerFirst = myLeagueRankings.find(t => t.isPlayer)?.points === Math.max(...myLeagueRankings.map(t => t.points));

  // Clock effect
  useEffect(() => {
    const timer = setInterval(() => {
      setServerTime(formatMoscowTime(getMoscowTime()));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const labels = {
    en: {
      title: "TOURNAMENT TABLES",
      subtitle: "Pyramid Hierarchy",
      menuTitle: "Tournament Terminals",
      promote: "Promote",
      promoteSuccess: "Promotion Success!",
      promoteDesc: "You have moved to a higher division!",
      canPromote: "Rank 1: Eligible for Promotion!",
      backToMenu: "Back to Menu",
      backToLevels: "Back to Levels",
      backToDivisions: "Back to Divisions",
      serverClock: "Server Clock (MSK)",
      matchStatus: "League Match Status",
      waiting: "Next match scheduled",
      completed: "Match for today completed",
      processing: "Simulating match...",
      div_label: "Division",
      level_label: "Level",
      season_label: "Season Day",
      bo2_format: "Best of 2 (2:0, 1:1, 0:2)",
      tiers: ["Elite Tier", "Professional Tier", "Challenger Tier"],
      tabs: {
        my_league: { label: "My League", desc: "Current group rankings", icon: Trophy },
        champions_cup: { label: "Champions Cup", desc: "Top tier elite tournament", icon: Award },
        masters_cup: { label: "Masters Cup", desc: "Professional division cup", icon: Star },
        my_pyramid: { label: "My Pyramid", desc: "Global hierarchy view", icon: LayoutDashboard },
        pyramid_cup: { label: "Pyramid Cup", desc: "Inter-division knockout", icon: Swords },
        friendly: { label: "Friendly Tournament", desc: "Low stakes training matches", icon: Users },
        pyramids_list: { label: "Pyramids", desc: "Active world pyramids", icon: Shield },
        pyramids_rating: { label: "Pyramid Rating", desc: "Global organization ranking", icon: TrendingUp },
        kda_leaders: { label: "Top KDA Players", desc: "Best individual performers", icon: Target }
      }
    },
    ru: {
      title: "ТУРНИРНЫЕ ТАБЛИЦЫ",
      subtitle: "Иерархия Пирамиды",
      menuTitle: "Турнирные Терминалы",
      promote: "Повышить",
      promoteSuccess: "Повышение!",
      promoteDesc: "Вы перешли в дивизион уровнем выше!",
      canPromote: "1 Место: Доступно повышение!",
      backToMenu: "В меню",
      backToLevels: "К уровням",
      backToDivisions: "К дивизионам",
      serverClock: "Часы Сервера (МСК)",
      matchStatus: "Статус матча лиги",
      waiting: "Ожидание начала матча",
      completed: "Матч на сегодня сыгран",
      processing: "Идет симуляция...",
      div_label: "Дивизион",
      level_label: "Уровень",
      season_label: "День сезона",
      bo2_format: "Формат Bo2 (2:0, 1:1, 0:2)",
      tiers: ["Элитный уровень", "Профессиональный уровень", "Претендентский уровень"],
      tabs: {
        my_league: { label: "Своя лига", desc: "Рейтинг вашей группы", icon: Trophy },
        champions_cup: { label: "Кубок чемпионов", desc: "Элитный турнир высшей лиги", icon: Award },
        masters_cup: { label: "Кубок Мастеров", desc: "Кубок профессионального дивизиона", icon: Star },
        my_pyramid: { label: "Своя пирамида", desc: "Обзор глобальной иерархии", icon: LayoutDashboard },
        pyramid_cup: { label: "Кубок пирамиды", desc: "Междивизионный плей-офф", icon: Swords },
        friendly: { label: "Товарищеский турнир", desc: "Тренировочные матчи без риска", icon: Users },
        pyramids_list: { label: "Пирамиды", desc: "Список активных миров", icon: Shield },
        pyramids_rating: { label: "Рейтинг пирамид", desc: "Мировой рейтинг организаций", icon: TrendingUp },
        kda_leaders: { label: "Игроки с лучшим КДА", desc: "Лидеры индивидуальной статистики", icon: Target }
      }
    }
  };

  const t = labels[language as keyof typeof labels] || labels.ru;

  const handlePromotion = () => {
    if (promoteLeague()) {
      toast({
        title: t.promoteSuccess,
        description: t.promoteDesc,
      });
    }
  };

  if (!isLoaded || isUserLoading || isProfileLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const renderRankingTable = (rankingsData: any[]) => (
    <div className="space-y-2 animate-in fade-in duration-300">
      <div className="flex items-center px-4 text-[10px] uppercase font-bold text-muted-foreground mb-1">
        <div className="w-8">#</div>
        <div className="flex-1">Team</div>
        <div className="w-24 text-center">W-D-L</div>
        <div className="w-16 text-right">Points</div>
      </div>
      {rankingsData.map((entry, i) => {
        const isTop3 = i < 3;
        return (
          <div 
            key={entry.id || entry.name} 
            className={cn(
              "flex items-center gap-3 p-3 rounded-xl border transition-all",
              entry.isPlayer ? "bg-primary/20 border-primary/50 shadow-lg" : "bg-secondary/20 border-white/5",
              isTop3 && !entry.isPlayer ? "border-yellow-500/10" : ""
            )}
          >
            <div className="w-8 text-center font-headline font-bold text-sm italic">
              {isTop3 ? (
                <Medal className={cn(
                  "w-5 h-5 mx-auto",
                  i === 0 ? "text-yellow-500" : i === 1 ? "text-gray-400" : "text-amber-600"
                )} />
              ) : i + 1}
            </div>
            <div className="flex-1 min-w-0">
              <p className={cn("font-bold text-xs uppercase flex items-center gap-2 truncate", entry.isPlayer && "text-primary")}>
                {entry.isPlayer ? (profile?.displayName || entry.name) : entry.name}
                {entry.isPlayer && <Star className="w-3 h-3 fill-current" />}
              </p>
            </div>
            <div className="w-24 text-center text-[10px] font-mono opacity-70">
              {entry.wins}-{entry.draws || 0}-{entry.losses || 0}
            </div>
            <div className="w-16 text-right">
              <p className="text-sm font-headline font-bold text-accent">{entry.points}</p>
            </div>
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="max-w-md mx-auto px-4 pt-8 pb-20">
      <header className="mb-6 flex items-center gap-4">
        {activeTab === 'menu' ? (
          <Link href="/">
            <Button variant="ghost" size="icon" className="rounded-full">
              <ChevronLeft className="w-6 h-6" />
            </Button>
          </Link>
        ) : (
          <Button variant="ghost" size="icon" className="rounded-full" onClick={() => setActiveTab('menu')}>
            <ChevronLeft className="w-6 h-6" />
          </Button>
        )}
        <div className="flex-1">
          <h1 className="text-2xl font-headline font-bold flex items-center gap-2 uppercase tracking-tighter">
            <Trophy className="text-yellow-500 w-5 h-5" />
            {activeTab === 'menu' ? t.title : t.tabs[activeTab as keyof typeof t.tabs].label}
          </h1>
          <p className="text-muted-foreground text-[10px] uppercase tracking-widest">
            {t.subtitle} | {t.div_label} {leagueLevel}.{divisionSubId}
          </p>
        </div>
      </header>

      {activeTab === 'menu' && (
        <>
          <div className="grid grid-cols-2 gap-3 mb-4">
            <Card className="glass-card border-primary/20 bg-primary/5">
              <CardContent className="p-4 flex items-center gap-3">
                <Calendar className="w-5 h-5 text-primary" />
                <div>
                  <p className="text-[10px] uppercase text-muted-foreground font-bold">{t.season_label}</p>
                  <p className="text-lg font-headline font-bold">{seasonDay} / {SEASON_DURATION_DAYS}</p>
                </div>
              </CardContent>
            </Card>
            <Card className="glass-card border-accent/20 bg-accent/5">
              <CardContent className="p-4 flex items-center gap-3">
                <Clock className="w-5 h-5 text-accent" />
                <div>
                  <p className="text-[10px] uppercase text-muted-foreground font-bold">MSK</p>
                  <p className="text-xs font-mono font-bold">{serverTime.split(' ')[1] || '00:00:00'}</p>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-4">
            <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-accent px-1">{t.menuTitle}</h2>
            <div className="space-y-2">
              {(Object.entries(t.tabs) as [RankingTab, any][]).map(([tabId, tabData]) => (
                <Card 
                  key={tabId} 
                  className="glass-card hover:bg-white/5 transition-colors border-white/5 cursor-pointer"
                  onClick={() => {
                    setActiveTab(tabId);
                    if (tabId === 'my_pyramid') setPyramidMode('levels');
                  }}
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
        </>
      )}

      {activeTab === 'my_league' && (
        <div className="space-y-6">
          <Card className="bg-secondary/20 border-white/5">
            <CardContent className="p-4 flex justify-between items-center">
              <span className="text-xs uppercase font-bold text-accent">{t.bo2_format}</span>
              <Badge variant="outline" className="text-[10px] border-primary/20 text-primary">
                {lastLeagueMatchDate === new Date().toISOString().split('T')[0] ? t.completed : t.waiting}
              </Badge>
            </CardContent>
          </Card>
          {isPlayerFirst && leagueLevel > 1 && (
            <Card className="bg-primary/20 border-primary/50 border-2">
              <CardContent className="p-4 flex items-center justify-between">
                <p className="text-xs font-bold text-primary">{t.canPromote}</p>
                <Button size="sm" onClick={handlePromotion} className="hero-gradient font-bold h-8 text-[10px]">
                  {t.promote}
                </Button>
              </CardContent>
            </Card>
          )}
          {renderRankingTable(myLeagueRankings)}
        </div>
      )}

      {/* Other tabs keep existing placeholders or logic */}
      {activeTab !== 'menu' && activeTab !== 'my_league' && (
         <div className="flex flex-col items-center justify-center py-12 text-center space-y-4">
           <Shield className="w-12 h-12 text-primary opacity-50" />
           <p className="text-xs text-muted-foreground uppercase tracking-widest">Data Synchronization Active</p>
         </div>
      )}
    </div>
  );
}
