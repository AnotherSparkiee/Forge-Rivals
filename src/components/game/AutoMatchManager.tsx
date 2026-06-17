/**
 * @fileOverview Автономный движок сезонов v18 (Reality Sync). 
 * Пересчитывает календарь под актуальную эпоху 2024 года.
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
import { getGlobalSeasonInfo, isMatchOverdue } from '@/app/lib/time-utils';
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
    if (!isLoaded || !userId || !selectedLeagueId) return;

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

        // 1. СИНХРОНИЗАЦИЯ КАЛЕНДАРЯ ПОД ТЕКУЩУЮ ЭПОХУ (V18)
        if (allGroupPlayers && allGroupPlayers.length > 0) {
          const currentTeams = getStableGroupTeams(Number(leagueLevel), Number(groupId), selectedLeagueId, allGroupPlayers);
          const teamsHash = currentTeams.map(t => t.id).join('|');

          const needsUpgrade = !groupSnap.exists() || 
                              (currentData?.calendarVersion || 0) < 18 ||
                              currentData?.teamsHash !== teamsHash;

          if (needsUpgrade) {
            let batch = writeBatch(db);
            const calendar = generateSeasonCalendar(currentTeams);
            
            // СТРОГОЕ СООТВЕТСТВИЕ EPOCH 2024
            const epochMs = new Date('2024-06-17T00:00:00+03:00').getTime();
            const dayMs = 24 * 60 * 60 * 1000;

            batch.set(groupRef, {
              id: prefixedGroupId,
              seasonId,
              seasonNumber: activeSeason,
              teams: currentTeams,
              teamsHash,
              calendarVersion: 18,
              updatedAt: serverTimestamp()
            }, { merge: true });

            calendar.forEach((m) => {
              const matchId = `m_${prefixedGroupId}_d${m.day}_${m.pairKey}`;
              const [hh, mm] = league.startTime.split(':').map(Number);
              
              // Находим время старта в рамках ТЕКУЩЕГО РЕАЛЬНОГО СЕЗОНА
              const matchTimeOffset = (activeSeason - 1) * 16 * dayMs + (m.day - 1) * dayMs + (hh * 60 * 60 * 1000) + (mm * 60 * 1000);
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
            console.log("[V18 PULSE] Reality Calendar Synced.");
          }
        }

        // 2. ПРИНУДИТЕЛЬНЫЙ РАСЧЕТ ПРОСРОЧЕННЫХ МАТЧЕЙ
        const overdueMatches = allSeasonMatches.filter(m => {
          return isMatchOverdue(m.startTime) && !checkIsMatchFinished(m);
        });

        if (overdueMatches.length > 0) {
          console.log(`[V18 PULSE] Resolving ${overdueMatches.length} overdue matches for ${prefixedGroupId}`);
          await forceResolveGroupMatches(selectedLeagueId, Number(leagueLevel), prefixedGroupId);
        }

      } catch (e: any) {
        console.warn("[V18 PULSE] Heartbeat error:", e.message);
      } finally {
        processingRef.current = false;
      }
    };

    heartbeat();
    const interval = setInterval(heartbeat, 10000); 
    return () => clearInterval(interval);
  }, [isLoaded, userId, selectedLeagueId, leagueLevel, groupId, allGroupPlayers, db, allSeasonMatches]);

  return null;
}
