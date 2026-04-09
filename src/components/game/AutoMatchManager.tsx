'use client';

import { useState, useEffect, useRef } from 'react';
import { useGameState } from '@/app/lib/store';
import { useUser, useFirestore, useDoc, useCollection, useMemoFirebase } from '@/firebase';
import { doc, collection, query, where } from 'firebase/firestore';
import { isMatchDue, getGlobalSeasonInfo } from '@/app/lib/time-utils';
import { getMockGroupTeams, getSchedule, LEAGUES, getMatchResult } from '@/app/lib/leagues-data';
import { getRandomStartingSquad } from '@/app/lib/moba-data';
import { simulateMobaMatch } from '@/ai/flows/simulate-moba-match';
import { 
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Zap, ArrowRight, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getGlobalCupParticipants, getWinnerOfBranch, CupParticipant, getEntryRound } from '@/app/lib/cup-utils';
import { useRouter } from 'next/navigation';

function sanitizeForFirestore(obj: any) {
  if (obj === undefined) return null;
  if (!obj) return obj;
  try {
    return JSON.parse(JSON.stringify(obj));
  } catch (e) {
    return null;
  }
}

export function AutoMatchManager() {
  const { 
    isLoaded, language, leagueLevel, divisionSubId, groupId, 
    seasonDay, seasonNumber, lastLeagueMatchDate, lastCupMatchDate, recordMatch, strategy, rank, seasonStartDate,
    markMatchAsSeen, matchHistory, seasonResults, dismissSeasonResults, setSyncing, ownedHeroes, lineup
  } = useGameState();
  const { user, isUserLoading } = useUser();
  const db = useFirestore();
  const router = useRouter();
  
  const [isSimulating, setIsSimulating] = useState(false);
  const [showResultDialog, setShowResultDialog] = useState(false);
  const [currentResult, setCurrentResult] = useState<any | null>(null);
  
  const simulationRef = useRef(false);
  const cupSimulationRef = useRef(false);
  const processedMatchesRef = useRef<Set<string>>(new Set());
  const winnersCache = useRef<Map<string, CupParticipant | null>>(new Map());

  const userRef = useMemoFirebase(() => user ? doc(db, 'players_v5', user.uid) : null, [db, user]);
  const { data: profile } = useDoc(userRef);

  const groupQuery = useMemoFirebase(() => {
    if (!profile?.selectedLeagueId) return null;
    return query(
      collection(db, 'players_v5'),
      where('selectedLeagueId', '==', profile.selectedLeagueId),
      where('leagueLevel', '==', profile.leagueLevel),
      where('groupId', '==', profile.groupId)
    );
  }, [db, profile?.selectedLeagueId, profile?.leagueLevel, profile?.groupId]);

  const { data: groupPlayers } = useCollection(groupQuery);

  const allLeaguePlayersQuery = useMemoFirebase(() => {
    if (!profile?.selectedLeagueId) return null;
    return query(
      collection(db, 'players_v5'),
      where('selectedLeagueId', '==', profile.selectedLeagueId)
    );
  }, [db, profile?.selectedLeagueId]);

  const { data: allLeaguePlayers } = useCollection(allLeaguePlayersQuery);

  const triggerAutoMatch = async (matchTime: string, targetDay: number, detId: string) => {
    if (!groupPlayers || !user || !profile || simulationRef.current || processedMatchesRef.current.has(detId)) return;
    
    const existingMatch = matchHistory.find(m => m.id === detId);
    const isIncomplete = !existingMatch || existingMatch.preview === undefined;
    if (!isIncomplete) return;

    processedMatchesRef.current.add(detId);
    simulationRef.current = true;
    setIsSimulating(true);
    setSyncing(true);
    
    try {
      const groupTeams = getMockGroupTeams(rank, profile.displayName || "My Team", leagueLevel, divisionSubId, groupId, profile.selectedLeagueId || "ALPHA", groupPlayers || [], user.uid, 0);
      const schedule = getSchedule(groupTeams);
      const todayMatch = schedule[targetDay - 1]?.find((m: any) => m.home.id === user.uid || m.away.id === user.uid);
      
      if (!todayMatch) throw new Error("No match scheduled");
      
      const opponent = todayMatch.home.id === user.uid ? todayMatch.away : todayMatch.home;
      const [detScoreA, detScoreB] = getMatchResult(todayMatch.home.id, todayMatch.away.id, targetDay, false);
      
      const forcedScoreA = todayMatch.home.id === user.uid ? detScoreA : detScoreB;
      const forcedScoreB = todayMatch.away.id === user.uid ? detScoreA : detScoreB;
      
      const squad = ownedHeroes.filter(h => Object.values(lineup).includes(h.id)).map(h => ({
        ...h,
        isSub: h.id === lineup.sub1 || h.id === lineup.sub2
      }));

      const botSquad = getRandomStartingSquad().map((h, i) => ({
        ...h,
        name: `${h.name} Bot`,
        isSub: i > 4
      }));

      const result = await simulateMobaMatch({
        teamA: { name: profile.displayName || "My Team", strategy, heroes: squad },
        teamB: { 
          name: opponent.name || "Unknown Team", 
          strategy: "Advanced Tactics", 
          heroes: botSquad
        },
        isBo2: true,
        scoreA: forcedScoreA, 
        scoreB: forcedScoreB
      });

      let customPlayedAt = undefined;
      if (targetDay < seasonDay && seasonStartDate) {
        const d = new Date(seasonStartDate);
        d.setDate(d.getDate() + (targetDay - 1));
        const [h, m] = matchTime.split(':').map(Number);
        d.setHours(h, m, 0, 0);
        customPlayedAt = d.toISOString();
      }

      recordMatch(result.winner, result, targetDay, opponent.name || "Unknown Team", 'league', customPlayedAt, detId);
      
      if (targetDay === seasonDay) {
        setCurrentResult({ ...result, id: detId, day: targetDay, opponentName: opponent.name, isCup: false });
        setShowResultDialog(true);
      }
    } catch (e: any) {
      console.error("Sim failed", e);
    } finally {
      setIsSimulating(false);
      simulationRef.current = false;
      setSyncing(false);
    }
  };

  const triggerCupMatch = async (matchTime: string, targetDay: number, detId: string) => {
    if (!user || !profile || !allLeaguePlayers || cupSimulationRef.current || processedMatchesRef.current.has(detId)) return;
    
    const existingMatch = matchHistory.find(m => m.id === detId);
    const wasWaiting = existingMatch?.opponentName === 'WAITING';
    const isIncomplete = !existingMatch || existingMatch.preview === undefined;
    
    // We only skip if match is complete AND it wasn't a WAITING match.
    // If it was WAITING, we proceed to see if an opponent is now available.
    if (existingMatch && !isIncomplete && !wasWaiting) return;

    const wasEliminated = matchHistory.some(m => m.type === 'tournament' && m.day < targetDay && m.scoreA < m.scoreB && m.seasonNumber === seasonNumber);
    if (wasEliminated) return;

    processedMatchesRef.current.add(detId);
    cupSimulationRef.current = true;
    setIsSimulating(true);
    setSyncing(true);
    
    try {
      const participants = getGlobalCupParticipants(allLeaguePlayers, seasonNumber);
      const myIdx = participants.findIndex(p => p?.id === user.uid);
      if (myIdx === -1) throw new Error("User not in cup participants");

      const entryRound = getEntryRound(profile.leagueLevel);
      if (targetDay <= entryRound) {
        const seededResult = {
          scoreA: 2, scoreB: 0, winner: profile.displayName || "Manager",
          matchSummary: "Seeded progression. No match required for this round.",
          teamStats: { teamA: { kills: 0, towersDestroyed: 0 }, teamB: { kills: 0, towersDestroyed: 0 } },
          heroPerformance: [],
          preview: null,
          timeline: [],
          postMatch: null
        };
        recordMatch(seededResult.winner, seededResult, targetDay, "SEEDED", 'tournament', undefined, detId);
        return;
      }

      winnersCache.current.clear();
      const step = Math.pow(2, targetDay - 1);
      const myBranchStart = Math.floor(myIdx / step) * step;
      const oppBranchStart = myBranchStart ^ step;
      const opponent = getWinnerOfBranch(participants, targetDay - 1, oppBranchStart, winnersCache.current, targetDay - 1);
      
      if (!opponent) {
        // If we were already waiting, don't re-record the same waiting state
        if (wasWaiting) return;
        const waitResult = {
          scoreA: 2, scoreB: 0, winner: profile.displayName || "Manager",
          matchSummary: "Waiting for qualifiers. Automatic progression.",
          teamStats: { teamA: { kills: 0, towersDestroyed: 0 }, teamB: { kills: 0, towersDestroyed: 0 } },
          heroPerformance: [],
          preview: null,
          timeline: [],
          postMatch: null
        };
        recordMatch(waitResult.winner, waitResult, targetDay, "WAITING", 'tournament', undefined, detId);
        return;
      }

      // If we got here, we HAVE an opponent! Even if we were waiting before, simulate now.
      const [forcedA, forcedB] = getMatchResult(user.uid, opponent.id, targetDay, true);
      const squad = ownedHeroes.filter(h => Object.values(lineup).includes(h.id)).map(h => ({
        ...h,
        isSub: h.id === lineup.sub1 || h.id === lineup.sub2
      }));

      const botSquad = getRandomStartingSquad().map((h, i) => ({
        ...h,
        name: `${h.name} Cup AI`,
        isSub: i > 4
      }));

      const result = await simulateMobaMatch({
        teamA: { name: profile.displayName || "My Team", strategy, heroes: squad },
        teamB: { 
          name: opponent.name, 
          strategy: "Tournament Execution", 
          heroes: botSquad
        },
        isBo2: false,
        isBo3: true,
        scoreA: forcedA,
        scoreB: forcedB
      });
      
      let customPlayedAt = undefined;
      if (targetDay < seasonDay && seasonStartDate) {
        const d = new Date(seasonStartDate);
        d.setDate(d.getDate() + (targetDay - 1));
        const [h, m] = matchTime.split(':').map(Number);
        d.setHours(h, m, 0, 0); 
        customPlayedAt = d.toISOString();
      }

      recordMatch(result.winner, result, targetDay, opponent.name, 'tournament', customPlayedAt, detId);
      
      if (targetDay === seasonDay) { 
        setCurrentResult({ ...result, id: detId, day: targetDay, opponentName: opponent.name, isCup: true }); 
        setShowResultDialog(true); 
      }
    } catch (e: any) {
      console.error("Cup Sim failed", e);
    } finally {
      setIsSimulating(false);
      cupSimulationRef.current = false;
      setSyncing(false);
    }
  };

  useEffect(() => {
    if (isLoaded && seasonDay > 0 && seasonDay <= 14 && !isSimulating && !isUserLoading && profile?.selectedLeagueId && groupPlayers && user) {
      const league = LEAGUES.find(l => l.id === profile.selectedLeagueId);
      const matchTime = league?.startTime || '23:00';
      
      const catchUp = async () => {
        for (let d = 1; d <= seasonDay; d++) {
          const detId = `league_${seasonNumber}_${d}`;
          const existingMatch = matchHistory.find(m => m.id === detId);
          const isIncomplete = !existingMatch || existingMatch.preview === undefined;
          
          if (isIncomplete && !processedMatchesRef.current.has(detId)) {
            if (d < seasonDay || isMatchDue(matchTime, lastLeagueMatchDate)) {
              await triggerAutoMatch(matchTime, d, detId);
            }
          }
        }
      };
      catchUp();
    }
  }, [isLoaded, seasonDay, seasonNumber, profile?.selectedLeagueId, !!groupPlayers]);

  useEffect(() => {
    if (isLoaded && seasonDay > 0 && seasonDay <= 14 && !isSimulating && !isUserLoading && profile?.selectedLeagueId && user && allLeaguePlayers && allLeaguePlayers.length > 0) {
      const cupTime = "07:00"; 
      
      const catchUpCup = async () => {
        for (let d = 1; d <= seasonDay; d++) {
          const detId = `cup_${seasonNumber}_${d}`;
          const existingMatch = matchHistory.find(m => m.id === detId);
          const wasWaiting = existingMatch?.opponentName === 'WAITING';
          const isIncomplete = !existingMatch || existingMatch.preview === undefined;

          const wasEliminated = matchHistory.some(m => m.type === 'tournament' && m.day < d && m.scoreA < m.scoreB && m.seasonNumber === seasonNumber);
          if (wasEliminated) break;

          if ((isIncomplete || wasWaiting) && !processedMatchesRef.current.has(detId)) {
            if (d < seasonDay || isMatchDue(cupTime, lastCupMatchDate)) {
              await triggerCupMatch(cupTime, d, detId);
            }
          }
        }
      };
      catchUpCup();
    }
  }, [isLoaded, seasonDay, seasonNumber, profile?.selectedLeagueId, !!allLeaguePlayers]);

  const handleGoToReport = () => {
    setShowResultDialog(false);
    const targetId = currentResult?.id;
    if (currentResult && !currentResult.isCup) markMatchAsSeen(currentResult.day);
    if (targetId) {
      router.push(`/match?id=${targetId}`);
    } else {
      router.push('/match');
    }
  };

  const t = { 
    title: language === 'ru' ? 'ИТОГИ СЕЗОНА' : 'SEASON RESULTS', 
    congrats: language === 'ru' ? 'СЕЗОН ЗАВЕРШЕН!' : 'SEASON COMPLETE!', 
    pos: language === 'ru' ? 'Ваше место:' : 'Your Place:', 
    pts: language === 'ru' ? 'Набрано очков:' : 'Points Scored:', 
    promoted: language === 'ru' ? 'ПОВЫШЕНИЕ В КЛАССЕ!' : 'PROMOTED!', 
    demoted: language === 'ru' ? 'ПОНИЖЕНИЕ В КЛАССЕ' : 'RELEGATED', 
    stayed: language === 'ru' ? 'ПОЗИЦИЯ СОХРАНЕНА' : 'POSITION MAINTAINED', 
    next: language === 'ru' ? 'СЛЕДУЮЩИЙ СЕЗОН' : 'NEXT SEASON',
    victory: language === 'ru' ? 'ОПЕРАЦИЯ ЗАВЕРШЕНА' : 'ENGAGEMENT COMPLETE',
    alert: language === 'ru' ? 'ТАКТИЧЕСКАЯ СВОДКА' : 'TACTICAL ALERT',
    proceed: language === 'ru' ? 'ПЕРЕЙТИ К ОТЧЕТУ' : 'PROCEED TO REPORT',
    desc: language === 'ru' ? 'Технический отчет о столкновении расшифрован и готов к изучению.' : 'Technical after-action report decrypted and ready for evaluation.'
  };

  return (
    <>
      <Dialog open={showResultDialog} onOpenChange={(open) => { if (!open) setShowResultDialog(false); }}>
        <DialogContent className="max-w-sm bg-card border-white/10 p-0 overflow-hidden shadow-2xl">
          <div className="p-6 text-center bg-gradient-to-br from-primary/20 via-background to-accent/10 border-b border-white/5">
            <div className="mx-auto w-16 h-16 rounded-full bg-secondary/50 flex items-center justify-center mb-4 border-2 border-primary shadow-[0_0_20px_rgba(var(--primary),0.3)]">
              <Zap className="w-8 h-8 text-primary animate-pulse" />
            </div>
            <DialogTitle className="text-xl font-headline font-bold uppercase tracking-tight text-primary">
              {t.alert}
            </DialogTitle>
            <DialogDescription className="text-[10px] text-muted-foreground mt-2 uppercase tracking-widest font-bold">
              {t.victory}
            </DialogDescription>
          </div>

          <div className="p-6 space-y-4">
            <div className="bg-secondary/30 rounded-xl border border-white/5 p-4 flex items-center gap-4">
              <div className="p-2 rounded-lg bg-primary/20">
                <FileText className="w-5 h-5 text-primary" />
              </div>
              <p className="text-xs leading-relaxed text-muted-foreground italic">
                "{t.desc}"
              </p>
            </div>
          </div>

          <DialogFooter className="p-4 bg-secondary/20 border-t border-white/5">
            <Button 
              className="w-full h-12 hero-gradient font-bold uppercase text-xs tracking-widest" 
              onClick={handleGoToReport}
            >
              <ArrowRight className="w-4 h-4 mr-2" />
              {t.proceed}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!seasonResults} onOpenChange={(open) => !open && dismissSeasonResults()}>
        <DialogContent className="max-w-md p-0 overflow-hidden bg-background border-white/10 shadow-2xl">
          <div className="p-8 text-center bg-gradient-to-br from-primary/20 via-background to-accent/10 border-b border-white/5">
            <DialogTitle className="text-2xl font-headline font-bold uppercase tracking-tight text-primary">{t.congrats}</DialogTitle>
            <DialogDescription className="sr-only">{t.title}</DialogDescription>
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
