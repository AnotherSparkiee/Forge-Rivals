
'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useGameState } from '../lib/store';
import { 
  Trophy, Medal, ChevronLeft, ChevronRight, 
  LayoutDashboard, Search, Crown, Shield, 
  ArrowUp, ArrowDown, Activity
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import Link from 'next/link';
import { getMockGroupTeams, getMatchResult } from '../lib/leagues-data';
import { Badge } from '@/components/ui/badge';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { doc, collection, query, where, limit } from 'firebase/firestore';
import { getMoscowTime } from '../lib/time-utils';
import { LoadingScreen } from '@/components/game/LoadingScreen';
import { getGlobalCupParticipants, getWinnerOfBranch, CupParticipant } from '../lib/cup-utils';

type RankingTab = 'menu' | 'my_league' | 'pyramid_cup';
const MATCHES_PER_PAGE = 15;

export default function RankingsPage() {
  const { user } = useUser();
  const router = useRouter();
  const { 
    rank, leagueLevel, groupId, isLoaded, language, 
    seasonDay, seasonNumber, selectedLeagueId, displayName
  } = useGameState();
  const db = useFirestore();
  
  const [activeTab, setActiveTab] = useState<RankingTab>('menu');
  const [searchQuery, setSearchQuery] = useState('');
  const [cupPage, setCupPage] = useState(0);

  // Discover all players in the current group hierarchy for the standings
  const teamsQuery = useMemoFirebase(() => {
    if (!selectedLeagueId) return null;
    return query(collection(db, 'leagues', selectedLeagueId, 'divisions', leagueLevel.toString(), 'groups', groupId.toString(), 'teams'));
  }, [db, selectedLeagueId, leagueLevel, groupId]);

  const { data: groupPlayers, isLoading: isGroupPlayersLoading } = useCollection(teamsQuery);

  // Discover all players for Cup seeding (requires root discovery collection)
  const allLeaguePlayersQuery = useMemoFirebase(() => {
    if (!selectedLeagueId) return null;
    return query(collection(db, 'players_v10'), where('selectedLeagueId', '==', selectedLeagueId));
  }, [db, selectedLeagueId]);

  const { data: allLeaguePlayers } = useCollection(allLeaguePlayersQuery);

  // Global Cup matches for the league
  const leagueCupMatchesQuery = useMemoFirebase(() => {
    if (activeTab !== 'pyramid_cup' || !selectedLeagueId) return null;
    return query(collection(db, 'leagues', selectedLeagueId, 'cups', seasonNumber.toString(), 'matches'), limit(200));
  }, [db, activeTab, selectedLeagueId, seasonNumber]);

  const { data: leagueCupMatches } = useCollection(leagueCupMatchesQuery);

  const effectiveDayForCup = useMemo(() => {
    const mskNow = getMoscowTime();
    return mskNow.getHours() >= 7 ? seasonDay : Math.max(0, seasonDay - 1);
  }, [seasonDay]);

  const groupStandings = useMemo(() => {
    if (!isLoaded || !groupPlayers) return [];
    // upToDay = seasonDay to show live standings including today's result if played
    return getMockGroupTeams(rank, displayName, leagueLevel, 1, groupId, selectedLeagueId || "ALPHA", groupPlayers, user?.uid, seasonDay);
  }, [isLoaded, groupPlayers, rank, displayName, leagueLevel, groupId, selectedLeagueId, user?.uid, seasonDay]);

  const cupMatches = useMemo(() => {
    if (!isLoaded || !allLeaguePlayers || activeTab !== 'pyramid_cup') return [];
    
    const participants = getGlobalCupParticipants(allLeaguePlayers, seasonNumber);
    const winnersCache = new Map<string, CupParticipant | null>();
    
    // We show the current round matches
    const round = Math.min(14, effectiveDayForCup === 0 ? 1 : effectiveDayForCup);
    const participantsPerMatch = Math.pow(2, round);
    const totalMatches = 16384 / participantsPerMatch;
    const step = Math.pow(2, round - 1);
    
    const matches = [];
    for (let m = 0; m < totalMatches; m++) {
      const matchStartIdx = m * participantsPerMatch;
      const h = getWinnerOfBranch(participants, round - 1, matchStartIdx, winnersCache, effectiveDayForCup);
      const a = getWinnerOfBranch(participants, round - 1, matchStartIdx + step, winnersCache, effectiveDayForCup);
      
      const detMatchId = `cup_S${seasonNumber}_R${round}_M${m}`;
      const record = leagueCupMatches?.find(gm => gm.id === detMatchId);
      const isMyMatch = h?.id === user?.uid || a?.id === user?.uid;
      const isPlayed = round <= effectiveDayForCup;

      let sH = record?.scoreA || 0;
      let sA = record?.scoreB || 0;
      if (!record && isPlayed && h && a) [sH, sA] = getMatchResult(h.id, a.id, round, true);

      const matchData = { id: detMatchId, home: h, away: a, isPlayed, isMyMatch, scoreH: sH, scoreA: sA, round };
      
      if (!searchQuery || (h?.name.toLowerCase().includes(searchQuery.toLowerCase())) || (a?.name.toLowerCase().includes(searchQuery.toLowerCase()))) {
        matches.push(matchData);
      }
    }
    // Prioritize my match at the top
    return matches.sort((a, b) => (a.isMyMatch ? -1 : b.isMyMatch ? 1 : 0));
  }, [allLeaguePlayers, effectiveDayForCup, searchQuery, user?.uid, leagueCupMatches, seasonNumber, isLoaded, activeTab]);

  const paginatedCupMatches = useMemo(() => cupMatches.slice(cupPage * MATCHES_PER_PAGE, (cupPage + 1) * MATCHES_PER_PAGE), [cupMatches, cupPage]);
  const totalCupPages = Math.ceil(cupMatches.length / MATCHES_PER_PAGE);

  if (isGroupPlayersLoading || !isLoaded) return <LoadingScreen />;

  const t = {
    en: {
      title: "TOURNAMENT TABLES",
      subtitle: "Global Ranking Terminal",
      my_league: "My League",
      pyramid_cup: "Pyramid Cup",
      promotion: "PROMOTION",
      relegation: "RELEGATION",
      pts: "PTS",
      winLoss: "W-L",
      back: "Back",
      menu: [
        { id: 'my_league', label: 'My League', desc: `Division ${leagueLevel}.${groupId}`, icon: Trophy, color: 'text-primary' },
        { id: 'pyramid_cup', label: 'Pyramid Cup', desc: 'Global knockout bracket', icon: Medal, color: 'text-accent' },
      ]
    },
    ru: {
      title: "ТУРНИРНЫЕ ТАБЛИЦЫ",
      subtitle: "Терминал глобальных рейтингов",
      my_league: "Своя лига",
      pyramid_cup: "Кубок пирамиды",
      promotion: "ПОВЫШЕНИЕ",
      relegation: "ВЫЛЕТ",
      pts: "ОЧК",
      winLoss: "В-П",
      back: "Назад",
      menu: [
        { id: 'my_league', label: 'Своя лига', desc: `Дивизион ${leagueLevel}.${groupId}`, icon: Trophy, color: 'text-primary' },
        { id: 'pyramid_cup', label: 'Кубок пирамиды', desc: 'Глобальная сетка выбывания', icon: Medal, color: 'text-accent' },
      ]
    }
  }[language as 'en' | 'ru'] || t.ru;

  const renderContent = () => {
    switch (activeTab) {
      case 'my_league':
        return (
          <div className="space-y-4 animate-in fade-in duration-500">
            <header className="flex items-center justify-between px-1">
              <h3 className="text-[10px] font-black uppercase text-accent tracking-widest flex items-center gap-2">
                <Shield className="w-3.5 h-3.5" /> DIVISION {leagueLevel}.{groupId}
              </h3>
              <Badge variant="outline" className="text-[8px] opacity-40 border-white/10 uppercase">Season {seasonNumber}</Badge>
            </header>

            <div className="space-y-1">
              <div className="grid grid-cols-[30px_1fr_60px_40px] items-center px-4 py-2 text-[8px] font-black text-muted-foreground uppercase tracking-widest">
                <span>#</span>
                <span>Team</span>
                <span className="text-center">{t.winLoss}</span>
                <span className="text-right">{t.pts}</span>
              </div>

              {groupStandings.map((entry, i) => {
                const isPromo = i < 2;
                const isRel = i >= 6;
                return (
                  <div 
                    key={entry.id} 
                    className={cn(
                      "grid grid-cols-[30px_1fr_60px_40px] items-center p-3 rounded-xl border transition-all",
                      entry.isMe ? "bg-primary/20 border-primary/40 ring-1 ring-primary/20 scale-[1.02] z-10" : "bg-secondary/20 border-white/5",
                      isPromo && !entry.isMe && "border-green-500/10",
                      isRel && !entry.isMe && "border-red-500/10 opacity-80"
                    )}
                  >
                    <div className={cn("text-xs font-black italic", isPromo ? "text-green-400" : (isRel ? "text-red-400" : "text-muted-foreground"))}>
                      {i + 1}
                    </div>
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-[11px] font-bold uppercase truncate text-white">{entry.name}</span>
                      {entry.isMe && <Badge className="text-[6px] h-3 px-1 bg-primary text-primary-foreground font-black">YOU</Badge>}
                    </div>
                    <div className="text-center font-mono text-[10px] font-bold text-muted-foreground">
                      {entry.wins}-{entry.losses}
                    </div>
                    <div className="text-right font-headline font-black text-primary italic">
                      {entry.points}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="grid grid-cols-2 gap-2 mt-4 px-1">
              <div className="flex items-center gap-2 text-[8px] font-black text-green-400 uppercase tracking-widest">
                <ArrowUp className="w-2.5 h-2.5" /> {t.promotion} (1-2)
              </div>
              <div className="flex items-center gap-2 text-[8px] font-black text-red-400 uppercase tracking-widest justify-end">
                <ArrowDown className="w-2.5 h-2.5" /> {t.relegation} (7-8)
              </div>
            </div>
          </div>
        );

      case 'pyramid_cup':
        return (
          <div className="space-y-4 animate-in fade-in duration-500 pb-10">
            <header className="space-y-3 px-1">
              <h3 className="text-[10px] font-black uppercase text-accent tracking-widest flex items-center gap-2">
                <Activity className="w-3.5 h-3.5" /> ROUND {Math.min(14, effectiveDayForCup === 0 ? 1 : effectiveDayForCup)} BRACKET
              </h3>
              <Input 
                placeholder="Search team name..." 
                value={searchQuery} 
                onChange={e => setSearchQuery(e.target.value)} 
                className="h-10 bg-secondary/50 border-white/10 text-xs focus-visible:ring-accent"
              />
            </header>

            <div className="space-y-2">
              {paginatedCupMatches.map((match) => (
                <Card key={match.id} className={cn(
                  "glass-card border-white/5 transition-all",
                  match.isMyMatch && "border-accent/40 bg-accent/5 ring-1 ring-accent/20"
                )}>
                  <CardContent className="p-3 flex items-center justify-between gap-4">
                    <div className="flex-1 space-y-1.5 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={cn(
                          "text-[10px] font-bold uppercase truncate",
                          match.home?.id === user?.uid ? "text-accent" : "text-white/80"
                        )}>
                          {match.home?.name || "TBD"}
                        </span>
                        {match.home?.id === user?.uid && <Badge className="text-[5px] h-2.5 px-0.5 bg-accent text-accent-foreground font-black">YOU</Badge>}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={cn(
                          "text-[10px] font-bold uppercase truncate",
                          match.away?.id === user?.uid ? "text-accent" : "text-white/80"
                        )}>
                          {match.away?.name || "TBD"}
                        </span>
                        {match.away?.id === user?.uid && <Badge className="text-[5px] h-2.5 px-0.5 bg-accent text-accent-foreground font-black">YOU</Badge>}
                      </div>
                    </div>
                    
                    <div className="flex flex-col items-center justify-center min-w-[45px] border-l border-white/5 pl-3 gap-1">
                      <div className="text-sm font-headline font-black italic tracking-tighter text-white">
                        {match.isPlayed ? `${match.scoreH}:${match.scoreA}` : "VS"}
                      </div>
                      {!match.isPlayed && <span className="text-[7px] font-black text-muted-foreground uppercase">STANDBY</span>}
                    </div>
                  </CardContent>
                </Card>
              ))}

              {totalCupPages > 1 && (
                <div className="flex items-center justify-center gap-4 pt-6">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    disabled={cupPage === 0} 
                    onClick={() => setCupPage(p => p - 1)}
                    className="h-8 w-8 rounded-full"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">
                    {cupPage + 1} / {totalCupPages}
                  </span>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    disabled={cupPage >= totalCupPages - 1} 
                    onClick={() => setCupPage(p => p + 1)}
                    className="h-8 w-8 rounded-full"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              )}
            </div>
          </div>
        );

      default: return null;
    }
  };

  return (
    <div className="max-w-md mx-auto px-4 pt-8 pb-24">
      <header className="mb-8 flex items-center gap-4">
        {activeTab === 'menu' ? (
          <Link href="/">
            <Button variant="ghost" size="icon" className="rounded-full shadow-lg border border-white/5">
              <ChevronLeft className="w-6 h-6" />
            </Button>
          </Link>
        ) : (
          <Button variant="ghost" size="icon" className="rounded-full shadow-lg border border-white/5" onClick={() => setActiveTab('menu')}>
            <ChevronLeft className="w-6 h-6" />
          </Button>
        )}
        <div>
          <h1 className="text-2xl font-headline font-bold uppercase tracking-tighter text-white">
            {activeTab === 'menu' ? t.title : (t as any)[activeTab]}
          </h1>
          <p className="text-muted-foreground text-[10px] uppercase tracking-widest">{activeTab === 'menu' ? t.subtitle : t.back}</p>
        </div>
      </header>

      {activeTab === 'menu' ? (
        <div className="space-y-2">
          {t.menu.map((item) => (
            <Card 
              key={item.id} 
              className="glass-card border-white/5 hover:bg-white/5 transition-all cursor-pointer group" 
              onClick={() => setActiveTab(item.id as RankingTab)}
            >
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={cn("p-2.5 rounded-xl bg-secondary/50", item.color)}>
                    <item.icon className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold uppercase group-hover:text-white transition-colors">{item.label}</h3>
                    <p className="text-[10px] text-muted-foreground leading-tight">{item.desc}</p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : renderContent()}
    </div>
  );
}
