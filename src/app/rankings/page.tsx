'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useGameState } from '../lib/store';
import { 
  Trophy, Medal, ChevronLeft, Award, 
  Users, Shield, Star, Swords, ChevronRight,
  LayoutDashboard, Loader2, Clock, Calendar,
  LayoutGrid, Search, Radio, Target, Zap, ShieldAlert,
  CheckCircle2, Timer, ChevronsLeft, ChevronsRight,
  ChevronLeft as ChevronLeftIcon, ChevronRight as ChevronRightIcon
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import Link from 'next/link';
import { getMockGroupTeams, LEAGUES, getMatchResult } from '../lib/leagues-data';
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

const MATCHES_PER_PAGE = 20;

/**
 * Generates the full list of 16,384 participants for the global cup.
 */
export function getGlobalCupParticipants(realPlayers: any[], seasonNumber: number) {
  const allPyramidTeams: any[] = [];
  // Build foundation from existing pyramid groups (511 groups * 8 teams = 4088)
  for (let lvl = 1; lvl <= 9; lvl++) {
    const groupsInDiv = Math.pow(2, lvl - 1);
    for (let g = 1; g <= groupsInDiv; g++) {
      const realInGroup = realPlayers.filter(p => Number(p.leagueLevel) === lvl && Number(p.groupId) === g);
      const groupTeams = [];
      realInGroup.forEach(p => {
        if (p.displayName && p.displayName !== "Unknown Commander") {
          groupTeams.push({ id: p.id, name: p.displayName, isPlayer: true });
        }
      });
      const botsNeeded = Math.max(0, 8 - groupTeams.length);
      for (let i = 0; i < botsNeeded; i++) {
        const botIdNum = (lvl * 1000) + (g * 10) + i + 1000;
        groupTeams.push({ id: `bot${botIdNum}`, name: `bot${botIdNum}`, isPlayer: false });
      }
      allPyramidTeams.push(...groupTeams.slice(0, 8));
    }
  }

  const TOTAL_SLOTS = 16384;
  const qualifiersNeeded = TOTAL_SLOTS - allPyramidTeams.length;
  
  // Fill the rest with Qualifier Bots
  const qualifierBots = Array.from({ length: qualifiersNeeded }).map((_, i) => ({
    id: `qual_bot_${i + 10000}`,
    name: `qual_bot_${i + 10000}`,
    isPlayer: false
  }));

  const fullList = [...allPyramidTeams, ...qualifierBots];
  fullList.sort((a, b) => a.id.localeCompare(b.id));

  // Deterministic shuffle
  const seed = seasonNumber * 999;
  const shuffled = [...fullList];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = (seed + i) % (i + 1);
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  return shuffled;
}

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
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRound, setSelectedRound] = useState<number | null>(null);
  const [cupPage, setCupPage] = useState(0);

  useEffect(() => {
    if (!isUserLoading && !user) {
      router.push('/auth/login');
    }
  }, [user, isUserLoading, router]);

  const userRef = useMemoFirebase(() => user ? doc(db, 'players_v5', user.uid) : null, [db, user]);
  const { data: profile } = useDoc(userRef);

  const allLeaguePlayersQuery = useMemoFirebase(() => {
    if (!profile?.selectedLeagueId) return null;
    return query(collection(db, 'players_v5'), where('selectedLeagueId', '==', profile.selectedLeagueId));
  }, [db, profile?.selectedLeagueId]);

  const { data: allLeaguePlayers, isLoading: isLeaguePlayersLoading } = useCollection(allLeaguePlayersQuery);

  const league = useMemo(() => LEAGUES.find(l => l.id === profile?.selectedLeagueId) || LEAGUES[0], [profile?.selectedLeagueId]);
  const isTodayPlayed = useMemo(() => lastLeagueMatchDate === getMoscowDateString(), [lastLeagueMatchDate]);

  const cupParticipants = useMemo(() => {
    if (!isLoaded || !allLeaguePlayers) return [];
    return getGlobalCupParticipants(allLeaguePlayers, seasonNumber);
  }, [isLoaded, allLeaguePlayers, seasonNumber]);

  // Winner cache to speed up recursion
  const winnersCache = useRef<Map<string, any>>(new Map());

  const getWinnerOfBranch = (startIndex: number, round: number): any => {
    const key = `${startIndex}-${round}`;
    if (winnersCache.current.has(key)) return winnersCache.current.get(key);
    
    if (round === 0) return cupParticipants[startIndex];
    
    const step = Math.pow(2, round - 1);
    const h = getWinnerOfBranch(startIndex, round - 1);
    const a = getWinnerOfBranch(startIndex + step, round - 1);
    
    // Deterministic match result for bots/others
    const [scoreH, scoreA] = getMatchResult(h.id, a.id, round);
    const winner = scoreH >= scoreA ? h : a; 
    
    winnersCache.current.set(key, winner);
    return winner;
  };

  const currentRoundIdx = Math.min(13, Math.max(0, seasonDay - 1));
  const activeRoundToShow = selectedRound !== null ? selectedRound : currentRoundIdx;

  const cupMatches = useMemo(() => {
    if (cupParticipants.length === 0) return [];
    winnersCache.current.clear();
    
    const round = activeRoundToShow + 1; // 1-indexed
    const step = Math.pow(2, round - 1);
    const participantsPerMatch = Math.pow(2, round);
    const totalMatches = 16384 / participantsPerMatch;
    
    const matches = [];
    for (let m = 0; m < totalMatches; m++) {
      const matchStartIdx = m * participantsPerMatch;
      const h = getWinnerOfBranch(matchStartIdx, round - 1);
      const a = getWinnerOfBranch(matchStartIdx + step, round - 1);
      
      if (!h || !a) continue;

      const isMyMatch = h.id === user?.uid || a.id === user?.uid;
      const [scoreH, scoreA] = getMatchResult(h.id, a.id, round);
      const isPlayed = round <= currentRoundIdx || (round === currentRoundIdx + 1 && isTodayPlayed);

      const matchData = {
        id: `match-${round}-${m}`,
        home: h,
        away: a,
        isPlayed,
        scoreH,
        scoreA,
        isMyMatch
      };

      if (searchQuery.trim().length > 2) {
        if (h.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
            a.name.toLowerCase().includes(searchQuery.toLowerCase())) {
          matches.push(matchData);
        }
      } else {
        matches.push(matchData);
      }
    }
    return matches;
  }, [cupParticipants, activeRoundToShow, searchQuery, user?.uid, currentRoundIdx, isTodayPlayed]);

  const paginatedMatches = useMemo(() => {
    const start = cupPage * MATCHES_PER_PAGE;
    return cupMatches.slice(start, start + MATCHES_PER_PAGE);
  }, [cupMatches, cupPage]);

  const totalPages = Math.ceil(cupMatches.length / MATCHES_PER_PAGE);

  const labels = {
    en: {
      title: "TOURNAMENT TABLES",
      rounds: [
        "1/8192 Round", "1/4096 Round", "1/2048 Round", "1/1024 Round", 
        "1/512 Round", "1/256 Round", "1/128 Round", "1/64 Round", 
        "1/32 Round", "1/16 Round", "1/8 Round", "Quarter-Finals", 
        "Semi-Finals", "Grand Final"
      ],
      bracketTitle: "Global Bracket Review",
      searchPlaceholder: "Search team...",
      remainingTeams: "Teams remaining",
      roundLabel: "Tournament Stage",
      statusInGame: "ACTIVE IN CUP",
      statusOut: "ELIMINATED",
      tabs: {
        my_league: { label: "My League", desc: "Group standings", icon: Trophy },
        my_pyramid: { label: "My Pyramid", desc: "Live global hierarchy", icon: LayoutDashboard },
        pyramid_cup: { label: "Pyramid Cup", desc: "Global knockout system", icon: Target }
      }
    },
    ru: {
      title: "ТУРНИРНЫЕ ТАБЛИЦЫ",
      rounds: [
        "Раунд 1/8192", "Раунд 1/4096", "Раунд 1/2048", "Раунд 1/1024", 
        "Раунд 1/512", "Раунд 1/256", "Раунд 1/128", "1/64 финала", 
        "1/32 финала", "1/16 финала", "1/8 финала", "Четвертьфинал", 
        "Полуфинал", "Гранд Финал"
      ],
      bracketTitle: "Обзор всех пар турнира",
      searchPlaceholder: "Поиск по названию...",
      remainingTeams: "Команд в игре",
      roundLabel: "Стадия турнира",
      statusInGame: "В ИГРЕ",
      statusOut: "ВЫБЫЛ",
      tabs: {
        my_league: { label: "Своя лига", desc: "Рейтинг группы", icon: Trophy },
        my_pyramid: { label: "Своя пирамида", desc: "Глобальная иерархия", icon: LayoutDashboard },
        pyramid_cup: { label: "Кубок пирамиды", desc: "Турнир на вылет", icon: Target }
      }
    }
  };

  const t = labels[language as keyof typeof labels] || labels.ru;
  const cupTime = getPyramidCupTime(league.startTime);

  if (isUserLoading || !isLoaded || !user) return <LoadingScreen />;

  const renderRankingTable = (rankingsData: any[]) => (
    <div className="space-y-2 animate-in fade-in duration-300">
      <div className="flex items-center px-4 text-[9px] uppercase font-black text-muted-foreground/50 mb-1 tracking-widest">
        <div className="w-8">#</div>
        <div className="flex-1">Operational ID</div>
        <div className="w-16 text-center">W-D-L</div>
        <div className="w-12 text-right">Pts</div>
      </div>
      {rankingsData.map((entry, i) => (
        <div key={entry.id} className={cn(
          "flex items-center gap-3 p-3 rounded-xl border transition-all", 
          entry.isMe ? "bg-primary/20 border-primary/50 shadow-[0_0_15px_rgba(var(--primary),0.1)]" : "bg-secondary/20 border-white/5"
        )}>
          <div className="w-6 text-center font-black text-xs">
            {i < 3 ? <Medal className={cn("w-4 h-4 mx-auto", i === 0 ? "text-yellow-500" : i === 1 ? "text-slate-400" : "text-amber-600")} /> : i + 1}
          </div>
          <div className="flex-1 truncate">
            <span className={cn("font-bold text-[11px] uppercase flex items-center gap-2", entry.isMe ? "text-white" : "text-muted-foreground")}>
              {entry.name}
              {entry.isPlayer && !entry.isMe && <Badge variant="outline" className="text-[7px] h-4 px-1.5 border-accent/40 text-accent font-black bg-accent/5">USER</Badge>}
            </span>
          </div>
          <div className="w-16 text-center text-[9px] font-mono font-bold opacity-50">{entry.wins}-{entry.draws}-{entry.losses}</div>
          <div className="w-10 text-right"><p className={cn("text-sm font-headline font-black italic", entry.points > 0 ? "text-accent" : "text-muted-foreground")}>{entry.points}</p></div>
        </div>
      ))}
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
                  <span className="text-[10px] uppercase font-black text-accent tracking-[0.2em]">Bo2 Format</span>
                  <span className="text-xs font-mono font-bold text-primary flex items-center gap-2 mt-2 bg-primary/10 px-2 py-1 rounded-md w-fit">
                    <Clock className="w-3.5 h-3.5" /> {league.startTime} MSK
                  </span>
                </div>
                <Badge variant="outline" className={cn("text-[10px] font-black px-3 py-1 border-white/10 uppercase tracking-widest", isTodayPlayed ? "bg-green-500/20 border-green-500/30 text-green-400" : "bg-primary/10 text-primary border-primary/20")}>
                  {seasonDay === 0 ? 'Season Tomorrow' : (isTodayPlayed ? 'Match Done' : 'Waiting...')}
                </Badge>
              </CardContent>
            </Card>
            {isLeaguePlayersLoading ? (
              <div className="py-20 text-center opacity-50"><Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" /></div>
            ) : renderRankingTable(getMockGroupTeams(rank, profile?.displayName || "My Team", leagueLevel, divisionSubId, groupId, profile?.selectedLeagueId || "ALPHA", allLeaguePlayers?.filter(p => p.leagueLevel === leagueLevel && p.groupId === groupId) || [], user?.uid, isTodayPlayed ? seasonDay : Math.max(0, seasonDay - 1)))}
          </div>
        );

      case 'pyramid_cup':
        return (
          <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500 pb-10">
            <Card className="glass-card bg-gradient-to-br from-accent/10 to-transparent border-accent/20 overflow-hidden">
              <CardContent className="p-6 flex flex-col items-center text-center">
                <div className="relative mb-4">
                  <div className="w-20 h-20 rounded-full bg-secondary/50 border-2 border-accent flex items-center justify-center shadow-[0_0_20px_rgba(var(--accent),0.2)]">
                    <Target className="w-10 h-10 text-accent" />
                  </div>
                </div>
                <h2 className="text-2xl font-headline font-bold uppercase tracking-tight text-white">{t.tabs.pyramid_cup.label}</h2>
                <div className="flex items-center gap-2 mt-2">
                  <Badge className="bg-primary text-white uppercase text-[8px] font-black">{t.roundLabel}</Badge>
                  <span className="text-[10px] text-muted-foreground uppercase font-bold">{t.rounds[activeRoundToShow]}</span>
                </div>
                <div className="w-full grid grid-cols-2 gap-3 mt-8">
                  <div className="bg-background/50 p-3 rounded-xl border border-white/5 text-center">
                    <p className="text-[8px] text-muted-foreground uppercase font-bold mb-1">{t.remainingTeams}</p>
                    <p className="text-xs font-bold text-primary">{Math.pow(2, 14 - activeRoundToShow)}</p>
                  </div>
                  <div className="bg-background/50 p-3 rounded-xl border border-white/5 text-center">
                    <p className="text-[8px] text-muted-foreground uppercase font-bold mb-1">Season Day</p>
                    <p className="text-xs font-bold text-accent">{seasonDay} / 14</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="space-y-4">
              <div className="px-1 flex flex-col gap-4">
                <h3 className="text-xs font-black uppercase tracking-[0.2em] text-accent flex items-center gap-2 px-1">
                  <Swords className="w-4 h-4" /> {t.bracketTitle}
                </h3>
                
                {/* Round Switcher */}
                <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                  {t.rounds.map((r, i) => (
                    <Button 
                      key={i} 
                      variant="outline" 
                      onClick={() => { setSelectedRound(i); setCupPage(0); }}
                      className={cn(
                        "h-8 px-3 text-[8px] font-black uppercase whitespace-nowrap border-white/5",
                        activeRoundToShow === i ? "bg-accent text-accent-foreground border-accent" : "bg-secondary/30 text-muted-foreground"
                      )}
                    >
                      {r}
                    </Button>
                  ))}
                </div>

                <Input 
                  placeholder={t.searchPlaceholder}
                  value={searchQuery}
                  onChange={(e) => { setSearchQuery(e.target.value); setCupPage(0); }}
                  className="bg-secondary/50 border-white/10 h-10 text-xs focus-visible:ring-accent"
                />
              </div>

              {isLeaguePlayersLoading ? (
                <div className="py-10 text-center opacity-50"><Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" /></div>
              ) : (
                <div className="space-y-3">
                  {paginatedMatches.map((pair) => (
                    <Card key={pair.id} className={cn(
                      "glass-card border-white/5 overflow-hidden transition-all",
                      pair.isMyMatch && "border-accent/30 ring-1 ring-accent/10 bg-accent/5"
                    )}>
                      <CardContent className="p-3 flex items-center justify-between gap-4">
                        <div className="flex-1 min-w-0 space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 min-w-0">
                              <div className={cn("w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0", pair.isMyMatch && "animate-pulse")} />
                              <span className={cn("text-[10px] font-bold uppercase truncate", pair.isMyMatch && pair.home.id === user?.uid && "text-accent")}>{pair.home.name}</span>
                              {pair.home.isPlayer && <Badge className="text-[6px] h-3 px-1 py-0 bg-primary/20 text-primary border-primary/20">USER</Badge>}
                            </div>
                            {pair.isPlayed && <span className="text-xs font-headline font-black text-white">{pair.scoreH}</span>}
                          </div>
                          <div className="flex items-center gap-2 px-1 opacity-20"><div className="h-px flex-1 bg-white" /><span className="text-[7px] font-black uppercase">VS</span><div className="h-px flex-1 bg-white" /></div>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 min-w-0">
                              <div className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" />
                              <span className={cn("text-[10px] font-bold uppercase truncate opacity-80", pair.isMyMatch && pair.away.id === user?.uid && "text-accent")}>{pair.away.name}</span>
                              {pair.away.isPlayer && <Badge className="text-[6px] h-3 px-1 py-0 bg-primary/20 text-primary border-primary/20">USER</Badge>}
                            </div>
                            {pair.isPlayed && <span className="text-xs font-headline font-black text-white">{pair.scoreA}</span>}
                          </div>
                        </div>
                        <div className="w-20 flex flex-col items-center justify-center border-l border-white/5 pl-2 gap-1 text-center shrink-0">
                          {pair.isPlayed ? (
                            <><CheckCircle2 className="w-4 h-4 text-green-400" /><span className="text-[7px] font-black uppercase text-green-400">FINISH</span></>
                          ) : (
                            <><Timer className="w-4 h-4 text-accent animate-pulse" /><span className="text-[7px] font-black uppercase text-accent leading-none">WAITING</span><span className="text-[8px] font-mono font-bold text-primary mt-0.5">{cupTime}</span></>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}

                  {/* Pagination Controls */}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-center gap-2 pt-4">
                      <Button variant="ghost" size="icon" disabled={cupPage === 0} onClick={() => setCupPage(0)} className="h-8 w-8"><ChevronsLeft className="w-4 h-4" /></Button>
                      <Button variant="ghost" size="icon" disabled={cupPage === 0} onClick={() => setCupPage(p => p - 1)} className="h-8 w-8"><ChevronLeftIcon className="w-4 h-4" /></Button>
                      <span className="text-[10px] font-bold text-muted-foreground uppercase px-4">Page {cupPage + 1} / {totalPages}</span>
                      <Button variant="ghost" size="icon" disabled={cupPage >= totalPages - 1} onClick={() => setCupPage(p => p + 1)} className="h-8 w-8"><ChevronRightIcon className="w-4 h-4" /></Button>
                      <Button variant="ghost" size="icon" disabled={cupPage >= totalPages - 1} onClick={() => setCupPage(totalPages - 1)} className="h-8 w-8"><ChevronsRight className="w-4 h-4" /></Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        );

      case 'my_pyramid':
        if (viewingGroup) {
          return (
            <div className="space-y-6 animate-in slide-in-from-bottom-2 duration-500 pb-10">
              <div className="flex items-center justify-between px-1">
                <Button variant="ghost" size="sm" onClick={() => setViewingGroup(null)} className="h-8 text-[10px] font-black uppercase tracking-widest text-primary hover:bg-primary/10">
                  <ChevronLeft className="w-3 h-3 mr-1" /> Back
                </Button>
                <Badge className="bg-accent text-accent-foreground text-[10px] font-black tracking-widest uppercase">
                  DIV {viewingGroup.div} | GROUP {viewingGroup.group}
                </Badge>
              </div>
              {isLeaguePlayersLoading ? (
                <div className="py-20 text-center opacity-50"><Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" /></div>
              ) : (
                renderRankingTable(getMockGroupTeams(1000, "Manager", viewingGroup.div, 1, viewingGroup.group, profile?.selectedLeagueId || "ALPHA", allLeaguePlayers?.filter(p => p.leagueLevel === viewingGroup.div && p.groupId === viewingGroup.group) || [], user?.uid, isTodayPlayed ? seasonDay : Math.max(0, seasonDay - 1)))
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
                  <ChevronLeft className="w-3 h-3 mr-1" /> Back
                </Button>
                <h2 className="text-sm font-headline font-bold uppercase text-accent">Division {selectedPyramidDiv}</h2>
              </div>
              <div className="grid grid-cols-4 gap-2">
                {Array.from({ length: groupCount }).map((_, i) => {
                  const gNum = i + 1;
                  const isMine = leagueLevel === selectedPyramidDiv && groupId === gNum;
                  return (
                    <Card key={gNum} className={cn("border-white/5 cursor-pointer transition-all hover:scale-105", isMine ? "bg-primary/20 border-primary/50" : "bg-secondary/30")} onClick={() => setViewingGroup({ div: selectedPyramidDiv, group: gNum })}>
                      <CardContent className="p-3 text-center">
                        <p className={cn("text-[10px] font-black uppercase tracking-tighter", isMine ? "text-primary" : "text-muted-foreground/60")}>#{gNum}</p>
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
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((div) => (
              <Card key={div} className={cn("glass-card border-white/5 hover:bg-white/5 cursor-pointer transition-all", leagueLevel === div && "border-primary/30 bg-primary/5")} onClick={() => setSelectedPyramidDiv(div)}>
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center font-headline font-black text-xl", leagueLevel === div ? "bg-primary text-primary-foreground" : "bg-secondary/50 text-muted-foreground/40")}>{div}</div>
                    <div><h3 className="text-sm font-black uppercase">Division {div}</h3><p className="text-[9px] text-muted-foreground font-black uppercase tracking-widest mt-1">{Math.pow(2, div - 1)} GROUPS</p></div>
                  </div>
                  {leagueLevel === div && <Badge className="text-[8px] uppercase font-black bg-primary">YOU ARE HERE</Badge>}
                </CardContent>
              </Card>
            ))}
          </div>
        );

      default: return null;
    }
  };

  if (activeTab === 'menu') {
    return (
      <div className="max-w-md mx-auto px-4 pt-8 pb-20">
        <header className="mb-8 flex items-center gap-4">
          <Link href="/"><Button variant="ghost" size="icon" className="rounded-full"><ChevronLeft className="w-6 h-6" /></Button></Link>
          <div className="flex-1"><h1 className="text-2xl font-headline font-black flex items-center gap-3 uppercase tracking-tighter"><Trophy className="text-yellow-500 w-6 h-6" /> {t.title}</h1><p className="text-muted-foreground text-[10px] uppercase tracking-widest opacity-50">Operational Hierarchy</p></div>
        </header>
        <div className="grid grid-cols-2 gap-3 mb-8">
          <Card className="glass-card bg-primary/5 border-primary/10"><CardContent className="p-4 flex items-center gap-4"><div className="p-2 rounded-lg bg-primary/20"><Calendar className="w-5 h-5 text-primary" /></div><div><p className="text-[9px] uppercase text-muted-foreground font-black tracking-widest">Season Day</p><p className="text-xl font-headline font-black italic">{seasonDay} / 14</p></div></CardContent></Card>
          <Card className="glass-card bg-accent/5 border-accent/10"><CardContent className="p-4 flex items-center gap-4"><div className="p-2 rounded-lg bg-accent/20"><Trophy className="w-5 h-5 text-accent" /></div><div><p className="text-[9px] uppercase text-muted-foreground font-black tracking-widest">Active Season</p><p className="text-sm font-headline font-black italic text-accent">#{seasonNumber}</p></div></CardContent></Card>
        </div>
        <div className="space-y-2">
          {(Object.entries(t.tabs) as [RankingTab, any][]).map(([tabId, tabData]) => (
            <Card key={tabId} className="glass-card hover:bg-white/5 transition-all cursor-pointer border-white/5" onClick={() => setActiveTab(tabId)}>
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-4"><div className="p-3 rounded-xl bg-secondary/50 border border-white/5"><tabData.icon className="w-5 h-5 text-primary" /></div><div><h3 className="text-sm font-black uppercase tracking-tight">{tabData.label}</h3><p className="text-[10px] text-muted-foreground font-medium opacity-70">{tabData.desc}</p></div></div>
                <ChevronRight className="w-5 h-5 text-muted-foreground/30" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto px-4 pt-8 pb-20">
      <header className="mb-8 flex items-center gap-4">
        <Button variant="ghost" size="icon" className="rounded-full" onClick={() => { if (viewingGroup) setViewingGroup(null); else if (selectedPyramidDiv) setSelectedPyramidDiv(null); else setActiveTab('menu'); }}><ChevronLeft className="w-6 h-6" /></Button>
        <div className="flex-1"><h1 className="text-xl font-headline font-black uppercase tracking-tight">{t.tabs[activeTab as keyof typeof t.tabs].label}</h1><p className="text-muted-foreground text-[10px] uppercase tracking-widest opacity-50">OPERATIONAL DATA | DIV {leagueLevel}.{divisionSubId}</p></div>
      </header>
      {renderContent()}
    </div>
  );
}
