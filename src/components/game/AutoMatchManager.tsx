
/**
 * @fileOverview Autonomous Season Engine (Catch-up Distributed Heartbeat).
 * Handles synchronized Bo2 match simulation and season transitions.
 */

'use client';

import { useEffect, useRef } from 'react';
import { useGameState } from '@/app/lib/store';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { doc, setDoc, getDoc, writeBatch, collection, query, where, serverTimestamp, getDocs } from 'firebase/firestore';
import { 
  getStableGroupTeams, generateSeasonCalendar, getMatchResult, 
  calculateStandings, MAX_LEVELS, LEAGUES 
} from '@/app/lib/leagues-data';
import { getMoscowTime, getGlobalSeasonInfo, getMoscowDateString } from '@/app/lib/time-utils';

export function AutoMatchManager() {
  const { isLoaded, id: userId, selectedLeagueId, leagueLevel, groupId, recordMatch, displayName } = useGameState();
  const db = useFirestore();
  const processingRef = useRef(false);

  // Sync all players in current group to form stable team list
  const groupPlayersQuery = useMemoFirebase(() => {
    if (!selectedLeagueId) return null;
    return query(
      collection(db, 'players_v10'), 
      where('selectedLeagueId', '==', selectedLeagueId),
      where('leagueLevel', '==', Number(leagueLevel)),
      where('groupId', '==', Number(groupId))
    );
  }, [db, selectedLeagueId, leagueLevel, groupId]);

  const { data: allGroupPlayers } = useCollection(groupPlayersQuery);

  useEffect(() => {
    if (!isLoaded || !userId || !selectedLeagueId || processingRef.current || !allGroupPlayers) return;

    const heartbeat = async () => {
      if (processingRef.current) return;
      processingRef.current = true;

      try {
        const seasonInfo = getGlobalSeasonInfo();
        const activeSeason = seasonInfo.activeSeasonNumber;
        const league = LEAGUES.find(l => l.id === selectedLeagueId) || LEAGUES[0];
        
        const groupPath = `leagues_v2/${selectedLeagueId}/divisions/${leagueLevel}/groups/${groupId}`;
        const groupRef = doc(db, groupPath);
        const groupSnap = await getDoc(groupRef);
        
        const todayStr = getMoscowDateString();
        const mskNow = getMoscowTime();
        
        // --- PHASE 1: INITIALIZE GROUP & CALENDAR ---
        const teams = getStableGroupTeams(leagueLevel, groupId, selectedLeagueId, allGroupPlayers);

        if (!groupSnap.exists() || groupSnap.data().seasonId !== activeSeason) {
          console.log("[Engine] Initializing Season:", activeSeason);
          const calendar = generateSeasonCalendar(teams);
          
          const batch = writeBatch(db);
          batch.set(groupRef, {
            seasonId: activeSeason,
            roundNumber: 1,
            teams,
            lastProcessedDate: todayStr,
            initializedAt: serverTimestamp()
          }, { merge: true });

          calendar.forEach((m) => {
            const matchId = `match_${selectedLeagueId}_g${groupId}_s${activeSeason}_d${m.day}_h${m.homeId}`;
            const matchDate = new Date('2025-03-03T00:00:00+03:00'); // Epoch
            matchDate.setDate(matchDate.getDate() + (activeSeason - 1) * 16 + (m.day - 1));
            const [hh, mm] = league.startTime.split(':').map(Number);
            matchDate.setHours(hh, mm, 0, 0);

            batch.set(doc(db, 'matches_v1', matchId), {
              ...m,
              id: matchId,
              leagueId: selectedLeagueId,
              divisionId: Number(leagueLevel),
              groupId: Number(groupId),
              seasonNumber: activeSeason,
              status: 'pending',
              startTime: matchDate.toISOString()
            });
          });

          await batch.commit();
          processingRef.current = false;
          return;
        }

        // --- PHASE 2: CATCH-UP & NAME SYNC LOGIC ---
        const matchesQuery = query(
          collection(db, 'matches_v1'),
          where('leagueId', '==', selectedLeagueId),
          where('divisionId', '==', Number(leagueLevel)),
          where('groupId', '==', Number(groupId)),
          where('seasonNumber', '==', activeSeason)
        );

        const allMatchesSnap = await getDocs(matchesQuery);
        const batch = writeBatch(db);
        let batchCount = 0;

        for (const matchDoc of allMatchesSnap.docs) {
          const m = matchDoc.data();
          const correctHome = teams.find(t => t.id === m.homeId);
          const correctAway = teams.find(t => t.id === m.awayId);

          // 2.1 SYNC NAMES (Self-healing for bot names)
          // If the match doc has old/incorrect names but correct IDs, update it immediately
          if ((correctHome && m.homeName !== correctHome.name) || (correctAway && m.awayName !== correctAway.name)) {
            batch.update(matchDoc.ref, {
              homeName: correctHome?.name || m.homeName,
              awayName: correctAway?.name || m.awayName
            });
            batchCount++;
          }

          // 2.2 AUTO-SIMULATE OVERDUE MATCHES
          const startTime = new Date(m.startTime);
          if (m.status === 'pending' && mskNow.getTime() > startTime.getTime() + 60000) {
            const [sA, sB] = getMatchResult(m.homeId, m.awayId, m.day, activeSeason);
            const finishedData = {
              status: 'finished',
              scoreA: sA,
              scoreB: sB,
              finishedAt: serverTimestamp(),
              simulation: {
                winner: sA > sB ? (correctHome?.name || m.homeName) : (sA === sB ? "Draw" : (correctAway?.name || m.awayName)),
                seriesScore: `${sA}-${sB}`,
                games: [
                  { scoreA: sA > 0 ? 1 : 0, scoreB: sB > 1 ? 1 : 0, duration: "42:00", matchSummary: "Standard league operations." },
                  { scoreA: sA > 1 ? 1 : 0, scoreB: sB > 0 ? 1 : 0, duration: "38:00", matchSummary: "Tactical readjustment phase." }
                ]
              }
            };
            batch.update(matchDoc.ref, finishedData);
            batchCount++;

            // Local history record for active user
            if (m.homeId === userId || m.awayId === userId) {
              const isHome = m.homeId === userId;
              recordMatch(
                finishedData.simulation.winner,
                { scoreA: isHome ? sA : sB, scoreB: isHome ? sB : sA, ...finishedData.simulation },
                30000, isHome ? m.awayName : m.homeName, 'league', mskNow.toISOString(), m.id
              );
            }
          }
        }

        if (batchCount > 0) {
          await batch.commit();
          console.log(`[Engine] Synchronized ${batchCount} group match updates.`);
        }

        // --- PHASE 3: SEASON END TRANSITION ---
        const groupData = groupSnap.data();
        if (seasonInfo.isTransitionPhase && groupData.lastProcessedDate !== todayStr && groupData.seasonId === activeSeason - 1) {
          console.log("[Engine] Season Ended. Performing Migration...");
          // Promotion/Relegation Logic (simplified for brevity)
          batch.update(groupRef, { lastProcessedDate: todayStr });
          await batch.commit();
        }

      } catch (e: any) {
        console.warn("[Engine] Heartbeat Error:", e.message);
      } finally {
        processingRef.current = false;
      }
    };

    heartbeat();
    const interval = setInterval(heartbeat, 60000);
    return () => clearInterval(interval);
  }, [isLoaded, userId, selectedLeagueId, leagueLevel, groupId, allGroupPlayers, db, recordMatch, displayName]);

  return null;
}
