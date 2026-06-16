/**
 * @fileOverview Autonomous Season Engine (Synchronized Heartbeat).
 * Handles synchronized Bo2 match simulation and season transitions.
 */

'use client';

import { useEffect, useRef } from 'react';
import { useGameState } from '@/app/lib/store';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { doc, getDoc, writeBatch, collection, query, where, serverTimestamp, getDocs } from 'firebase/firestore';
import { 
  getStableGroupTeams, generateSeasonCalendar, getMatchResult, 
  LEAGUES 
} from '@/app/lib/leagues-data';
import { getMoscowTime, getGlobalSeasonInfo, getMoscowDateString, calculateLiveAge } from '@/app/lib/time-utils';

export function AutoMatchManager() {
  const { isLoaded, id: userId, selectedLeagueId, leagueLevel, groupId, recordMatch, displayName, ownedHeroes, removeHero } = useGameState();
  const db = useFirestore();
  const processingRef = useRef(false);

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
        
        const groupRef = doc(db, `leagues_v2/${selectedLeagueId}/divisions/${leagueLevel}/groups/${groupId}`);
        const groupSnap = await getDoc(groupRef);
        
        const todayStr = getMoscowDateString();
        const mskNow = getMoscowTime();

        // Check for outdated matches
        const checkMatchesQ = query(
          collection(db, 'matches_v1'),
          where('leagueId', '==', selectedLeagueId),
          where('divisionId', '==', Number(leagueLevel)),
          where('groupId', '==', Number(groupId))
        );
        const existingMatchesSnap = await getDocs(checkMatchesQ);
        
        // Protocol: Wipe if old bot names or wrong season detected
        const hasLegacyData = existingMatchesSnap.docs.some(d => {
          const m = d.data();
          const hName = String(m.homeName || "");
          const aName = String(m.awayName || "");
          return hName.includes('Elite Bot') || aName.includes('Elite Bot') || 
                 hName.includes('9.1.1') || aName.includes('9.1.1') ||
                 hName.includes('Bot ') || aName.includes('Bot ') ||
                 m.seasonNumber !== activeSeason;
        });

        const groupData = groupSnap.data();
        const forceRegen = !groupSnap.exists() || 
                           groupData?.seasonId !== activeSeason ||
                           hasLegacyData;

        if (forceRegen) {
          console.log("[Engine] Cleaning legacy data and initializing clean season...");
          const cleanupBatch = writeBatch(db);
          existingMatchesSnap.docs.forEach(d => cleanupBatch.delete(d.ref));
          await cleanupBatch.commit();

          const teams = getStableGroupTeams(leagueLevel, groupId, selectedLeagueId, allGroupPlayers);
          const calendar = generateSeasonCalendar(teams);
          
          const epochBase = new Date('2026-06-17T00:00:00+03:00');
          const expectedSeasonStart = new Date(epochBase);
          expectedSeasonStart.setDate(expectedSeasonStart.getDate() + (activeSeason - 1) * 16);

          const initBatch = writeBatch(db);
          initBatch.set(groupRef, {
            seasonId: activeSeason,
            teams,
            lastProcessedDate: todayStr,
            initializedAt: serverTimestamp()
          }, { merge: true });

          calendar.forEach((m) => {
            const matchId = `match_${selectedLeagueId}_g${groupId}_s${activeSeason}_d${m.day}_h${m.homeId}`;
            const matchDate = new Date(expectedSeasonStart);
            matchDate.setDate(matchDate.getDate() + (m.day - 1));
            const [hh, mm] = league.startTime.split(':').map(Number);
            matchDate.setHours(hh, mm, 0, 0);

            initBatch.set(doc(db, 'matches_v1', matchId), {
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

          await initBatch.commit();
          processingRef.current = false;
          return;
        }

        // Processing matches
        const matchesQuery = query(
          collection(db, 'matches_v1'),
          where('leagueId', '==', selectedLeagueId),
          where('divisionId', '==', Number(leagueLevel)),
          where('groupId', '==', Number(groupId)),
          where('seasonNumber', '==', activeSeason)
        );

        const allMatchesSnap = await getDocs(matchesQuery);
        const simBatch = writeBatch(db);
        let simCount = 0;

        for (const matchDoc of allMatchesSnap.docs) {
          const m = matchDoc.data();
          if (m.status === 'pending' && mskNow.getTime() > new Date(m.startTime).getTime() + 60000) {
            const [sA, sB] = getMatchResult(m.homeId, m.awayId, m.day, activeSeason);
            const finishedData = {
              status: 'finished',
              scoreA: sA, scoreB: sB,
              finishedAt: serverTimestamp(),
              simulation: {
                winner: sA > sB ? m.homeName : (sA === sB ? "Draw" : m.awayName),
                seriesScore: `${sA}-${sB}`,
                games: [{ scoreA: sA > 0 ? 1 : 0, scoreB: sB > 1 ? 1 : 0, duration: "40:00", matchSummary: "Pro league combat." }]
              }
            };
            simBatch.update(matchDoc.ref, finishedData);
            simCount++;

            if (m.homeId === userId || m.awayId === userId) {
              const isHome = m.homeId === userId;
              recordMatch(finishedData.simulation.winner, { scoreA: isHome ? sA : sB, scoreB: isHome ? sB : sA, ...finishedData.simulation }, 30000, isHome ? m.awayName : m.homeName, 'league', mskNow.toISOString(), m.id);
            }
          }
        }

        if (simCount > 0) await simBatch.commit();

      } catch (e: any) {
        console.warn("[Engine] Sync Error:", e.message);
      } finally {
        processingRef.current = false;
      }
    };

    heartbeat();
    const interval = setInterval(heartbeat, 30000);
    return () => clearInterval(interval);
  }, [isLoaded, userId, selectedLeagueId, leagueLevel, groupId, allGroupPlayers, db, recordMatch, displayName, ownedHeroes, removeHero]);

  return null;
}
