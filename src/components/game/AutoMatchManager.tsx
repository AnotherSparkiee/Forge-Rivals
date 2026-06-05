
'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useGameState } from '@/app/lib/store';
import { useUser, useFirestore, useDoc, useCollection, useMemoFirebase } from '@/firebase';
import { doc, collection, query, where } from 'firebase/firestore';
import { isMatchDue, getGlobalSeasonInfo, getMoscowTime, getMoscowDateString } from '@/app/lib/time-utils';
import { getMockGroupTeams, getSchedule, LEAGUES, getMatchResult } from '@/app/lib/leagues-data';
import { getRandomStartingSquad } from '@/app/lib/moba-data';
import { simulateMobaMatch } from '@/ai/flows/simulate-moba-match';
import { 
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Zap, ArrowRight, FileText, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getGlobalCupParticipants, getWinnerOfBranch, CupParticipant, getEntryRound } from '@/app/lib/cup-utils';
import { useRouter } from 'next/navigation';

export function AutoMatchManager() {
  const { 
    isLoaded, language, leagueLevel, divisionSubId, groupId, 
    seasonDay, seasonNumber, lastLeagueMatchDate, lastCupMatchDate, recordMatch, strategy, rank, seasonStartDate,
    markMatchAsSeen, matchHistory, seasonResults, dismissSeasonResults, setSyncing, ownedHeroes, lineup,
    lastProcessedSeason
  } = useGameState();
  const { user, isUserLoading } = useUser();
  const db = useFirestore();
  const router = useRouter();
  
  const [isSimulating, setIsSimulating] = useState(false);
  const [showResultDialog, setShowResultDialog] = useState(false);
  const [currentResult, setCurrentResult] = useState<any | null>(null);
  
  const simulationLockRef = useRef(false);
  const winnersCache = useRef<Map<string, CupParticipant | null>>(new Map());

  const userRef = useMemoFirebase(() => user ? doc(db, 'players_v10', user.uid) : null, [db, user]);
  const { data: profile } = useDoc(userRef);

  const groupQuery = useMemoFirebase(() => {
    if (!profile?.selectedLeagueId || !user?.uid) return null;
    return query(
      collection(db, 'players_v10'),
      where('selectedLeagueId', '==', profile.selectedLeagueId),
      where('leagueLevel', '==', profile.leagueLevel),
      where('groupId', '==', profile.groupId)
    );
  }, [db, profile?.selectedLeagueId, profile?.leagueLevel, profile?.groupId, user?.uid]);

  const { data: groupPlayers } = useCollection(groupQuery);

  const allLeaguePlayersQuery = useMemoFirebase(() => {
    if (!profile?.selectedLeagueId || !user?.uid) return null;
    return query(
      collection(db, 'players_v10'),
      where('selectedLeagueId', '==', profile.selectedLeagueId)
    );
  }, [db, profile?.selectedLeagueId, user?.uid]);

  const { data: allLeaguePlayers } = useCollection(allLeaguePlayersQuery);

  const simulateOneLeagueMatch = useCallback(async (targetSeason: number, targetDay: number, isCatchUp: boolean) => {
    if (!groupPlayers || !user || !profile || simulationLockRef.current) return;
    
    const detId = `league_S${targetSeason}_D${targetDay}`;
    const alreadyRecorded = matchHistory.some(m => m.id === detId);
    if (alreadyRecorded) return;

    simulationLockRef.current = true;
    setIsSimulating(true);
    setSyncing(true);
    
    try {
      const groupTeams = getMockGroupTeams(rank, profile.displayName || "My Team", leagueLevel, divisionSubId, groupId, profile.selectedLeagueId || "ALPHA", groupPlayers || [], user.uid, 0);
      const schedule = getSchedule(groupTeams);
      const targetMatch = schedule[targetDay - 1]?.find((m: any) => m.home.id === user.uid || m.away.id === user.uid);
      
      if (!targetMatch) throw new Error("No match scheduled");
      
      const opponent = targetMatch.home.id === user.uid ? targetMatch.away : targetMatch.home;
      const [detScoreH, detScoreA] = getMatchResult(targetMatch.home.id, targetMatch.away.id, targetDay, false);
      
      const forcedScoreA = targetMatch.home.id === user.uid ? detScoreH : detScoreA;
      const forcedScoreB = targetMatch.away.id === user.uid ? detScoreH : detScoreA;
      
      const squad = ownedHeroes.filter(h => Object.values(lineup).includes(h.id)).map(h => ({
        name: h.name, role: h.role, overallRating: h.overallRating, proStats: h.proStats,
        isSub: h.id === lineup.sub1 || h.id === lineup.sub2
      }));

      const botSquad = getRandomStartingSquad().map((h, i) => ({
        name: `${h.name} AI`, role: h.role, overallRating: h.overallRating, proStats: h.proStats,
        isSub: i > 4
      }));

      const result = await simulateMobaMatch({
        teamA: { name: profile.displayName || "My Team", strategy, heroes: squad },
        teamB: { name: opponent.name || "Opponent", strategy: "Advanced Tactics", heroes: botSquad },
        isBo2: true,
        scoreA: forcedScoreA, 
        scoreB: forcedScoreB
      });

      if (result && result.winner) {
        let customPlayedAt = undefined;
        if (isCatchUp && seasonStartDate) {
          const d = new Date(seasonStartDate);
          d.setDate(d.getDate() + (targetDay - 1));
          customPlayedAt = d.toISOString();
        }

        const canonicalWinner = forcedScoreA > forcedScoreB ? (profile.displayName || "Manager") : (forcedScoreA < forcedScoreB ? (opponent.name || "Opponent") : "Draw");
        recordMatch(canonicalWinner, { ...result, scoreA: forcedScoreA, scoreB: forcedScoreB }, targetDay, opponent.name || "Opponent", 'league', customPlayedAt, detId);
        
        if (!isCatchUp) {
          setCurrentResult({ ...result, id: detId, day: targetDay, opponentName: opponent.name, type: 'league', scoreA: forcedScoreA, scoreB: forcedScoreB });
          setShowResultDialog(true);
        }
      }
    } catch (e: any) {
      console.error("League Simulation failed", e);
    } finally {
      setIsSimulating(false);
      simulationLockRef.current = false;
      setSyncing(false);
    }
  }, [groupPlayers, user, profile, strategy, rank, leagueLevel, divisionSubId, groupId, ownedHeroes, lineup, seasonStartDate, recordMatch, setSyncing, matchHistory]);

  const simulateOneCupMatch = useCallback(async (targetSeason: number, targetDay: number, isCatchUp: boolean) => {
    if (!user || !profile || !allLeaguePlayers || simulationLockRef.current) return;
    
    const detId = `cup_S${targetSeason}_D${targetDay}`;
    const alreadyRecorded = matchHistory.some(m => m.id === detId);
    if (alreadyRecorded) return;

    simulationLockRef.current = true;
    setIsSimulating(true);
    setSyncing(true);
    
    try {
      const participants = getGlobalCupParticipants(allLeaguePlayers, targetSeason);
      const myIdx = participants.findIndex(p => p?.id === user.uid);
      if (myIdx === -1) return;

      const entryRound = getEntryRound(profile.leagueLevel);
      if (targetDay <= entryRound) {
        const seededResult = {
          scoreA: 2, scoreB: 0, winner: profile.displayName || "Manager",
          matchSummary: "Seeded progression.", teamStats: { teamA: { kills: 0, towersDestroyed: 0 }, teamB: { kills: 0, towersDestroyed: 0 } },
          heroPerformance: [], preview: null, timeline: [], postMatch: null
        };
        recordMatch(seededResult.winner, seededResult, targetDay, "SEEDED", 'cup', undefined, detId);
        return;
      }

      winnersCache.current.clear();
      const step = Math.pow(2, targetDay - 1);
      const myBranchStart = Math.floor(myIdx / step) * step;
      const oppBranchStart = myBranchStart ^ step;
      const opponent = getWinnerOfBranch(participants, targetDay - 1, oppBranchStart, winnersCache.current, targetDay - 1);
      
      if (!opponent) {
        const waitResult = {
          scoreA: 2, scoreB: 0, winner: profile.displayName || "Manager",
          matchSummary: "Automatic progression.", teamStats: { teamA: { kills: 0, towersDestroyed: 0 }, teamB: { kills: 0, towersDestroyed: 0 } },
          heroPerformance: [], preview: null, timeline: [], postMatch: null
        };
        recordMatch(waitResult.winner, waitResult, targetDay, "WAITING", 'cup', undefined, detId);
        return;
      }

      const [forcedA, forcedB] = getMatchResult(user.uid, opponent.id, targetDay, true);
      const squad = ownedHeroes.filter(h => Object.values(lineup).includes(h.id)).map(h => ({
        name: h.name, role: h.role, overallRating: h.overallRating, proStats: h.proStats,
        isSub: h.id === lineup.sub1 || h.id === lineup.sub2
      }));

      const botSquad = getRandomStartingSquad().map((h, i) => ({
        name: `${h.name} AI`, role: h.role, overallRating: h.overallRating, proStats: h.proStats,
        isSub: i > 4
      }));

      const result = await simulateMobaMatch({
        teamA: { name: profile.displayName || "Manager", strategy, heroes: squad },
        teamB: { name: opponent.name, strategy: "Tournament Execution", heroes: botSquad },
        isBo2: false, isBo3: true, scoreA: forcedA, scoreB: forcedB
      });
      
      if (result && result.winner) {
        const canonicalWinner = forcedA > forcedB ? (profile.displayName || "Manager") : (forcedA < forcedB ? opponent.name : "Draw");
        recordMatch(canonicalWinner, { ...result, scoreA: forcedA, scoreB: forcedB }, targetDay, opponent.name, 'cup', undefined, detId);
        
        if (!isCatchUp) {
          setCurrentResult({ ...result, id: detId, day: targetDay, opponentName: opponent.name, type: 'cup', scoreA: forcedA, scoreB: forcedB }); 
          setShowResultDialog(true); 
        }
      }
    } catch (e: any) {
      console.error("Cup simulation failed", e);
    } finally {
      setIsSimulating(false);
      simulationLockRef.current = false;
      setSyncing(false);
    }
  }, [allLeaguePlayers, user, profile, strategy, ownedHeroes, lineup, recordMatch, setSyncing, matchHistory]);

  useEffect(() => {
    if (!isLoaded || isUserLoading || isSimulating || !profile?.selectedLeagueId || !user) return;

    const findAndSimulateNext = async () => {
      if (lastProcessedSeason > 0 && lastProcessedSeason < seasonNumber) {
        for (let d = 1; d <= 14; d++) {
          const detId = `league_S${lastProcessedSeason}_D${d}`;
          const existing = matchHistory.find(m => m.id === detId);
          if (!existing || existing.preview === undefined) {
            await simulateOneLeagueMatch(lastProcessedSeason, d, true);
            return; 
          }
        }
      }

      if (seasonDay > 0 && seasonDay <= 14) {
        const league = LEAGUES.find(l => l.id === profile.selectedLeagueId);
        const leagueTime = league?.startTime || '23:00';
        const cupTime = "07:00";

        for (let d = 1; d <= seasonDay; d++) {
          const lId = `league_S${seasonNumber}_D${d}`;
          const lMatch = matchHistory.find(m => m.id === lId);
          const lDue = (d < seasonDay) || isMatchDue(leagueTime, lastLeagueMatchDate);
          const isFadedWaiting = lMatch?.opponentName === 'WAITING' && d < seasonDay;

          if ((lDue && (!lMatch || lMatch.preview === undefined)) || isFadedWaiting) {
            await simulateOneLeagueMatch(seasonNumber, d, d < seasonDay);
            return; 
          }

          const cId = `cup_S${seasonNumber}_D${d}`;
          const cMatch = matchHistory.find(m => m.id === cId);
          const cDue = (d < seasonDay) || isMatchDue(cupTime, lastCupMatchDate);
          
          const eliminated = matchHistory.some(m => 
            (m.type === 'cup' || m.type === 'tournament') && 
            m.seasonNumber === seasonNumber && 
            m.day < d && 
            m.opponentName !== 'SEEDED' && 
            m.opponentName !== 'WAITING' &&
            m.scoreA < m.scoreB
          );
          
          const isCupWaiting = cMatch?.opponentName === 'WAITING' && (d < seasonDay || isMatchDue(cupTime, null));

          if (!eliminated && cDue && (!cMatch || cMatch.preview === undefined || isCupWaiting)) {
            await simulateOneCupMatch(seasonNumber, d, d < seasonDay);
            return; 
          }
        }
      }
    };

    const timer = setTimeout(findAndSimulateNext, 2500);
    return () => clearTimeout(timer);
  }, [isLoaded, isUserLoading, isSimulating, seasonDay, seasonNumber, lastProcessedSeason, matchHistory, profile?.selectedLeagueId, lastLeagueMatchDate, lastCupMatchDate, simulateOneLeagueMatch, simulateOneCupMatch, user]);

  const handleGoToReport = () => {
    setShowResultDialog(false);
    const targetId = currentResult?.id;
    if (currentResult && currentResult.type === 'league') markMatchAsSeen(currentResult.day);
    if (targetId) router.push(`/match?id=${targetId}`);
  };

  const t = { 
    congrats: language === 'ru' ? 'СЕЗОН ЗАВЕРШЕН!' : 'SEASON COMPLETE!', 
    pos: language === 'ru' ? 'Ваше место:' : 'Your Place:', 
    pts: language === 'ru' ? 'Набрано очков:' : 'Points Scored:', 
    next: language === 'ru' ? 'СЛЕДУЮЩИЙ СЕЗОН' : 'NEXT SEASON',
    alert: language === 'ru' ? 'ТАКТИЧЕСКАЯ СВОДКА' : 'TACTICAL ALERT',
    proceed: language === 'ru' ? 'ПЕРЕЙТИ К ОТЧЕТУ' : 'PROCEED TO REPORT',
    desc: language === 'ru' ? 'Технический отчет о столкновении расшифрован и готов к изучению.' : 'Technical after-action report decrypted and ready for evaluation.'
  };

  return (
    <>
      <Dialog open={showResultDialog} onOpenChange={setShowResultDialog}>
        <DialogContent className="max-w-sm bg-card border-white/10 p-0 overflow-hidden shadow-2xl">
          <div className="p-6 text-center bg-gradient-to-br from-primary/20 via-background to-accent/10 border-b border-white/5">
            <div className="mx-auto w-16 h-16 rounded-full bg-secondary/50 flex items-center justify-center mb-4 border-2 border-primary shadow-[0_0_20px_rgba(var(--primary),0.3)]">
              <Zap className="w-8 h-8 text-primary animate-pulse" />
            </div>
            <DialogTitle className="text-xl font-headline font-bold uppercase tracking-tight text-primary">{t.alert}</DialogTitle>
          </div>
          <div className="p-6 space-y-4">
            <div className="bg-secondary/30 rounded-xl border border-white/5 p-4 flex items-center gap-4">
              <div className="p-2 rounded-lg bg-primary/20"><FileText className="w-5 h-5 text-primary" /></div>
              <p className="text-xs leading-relaxed text-muted-foreground italic">"{t.desc}"</p>
            </div>
          </div>
          <DialogFooter className="p-4 bg-secondary/20 border-t border-white/5">
            <Button className="w-full h-12 hero-gradient font-bold uppercase text-xs tracking-widest" onClick={handleGoToReport}>
              <ArrowRight className="w-4 h-4 mr-2" /> {t.proceed}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!seasonResults} onOpenChange={(open) => !open && dismissSeasonResults()}>
        <DialogContent className="max-md p-0 overflow-hidden bg-background border-white/10 shadow-2xl">
          <div className="p-8 text-center bg-gradient-to-br from-primary/20 via-background to-accent/10 border-b border-white/5">
            <DialogTitle className="text-2xl font-headline font-bold uppercase tracking-tight text-primary">{t.congrats}</DialogTitle>
          </div>
          <div className="p-8 space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-secondary/30 p-4 rounded-xl border border-white/5 text-center">
                <p className="text-[10px] uppercase font-bold text-muted-foreground mb-1">{t.pos}</p>
                <p className="text-3xl font-headline font-bold text-accent">{seasonResults?.lastRank}</p>
              </div>
              <div className="bg-secondary/30 p-4 rounded-xl border border-white/5 text-center">
                <p className="text-[10px] uppercase font-bold text-muted-foreground mb-1">{t.pts}</p>
                <p className="text-3xl font-headline font-bold text-primary">{seasonResults?.lastPoints}</p>
              </div>
            </div>
          </div>
          <DialogFooter className="p-6 bg-secondary/20 border-t border-white/5">
            <Button className="w-full h-14 hero-gradient font-bold uppercase text-xs" onClick={dismissSeasonResults}>{t.next}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
