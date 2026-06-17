'use client';

/**
 * @fileOverview Автономный менеджер синхронизации v26.
 * Оптимизирован для "тихой" фоновой работы без визуальных морганий.
 */

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

  // Стабильный запрос игроков группы
  const playersInGroupQuery = useMemoFirebase(() => {
    if (isUserLoading || !user?.uid || !selectedLeagueId) return null;
    return query(
      collection(db, 'players_v10'), 
      where('selectedLeagueId', '==', selectedLeagueId),
      where('leagueLevel', '==', Number(leagueLevel)),
      where('groupId', '==', Number(groupId))
    );
  }, [db, selectedLeagueId, leagueLevel, groupId, isUserLoading, user?.uid]);

  const { data: allGroupPlayers } = useCollection(playersInGroupQuery);

  useEffect(() => {
    if (isUserLoading || !user?.uid || !isLoaded || !userId || !selectedLeagueId || !allGroupPlayers) return;

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
        const currentTeams = getStableGroupTeams(Number(leagueLevel), Number(groupId), selectedLeagueId, allGroupPlayers);
        const teamsHash = currentTeams.map(t => t.id).join('|');

        // Инициализация сетки если нужно
        const needsUpgrade = !groupSnap.exists() || 
                            (groupSnap.data()?.calendarVersion || 0) < 25 ||
                            groupSnap.data()?.teamsHash !== teamsHash;

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
            calendarVersion: 25,
            updatedAt: serverTimestamp()
          }, { merge: true });

          currentTeams.forEach(team => {
            const teamRef = doc(db, 'leagues_v2', selectedLeagueId, 'divisions', String(leagueLevel), 'groups', prefixedGroupId, 'teams', team.id);
            batch.set(teamRef, {
              id: team.id,
              name: team.name,
              displayName: team.name,
              wins: 0, draws: 0, losses: 0, points: 0,
              updatedAt: serverTimestamp()
            }, { merge: true });
          });

          calendar.forEach((m) => {
            const matchId = `m_${prefixedGroupId}_d${m.day}_${m.pairKey}`;
            const [hh, mm] = league.startTime.split(':').map(Number);
            const offset = (activeSeason - 1) * 16 * dayMs + (m.day - 1) * dayMs + (hh * 60 * 60 * 1000) + (mm * 60 * 1000);
            const finalDate = new Date(epochMs + offset);

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
        }

        // Фоновый расчет просроченных матчей
        const overdue = allSeasonMatches.filter(m => isMatchOverdue(m.startTime) && !checkIsMatchFinished(m));
        if (overdue.length > 0) {
          await forceResolveGroupMatches(selectedLeagueId, Number(leagueLevel), prefixedGroupId);
        }

      } catch (e: any) {
        // Ошибки логируются только в консоль для дебага, не мешая пользователю
        console.debug("[V26 Sync Pulse]:", e.message);
      } finally {
        processingRef.current = false;
      }
    };

    const interval = setInterval(heartbeat, 15000); 
    heartbeat();
    return () => clearInterval(interval);
  }, [isLoaded, userId, selectedLeagueId, leagueLevel, groupId, allGroupPlayers, db, allSeasonMatches, isUserLoading, user?.uid]);

  return null;
}