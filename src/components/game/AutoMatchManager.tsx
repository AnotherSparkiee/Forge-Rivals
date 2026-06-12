/**
 * @fileOverview Autonomous Season Engine (Distributed Heartbeat).
 * Handles:
 * 1. Automatic Group/Calendar initialization.
 * 2. Synchronized Round Simulation (Bo2).
 * 3. Season Transition (Promotion/Relegation).
 */

'use client';

import { useEffect, useRef } from 'react';
import { useGameState } from '@/app/lib/store';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { doc, setDoc, getDoc, writeBatch, collection, query, where, serverTimestamp } from 'firebase/firestore';
import { 
  getStableGroupTeams, generateSeasonCalendar, getMatchResult, 
  calculateStandings, MAX_LEVELS 
} from '@/app/lib/leagues-data';
import { getMoscowTime, getGlobalSeasonInfo, getMoscowDateString } from '@/app/lib/time-utils';

export function AutoMatchManager() {
  const { isLoaded, id: userId, selectedLeagueId, leagueLevel, groupId, seasonNumber, recordMatch, displayName } = useGameState();
  const db = useFirestore();
  const processingRef = useRef(false);

  // Sync all players in current group
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
    if (!isLoaded || !userId || !selectedLeagueId || processingRef.current) return;

    const heartbeat = async () => {
      processingRef.current = true;
      try {
        const seasonInfo = getGlobalSeasonInfo();
        const groupPath = `leagues_v2/${selectedLeagueId}/divisions/${leagueLevel}/groups/${groupId}`;
        const groupRef = doc(db, groupPath);
        const groupSnap = await getDoc(groupRef);
        
        const todayStr = getMoscowDateString();
        const mskNow = getMoscowTime();
        
        // --- PHASE 1: INITIALIZE GROUP ---
        if (!groupSnap.exists() || groupSnap.data().seasonId !== seasonInfo.activeSeasonNumber) {
          console.log("[Engine] Initializing New Season for Group:", groupId);
          const teams = getStableGroupTeams(leagueLevel, groupId, selectedLeagueId, allGroupPlayers || []);
          const calendar = generateSeasonCalendar(teams);
          
          await setDoc(groupRef, {
            seasonId: seasonInfo.activeSeasonNumber,
            roundNumber: 1,
            teams,
            calendar,
            lastProcessedDate: todayStr,
            initializedAt: serverTimestamp()
          }, { merge: true });
          processingRef.current = false;
          return;
        }

        const groupData = groupSnap.data();
        const roundNumber = groupData.roundNumber || 1;

        // --- PHASE 2: DAILY SIMULATION (23:05 TICK) ---
        const isMatchTime = mskNow.getHours() >= 23 && mskNow.getMinutes() >= 5;
        const isNotProcessedToday = groupData.lastProcessedDate !== todayStr;

        if (isMatchTime && isNotProcessedToday && roundNumber <= 14) {
          console.log("[Engine] Ticking Round:", roundNumber);
          const batch = writeBatch(db);
          const updatedCalendar = [...groupData.calendar];
          
          // Filter matches for current day
          updatedCalendar.forEach((m, idx) => {
            if (m.day === roundNumber && m.status === 'pending') {
              const [sA, sB] = getMatchResult(m.homeId, m.awayId, roundNumber, seasonInfo.activeSeasonNumber);
              updatedCalendar[idx] = { ...m, scoreA: sA, scoreB: sB, status: 'finished' };
              
              // Record locally if it's user's match
              if (m.homeId === userId || m.awayId === userId) {
                const isHome = m.homeId === userId;
                recordMatch(
                  sA > sB ? (isHome ? displayName : m.awayName) : (sA === sB ? "Draw" : (isHome ? m.awayName : displayName)),
                  { scoreA: isHome ? sA : sB, scoreB: isHome ? sB : sA, games: [] },
                  30000, isHome ? m.awayName : m.homeName, 'league', mskNow.toISOString(), `match_s${seasonInfo.activeSeasonNumber}_d${roundNumber}`
                );
              }

              // Also store in global matches for UI consistency
              const globalMatchRef = doc(db, 'matches_v1', `match_${selectedLeagueId}_g${groupId}_s${seasonInfo.activeSeasonNumber}_d${roundNumber}_${m.homeId}`);
              batch.set(globalMatchRef, {
                ...updatedCalendar[idx],
                leagueId: selectedLeagueId,
                divisionId: leagueLevel,
                groupId,
                seasonNumber: seasonInfo.activeSeasonNumber,
                finishedAt: serverTimestamp()
              });
            }
          });

          batch.update(groupRef, {
            calendar: updatedCalendar,
            roundNumber: roundNumber + 1,
            lastProcessedDate: todayStr
          });

          await batch.commit();
          console.log("[Engine] Round finalized.");
        }

        // --- PHASE 3: SEASON TRANSITION (PROMOTION / RELEGATION) ---
        if (roundNumber > 14 && isNotProcessedToday) {
          console.log("[Engine] Season End. Performing Transition...");
          const standings = calculateStandings(groupData.teams, groupData.calendar);
          const batch = writeBatch(db);

          for (let i = 0; i < standings.length; i++) {
            const team = standings[i];
            const pos = i + 1;
            
            if (team.isBot) continue; // Bots don't have profile docs

            let newLevel = leagueLevel;
            let newGroup = groupId;

            // Winner -> Up (if not Div 1)
            if (pos === 1 && leagueLevel > 1) {
              newLevel = leagueLevel - 1;
              newGroup = Math.ceil(groupId / 2);
            } 
            // Last 2 -> Down (if not Div 9)
            else if (pos >= 7 && leagueLevel < MAX_LEVELS) {
              newLevel = leagueLevel + 1;
              newGroup = (pos === 7) ? (groupId * 2 - 1) : (groupId * 2);
            }

            const teamProfileRef = doc(db, 'players_v10', team.id);
            batch.update(teamProfileRef, {
              leagueLevel: newLevel,
              groupId: newGroup,
              lastProcessedSeason: seasonInfo.activeSeasonNumber
            });
          }

          batch.update(groupRef, { lastProcessedDate: todayStr });
          await batch.commit();
          console.log("[Engine] Global Migration Complete.");
        }

      } catch (e) {
        console.error("[Engine] Critical Fail:", e);
      } finally {
        processingRef.current = false;
      }
    };

    heartbeat();
    const interval = setInterval(heartbeat, 60000); // Check every minute
    return () => clearInterval(interval);
  }, [isLoaded, userId, selectedLeagueId, leagueLevel, groupId, seasonNumber, allGroupPlayers, db, recordMatch, displayName]);

  return null;
}
