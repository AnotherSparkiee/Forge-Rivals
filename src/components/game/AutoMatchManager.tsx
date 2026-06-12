
'use client';

/**
 * @fileOverview Global Group Autonomous Match Persistence.
 * This component acts as a background "worker" that ensures deterministic
 * results are persisted to Firestore for detailed logging and history.
 */

import { useEffect, useRef } from 'react';
import { useGameState, LineupSlot } from '@/app/lib/store';
import { useUser, useFirestore } from '@/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { simulateMobaMatch } from '@/ai/flows/simulate-moba-match';
import { generateBotSquad } from '@/app/lib/moba-data';
import { getMatchResult } from '@/app/lib/leagues-data';

function sanitize(obj: any) {
  return JSON.parse(JSON.stringify(obj));
}

export function AutoMatchManager() {
  const { 
    isLoaded, id: userId, 
    strategy, ownedHeroes, lineup, recordMatch, displayName,
    groupMatches, seasonNumber
  } = useGameState();
  const db = useFirestore();
  const processingRef = useRef<Set<string>>(new Set());

  const processPendingMatch = async (match: any) => {
    if (processingRef.current.has(match.id)) return;
    processingRef.current.add(match.id);

    try {
      // 1. Get deterministic result (SAME FOR EVERYONE)
      const [finalScoreA, finalScoreB] = getMatchResult(match.homeId, match.awayId, match.day, seasonNumber);

      // 2. Only perform detailed AI simulation if the match belongs to this user
      // or if we want to "volunteer" as the group processor.
      const isOurMatch = match.homeId === userId || match.awayId === userId;
      
      let simulationResult;

      if (isOurMatch) {
        const activeSlots: LineupSlot[] = ['carry', 'mid', 'offlane', 'support', 'full_support'];
        const myHeroes = activeSlots.map(slot => ownedHeroes.find(h => h.id === lineup[slot])).filter(Boolean);
        const mySquad = myHeroes.map(h => ({ name: h!.name, role: h!.role, overallRating: h!.overallRating, proStats: h!.proStats, isSub: false }));
        
        // Add fillers if needed
        while (mySquad.length < 5) {
          mySquad.push({ name: `Bot ${mySquad.length + 1}`, role: 'Support', overallRating: 20, proStats: generateBotSquad(20)[0].proStats, isSub: false });
        }
        
        const opponentSquad = generateBotSquad(25);
        const stratA = match.homeId === userId ? strategy : 'Balanced Play';
        const stratB = match.homeId === userId ? 'Balanced Play' : strategy;

        simulationResult = await simulateMobaMatch({
          teamA: { name: match.homeName, strategy: stratA, heroes: match.homeId === userId ? mySquad : opponentSquad },
          teamB: { name: match.awayName, strategy: stratB, heroes: match.awayId === userId ? mySquad : opponentSquad },
          isBo2: true, scoreA: finalScoreA, scoreB: finalScoreB
        });

        // Save to local matchHistory for "Svoi Sygrannye"
        recordMatch(
          finalScoreA > finalScoreB ? match.homeName : (finalScoreA === finalScoreB ? "Draw" : match.awayName),
          { ...simulationResult.games[0], scoreA: isOurMatch && match.homeId === userId ? finalScoreA : finalScoreB, scoreB: isOurMatch && match.homeId === userId ? finalScoreB : finalScoreA, games: simulationResult.games, seriesScore: simulationResult.seriesScore },
          50000,
          match.homeId === userId ? match.awayName : match.homeName,
          'league',
          new Date().toISOString(),
          match.id
        );
      } else {
        // Fast deterministic mock simulation for others to avoid heavy AI calls for every match in league
        simulationResult = { winner: finalScoreA > finalScoreB ? match.homeName : (finalScoreA === finalScoreB ? "Draw" : match.awayName), seriesScore: `${finalScoreA}-${finalScoreB}`, games: [] };
      }

      // 3. Persist to Global Database
      await updateDoc(doc(db, 'matches_v1', match.id), {
        status: 'finished',
        scoreA: finalScoreA,
        scoreB: finalScoreB,
        winnerId: finalScoreA > finalScoreB ? match.homeId : (finalScoreA < finalScoreB ? match.awayId : null),
        simulation: sanitize(simulationResult),
        finishedAt: new Date().toISOString()
      });

    } catch (e) {
      console.error("Match persistence failed", match.id, e);
      processingRef.current.delete(match.id);
    }
  };

  useEffect(() => {
    if (!isLoaded || !groupMatches || !userId) return;
    const now = Date.now();
    
    // Check all matches in the group schedule.
    const dueMatches = groupMatches.filter(m => {
      const startTime = new Date(m.startTime).getTime();
      return m.status === 'pending' && now >= startTime;
    });

    dueMatches.forEach(processPendingMatch);
  }, [groupMatches, isLoaded, userId]);

  return null;
}
