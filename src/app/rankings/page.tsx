'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useGameState } from '../lib/store';
import { 
  Trophy, Medal, ChevronLeft, Swords, ChevronRight,
  LayoutDashboard, Loader2, Target, Timer, ChevronsLeft, ChevronsRight,
  ChevronLeft as ChevronLeftIcon, ChevronRight as ChevronRightIcon,
  Skull, Crosshair, FileText, ArrowUp, ArrowDown
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import Link from 'next/link';
import { getMockGroupTeams, getMatchResult } from '../lib/leagues-data';
import { Badge } from '@/components/ui/badge';
import { useUser, useFirestore, useDoc, useCollection, useMemoFirebase } from '@/firebase';
import { doc, collection, query, where, limit } from 'firebase/firestore';
import { getMoscowTime } from '../lib/time-utils';
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

type RankingTab = 'menu' | 'my_league' | 'my_pyramid' | 'pyramid_cup';
const MATCHES_PER_PAGE = 20;

export default function RankingsPage() {
  const { user } = useUser();
  const router = useRouter();
  const { 
    rank, leagueLevel, groupId, isLoaded, language, 
    lastLeagueMatchDate, seasonDay, seasonNumber, matchHistory, selectedLeagueId, displayName
  } = useGameState();
  const db = useFirestore();
  
  const [activeTab, setActiveTab] = useState<RankingTab>('menu');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRound, setSelectedRound] = useState<number | null>(null);
  const [cupPage, setCupPage] = useState(0);
  const [viewingMatch, setViewingMatch] = useState<any | null>(null);

  // Discover all players in the current group hierarchy
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

  // League-specific matches for the Cup
  const leagueMatchesQuery = useMemoFirebase(() => {
    if (activeTab !== 'pyramid_cup' || !selectedLeagueId) return null;
    return query(collection(db, 'leagues', selectedLeagueId, 'cups', seasonNumber.toString(), 'matches'), limit(500));
  }, [db, activeTab, selectedLeagueId, seasonNumber]);

  const { data: leagueCupMatches } = useCollection(leagueMatchesQuery);

  const effectiveDayForCup = useMemo(() => {
    const mskNow = getMoscowTime();
    return mskNow.getHours() >= 7 ? seasonDay : Math.max(0, seasonDay - 1);
  }, [seasonDay]);

  const activeRoundToShow = selectedRound !== null ? selectedRound : Math.min(13, effectiveDayForCup === 0 ? 0 : effectiveDayForCup - 1);

  const cupMatches = useMemo(() => {
    if (!isLoaded || !allLeaguePlayers) return [];
    const participants = getGlobalCupParticipants(allLeaguePlayers, seasonNumber);
    const winnersCache = new Map<string, CupParticipant | null>();
    const round = activeRoundToShow + 1;
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

      if (!searchQuery || h?.name.toLowerCase().includes(searchQuery.toLowerCase()) || a?.name.toLowerCase().includes(searchQuery.toLowerCase())) {
        matches.push({ id: detMatchId, home: h, away: a, isPlayed, isMyMatch, isRealMatch: !!(h && a), scoreH: sH, scoreA: sA, round });
      }
    }
    return matches.sort((a, b) => (a.isMyMatch ? -1 : b.isMyMatch ? 1 : 0));
  }, [allLeaguePlayers, activeRoundToShow, searchQuery, user?.uid, effectiveDayForCup, leagueCupMatches, seasonNumber, isLoaded]);

  const paginatedMatches = useMemo(() => cupMatches.slice(cupPage * MATCHES_PER_PAGE, (cupPage + 1) * MATCHES_PER_PAGE), [cupMatches, cupPage]);
  const totalPages = Math.ceil(cupMatches.length / MATCHES_PER_PAGE);

  if (!isLoaded || isGroupPlayersLoading) return <LoadingScreen />;

  const t = {
    en: { title: "TOURNAMENT TABLES", my_league: "My League", my_pyramid: "My Pyramid", pyramid_cup: "Pyramid Cup", promotion: "PROMOTION", relegation: "RELEGATION" },
    ru: { title: "ТУРНИРНЫЕ ТАБЛИЦЫ", my_league: "Своя лига", my_pyramid: "Своя пирамида", pyramid_cup: "Кубок пирамиды", promotion: "ПОВЫШЕНИЕ", relegation: "ВЫЛЕТ" }
  }[language === 'ru' ? 'ru' : 'en'];

  const renderRankingTable = (data: any[]) => (
    <div className="space-y-2">
      {data.map((entry, i) => (
        <div key={entry.id} className={cn("flex items-center gap-3 p-3 rounded-xl border", entry.isMe ? "bg-primary/20 border-primary/50" : "bg-secondary/20 border-white/5")}>
          <div className="w-6 text-center font-black text-xs">{i + 1}</div>
          <div className="flex-1 truncate font-bold text-[11px] uppercase">{entry.name}</div>
          <div className="w-16 text-center text-[9px] font-mono font-bold opacity-50">{entry.wins}-{entry.losses}</div>
          <div className="w-10 text-right font-headline font-black text-accent">{entry.points}</div>
        </div>
      ))}
    </div>
  );

  return (
    <div className="max-w-md mx-auto px-4 pt-8 pb-24">
      <header className="mb-8 flex items-center gap-4">
        <Link href="/"><Button variant="ghost" size="icon" className="rounded-full"><ChevronLeft className="w-6 h-6" /></Button></Link>
        <h1 className="text-2xl font-headline font-black uppercase tracking-tighter">{t.title}</h1>
      </header>

      {activeTab === 'menu' ? (
        <div className="space-y-2">
          {['my_league', 'my_pyramid', 'pyramid_cup'].map((id) => (
            <Card key={id} className="glass-card cursor-pointer hover:bg-white/5" onClick={() => setActiveTab(id as any)}>
              <CardContent className="p-4 flex items-center justify-between">
                <span className="text-sm font-black uppercase">{(t as any)[id]}</span>
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : activeTab === 'my_league' ? (
        renderRankingTable(getMockGroupTeams(rank, displayName, leagueLevel, 1, groupId, selectedLeagueId || "ALPHA", groupPlayers || [], user?.uid, seasonDay))
      ) : activeTab === 'pyramid_cup' ? (
        <div className="space-y-6">
          <Input placeholder="Search team..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="bg-secondary/50" />
          <div className="space-y-3">
            {paginatedMatches.map((pair) => (
              <Card key={pair.id} className={cn("glass-card border-white/5", pair.isMyMatch && "border-accent/40 bg-accent/5")}>
                <CardContent className="p-3 flex items-center justify-between gap-4">
                  <div className="flex-1 space-y-1 min-w-0">
                    <p className="text-[10px] font-bold uppercase truncate">{pair.home?.name || "TBD"}</p>
                    <p className="text-[10px] font-bold uppercase truncate opacity-60">{pair.away?.name || "TBD"}</p>
                  </div>
                  <div className="text-lg font-headline font-black italic">{pair.scoreH} : {pair.scoreA}</div>
                </CardContent>
              </Card>
            ))}
            {totalPages > 1 && <div className="flex justify-center gap-4 pt-4"><Button variant="ghost" size="sm" onClick={() => setCupPage(p => Math.max(0, p-1))}><ChevronLeftIcon /></Button><span className="text-xs font-bold">{cupPage+1}/{totalPages}</span><Button variant="ghost" size="sm" onClick={() => setCupPage(p => Math.min(totalPages-1, p+1))}><ChevronRightIcon /></Button></div>}
          </div>
        </div>
      ) : (
        <div className="py-20 text-center opacity-30 uppercase font-black">Hierarchy data syncing...</div>
      )}
    </div>
  );
}
