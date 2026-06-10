
'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useGameState } from '@/app/lib/store';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { doc, collection, query, where, getDoc } from 'firebase/firestore';
import { isMatchDue, getGlobalSeasonInfo, getMoscowDateString } from '@/app/lib/time-utils';
import { getMockGroupTeams, getSchedule, LEAGUES, getMatchResult } from '@/app/lib/leagues-data';
import { generateBotSquad } from '@/app/lib/moba-data';
import { simulateMobaMatch } from '@/ai/flows/simulate-moba-match';
import { 
  Dialog, DialogContent, DialogTitle
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';

export function AutoMatchManager() {
  const { 
    isLoaded, leagueLevel, groupId, 
    seasonDay, seasonNumber, lastLeagueMatchDate, lastCupMatchDate, recordMatch, recordMatchGlobal, strategy, rank, 
    matchHistory, setSyncing, ownedHeroes, lineup,
    selectedLeagueId, displayName
  } = useGameState();
  const { user } = useUser();
  const db = useFirestore();
  const router = useRouter();
  
  const [isSimulating, setIsSimulating] = useState(false);
  const [showResultDialog, setShowResultDialog] = useState(false);
  const [currentResult, setCurrentResult] = useState<any | null>(null);
  const simulationLockRef = useRef(false);

  const playersQuery = useMemoFirebase(() => {
    if (!selectedLeagueId) return null;
    return query(collection(db, 'players_v10'), where('selectedLeagueId', '==', selectedLeagueId));
  }, [db, selectedLeagueId]);

  const { data: allPlayers } = useCollection(playersQuery);

  const simulateOneLeagueMatch = useCallback(async (targetSeason: number, targetDay: number, isCatchUp: boolean) => {
    if (!allPlayers || !user || !selectedLeagueId || simulationLockRef.current) return;
    
    const groupTeams = getMockGroupTeams(rank, displayName, leagueLevel, 1, groupId, selectedLeagueId, allPlayers || [], user.uid, 0);
    const schedule = getSchedule(groupTeams);
    const dayMatches = schedule[targetDay - 1];
    if (!dayMatches) return;

    simulationLockRef.current = true;
    setIsSimulating(true);
    setSyncing(true);
    
    try {
      for (const match of dayMatches) {
        const isMyMatch = match.home.id === user.uid || match.away.id === user.uid;
        const matchId = `league_S${targetSeason}_D${targetDay}_${match.home.id}_${match.away.id}`;
        
        const globalRef = doc(db, 'leagues_v2', selectedLeagueId, 'matches', matchId);
        const globalSnap = await getDoc(globalRef);
        
        if (globalSnap.exists()) {
          const gData = globalSnap.data();
          if (isMyMatch) {
             const alreadyRecorded = matchHistory.some(m => m.id === matchId);
             if (!alreadyRecorded) recordMatch(gData.winnerId, gData, targetDay, gData.awayId, 'league', gData.playedAt, matchId, targetSeason);
          }
          continue;
        }

        const [detScoreH, detScoreA] = getMatchResult(match.home.id, match.away.id, targetDay, false);
        const playedAt = new Date().toISOString();

        if (isMyMatch) {
          const squad = ownedHeroes.filter(h => Object.values(lineup).includes(h.id)).map(h => ({ name: h.name, role: h.role, overallRating: h.overallRating, proStats: h.proStats, isSub: false }));
          const botSquad = generateBotSquad(25);

          const result = await simulateMobaMatch({
            teamA: { name: displayName, strategy, heroes: squad },
            teamB: { name: (match.home.id === user.uid ? match.away.name : match.home.name), strategy: "Balanced Play", heroes: botSquad },
            isBo2: true, scoreA: match.home.id === user.uid ? detScoreH : detScoreA, scoreB: match.away.id === user.uid ? detScoreH : detScoreA
          });

          if (result) {
            const res = { ...result.games[0], scoreA: match.home.id === user.uid ? detScoreH : detScoreA, scoreB: match.away.id === user.uid ? detScoreH : detScoreA };
            recordMatch(result.winner, res, targetDay, (match.home.id === user.uid ? match.away.name : match.home.name), 'league', playedAt, matchId, targetSeason);
            if (!isCatchUp) { setCurrentResult({ ...res, id: matchId, day: targetDay, opponentName: (match.home.id === user.uid ? match.away.name : match.home.name), type: 'league' }); setShowResultDialog(true); }
          }
        } else {
          recordMatchGlobal({ id: matchId, season: targetSeason, day: targetDay, type: 'league', homeId: match.home.id, awayId: match.away.id, scoreA: detScoreH, scoreB: detScoreA, winnerId: detScoreH > detScoreA ? match.home.id : (detScoreH < detScoreA ? match.away.id : "Draw"), playedAt });
        }
      }
    } finally { setIsSimulating(false); simulationLockRef.current = false; setSyncing(false); }
  }, [allPlayers, user, selectedLeagueId, leagueLevel, groupId, displayName, strategy, rank, ownedHeroes, lineup, recordMatch, recordMatchGlobal, setSyncing, matchHistory, db]);

  useEffect(() => {
    if (!isLoaded || isSimulating || !selectedLeagueId || !user) return;
    const findNext = async () => {
      if (seasonDay > 0 && seasonDay <= 14) {
        const leagueTime = LEAGUES.find(l => l.id === selectedLeagueId)?.startTime || '23:00';
        for (let d = 1; d <= seasonDay; d++) {
          const lMatch = matchHistory.find(m => m.type === 'league' && m.day === d && m.seasonNumber === seasonNumber);
          if (isMatchDue(leagueTime, lastLeagueMatchDate) && !lMatch) { await simulateOneLeagueMatch(seasonNumber, d, d < seasonDay); return; }
        }
      }
    };
    const timer = setTimeout(findNext, 3000);
    return () => clearTimeout(timer);
  }, [isLoaded, isSimulating, seasonDay, seasonNumber, matchHistory, selectedLeagueId, lastLeagueMatchDate, simulateOneLeagueMatch, user]);

  if (!isLoaded || !user) return null;

  return (
    <Dialog open={showResultDialog} onOpenChange={setShowResultDialog}>
      <DialogContent className="max-w-sm bg-card border-white/10 p-0 overflow-hidden shadow-2xl">
        <div className="p-6 text-center bg-gradient-to-br from-primary/20 via-background to-accent/10 border-b border-white/5">
          <DialogTitle className="text-xl font-headline font-bold uppercase tracking-tight text-primary">TACTICAL ALERT</DialogTitle>
        </div>
        <div className="p-6">
           <Button className="w-full h-12 hero-gradient font-black text-xs" onClick={() => { setShowResultDialog(false); router.push(`/match?id=${currentResult?.id}`); }}>
             PROCEED TO REPORT
           </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
