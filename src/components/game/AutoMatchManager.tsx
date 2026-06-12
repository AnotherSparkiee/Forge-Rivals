'use client';

/**
 * @fileOverview Global Autonomous Match Synchronizer (Surrogate Cloud Function).
 * 
 * Logic:
 * 1. Synchronous Completion: All matches of a round finish at the same time for the whole group.
 * 2. Automatic Initialization: Generates the full 56-match calendar for Season 1 if missing.
 * 3. Batch Writes: Results are committed to Firestore in batches for absolute consistency.
 */

import { useEffect, useRef, useCallback } from 'react';
import { useGameState, LineupSlot } from '@/app/lib/store';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { doc, setDoc, getDoc, writeBatch, collection, query, where, serverTimestamp } from 'firebase/firestore';
import { simulateMobaMatch } from '@/ai/flows/simulate-moba-match';
import { generateBotSquad } from '@/app/lib/moba-data';
import { getMatchResult, generateDeterministicDayMatches, getStableGroupTeams } from '@/app/lib/leagues-data';
import { getMoscowTime } from '@/app/lib/time-utils';

function sanitize(obj: any) {
  try {
    return JSON.parse(JSON.stringify(obj));
  } catch (e) {
    return null;
  }
}

export function AutoMatchManager() {
  const { 
    isLoaded, id: userId, 
    strategy, ownedHeroes, lineup, recordMatch,
    groupMatches, seasonNumber, leagueLevel, groupId, selectedLeagueId, displayName
  } = useGameState();
  const db = useFirestore();
  
  const processingRoundsRef = useRef<Set<number>>(new Set());
  const initTriggeredRef = useRef<string>("");

  const leaguePlayersQuery = useMemoFirebase(() => {
    if (!selectedLeagueId) return null;
    return query(collection(db, 'players_v10'), where('selectedLeagueId', '==', selectedLeagueId));
  }, [db, selectedLeagueId]);

  const { data: allLeaguePlayers } = useCollection(leaguePlayersQuery);

  /**
   * Initializes the group's full seasonal calendar (56 matches) if it doesn't exist.
   */
  const ensureGroupScheduleExists = useCallback(async () => {
    if (!selectedLeagueId || !leagueLevel || !groupId || !seasonNumber || !allLeaguePlayers) return;
    
    const syncKey = `init_${selectedLeagueId}_${leagueLevel}_${groupId}_s${seasonNumber}`;
    if (initTriggeredRef.current === syncKey) return;
    initTriggeredRef.current = syncKey;

    try {
      const firstMatchId = `match_${seasonNumber}_${selectedLeagueId}_${leagueLevel}_${groupId}_d1_m0`;
      const firstSnap = await getDoc(doc(db, 'matches_v1', firstMatchId));
      
      if (!firstSnap.exists()) {
        console.log("[Autonomous] Initializing full seasonal calendar for group:", syncKey);
        const teams = getStableGroupTeams(leagueLevel, groupId, selectedLeagueId, allLeaguePlayers);
        const batch = writeBatch(db);
        
        for (let d = 1; d <= 14; d++) {
          const dayMatches = generateDeterministicDayMatches(leagueLevel, groupId, selectedLeagueId, seasonNumber, d, teams);
          dayMatches.forEach(m => {
            batch.set(doc(db, 'matches_v1', m.id), m, { merge: true });
          });
        }
        await batch.commit();
        console.log("[Autonomous] Calendar synchronized successfully.");
      }
    } catch (e) {
      console.error("[Autonomous] Schedule sync failed:", e);
    }
  }, [selectedLeagueId, leagueLevel, groupId, seasonNumber, allLeaguePlayers, db]);

  /**
   * Synchronously processes an entire round (all 4 matches in the group).
   */
  const processGroupRound = async (day: number, roundMatches: any[]) => {
    if (processingRoundsRef.current.has(day)) return;
    processingRoundsRef.current.add(day);

    console.log(`[Autonomous] Heartbeat: Processing Day ${day} for group ${groupId}...`);
    const batch = writeBatch(db);
    const finishedAt = new Date().toISOString();

    try {
      for (const match of roundMatches) {
        // Ensure we don't overwrite if someone else just finished it
        const [scoreH, scoreA] = getMatchResult(match.homeId, match.awayId, day, seasonNumber);
        const isOurMatch = match.homeId === userId || match.awayId === userId;

        let simulation;
        if (isOurMatch) {
          // Full AI Simulation for player match
          const activeSlots: LineupSlot[] = ['carry', 'mid', 'offlane', 'support', 'full_support'];
          const mySquad = activeSlots.map(slot => ownedHeroes.find(h => h.id === lineup[slot])).filter(Boolean).map(h => ({
            name: h!.name, role: h!.role, overallRating: h!.overallRating, proStats: h!.proStats, isSub: false
          }));
          while (mySquad.length < 5) mySquad.push({ name: `AI Mercenary`, role: 'Support', overallRating: 20, proStats: generateBotSquad(20)[0].proStats, isSub: false });
          
          const opponentSquad = generateBotSquad(25);
          const result = await simulateMobaMatch({
            teamA: { name: match.homeName, strategy: match.homeId === userId ? strategy : 'Balanced Play', heroes: match.homeId === userId ? mySquad : opponentSquad },
            teamB: { name: match.awayName, strategy: match.awayId === userId ? strategy : 'Balanced Play', heroes: match.awayId === userId ? mySquad : opponentSquad },
            isBo2: true, scoreA: scoreH, scoreB: scoreA
          });
          simulation = sanitize(result);

          // Record locally for player's "My Played"
          const myWins = match.homeId === userId ? scoreH : scoreA;
          const oppWins = match.homeId === userId ? scoreA : scoreH;
          recordMatch(
            myWins > oppWins ? displayName : (myWins === oppWins ? "Draw" : (match.homeId === userId ? match.awayName : match.homeName)),
            { ...result.games[0], scoreA: myWins, scoreB: oppWins, games: result.games, seriesScore: `${myWins}-${oppWins}` },
            50000, match.homeId === userId ? match.awayName : match.homeName, 'league', finishedAt, match.id
          );
        } else {
          // Standard Bo2 simulation for bot matches
          simulation = {
            winner: scoreH > scoreA ? match.homeName : (scoreH === scoreA ? "Draw" : match.awayName),
            seriesScore: `${scoreH}-${scoreA}`,
            games: [
              { scoreA: scoreH > 0 ? 1 : 0, scoreB: scoreA > 0 ? 0 : 0, duration: "35:00", matchSummary: "Pro performance.", timeline: [], scoreboard: [] },
              { scoreA: scoreH > 1 ? 1 : 0, scoreB: scoreA > 1 ? 1 : 0, duration: "35:00", matchSummary: "Pro performance.", timeline: [], scoreboard: [] }
            ]
          };
        }

        batch.update(doc(db, 'matches_v1', match.id), {
          status: 'finished',
          scoreA: scoreH,
          scoreB: scoreA,
          winnerId: scoreH > scoreA ? match.homeId : (scoreH < scoreA ? match.awayId : null),
          simulation,
          finishedAt
        });
      }

      await batch.commit();
      console.log(`[Autonomous] Round ${day} finalized for group.`);
    } catch (e) {
      console.error(`[Autonomous] Round ${day} processing error:`, e);
    } finally {
      processingRoundsRef.current.delete(day);
    }
  };

  useEffect(() => {
    if (!isLoaded || !userId || !allLeaguePlayers) return;

    // Phase 1: Initialize global calendar
    ensureGroupScheduleExists();

    if (!groupMatches || groupMatches.length === 0) return;

    // Phase 2: Heartbeat - Process all pending rounds up to now
    const now = getMoscowTime().getTime();
    
    // Group matches by day to process rounds synchronously
    const rounds: Record<number, any[]> = {};
    groupMatches.forEach(m => {
      if (m.status === 'pending') {
        const round = Number(m.day);
        if (!rounds[round]) rounds[round] = [];
        rounds[round].push(m);
      }
    });

    const sortedPendingDays = Object.keys(rounds).map(Number).sort((a, b) => a - b);

    for (const day of sortedPendingDays) {
      const roundStartTime = new Date(rounds[day][0].startTime).getTime();
      if (now >= roundStartTime) {
        processGroupRound(day, rounds[day]);
      }
    }
  }, [groupMatches, isLoaded, userId, selectedLeagueId, leagueLevel, groupId, seasonNumber, allLeaguePlayers, ensureGroupScheduleExists, db]);

  return null;
}
