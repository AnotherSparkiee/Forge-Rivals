
'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useGameState } from '../lib/store';
import { 
  Trophy, Medal, ChevronLeft, Award, 
  Users, Shield, Star, Swords, ChevronRight,
  LayoutDashboard, Loader2, Clock, Calendar,
  LayoutGrid, Search, Radio, Target, Zap, ShieldAlert, AlertTriangle,
  CheckCircle2, Timer
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import Link from 'next/link';
import { getMockGroupTeams, LEAGUES } from '../lib/leagues-data';
import { Badge } from '@/components/ui/badge';
import { useUser, useFirestore, useDoc, useCollection, useMemoFirebase } from '@/firebase';
import { doc, collection, query, where } from 'firebase/firestore';
import { getMoscowDateString, getPyramidCupTime } from '../lib/time-utils';
import { LoadingScreen } from '@/components/game/LoadingScreen';

type RankingTab = 
  | 'menu'
  | 'my_league' 
  | 'champions_cup' 
  | 'masters_cup' 
  | 'my_pyramid' 
  | 'pyramid_cup' 
  | 'friendly';

export default function RankingsPage() {
  const { user, isUserLoading } = useUser();
  const router = useRouter();
  const { 
    rank, leagueLevel, divisionSubId, groupId, isLoaded, language, 
    lastLeagueMatchDate, seasonDay, seasonNumber, isSyncing, matchHistory
  } = useGameState();
  const db = useFirestore();
  
  const [activeTab, setActiveTab] = useState<RankingTab>('menu');
  const [selectedPyramidDiv, setSelectedPyramidDiv] = useState<number | null>(null);
  const [viewingGroup, setViewingGroup] = useState<{ div: number, group: number } | null>(null);

  useEffect(() => {
    if (!isUserLoading && !user) {
      router.push('/auth/login');
    }
  }, [user, isUserLoading, router]);

  const userRef = useMemoFirebase(() => user ? doc(db, 'players_v5', user.uid) : null, [db, user]);
  const { data: profile, isLoading: isProfileLoading } = useDoc(userRef);

  // Query for current group players
  const groupQuery = useMemoFirebase(() => {
    if (!profile?.selectedLeagueId) return null;
    return query(
      collection(db, 'players_v5'),
      where('selectedLeagueId', '==', profile.selectedLeagueId),
      where('leagueLevel', '==', Number(profile.leagueLevel)),
      where('groupId', '==', Number(profile.groupId))
    );
  }, [db, profile?.selectedLeagueId, profile?.leagueLevel, profile?.groupId]);

  const { data: groupPlayers, isLoading: isGroupLoading } = useCollection(groupQuery);

  // Query for ANY group being viewed in pyramid
  const viewingGroupPlayersQuery = useMemoFirebase(() => {
    if (!profile?.selectedLeagueId || !viewingGroup) return null;
    return query(
      collection(db, 'players_v5'),
      where('selectedLeagueId', '==', profile.selectedLeagueId),
      where('leagueLevel', '==', Number(viewingGroup.div)),
      where('groupId', '==', Number(viewingGroup.group))
    );
  }, [db, profile?.selectedLeagueId, viewingGroup]);

  const { data: viewingGroupPlayers, isLoading: isViewingGroupLoading } = useCollection(viewingGroupPlayersQuery);

  const allLeaguePlayersQuery = useMemoFirebase(() => {
    if (!profile?.selectedLeagueId) return null;
    return query(
      collection(db, 'players_v5'),
      where('selectedLeagueId', '==', profile.selectedLeagueId)
    );
  }, [db, profile?.selectedLeagueId]);

  const { data: allLeaguePlayers, isLoading: isLeaguePlayersLoading } = useCollection(allLeaguePlayersQuery);

  const league = useMemo(() => {
    return LEAGUES.find(l => l.id === profile?.selectedLeagueId) || LEAGUES[0];
  }, [profile?.selectedLeagueId]);

  const isTodayPlayed = useMemo(() => {
    const todayStr = getMoscowDateString();
    return lastLeagueMatchDate === todayStr;
  }, [lastLeagueMatchDate]);

  const cupEliminationDay = useMemo(() => {
    const lostMatch = matchHistory.find(m => m.type === 'tournament' && m.scoreA < m.scoreB && m.seasonNumber === seasonNumber);
    return lostMatch ? lostMatch.day : null;
  }, [matchHistory, seasonNumber]);

  const myLeagueRankings = useMemo(() => {
    if (!isLoaded || !profile || !groupPlayers) return [];
    const completedDays = isTodayPlayed ? seasonDay : Math.max(0, seasonDay - 1);
    
    const teams = getMockGroupTeams(
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
    
    return [...teams].sort((a, b) => b.points - a.points || (b.wins - a.wins));
  }, [isLoaded, profile, groupPlayers, leagueLevel, divisionSubId, groupId, seasonDay, isTodayPlayed, rank, user?.uid]);

  const cupPairs = useMemo(() => {
    if (!user || !isLoaded || !allLeaguePlayers) return [];
    const sortedPlayers = [...allLeaguePlayers].sort((a, b) => a.id.localeCompare(b.id));
    const myIndex = sortedPlayers.findIndex(p => p.id === user.uid);
    if (myIndex === -1) return [];

    const pairs = [];
    const d = seasonDay || 1;
    const step = Math.pow(2, d - 1);
    const blockSize = step * 8;
    const blockStart = Math.floor(myIndex / blockSize) * blockSize;

    for (let i = 0; i < 4; i++) {
      const matchIndexInBlock = i;
      const teamA_idx = blockStart + (matchIndexInBlock * 2 * step);
      const teamB_idx = teamA_idx + step;
      const playerA = sortedPlayers[teamA_idx];
      const playerB = sortedPlayers[teamB_idx];
      const homeName = playerA ? (playerA.displayName || "Manager") : "---";
      const awayName = playerB ? (playerB.displayName || "Manager") : "---";
      const isUserMatch = (myIndex >= teamA_idx && myIndex < teamA_idx + step) || 
                          (myIndex >= teamB_idx && myIndex < teamB_idx + step);
      const historicalMatch = matchHistory.find(m => m.day === d && m.type === 'tournament' && m.seasonNumber === seasonNumber);
      const isPlayed = isUserMatch && !!historicalMatch;
      pairs.push({
        id: `pair-${i}`,
        home: homeName,
        away: awayName,
        isUser: isUserMatch,
        isPlayed,
        result: isPlayed ? `${historicalMatch.scoreA}:${historicalMatch.scoreB}` : null,
        winner: isPlayed ? historicalMatch.winner : (playerA && !playerB ? playerA.displayName : null)
      });
    }
    return pairs;
  }, [user, isLoaded, allLeaguePlayers, seasonNumber, seasonDay, matchHistory]);

  if (isUserLoading || !isLoaded || !user) {
    return <LoadingScreen />;
  }

  const labels = {
    en: {
      title: "TOURNAMENT TABLES",
      subtitle: "Pyramid Hierarchy",
      menuTitle: "Tournament Terminals",
      matchStatus: "League Status",
      waiting: "Waiting for " + league.startTime,
      completed: "Match completed",
      upcoming: "Season starts tomorrow",
      div_label: "Division",
      season_label: "Season Day",
      current_season: "Active Season",
      season_value: "Season 1",
      bo2_format: `Bo2 Format (${league.startTime} daily)`,
      pyramidTitle: "Pyramid Structure",
      pyramidDesc: "Global Hierarchy of MU League",
      backToDivs: "Back to Divisions",
      backToGroups: "Back to Pyramid",
      groupLabel: "Group",
      myPos: "YOU ARE HERE",
      realManager: "USER",
      cupStatus: "Cup Status",
      inCup: "ACTIVE IN CUP",
      eliminated: "ELIMINATED",
      roundLabel: "Current Stage",
      bracketTitle: "Local Tournament Grid",
      bracketDesc: "Real league participants only",
      waitingMatch: "AWAITING DEPLOYMENT",
      matchTime: "Match Start",
      rounds: [
        "1/8192 Round", "1/4096 Round", "1/2048 Round", "1/1024 Round", 
        "1/512 Round", "1/256 Round", "1/128 Round", "1/64 Round", 
        "1/32 Round", "1/16 Round", "Quarter-Finals", "Semi-Finals", 
        "Grand Final", "Season Wrap-up"
      ],
      tabs: {
        my_league: { label: "My League", desc: "Current group rankings", icon: Trophy },
        champions_cup: { label: "Champions Cup", desc: "Top tier elite", icon: Award },
        masters_cup: { label: "Masters Cup", desc: "Pro division cup", icon: Star },
        my_pyramid: { label: "My Pyramid", desc: "Global live hierarchy", icon: LayoutDashboard },
        pyramid_cup: { label: "Pyramid Cup", desc: "Daily knockout rounds", icon: Target },
        friendly: { label: "Friendly", desc: "Training matches", icon: Users }
      }
    },
    ru: {
      title: "ТУРНИРНЫЕ ТАБЛИЦЫ",
      subtitle: "Иерархия Пирамиды",
      menuTitle: "Турнирные Терминалы",
      matchStatus: "Статус лиги",
      waiting: "Ожидание " + league.startTime,
      completed: "Матч завершен",
      upcoming: "Сезон начнется завтра",
      div_label: "Дивизион",
      season_label: "День сезона",
      current_season: "Текущий сезон",
      season_value: "Сезон 1",
      bo2_format: `Формат Bo2 (Ежедневно ${league.startTime})`,
      pyramidTitle: "Структура Пирамиды",
      pyramidDesc: "Глобальная иерархия лиги MU",
      backToDivs: "К списку дивизионов",
      backToGroups: "Назад в пирамиду",
      groupLabel: "Группа",
      myPos: "ВЫ ЗДЕСЬ",
      realManager: "МЕНЕДЖЕР",
      cupStatus: "Статус в кубке",
      inCup: "В ИГРЕ",
      eliminated: "ВЫБЫЛ",
      roundLabel: "Текущая стадия",
      bracketTitle: "Сетка вашего сектора",
      bracketDesc: "Только реальные участники лиги",
      waitingMatch: "ОЖИДАНИЕ БОЯ",
      matchTime: "Начало матча",
      rounds: [
        "Раунд 1/8192", "Раунд 1/4096", "Раунд 1/2048", "Раунд 1/1024", 
        "Раунд 1/512", "Раунд 1/256", "Раунд 1/128", "1/64 финала", 
        "1/32 финала", "1/16 финала", "Четвертьфинал", "Полуфинал", 
        "Гранд Финал", "Итоги сезона"
      ],
      tabs: {
        my_league: { label: "Своя лига", desc: "Рейтинг вашей группы", icon: Trophy },
        champions_cup: { label: "Кубок чемпионов", desc: "Элитный турнир", icon: Award },
        masters_cup: { label: "Кубок Мастеров", desc: "Профессиональный кубок", icon: Star },
        my_pyramid: { label: "Своя пирамида", desc: "Обзор живой иерархии", icon: LayoutDashboard },
        pyramid_cup: { label: "Кубок пирамиды", desc: "Ежедневный турнир на вылет", icon: Target },
        friendly: { label: "Товарищеский", desc: "Тренировочные игры", icon: Users }
      }
    }
  };

  const t = labels[language as keyof typeof labels] || labels.ru;

  const currentRoundIdx = Math.min(t.rounds.length - 1, Math.max(0, seasonDay - 1));
  const cupTime = getPyramidCupTime(league.startTime);

  const renderRankingTable = (rankingsData: any[]) => (
    <div className="space-y-2 animate-in fade-in duration-300">
      <div className="flex items-center px-4 text-[9px] uppercase font-black text-muted-foreground/50 mb-1 tracking-widest">
        <div className="w-8">#</div>
        <div className="flex-1">Operational ID</div>
        <div className="w-16 text-center">W-D-L</div>
        <div className="w-12 text-right">Pts</div>
      </div>
      {rankingsData.map((entry, i) => {
        const isTop3 = i < 3;
        return (
          <div key={entry.id} className={cn(
            "flex items-center gap-3 p-3 rounded-xl border transition-all", 
            entry.isMe ? "bg-primary/20 border-primary/50 shadow-[0_0_15px_rgba(var(--primary),0.1)]" : "bg-secondary/20 border-white/5"
          )}>
            <div className="w-6 text-center font-black text-xs">
              {isTop3 ? <Medal className={cn("w-4 h-4 mx-auto", i === 0 ? "text-yellow-500" : i === 1 ? "text-slate-400" : "text-amber-600")} /> : i + 1}
            </div>
            <div className="flex-1 truncate">
              <span className={cn(
                "font-bold text-[11px] uppercase flex items-center gap-2", 
                entry.isMe ? "text-white" : "text-muted-foreground"
              )}>
                {entry.name}
                {entry.isPlayer && !entry.isMe && (
                  <Badge variant="outline" className="text-[7px] h-4 px-1.5 border-accent/40 text-accent font-black bg-accent/5">
                    {t.realManager}
                  </Badge>
                )}
              </span>
            </div>
            <div className="w-16 text-center text-[9px] font-mono font-bold opacity-50">{entry.wins}-{entry.draws}-{entry.losses}</div>
            <div className="w-10 text-right">
              <p className={cn("text-sm font-headline font-black italic", entry.points > 0 ? "text-accent" : "text-muted-foreground")}>
                {entry.points}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );

  const renderContent = () => {
    switch (activeTab) {
      case 'my_league':
        return (
          <div className="space-y-6">
            <Card className="bg-secondary/30 border-white/5 shadow-xl">
              <CardContent className="p-5 flex justify-between items-center">
                <div className="flex flex-col">
                  <span className="text-[10px] uppercase font-black text-accent tracking-[0.2em]">{t.bo2_format}</span>
                  <span className="text-xs font-mono font-bold text-primary flex items-center gap-2 mt-2 bg-primary/10 px-2 py-1 rounded-md w-fit">
                    <Clock className="w-3.5 h-3.5" /> {league.startTime} MSK
                  </span>
                </div>
                <Badge variant="outline" className={cn(
                  "text-[10px] font-black px-3 py-1 border-white/10 uppercase tracking-widest", 
                  isTodayPlayed ? "bg-green-500/20 border-green-500/30 text-green-400" : "bg-primary/10 text-primary border-primary/20"
                )}>
                  {seasonDay === 0 ? t.upcoming : (isTodayPlayed ? t.completed : t.waiting)}
                </Badge>
              </CardContent>
            </Card>
            {isGroupLoading ? (
              <div className="py-20 text-center opacity-50"><Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" /></div>
            ) : renderRankingTable(myLeagueRankings)}
          </div>
        );

      case 'pyramid_cup':
        return (
          <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500 pb-10">
            <Card className="glass-card bg-gradient-to-br from-accent/10 to-transparent border-accent/20 overflow-hidden">
              <CardContent className="p-6 flex flex-col items-center text-center">
                <div className="relative mb-4">
                  <div className="w-20 h-20 rounded-full bg-secondary/50 border-2 border-accent flex items-center justify-center shadow-[0_0_20px_rgba(var(--accent),0.2)]">
                    <Target className={cn("w-10 h-10 text-accent", !cupEliminationDay && "animate-pulse")} />
                  </div>
                  {!cupEliminationDay && (
                    <div className="absolute -top-1 -right-1">
                      <Zap className="w-6 h-6 text-yellow-500 fill-yellow-500 animate-bounce" />
                    </div>
                  )}
                </div>
                
                <h2 className="text-2xl font-headline font-bold uppercase tracking-tight text-white">{t.tabs.pyramid_cup.label}</h2>
                <div className="flex items-center gap-2 mt-2">
                  <Badge className={cn("uppercase text-[8px] font-black", cupEliminationDay ? "bg-destructive text-white" : "bg-green-500 text-white")}>
                    {cupEliminationDay ? `${t.eliminated} (DAY ${cupEliminationDay})` : t.inCup}
                  </Badge>
                  <span className="text-[10px] text-muted-foreground uppercase font-bold">Season {seasonNumber}</span>
                </div>

                <div className="w-full grid grid-cols-2 gap-3 mt-8">
                  <div className="bg-background/50 p-3 rounded-xl border border-white/5">
                    <p className="text-[8px] text-muted-foreground uppercase font-bold mb-1">{t.roundLabel}</p>
                    <p className="text-xs font-bold text-accent uppercase truncate">{t.rounds[currentRoundIdx]}</p>
                  </div>
                  <div className="bg-background/50 p-3 rounded-xl border border-white/5">
                    <p className="text-[8px] text-muted-foreground uppercase font-bold mb-1">{t.matchTime}</p>
                    <p className="text-xs font-bold text-primary">{cupTime} MSK</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="space-y-4">
              <h3 className="text-xs font-black uppercase tracking-[0.2em] text-accent px-1 flex items-center gap-2">
                <LayoutGrid className="w-4 h-4" /> {t.bracketTitle}
              </h3>
              
              <div className="space-y-3 relative">
                {isLeaguePlayersLoading ? (
                  <div className="py-10 text-center opacity-50">
                    <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
                  </div>
                ) : cupPairs.length > 0 ? (
                  cupPairs.map((pair) => (
                    <Card key={pair.id} className={cn(
                      "glass-card border-white/5 overflow-hidden transition-all",
                      pair.isUser && "border-primary/30 ring-1 ring-primary/10 bg-primary/5"
                    )}>
                      <CardContent className="p-0">
                        <div className="flex items-center justify-between p-3 gap-2">
                          <div className="flex-1 min-w-0 space-y-2">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2 min-w-0">
                                <div className={cn("w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0", pair.isUser && "bg-primary animate-pulse")} />
                                <span className={cn("text-[10px] font-bold uppercase truncate", pair.isUser && "text-primary")}>{pair.home}</span>
                                {pair.isUser && pair.home !== "---" && <Badge className="text-[6px] h-3 px-1 py-0 bg-primary text-primary-foreground font-black">YOU</Badge>}
                              </div>
                              {pair.isPlayed && <span className="text-xs font-headline font-black text-white">{pair.result?.split(':')[0]}</span>}
                            </div>
                            <div className="flex items-center gap-2 px-1 opacity-20">
                              <div className="h-px flex-1 bg-white" />
                              <span className="text-[7px] font-black uppercase">VS</span>
                              <div className="h-px flex-1 bg-white" />
                            </div>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2 min-w-0">
                                <div className={cn("w-1.5 h-1.5 rounded-full bg-red-400 shrink-0")} />
                                <span className={cn("text-[10px] font-bold uppercase truncate opacity-80")}>{pair.away}</span>
                              </div>
                              {pair.isPlayed && <span className="text-xs font-headline font-black text-white">{pair.result?.split(':')[1]}</span>}
                            </div>
                          </div>
                          <div className="w-20 flex flex-col items-center justify-center border-l border-white/5 pl-2 gap-1 text-center shrink-0">
                            {pair.isPlayed ? (
                              <><CheckCircle2 className="w-4 h-4 text-green-400" /><span className="text-[7px] font-black uppercase text-green-400">FINISH</span></>
                            ) : pair.home === "---" || pair.away === "---" ? (
                              <><CheckCircle2 className="w-4 h-4 text-blue-400" /><span className="text-[7px] font-black uppercase text-blue-400">BYE</span></>
                            ) : (
                              <><Timer className="w-4 h-4 text-accent animate-pulse" /><span className="text-[7px] font-black uppercase text-accent leading-none">{t.waitingMatch}</span><span className="text-[8px] font-mono font-bold text-primary mt-0.5">{cupTime}</span></>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                ) : (
                  <div className="py-10 text-center opacity-40 uppercase text-[10px] font-bold tracking-widest">Synchronizing participants...</div>
                )}
              </div>
            </div>
          </div>
        );

      case 'my_pyramid':
        if (viewingGroup) {
          return (
            <div className="space-y-6 animate-in slide-in-from-bottom-2 duration-500 pb-10">
              <div className="flex items-center justify-between px-1">
                <Button variant="ghost" size="sm" onClick={() => setViewingGroup(null)} className="h-8 text-[10px] font-black uppercase tracking-widest text-primary hover:bg-primary/10">
                  <ChevronLeft className="w-3 h-3 mr-1" /> {t.backToGroups}
                </Button>
                <Badge className="bg-accent text-accent-foreground text-[10px] font-black tracking-widest uppercase">
                  DIV {viewingGroup.div} | GROUP {viewingGroup.group}
                </Badge>
              </div>
              {isViewingGroupLoading ? (
                <div className="py-20 text-center opacity-50"><Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" /></div>
              ) : (
                renderRankingTable(getMockGroupTeams(
                  1000, 
                  profile?.displayName || "Manager", 
                  viewingGroup.div, 
                  1, 
                  viewingGroup.group, 
                  profile?.selectedLeagueId || "ALPHA", 
                  viewingGroupPlayers || [], 
                  user?.uid, 
                  isTodayPlayed ? seasonDay : Math.max(0, seasonDay - 1)
                ))
              )}
            </div>
          );
        }

        if (selectedPyramidDiv) {
          const groupCount = Math.pow(2, selectedPyramidDiv - 1);
          return (
            <div className="space-y-6 animate-in fade-in duration-500 pb-10">
              <div className="flex items-center justify-between px-1">
                <Button variant="ghost" size="sm" onClick={() => setSelectedPyramidDiv(null)} className="h-8 text-[10px] font-black uppercase tracking-widest text-primary hover:bg-primary/10">
                  <ChevronLeft className="w-3 h-3 mr-1" /> {t.backToDivs}
                </Button>
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-headline font-bold uppercase text-accent">{t.div_label} {selectedPyramidDiv}</h2>
                  <Badge variant="outline" className="text-[8px] border-white/10">{groupCount} GROUPS</Badge>
                </div>
              </div>
              <div className="grid grid-cols-4 gap-2">
                {Array.from({ length: groupCount }).map((_, i) => {
                  const gNum = i + 1;
                  const isMine = leagueLevel === selectedPyramidDiv && groupId === gNum;
                  return (
                    <Card key={gNum} className={cn("border-white/5 cursor-pointer transition-all hover:scale-105 active:scale-95 overflow-hidden", isMine ? "bg-primary/20 border-primary/50 shadow-[0_0_15px_rgba(var(--primary),0.2)]" : "bg-secondary/30 hover:border-white/20")} onClick={() => setViewingGroup({ div: selectedPyramidDiv, group: gNum })}>
                      <CardContent className="p-3 text-center relative">
                        <p className={cn("text-[10px] font-black uppercase tracking-tighter", isMine ? "text-primary" : "text-muted-foreground/60")}>#{gNum}</p>
                        {isMine && <div className="text-[6px] font-black text-primary mt-1 leading-none animate-pulse">{t.myPos}</div>}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          );
        }

        return (
          <div className="space-y-3 animate-in fade-in duration-500 pb-10">
            <div className="p-5 bg-gradient-to-br from-primary/10 via-card to-accent/5 rounded-2xl border border-white/5 mb-6 text-center shadow-xl">
              <h2 className="text-sm font-headline font-black uppercase tracking-[0.2em] text-primary flex items-center justify-center gap-3"><LayoutGrid className="w-5 h-5" /> {t.pyramidTitle}</h2>
              <p className="text-[9px] text-muted-foreground mt-2 uppercase font-black tracking-widest opacity-60">{t.pyramidDesc}</p>
            </div>
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((div) => {
              const groupCount = Math.pow(2, div - 1);
              const isMyDiv = leagueLevel === div;
              return (
                <Card key={div} className={cn("glass-card border-white/5 hover:bg-white/5 cursor-pointer transition-all group", isMyDiv && "border-primary/30 bg-primary/5 ring-1 ring-primary/20")} onClick={() => setSelectedPyramidDiv(div)}>
                  <CardContent className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center font-headline font-black text-xl transition-all", isMyDiv ? "bg-primary text-primary-foreground shadow-lg shadow-primary/30 rotate-3" : "bg-secondary/50 text-muted-foreground/40 group-hover:text-primary")}>{div}</div>
                      <div>
                        <h3 className="text-sm font-black uppercase tracking-tight">{t.div_label} {div}</h3>
                        <p className="text-[9px] text-muted-foreground font-black uppercase tracking-widest mt-1 opacity-50">{groupCount} GROUPS</p>
                      </div>
                    </div>
                    {isMyDiv && <Badge className="text-[8px] uppercase font-black bg-primary text-primary-foreground animate-pulse">{t.myPos}</Badge>}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        );

      default: return null;
    }
  };

  if (activeTab === 'menu') {
    return (
      <div className="max-w-md mx-auto px-4 pt-8 pb-20">
        <header className="mb-8 flex items-center gap-4">
          <Link href="/"><Button variant="ghost" size="icon" className="rounded-full hover:bg-white/5"><ChevronLeft className="w-6 h-6" /></Button></Link>
          <div className="flex-1">
            <h1 className="text-2xl font-headline font-black flex items-center gap-3 uppercase tracking-tighter">
              <Trophy className="text-yellow-500 w-6 h-6" /> 
              {t.title}
            </h1>
            <p className="text-muted-foreground text-[10px] uppercase tracking-[0.2em] font-black opacity-50">Operational Hierarchy</p>
          </div>
        </header>

        {(isProfileLoading || isGroupLoading) ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4 opacity-50">
            <Loader2 className="w-10 h-10 animate-spin text-primary" />
            <p className="text-[10px] font-black uppercase tracking-widest">Querying League Server...</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 mb-8">
              <Card className="glass-card bg-primary/5 border-primary/10">
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="p-2 rounded-lg bg-primary/20"><Calendar className="w-5 h-5 text-primary" /></div>
                  <div><p className="text-[9px] uppercase text-muted-foreground font-black tracking-widest">{t.season_label}</p><p className="text-xl font-headline font-black italic">{seasonDay} / 14</p></div>
                </CardContent>
              </Card>
              <Card className="glass-card bg-accent/5 border-accent/10">
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="p-2 rounded-lg bg-accent/20"><Trophy className="w-5 h-5 text-accent" /></div>
                  <div><p className="text-[9px] uppercase text-muted-foreground font-black tracking-widest">{t.current_season}</p><p className="text-xl font-headline font-black italic text-accent">{t.season_value}</p></div>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-2">
              {(Object.entries(t.tabs) as [RankingTab, any][]).map(([tabId, tabData]) => (
                <Card key={tabId} className="glass-card hover:bg-white/5 transition-all cursor-pointer border-white/5 active:scale-[0.98]" onClick={() => setActiveTab(tabId)}>
                  <CardContent className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="p-3 rounded-xl bg-secondary/50 border border-white/5"><tabData.icon className="w-5 h-5 text-primary" /></div>
                      <div>
                        <h3 className="text-sm font-black uppercase tracking-tight">{tabData.label}</h3>
                        <p className="text-[10px] text-muted-foreground font-medium opacity-70">{tabData.desc}</p>
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-muted-foreground/30" />
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
      <header className="mb-8 flex items-center gap-4">
        <Button variant="ghost" size="icon" className="rounded-full hover:bg-white/5" onClick={() => {
          if (viewingGroup) setViewingGroup(null);
          else if (selectedPyramidDiv) setSelectedPyramidDiv(null);
          else setActiveTab('menu');
        }}>
          <ChevronLeft className="w-6 h-6" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-headline font-black uppercase tracking-tight">{t.tabs[activeTab as keyof typeof t.tabs].label}</h1>
            {isSyncing && <Radio className="w-3 h-3 text-accent animate-pulse" />}
          </div>
          <p className="text-muted-foreground text-[10px] uppercase tracking-widest font-black opacity-50">
            {activeTab === 'my_pyramid' ? 'LIVE GLOBAL PYRAMID' : `OPERATIONAL DATA | DIV ${leagueLevel}.${divisionSubId}`}
          </p>
        </div>
      </header>

      {renderContent()}
    </div>
  );
}
