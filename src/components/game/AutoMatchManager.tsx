
'use client';

/**
 * @fileOverview Global Group Autonomous Match Persistence & Schedule Initialization.
 * Ensures the league calendar exists and processes due matches deterministically.
 */

import { useEffect, useRef } from 'react';
import { useGameState, LineupSlot } from '@/app/lib/store';
import { useUser, useFirestore } from '@/firebase';
import { doc, updateDoc, setDoc, getDoc, writeBatch, collection, query, where, getDocs } from 'firebase/firestore';
import { simulateMobaMatch } from '@/ai/flows/simulate-moba-match';
import { generateBotSquad } from '@/app/lib/moba-data';
import { getMatchResult, generateDeterministicDayMatches, TEAMS_PER_GROUP } from '@/app/lib/leagues-data';

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
    groupMatches, seasonNumber, leagueLevel, groupId, selectedLeagueId
  } = useGameState();
  const db = useFirestore();
  const processingRef = useRef<Set<string>>(new Set());
  const initTriggeredRef = useRef<string>("");

  /**
   * Initializes the schedule for the current group if it doesn't exist.
   * Generates all 14 days of the season in advance.
   */
  const ensureScheduleExists = async () => {
    if (!selectedLeagueId || !leagueLevel || !groupId || !seasonNumber) return;
    
    const syncKey = `${selectedLeagueId}_${leagueLevel}_${groupId}_${seasonNumber}`;
    if (initTriggeredRef.current === syncKey) return;
    initTriggeredRef.current = syncKey;

    try {
      const firstMatchId = `match_${seasonNumber}_${selectedLeagueId}_${leagueLevel}_${groupId}_d1_m0`;
      const firstSnap = await getDoc(doc(db, 'matches_v1', firstMatchId));
      
      if (!firstSnap.exists()) {
        console.log("Initializing autonomous group schedule for:", syncKey);
        
        // 1. Get real players in this group to assign correct names
        const playersRef = collection(db, 'players_v10');
        const q = query(playersRef, 
          where('selectedLeagueId', '==', selectedLeagueId),
          where('leagueLevel', '==', Number(leagueLevel)),
          where('groupId', '==', Number(groupId))
        );
        const playerSnaps = await getDocs(q);
        const realTeams = playerSnaps.docs.map(d => ({ id: d.id, name: d.data().displayName || "Manager" }));
        
        const teams: any[] = [...realTeams];
        const botsNeeded = Math.max(0, TEAMS_PER_GROUP - teams.length);
        for (let i = 0; i < botsNeeded; i++) {
          const botId = `bot_${leagueLevel}_${groupId}_${i}`;
          teams.push({ id: botId, name: `Elite Bot ${i + 1}` });
        }
        
        // Deterministic sort for pairing
        teams.sort((a, b) => a.id.localeCompare(b.id));
        
        const batch = writeBatch(db);
        for (let d = 1; d <= 14; d++) {
          const dayMatches = generateDeterministicDayMatches(leagueLevel, groupId, selectedLeagueId, seasonNumber, d, teams);
          dayMatches.forEach(m => {
            batch.set(doc(db, 'matches_v1', m.id), m, { merge: true });
          });
        }
        await batch.commit();
      }
    } catch (e) {
      console.error("Schedule initialization failed", e);
    }
  };

  /**
   * Processes a single match that is due according to the clock.
   */
  const processPendingMatch = async (match: any) => {
    if (processingRef.current.has(match.id)) return;
    processingRef.current.add(match.id);

    try {
      const [finalScoreH, finalScoreA] = getMatchResult(match.homeId, match.awayId, match.day, seasonNumber);
      const isOurMatch = match.homeId === userId || match.awayId === userId;
      
      let simulationResult;

      if (isOurMatch) {
        // Full AI Simulation for player match
        const activeSlots: LineupSlot[] = ['carry', 'mid', 'offlane', 'support', 'full_support'];
        const myHeroes = activeSlots.map(slot => ownedHeroes.find(h => h.id === lineup[slot])).filter(Boolean);
        
        const mySquad = myHeroes.map(h => ({ 
          name: h!.name, 
          role: h!.role, 
          overallRating: h!.overallRating, 
          proStats: h!.proStats, 
          isSub: false 
        }));
        
        while (mySquad.length < 5) {
          mySquad.push({ 
            name: `Training Bot ${mySquad.length + 1}`, 
            role: 'Support', 
            overallRating: 20, 
            proStats: generateBotSquad(20)[0].proStats, 
            isSub: false 
          });
        }
        
        const opponentSquad = generateBotSquad(25);
        const stratA = match.homeId === userId ? strategy : 'Balanced Play';
        const stratB = match.homeId === userId ? 'Balanced Play' : strategy;

        simulationResult = await simulateMobaMatch({
          teamA: { name: match.homeName, strategy: stratA, heroes: match.homeId === userId ? mySquad : opponentSquad },
          teamB: { name: match.awayName, strategy: stratB, heroes: match.awayId === userId ? mySquad : opponentSquad },
          isBo2: true, 
          scoreA: finalScoreH, 
          scoreB: finalScoreA
        });

        // Record for local history
        recordMatch(
          finalScoreH > finalScoreA ? match.homeName : (finalScoreH === finalScoreA ? "Draw" : match.awayName),
          { 
            ...simulationResult.games[0], 
            scoreA: finalScoreH, 
            scoreB: finalScoreA, 
            games: simulationResult.games, 
            seriesScore: simulationResult.seriesScore 
          },
          50000,
          match.homeId === userId ? match.awayName : match.homeName,
          'league',
          new Date().toISOString(),
          match.id
        );
      } else {
        // Fast deterministic simulation for other matches in the group
        simulationResult = { 
          winner: finalScoreH > finalScoreA ? match.homeName : (finalScoreH === finalScoreA ? "Draw" : match.awayName), 
          seriesScore: `${finalScoreH}-${finalScoreA}`, 
          games: [
            { scoreA: finalScoreH > 0 ? 1 : 0, scoreB: finalScoreA > 0 ? 0 : 0, duration: "35:00", matchSummary: "Standard performance.", timeline: [], scoreboard: [] },
            { scoreA: finalScoreH > 1 ? 1 : 0, scoreB: finalScoreA > 1 ? 1 : 0, duration: "35:00", matchSummary: "Standard performance.", timeline: [], scoreboard: [] }
          ] 
        };
      }

      // Persist result to the global match record
      await updateDoc(doc(db, 'matches_v1', match.id), {
        status: 'finished',
        scoreA: finalScoreH,
        scoreB: finalScoreA,
        winnerId: finalScoreH > finalScoreA ? match.homeId : (finalScoreH < finalScoreA ? match.awayId : null),
        simulation: sanitize(simulationResult),
        finishedAt: new Date().toISOString()
      });

    } catch (e) {
      console.error("Match persistence failed", match.id, e);
    } finally {
      processingRef.current.delete(match.id);
    }
  };

  useEffect(() => {
    if (!isLoaded || !userId) return;
    
    ensureScheduleExists();

    if (!groupMatches || groupMatches.length === 0) return;
    const now = Date.now();
    
    // Find any matches whose startTime has passed but they are still 'pending'
    const dueMatches = groupMatches.filter(m => {
      const startTime = new Date(m.startTime).getTime();
      return m.status === 'pending' && now >= startTime;
    });

    dueMatches.forEach(processPendingMatch);
  }, [groupMatches, isLoaded, userId, selectedLeagueId, leagueLevel, groupId, seasonNumber]);

  return null;
}
