'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useGameState } from '../lib/store';
import { 
  Trophy, Medal, ChevronLeft, Award, 
  Users, Shield, Star, Swords, ChevronRight,
  LayoutDashboard, Loader2, Clock, Calendar,
  Search, Radio, Target, Zap, ShieldAlert,
  CheckCircle2, Timer, ChevronsLeft, ChevronsRight,
  ChevronLeft as ChevronLeftIcon, ChevronRight as ChevronRightIcon,
  Skull, Crosshair, FileText, ArrowRight, ArrowUp, ArrowDown
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
import { getMoscowDateString, getPyramidCupTime, getMoscowTime } from '../lib/time-utils';
import { LoadingScreen } from '@/components/game/LoadingScreen';
import { getGlobalCupParticipants, getWinnerOfBranch, CupParticipant, getEntryRound } from '../lib/cup-utils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

type RankingTab = 
  | 'menu'
  | 'my_league' 
  | 'my_pyramid' 
  | 'pyramid_cup';

const MATCHES_PER_PAGE = 20;

export default function RankingsPage() {
  const { user, isUserLoading } = useUser();
  const router = useRouter();
  const { 
    rank, leagueLevel, divisionSubId, groupId, isLoaded, language, 
    lastLeagueMatchDate, lastCupMatchDate, seasonDay, seasonNumber, matchHistory
  } = useGameState();
  const db = useFirestore();
  
  const [activeTab, setActiveTab] = useState<RankingTab>('menu');
  const [selectedPyramidDiv, setSelectedPyramidDiv] = useState<number | null>(null);
  const [viewingGroup, setViewingGroup] = useState<{ div: number, group: number } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRound, setSelectedRound] = useState<number | null>(null);
  const [cupPage, setCupPage] = useState(0);
  const [viewingMatch, setViewingMatch] = useState<any | null>(null);

  useEffect(() => {
    if (!isUserLoading && !user) {
      router.push('/auth/register');
    }
  }, [user, isUserLoading, router]);

  // Standardized on players_v10
  const userRef = useMemoFirebase(() => user ? doc(db, 'players_v10', user.uid) : null, [db, user]);
  const { data: profile } = useDoc(userRef);

  const allLeaguePlayersQuery = useMemoFirebase(() => {
    if (!profile?.selectedLeagueId) return null;
    return query(collection(db, 'players_v10'), where('selectedLeagueId', '==', profile.selectedLeagueId));
  }, [db, profile?.selectedLeagueId]);

  const { data: allLeaguePlayers, isLoading: isLeaguePlayersLoading } = useCollection(allLeaguePlayersQuery);

  const league = useMemo(() => LEAGUES.find(l => l.id === profile?.selectedLeagueId) || LEAGUES[0], [profile?.selectedLeagueId]);
  const isTodayPlayed = useMemo(() => lastLeagueMatchDate === getMoscowDateString(), [lastLeagueMatchDate]);
  
  const winnersCache = useRef<Map<string, CupParticipant | null>>(new Map());

  const cupParticipants = useMemo(() => {
    if (!isLoaded || !allLeaguePlayers) return [];
    return getGlobalCupParticipants(allLeaguePlayers, seasonNumber);
  }, [isLoaded, allLeaguePlayers, seasonNumber]);

  const effectiveDayForCup = useMemo(() => {
    const mskNow = getMoscowTime();
    const isCupPassedToday = mskNow.getHours() >= 7;
    return isCupPassedToday ? seasonDay : Math.max(0, seasonDay - 1);
  }, [seasonDay]);

  const activeRoundToShow = selectedRound !== null ? selectedRound : Math.min(13, effectiveDayForCup === 0 ? 0 : effectiveDayForCup - 1);

  const cupMatches = useMemo(() => {
    if (cupParticipants.length === 0) return [];
    winnersCache.current.clear();
    
    const round = activeRoundToShow + 1;
    const participantsPerMatch = Math.pow(2, round);
    const totalMatches = 16384 / participantsPerMatch;
    const step = Math.pow(2, round - 1);
    
    const matches = [];
    for (let m = 0; m < totalMatches; m++) {
      const matchStartIdx = m * participantsPerMatch;
      const h = getWinnerOfBranch(cupParticipants, round - 1, matchStartIdx, winnersCache.current, effectiveDayForCup);
      const a = getWinnerOfBranch(cupParticipants, round - 1, matchStartIdx + step, winnersCache.current, effectiveDayForCup);
      
      if (!h && !a && round > 1) {
        if (searchQuery.length < 3 && round < 8) continue;
      }

      const isMyMatch = h?.id === user?.uid || a?.id === user?.uid;
      const isPlayed = round <= effectiveDayForCup;
      
      let isRealMatch = false;
      if (h && a) {
        const hEntry = getEntryRound(h.level);
        const aEntry = getEntryRound(a.level);
        isRealMatch = round > hEntry && round > aEntry;
      }

      let sH = 0;
      let sA = 0;

      if (isPlayed && isMyMatch) {
        const historical = matchHistory.find(match => 
          match.type === 'cup' && 
          match.day === round && 
          match.seasonNumber === seasonNumber
        );

        if (historical) {
          sH = h?.id === user?.uid ? historical.scoreA : historical.scoreB;
          sA = a?.id === user?.uid ? historical.scoreA : historical.scoreB;
        } else if (isRealMatch && h && a) {
          [sH, sA] = getMatchResult(h.id, a.id, round, true);
        } else if (h && !a) {
          sH = 2; sA = 0;
        } else if (!h && a) {
          sH = 0; sA = 2;
        }
      } else if (isPlayed && isRealMatch && h && a) {
        [sH, sA] = getMatchResult(h.id, a.id, round, true);
      } else if (isPlayed && h && !a) {
        sH = 2; sA = 0;
      } else if (isPlayed && !h && a) {
        sH = 0; sA = 2;
      }

      const matchData = {
        id: `match-${round}-${m}`,
        home: h,
        away: a,
        isPlayed,
        isMyMatch,
        isRealMatch,
        scoreH: sH,
        scoreA: sA,
        round
      };

      if (searchQuery.trim().length > 2) {
        if (h?.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
            a?.name.toLowerCase().includes(searchQuery.toLowerCase())) {
          matches.push(matchData);
        }
      } else {
        matches.push(matchData);
      }
    }
    
    return matches.sort((a, b) => (a.isMyMatch ? -1 : b.isMyMatch ? 1 : 0));
  }, [cupParticipants, activeRoundToShow, searchQuery, user?.uid, effectiveDayForCup, matchHistory, seasonNumber]);

  const paginatedMatches = useMemo(() => {
    const start = cupPage * MATCHES_PER_PAGE;
    return cupMatches.slice(start, start + MATCHES_PER_PAGE);
  }, [cupMatches, cupPage]);

  const totalPages = Math.ceil(cupMatches.length / MATCHES_PER_PAGE);

  const labels = {
    en: {
      title: "TOURNAMENT TABLES",
      rounds: [
        "Round 1", "Round 2", "Round 3", "Round 4", 
        "Round 5", "Round 6", "Round 7", "Round 8", 
        "Round 9", "Round 10", "Round 11", "Quarter-Finals", 
        "Semi-Finals", "Grand Final"
      ],
      bracketTitle: "Global Bracket Review",
      searchPlaceholder: "Search team...",
      remainingTeams: "Teams in game",
      roundLabel: "Tournament Stage",
      seeded: "SEEDED / WAITING",
      tbd: "TBD (AWAITING ROUND)",
      reportTitle: "MATCH DOSSIER",
      reportDesc: "Tactical data reconstruction for",
      summary: "Strategic Summary",
      noRealReport: "Seeded progressions do not have tactical reports.",
      close: "CLOSE REPORT",
      victory: "VICTORY",
      defeat: "DEFEAT",
      draw: "DRAW",
      promotion: "PROMOTION",
      relegation: "RELEGATION",
      clubName: "Club Name",
      wdl: "W-D-L",
      pointsShort: "Pts",
      tabs: {
        my_league: { label: "My League", desc: "Group standings", icon: Trophy },
        my_pyramid: { label: "My Pyramid", desc: "Live global hierarchy", icon: LayoutDashboard },
        pyramid_cup: { label: "Pyramid Cup", desc: "Global knockout system", icon: Target }
      }
    },
    ru: {
      title: "ТУРНИРНЫЕ ТАБЛИЦЫ",
      rounds: [
        "Раунд 1", "Раунд 2", "Раунд 3", "Раунд 4", 
        "Раунд 5", "Раунд 6", "Раунд 7", "Раунд 8", 
        "Раунд 9", "Раунд 10", "Раунд 11", "Четвертьфинал", 
        "Полуфинал", "Гранд Финал"
      ],
      bracketTitle: "Обзор всех пар турнира",
      searchPlaceholder: "Поиск по названию...",
      remainingTeams: "Команд в игре",
      roundLabel: "Стадия турнира",
      seeded: "ПОСЕВ / ОЖИДАНИЕ",
      tbd: "TBD (ОЖИДАНИЕ РАУНДА)",
      reportTitle: "ОТЧЕТ О МАТЧЕ",
      reportDesc: "Реконструкция тактических данных для",
      summary: "Сводка стратегий",
      noRealReport: "Стадии посева не содержат тактических отчетов.",
      close: "ЗАКРЫТЬ ОТЧЕТ",
      victory: "ПОБЕДА",
      defeat: "ПОРАЖЕНИЕ",
      draw: "НИЧЬЯ",
      promotion: "ПОВЫШЕНИЕ",
      relegation: "ВЫЛЕТ",
      clubName: "Название клуба",
      wdl: "В-Н-П",
      pointsShort: "Очк",
      tabs: {
        my_league: { label: "Своя лига", desc: "Рейтинг группы", icon: Trophy },
        my_pyramid: { label: "Своя пирамида", desc: "Глобальная иерархия", icon: LayoutDashboard },
        pyramid_cup: { label: "Кубок пирамиды", desc: "Турнир на вылет", icon: Target }
      }
    }
  };

  const t = labels[language as keyof typeof labels] || labels.ru;

  const handleOpenReport = (match: any) => {
    if (!match.isPlayed || !match.isRealMatch) return;
    setViewingMatch(match);
  };

  const getMatchSummary = (match: any) => {
    const historical = matchHistory.find(m => m.type === 'cup' && m.day === match.round && m.seasonNumber === seasonNumber);
    if (historical) return historical.matchSummary;

    const summaries = [
      "Superior map control allowed for a decisive victory.",
      "The mid-lane dominance paved the way for late-game scaling.",
      "Crucial dragon steals turned the tide of the engagement.",
      "A series of well-coordinated ganks caught the opposition off-guard.",
      "Defensive positioning and objective focus secured the result.",
      "Aggressive early game pressure led to an unstoppable snowball."
    ];
    const seed = (match.home?.id.length || 0) + (match.away?.id.length || 0) + match.round;
    return summaries[seed % summaries.length];
  };

  if (isUserLoading || !isLoaded || !user) return <LoadingScreen />;

  const renderRankingTable = (rankingsData: any[]) => (
    <div className="space-y-2 animate-in fade-in duration-300">
      <div className="flex items-center px-4 text-[9px] uppercase font-black text-muted-foreground/50 mb-1 tracking-widest">
        <div className="w-8">#</div>
        <div className="flex-1">{t.clubName}</div>
        <div className="w-16 text-center">{t.wdl}</div>
        <div className="w-12 text-right">{t.pointsShort}</div>
      </div>
      {rankingsData.map((entry, i) => {
        const isPromotion = i === 0;
        const isRelegation = i === 6 || i === 7;

        return (
          <div key={entry.id} className={cn(
            "flex items-center gap-3 p-3 rounded-xl border transition-all relative overflow-hidden", 
            entry.isMe ? "bg-primary/20 border-primary/50 shadow-[0_0_15px_rgba(var(--primary),0.1)]" : "bg-secondary/20 border-white/5",
            isPromotion && !entry.isMe && "border-green-500/20 bg-green-500/5",
            isRelegation && !entry.isMe && "border-red-500/20 bg-red-500/5"
          )}>
            <div className="w-6 text-center font-black text-xs flex flex-col items-center justify-center gap-0.5">
              {i + 1}
              {isPromotion && <ArrowUp className="w-3 h-3 text-green-500 animate-bounce" />}
              {isRelegation && <ArrowDown className="w-3 h-3 text-red-500 animate-bounce" />}
            </div>
            <div className="flex-1 truncate">
              <span className={cn("font-bold text-[11px] uppercase flex items-center gap-2", entry.isMe ? "text-white" : "text-muted-foreground")}>
                {entry.name}
                {entry.isPlayer && !entry.isMe && <Badge variant="outline" className="text-[7px] h-4 px-1.5 border-accent/40 text-accent font-black bg-accent/5">USER</Badge>}
                {isPromotion && <span className="text-[6px] font-black text-green-500/60 tracking-tighter">{t.promotion}</span>}
                {isRelegation && <span className="text-[6px] font-black text-red-500/60 tracking-tighter">{t.relegation}</span>}
              </span>
            </div>
            <div className="w-16 text-center text-[9px] font-mono font-bold opacity-50">{entry.wins}-{entry.draws || 0}-{entry.losses}</div>
            <div className="w-10 text-right"><p className={cn("text-sm font-headline font-black italic", entry.points > 0 ? "text-accent" : "text-muted-foreground")}>{entry.points}</p></div>
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
            {isLeaguePlayersLoading ? (
              <div className="py-20 text-center opacity-50"><Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" /></div>
            ) : renderRankingTable(getMockGroupTeams(rank, profile?.displayName || "My Team", leagueLevel, divisionSubId, groupId, profile?.selectedLeagueId || "ALPHA", allLeaguePlayers?.filter(p => Number(p.leagueLevel) === leagueLevel && Number(p.groupId) === groupId) || [], user?.uid, isTodayPlayed ? seasonDay : Math.max(0, seasonDay - 1)))}
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
                
                <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                  {t.rounds.map((r, i) => {
                    const isFuture = i > (effectiveDayForCup === 0 ? 0 : effectiveDayForCup - 1);
                    return (
                      <Button 
                        key={i} 
                        variant="outline" 
                        onClick={() => { setSelectedRound(i); setCupPage(0); }}
                        className={cn(
                          "h-8 px-3 text-[8px] font-black uppercase whitespace-nowrap border-white/5",
                          activeRoundToShow === i ? "bg-accent text-accent-foreground border-accent" : "bg-secondary/30 text-muted-foreground",
                          isFuture && "opacity-50 grayscale"
                        )}
                      >
                        {r}
                      </Button>
                    );
                  })}
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
                    <Card 
                      key={pair.id} 
                      className={cn(
                        "glass-card border-white/5 overflow-hidden transition-all group",
                        pair.isMyMatch && "border-accent/30 ring-1 ring-accent/10 bg-accent/5",
                        pair.isPlayed && pair.isRealMatch && "cursor-pointer hover:bg-white/5"
                      )}
                      onClick={() => handleOpenReport(pair)}
                    >
                      <CardContent className="p-3 flex items-center justify-between gap-4">
                        <div className="flex-1 min-w-0 space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 min-w-0">
                              <div className={cn("w-1.5 h-1.5 rounded-full shrink-0", pair.home ? "bg-blue-400" : "bg-muted-foreground/30", pair.isMyMatch && pair.home?.id === user?.uid && "animate-pulse")} />
                              <span className={cn("text-[10px] font-bold uppercase truncate", pair.isMyMatch && pair.home?.id === user?.uid ? "text-accent" : (pair.home ? "text-white" : "text-muted-foreground/40"))}>
                                {pair.home ? pair.home.name : t.tbd}
                              </span>
                              {pair.home && <Badge variant="outline" className="text-[6px] h-3 px-1 py-0 border-white/10 opacity-60">DIV {pair.home.level}</Badge>}
                              {pair.home?.isPlayer && <Badge className="text-[6px] h-3 px-1 py-0 bg-primary/20 text-primary border-primary/20">USER</Badge>}
                            </div>
                          </div>
                          
                          {pair.isRealMatch ? (
                            <div className="flex items-center gap-2 px-1 opacity-20"><div className="h-px flex-1 bg-white" /><span className="text-[7px] font-black uppercase">VS</span><div className="h-px flex-1 bg-white" /></div>
                          ) : (
                            <div className="flex items-center gap-2 px-1 opacity-10"><div className="h-px flex-1 border-t border-dashed border-white" /></div>
                          )}

                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 min-w-0">
                              <div className={cn("w-1.5 h-1.5 rounded-full shrink-0", pair.away ? "bg-red-400" : "bg-muted-foreground/30")} />
                              <span className={cn("text-[10px] font-bold uppercase truncate opacity-80", pair.isMyMatch && pair.away?.id === user?.uid ? "text-accent" : (pair.away ? "text-white" : "text-muted-foreground/40"))}>
                                {pair.away ? pair.away.name : t.tbd}
                              </span>
                              {pair.away && <Badge variant="outline" className="text-[7px] h-3 px-1 py-0 border-white/10 opacity-60">DIV {pair.away.level}</Badge>}
                              {pair.away?.isPlayer && <Badge className="text-[6px] h-3 px-1 py-0 bg-primary/20 text-primary border-primary/20">USER</Badge>}
                            </div>
                          </div>
                        </div>
                        <div className="w-24 flex flex-col items-center justify-center border-l border-white/5 pl-2 gap-1 text-center shrink-0">
                          {pair.isPlayed && pair.isRealMatch && pair.home && pair.away ? (
                            <div className="flex flex-col items-center gap-1">
                              <div className="flex items-center gap-1.5 text-lg font-headline font-black italic">
                                <span className={cn(pair.scoreH > pair.scoreA ? "text-primary" : "text-muted-foreground")}>{pair.scoreH}</span>
                                <span className="text-[10px] text-muted-foreground opacity-30">:</span>
                                <span className={cn(pair.scoreA > pair.scoreH ? "text-primary" : "text-muted-foreground")}>{pair.scoreA}</span>
                              </div>
                              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <FileText className="w-2.5 h-2.5 text-accent" />
                                <span className="text-[7px] font-black uppercase text-accent">REPORT</span>
                              </div>
                            </div>
                          ) : (pair.isPlayed && (pair.home || pair.away)) ? (
                            <div className="flex flex-col items-center opacity-40">
                              <Zap className="w-4 h-4 text-muted-foreground" />
                              <span className="text-[6px] font-black uppercase mt-1">SEEDED ENTRY</span>
                            </div>
                          ) : (
                            <><Timer className="w-4 h-4 text-accent animate-pulse" /><span className="text-[7px] font-black uppercase text-accent leading-none">WAITING</span><span className="text-[8px] font-mono font-bold text-primary mt-0.5">07:00</span></>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}

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
                renderRankingTable(getMockGroupTeams(1000, "Manager", viewingGroup.div, 1, viewingGroup.group, profile?.selectedLeagueId || "ALPHA", allLeaguePlayers?.filter(p => Number(p.leagueLevel) === viewingGroup.div && Number(p.groupId) === viewingGroup.group) || [], user?.uid, isTodayPlayed ? seasonDay : Math.max(0, seasonDay - 1)))
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

      <Dialog open={!!viewingMatch} onOpenChange={() => setViewingMatch(null)}>
        <DialogContent className="max-w-md p-0 overflow-hidden bg-background border-white/10 shadow-2xl">
          {viewingMatch && (
            <>
              <div className={cn(
                "p-8 text-center border-b border-white/5",
                viewingMatch.scoreH > viewingMatch.scoreA ? "bg-primary/10" : (viewingMatch.scoreH === viewingMatch.scoreA ? "bg-accent/10" : "bg-destructive/10")
              )}>
                <div className="mx-auto w-16 h-16 rounded-full bg-secondary/50 flex items-center justify-center mb-4 border-2 border-primary shadow-[0_0_20px_rgba(var(--primary),0.3)]">
                  <Trophy className="w-8 h-8 text-primary" />
                </div>
                <DialogTitle className="text-2xl font-headline font-bold uppercase tracking-tight text-white">
                  {viewingMatch.scoreH > viewingMatch.scoreA ? t.victory : (viewingMatch.scoreH === viewingMatch.scoreA ? t.draw : t.defeat)}
                </DialogTitle>
                <DialogDescription className="text-[10px] text-muted-foreground mt-2 uppercase tracking-widest font-bold">
                  {t.reportDesc} {t.rounds[viewingMatch.round - 1]}
                </DialogDescription>
                
                <div className="flex items-center justify-center gap-6 mt-6">
                  <div className="text-right flex-1 min-w-0">
                    <p className={cn("text-xs font-bold uppercase truncate", viewingMatch.scoreH > viewingMatch.scoreA ? "text-primary" : "text-muted-foreground")}>{viewingMatch.home?.name || t.seeded}</p>
                    <p className="text-3xl font-headline font-black italic">{viewingMatch.scoreH}</p>
                  </div>
                  <div className="text-2xl font-headline font-bold opacity-20">:</div>
                  <div className="text-left flex-1 min-w-0">
                    <p className={cn("text-xs font-bold uppercase truncate", viewingMatch.scoreA > viewingMatch.scoreH ? "text-primary" : "text-muted-foreground")}>{viewingMatch.away?.name || t.seeded}</p>
                    <p className="text-3xl font-headline font-black italic">{viewingMatch.scoreA}</p>
                  </div>
                </div>
              </div>

              <div className="p-6 space-y-6">
                {!viewingMatch.isRealMatch ? (
                  <p className="text-xs text-center text-muted-foreground italic">{t.noRealReport}</p>
                ) : (
                  <>
                    <div className="space-y-2">
                      <h3 className="text-[10px] font-black text-accent uppercase tracking-widest flex items-center gap-2">
                        <FileText className="w-3 h-3" /> {t.summary}
                      </h3>
                      <p className="text-sm leading-relaxed text-muted-foreground italic bg-secondary/20 p-4 rounded-xl border border-white/5">
                        "{getMatchSummary(viewingMatch)}"
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <Card className="bg-secondary/20 border-white/5">
                        <CardContent className="p-4 flex flex-col items-center">
                          <Skull className="w-5 h-5 text-red-400 mb-2" />
                          <span className="text-xl font-bold">{10 * (viewingMatch.scoreH + viewingMatch.scoreA) + (viewingMatch.scoreH * 5)}</span>
                          <span className="text-[8px] text-muted-foreground uppercase font-bold">Kills</span>
                        </CardContent>
                      </Card>
                      <Card className="bg-secondary/20 border-white/5">
                        <CardContent className="p-4 flex flex-col items-center">
                          <Crosshair className="w-5 h-5 text-blue-400 mb-2" />
                          <span className="text-xl font-bold">{viewingMatch.scoreH === 2 ? 11 : 7}</span>
                          <span className="text-[8px] text-muted-foreground uppercase font-bold">Towers</span>
                        </CardContent>
                      </Card>
                    </div>
                  </>
                )}
              </div>

              <DialogFooter className="p-4 bg-secondary/20 border-t border-white/5">
                <Button 
                  className="w-full h-12 hero-gradient font-bold uppercase text-xs tracking-widest" 
                  onClick={() => setViewingMatch(null)}
                >
                  {t.close}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
