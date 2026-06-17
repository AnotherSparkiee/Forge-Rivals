/**
 * @fileOverview Автономный менеджер синхронизации v26.
 * Внедрена защита Auth-First для предотвращения ошибок доступа при инициализации.
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
import { getGlobalSeasonInfo, isMatchOverdue, getMoscowTime } from '@/app/lib/time-utils';
import { forceResolveGroupMatches } from '@/app/actions/mmo-engine';

export function AutoMatchManager() {
  const { user, isUserLoading } = useUser();
  const { isLoaded, id: userId, selectedLeagueId, leagueLevel, groupId, allSeasonMatches } = useGameState();
  const db = useFirestore();
  const processingRef = useRef(false);

  const playersInGroupQuery = useMemoFirebase(() => {
    if (isUserLoading || !user || !selectedLeagueId) return null;
    try {
      return query(
        collection(db, 'players_v10'), 
        where('selectedLeagueId', '==', selectedLeagueId),
        where('leagueLevel', '==', Number(leagueLevel)),
        where('groupId', '==', Number(groupId))
      );
    } catch (e) {
      console.error("Manager group query failed", e);
      return null;
    }
  }, [db, selectedLeagueId, leagueLevel, groupId, isUserLoading, user]);

  const { data: allGroupPlayers } = useCollection(playersInGroupQuery);

  useEffect(() => {
    if (isUserLoading || !user || !isLoaded || !userId || !selectedLeagueId || !allGroupPlayers) return;

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

        const currentTeams = getStableGroupTeams(Number(leagueLevel), Number(groupId), selectedLeagueId, allGroupPlayers);
        const teamsHash = currentTeams.map(t => t.id).join('|');

        const needsUpgrade = !groupSnap.exists() || 
                            (currentData?.calendarVersion || 0) < 25 ||
                            currentData?.teamsHash !== teamsHash;

        if (needsUpgrade) {
          console.log(`[V25 Manager] Synchronizing League Grid for ${prefixedGroupId}...`);
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
            calendarVersion: 25,
            updatedAt: serverTimestamp()
          }, { merge: true });

          currentTeams.forEach(team => {
            const teamInGroupRef = doc(db, 'leagues_v2', selectedLeagueId, 'divisions', String(leagueLevel), 'groups', prefixedGroupId, 'teams', team.id);
            batch.set(teamInGroupRef, {
              id: team.id,
              name: team.name,
              displayName: team.name,
              wins: 0,
              draws: 0,
              losses: 0,
              points: 0,
              updatedAt: serverTimestamp()
            }, { merge: true });
          });

          calendar.forEach((m) => {
            const matchId = `m_${prefixedGroupId}_d${m.day}_${m.pairKey}`;
            const [hh, mm] = league.startTime.split(':').map(Number);
            
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
              isFinished: false,
              startTime: finalDate.toISOString(),
              scheduledAt: Timestamp.fromDate(finalDate),
              version: 25
            }, { merge: true });
          });

          await batch.commit();
          console.log(`[V25 Manager] Batch committed. Calendar active.`);
        }

        const overdueMatches = allSeasonMatches.filter(m => {
          return isMatchOverdue(m.startTime) && !checkIsMatchFinished(m);
        });

        if (overdueMatches.length > 0) {
          console.log(`[V25 Manager] Found ${overdueMatches.length} overdue matches. Triggering server action...`);
          await forceResolveGroupMatches(selectedLeagueId, Number(leagueLevel), prefixedGroupId);
        }

      } catch (e: any) {
        console.warn("[V25 Manager] Pulse error:", e.message);
      } finally {
        processingRef.current = false;
      }
    };

    heartbeat();
    const interval = setInterval(heartbeat, 15000); 
    return () => clearInterval(interval);
  }, [isLoaded, userId, selectedLeagueId, leagueLevel, groupId, allGroupPlayers, db, allSeasonMatches, isUserLoading, user]);

  return null;
}
