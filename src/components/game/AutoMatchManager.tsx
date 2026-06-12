
/**
 * @fileOverview Autonomous Season Engine (Catch-up Distributed Heartbeat).
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
        if (!groupSnap.exists() || groupSnap.data().seasonId !== activeSeason) {
          console.log("[Engine] Initializing Season:", activeSeason);
          const teams = getStableGroupTeams(leagueLevel, groupId, selectedLeagueId, allGroupPlayers);
          const calendar = generateSeasonCalendar(teams);
          
          const batch = writeBatch(db);
          batch.set(groupRef, {
            seasonId: activeSeason,
            roundNumber: 1,
            teams,
            lastProcessedDate: todayStr,
            initializedAt: serverTimestamp()
          }, { merge: true });

          // Pre-populate matches_v1 for entire season with PRECISE START TIMES
          calendar.forEach((m) => {
            const matchId = `match_${selectedLeagueId}_g${groupId}_s${activeSeason}_d${m.day}_h${m.homeId}`;
            
            // Calculate precise ISO startTime based on day and league config
            const matchDate = new Date('2025-03-03T00:00:00+03:00'); // Epoch
            matchDate.setDate(matchDate.getDate() + (activeSeason - 1) * 16 + (m.day - 1));
            const [hh, mm] = league.startTime.split(':').map(Number);
            matchDate.setHours(hh, mm, 0, 0);

            batch.set(doc(db, 'matches_v1', matchId), {
              ...m,
              id: matchId,
              leagueId: selectedLeagueId,
              divisionId: leagueLevel,
              groupId,
              seasonNumber: activeSeason,
              status: 'pending',
              startTime: matchDate.toISOString()
            });
          });

          await batch.commit();
          processingRef.current = false;
          return;
        }

        // --- PHASE 2: CATCH-UP LOGIC (Process all pending matches in past) ---
        // Find all matches for this group that should be finished by now
        const matchesQuery = query(
          collection(db, 'matches_v1'),
          where('leagueId', '==', selectedLeagueId),
          where('divisionId', '==', Number(leagueLevel)),
          where('groupId', '==', Number(groupId)),
          where('seasonNumber', '==', activeSeason),
          where('status', '==', 'pending')
        );

        const pendingSnap = await getDocs(matchesQuery);
        const matchesToFinalize = pendingSnap.docs.filter(doc => {
          const startTime = new Date(doc.data().startTime);
          // Auto-finalize match if it started more than 1 minute ago
          return mskNow.getTime() > startTime.getTime() + 60000;
        });

        if (matchesToFinalize.length > 0) {
          console.log(`[Engine] Finalizing ${matchesToFinalize.length} overdue matches...`);
          const batch = writeBatch(db);

          for (const matchDoc of matchesToFinalize) {
            const m = matchDoc.data();
            const [sA, sB] = getMatchResult(m.homeId, m.awayId, m.day, activeSeason);
            
            const finishedData = {
              status: 'finished',
              scoreA: sA,
              scoreB: sB,
              finishedAt: serverTimestamp(),
              simulation: {
                winner: sA > sB ? m.homeName : (sA === sB ? "Draw" : m.awayName),
                seriesScore: `${sA}-${sB}`,
                games: [
                  { scoreA: sA > 0 ? 1 : 0, scoreB: sB > 1 ? 1 : 0, duration: "42:00", matchSummary: "Standard league operations." },
                  { scoreA: sA > 1 ? 1 : 0, scoreB: sB > 0 ? 1 : 0, duration: "38:00", matchSummary: "Tactical readjustment phase." }
                ]
              }
            };

            batch.update(matchDoc.ref, finishedData);

            // If it's a match for THIS user, record it in their personal history
            if (m.homeId === userId || m.awayId === userId) {
              const isHome = m.homeId === userId;
              recordMatch(
                finishedData.simulation.winner,
                { scoreA: isHome ? sA : sB, scoreB: isHome ? sB : sA, ...finishedData.simulation },
                30000, isHome ? m.awayName : m.homeName, 'league', mskNow.toISOString(), m.id
              );
            }
          }

          // Update group round number to the latest completed day
          const maxDay = Math.max(...matchesToFinalize.map(d => d.data().day));
          batch.update(groupRef, { 
            roundNumber: maxDay + 1,
            lastProcessedDate: todayStr 
          });

          await batch.commit();
          console.log("[Engine] Catch-up sync completed.");
        }

        // --- PHASE 3: SEASON END TRANSITION ---
        const groupData = groupSnap.data();
        if (groupData.roundNumber > 14 && groupData.lastProcessedDate !== todayStr && !seasonInfo.isTransitionPhase) {
          console.log("[Engine] Season Ended. Performing Migration...");
          
          const teams = groupData.teams;
          const matchesQuery = query(
            collection(db, 'matches_v1'),
            where('leagueId', '==', selectedLeagueId),
            where('divisionId', '==', Number(leagueLevel)),
            where('groupId', '==', Number(groupId)),
            where('seasonNumber', '==', activeSeason)
          );
          const seasonMatchesSnap = await getDocs(matchesQuery);
          const seasonMatches = seasonMatchesSnap.docs.map(d => d.data());

          const standings = calculateStandings(teams, seasonMatches);
          const batch = writeBatch(db);

          for (let i = 0; i < standings.length; i++) {
            const team = standings[i];
            const pos = i + 1;
            if (team.isBot) continue;

            let nextLvl = Number(leagueLevel);
            let nextGrp = Number(groupId);

            if (pos === 1 && nextLvl > 1) {
              nextLvl -= 1;
              nextGrp = Math.ceil(nextGrp / 2);
            } else if (pos >= 7 && nextLvl < MAX_LEVELS) {
              nextLvl += 1;
              nextGrp = (pos === 7) ? (nextGrp * 2 - 1) : (nextGrp * 2);
            }

            batch.update(doc(db, 'players_v10', team.id), {
              leagueLevel: nextLvl,
              groupId: nextGrp,
              lastProcessedSeason: activeSeason
            });
          }

          batch.update(groupRef, { lastProcessedDate: todayStr });
          await batch.commit();
          console.log("[Engine] Migration Done.");
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
