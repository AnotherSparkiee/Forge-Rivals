/**
 * @fileOverview Автономный движок сезонов v15 (Standings-First). 
 * Мгновенный триггер серверного расчета при наступлении времени матча.
 */

'use client';

import { useEffect, useRef } from 'react';
import { useGameState, checkIsMatchFinished } from '@/app/lib/store';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { doc, getDoc, writeBatch, collection, query, where, serverTimestamp, Timestamp } from 'firebase/firestore';
import { 
  getStableGroupTeams, generateSeasonCalendar, 
  LEAGUES 
} from '@/app/lib/leagues-data';
import { getMoscowTime, getGlobalSeasonInfo } from '@/app/lib/time-utils';
import { forceResolveGroupMatches } from '@/app/actions/mmo-engine';

export function AutoMatchManager() {
  const { isLoaded, id: userId, selectedLeagueId, leagueLevel, groupId, allSeasonMatches } = useGameState();
  const db = useFirestore();
  const processingRef = useRef(false);

  const playersInGroupQuery = useMemoFirebase(() => {
    if (!selectedLeagueId) return null;
    return query(
      collection(db, 'players_v10'), 
      where('selectedLeagueId', '==', selectedLeagueId),
      where('leagueLevel', '==', Number(leagueLevel)),
      where('groupId', '==', Number(groupId))
    );
  }, [db, selectedLeagueId, leagueLevel, groupId]);

  const { data: allGroupPlayers } = useCollection(playersInGroupQuery);

  useEffect(() => {
    if (!isLoaded || !userId || !selectedLeagueId || processingRef.current) return;

    const heartbeat = async () => {
      if (processingRef.current) return;
      processingRef.current = true;

      try {
        const seasonInfo = getGlobalSeasonInfo();
        const activeSeason = seasonInfo.activeSeasonNumber;
        const seasonId = `season_${activeSeason}`;
        const league = LEAGUES.find(l => l.id === selectedLeagueId) || LEAGUES[0];
        
        const prefixedGroupId = `${seasonId}_league_${selectedLeagueId}_group_${groupId}`;
        const groupRef = doc(db, 'leagues_v2', selectedLeagueId, 'divisions', String(leagueLevel), 'groups', prefixedGroupId);
        
        const groupSnap = await getDoc(groupRef);
        const currentData = groupSnap.data();

        // 1. СИНХРОНИЗАЦИЯ КАЛЕНДАРЯ
        if (allGroupPlayers && allGroupPlayers.length > 0) {
          const currentTeams = getStableGroupTeams(Number(leagueLevel), Number(groupId), selectedLeagueId, allGroupPlayers);
          const teamsHash = currentTeams.map(t => t.id).join('|');

          const needsUpgrade = !groupSnap.exists() || 
                              (currentData?.calendarVersion || 0) < 15 ||
                              currentData?.teamsHash !== teamsHash;

          if (needsUpgrade) {
            let batch = writeBatch(db);
            const calendar = generateSeasonCalendar(currentTeams);
            const epochMs = new Date('2026-06-17T00:00:00+03:00').getTime();
            const dayMs = 24 * 60 * 60 * 1000;

            batch.set(groupRef, {
              id: prefixedGroupId,
              seasonId,
              seasonNumber: activeSeason,
              teams: currentTeams,
              teamsHash,
              calendarVersion: 15,
              updatedAt: serverTimestamp()
            }, { merge: true });

            calendar.forEach((m) => {
              const matchId = `m_${prefixedGroupId}_d${m.day}_${m.pairKey}`;
              const [hh, mm] = league.startTime.split(':').map(Number);
              const matchTimeOffset = (m.day - 1) * dayMs + (hh * 60 * 60 * 1000) + (mm * 60 * 1000);
              const finalDate = new Date(epochMs + matchTimeOffset);

              batch.set(doc(db, 'matches_v1', matchId), {
                ...m,
                id: matchId,
                seasonId,
                seasonNumber: activeSeason,
                groupId: prefixedGroupId,
                leagueId: selectedLeagueId,
                divisionId: Number(leagueLevel),
                status: 'pending',
                matchStatus: 'pending',
                isFinished: false,
                startTime: finalDate.toISOString(),
                scheduledAt: Timestamp.fromDate(finalDate)
              }, { merge: true });
            });

            await batch.commit();
            console.log("[PULSE V15] Calendar synced.");
          }
        }

        // 2. СЕРВЕРНЫЙ РАСЧЕТ ОЧКОВ (Standings-First Priority)
        const mskTime = getMoscowTime().getTime();
        const overdue = allSeasonMatches.some(m => {
          const startTime = m.startTime ? new Date(m.startTime).getTime() : 0;
          return startTime > 0 && mskTime > startTime && !checkIsMatchFinished(m);
        });

        if (overdue) {
          console.log(`[PULSE V15] Overdue match detected. Requesting server resolution...`);
          await forceResolveGroupMatches(selectedLeagueId, Number(leagueLevel), prefixedGroupId);
        }

      } catch (e: any) {
        console.warn("[PULSE V15] Sync skipped:", e.message);
      } finally {
        processingRef.current = false;
      }
    };

    heartbeat();
    const interval = setInterval(heartbeat, 5000); 
    return () => clearInterval(interval);
  }, [isLoaded, userId, selectedLeagueId, leagueLevel, groupId, allGroupPlayers, db, allSeasonMatches]);

  return null;
}
