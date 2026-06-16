/**
 * @fileOverview Autonomous Season Engine (Synchronized Heartbeat).
 * Handles synchronized Bo2 match simulation and season transitions.
 */

'use client';

import { useEffect, useRef } from 'react';
import { useGameState } from '@/app/lib/store';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { doc, getDoc, writeBatch, collection, query, where, serverTimestamp, getDocs, deleteDoc } from 'firebase/firestore';
import { 
  getStableGroupTeams, generateSeasonCalendar, getMatchResult, 
  LEAGUES 
} from '@/app/lib/leagues-data';
import { getMoscowTime, getGlobalSeasonInfo, getMoscowDateString, calculateLiveAge } from '@/app/lib/time-utils';

export function AutoMatchManager() {
  const { isLoaded, id: userId, selectedLeagueId, leagueLevel, groupId, recordMatch, displayName, ownedHeroes, removeHero } = useGameState();
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

        // --- CAREER LIFECYCLE: MONITOR RETIREMENT ---
        const squad = ownedHeroes || [];
        for (const hero of squad) {
          if (hero.isPro && hero.careerEndAge) {
            const liveAge = calculateLiveAge(hero.baseAge, hero.hiredAt);
            if (liveAge.numeric >= hero.careerEndAge) {
               removeHero(hero.id, 0); 
            }
          }
        }
        
        // --- PHASE 1: INITIALIZE GROUP & CALENDAR ---
        const teams = getStableGroupTeams(leagueLevel, groupId, selectedLeagueId, allGroupPlayers);

        // SYNCED WITH EPOCH 2026-06-17
        const epochBase = new Date('2026-06-17T00:00:00+03:00');
        const expectedSeasonStart = new Date(epochBase);
        expectedSeasonStart.setDate(expectedSeasonStart.getDate() + (activeSeason - 1) * 16);

        // Force regeneration if season mismatch OR group integrity lost OR old bot naming convention
        const groupData = groupSnap.data();
        const hasOldBots = groupData?.teams?.some((t: any) => t.isBot && !t.name.startsWith('bot'));
        const isOldEpoch = groupData?.initializedAt && new Date(groupData.initializedAt.toMillis()).getFullYear() < 2026;
        
        const forceRegen = !groupSnap.exists() || 
                           groupData?.seasonId !== activeSeason ||
                           (groupData?.teams?.length !== 8) ||
                           hasOldBots ||
                           isOldEpoch;

        if (forceRegen) {
          // CLEANUP OLD MATCHES BEFORE REGEN
          const oldMatchesQ = query(
            collection(db, 'matches_v1'),
            where('leagueId', '==', selectedLeagueId),
            where('divisionId', '==', Number(leagueLevel)),
            where('groupId', '==', Number(groupId))
          );
          const oldSnap = await getDocs(oldMatchesQ);
          const cleanupBatch = writeBatch(db);
          oldSnap.docs.forEach(d => cleanupBatch.delete(d.ref));
          await cleanupBatch.commit();

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
            const matchDate = new Date(expectedSeasonStart);
            matchDate.setDate(matchDate.getDate() + (m.day - 1));
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

        // --- PHASE 2: CATCH-UP & SYNC LOGIC ---
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

          // Force update bot names if they don't match deterministic unique IDs
          if ((correctHome && m.homeName !== correctHome.name) || (correctAway && m.awayName !== correctAway.name)) {
            batch.update(matchDoc.ref, {
              homeName: correctHome?.name || m.homeName,
              awayName: correctAway?.name || m.awayName
            });
            batchCount++;
          }

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
  }, [isLoaded, userId, selectedLeagueId, leagueLevel, groupId, allGroupPlayers, db, recordMatch, displayName, ownedHeroes, removeHero]);

  return null;
}
