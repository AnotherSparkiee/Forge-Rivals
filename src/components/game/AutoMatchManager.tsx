'use client';

/**
 * @fileOverview Автономный менеджер синхронизации v31 "Clean Slate".
 * 1. Очищает старые данные (версии < 31).
 * 2. Инициализирует таблицы лиг (очки в 0).
 * 3. Генерирует календарь Лиги и Кубка СТРОГО 19.06 в 16:00.
 */

import { useEffect, useRef } from 'react';
import { useGameState } from '@/app/lib/store';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { doc, getDoc, writeBatch, collection, query, where, serverTimestamp, Timestamp, getDocs, updateDoc } from 'firebase/firestore';
import { 
  getStableGroupTeams, generateSeasonCalendar, 
  LEAGUES 
} from '@/app/lib/leagues-data';
import { getGlobalSeasonInfo, isMatchOverdue, getMoscowTime } from '@/app/lib/time-utils';
import { forceResolveGroupMatches } from '@/app/actions/mmo-engine';
import { generatePyramidCup } from '@/app/actions/cup-engine';

export function AutoMatchManager() {
  const { user, isUserLoading } = useUser();
  const { isLoaded, id: userId, selectedLeagueId, leagueLevel, groupId, allSeasonMatches } = useGameState();
  const db = useFirestore();
  const processingRef = useRef(false);

  const playersInGroupQuery = useMemoFirebase(() => {
    if (isUserLoading || !user?.uid || !selectedLeagueId) return null;
    return query(
      collection(db, 'players_v10'), 
      where('selectedLeagueId', '==', String(selectedLeagueId)),
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
        const info = getGlobalSeasonInfo();
        const mskNow = getMoscowTime();
        const activeSN = Number(info.activeSeasonNumber);
        const seasonId = `season_${activeSN}`;
        const league = LEAGUES.find(l => l.id === selectedLeagueId) || LEAGUES[0];
        const prefixedGroupId = `${seasonId}_league_${selectedLeagueId}_group_${groupId}`;
        
        const groupRef = doc(db, 'leagues_v2', selectedLeagueId, 'divisions', String(leagueLevel), 'groups', prefixedGroupId);
        const groupSnap = await getDoc(groupRef);
        
        const currentVersion = groupSnap.data()?.calendarVersion || 0;
        const needsUpgrade = currentVersion < 31; // ВЕРСИЯ 31

        // ГЛОБАЛЬНЫЙ ТРИГГЕР: 19.06.2026 16:00
        const triggerTime = new Date('2026-06-19T16:00:00+03:00').getTime();
        const isTriggerTime = mskNow.getTime() >= triggerTime;

        if (needsUpgrade) {
          // 1. Очистка старых матчей группы
          const qOld = query(collection(db, 'matches_v1'), where('groupId', '==', String(prefixedGroupId)));
          const oldSnap = await getDocs(qOld);
          if (!oldSnap.empty) {
            let clearBatch = writeBatch(db);
            oldSnap.docs.forEach(d => clearBatch.delete(d.ref));
            await clearBatch.commit();
          }

          // 2. Сброс таблицы лиги
          let batch = writeBatch(db);
          const currentTeams = getStableGroupTeams(Number(leagueLevel), Number(groupId), selectedLeagueId, allGroupPlayers);
          
          batch.set(groupRef, {
            id: prefixedGroupId,
            seasonId,
            seasonNumber: activeSN,
            calendarVersion: 31,
            status: 'offseason_reset',
            updatedAt: serverTimestamp()
          }, { merge: true });

          currentTeams.forEach(team => {
            const teamRef = doc(db, 'leagues_v2', selectedLeagueId, 'divisions', String(leagueLevel), 'groups', prefixedGroupId, 'teams', team.id);
            batch.set(teamRef, {
              id: team.id,
              name: team.name,
              wins: 0, draws: 0, losses: 0, points: 0,
              updatedAt: serverTimestamp()
            }, { merge: true });
          });

          await batch.commit();
        }

        // ГЕНЕРАЦИЯ КАЛЕНДАРЯ (Лига + Кубок) - Сработает 19.06 16:00
        if (isTriggerTime) {
          const sysStatusRef = doc(db, 'system_v1', 'status');
          const sysStatus = await getDoc(sysStatusRef);
          const groupData = groupSnap.data();
          
          // Генерируем лигу, если еще не готова для этой версии
          if (groupData?.status !== 'ready_for_battle') {
            const currentTeams = getStableGroupTeams(Number(leagueLevel), Number(groupId), selectedLeagueId, allGroupPlayers);
            const calendar = generateSeasonCalendar(currentTeams);
            const epochMs = new Date('2026-06-20T00:00:00+03:00').getTime();
            const dayMs = 24 * 60 * 60 * 1000;

            let batch = writeBatch(db);
            calendar.forEach((m) => {
              const matchId = `m_${prefixedGroupId}_d${m.day}_${m.pairKey}`;
              const [hh, mm] = league.startTime.split(':').map(Number);
              const offset = (activeSN - 1) * 16 * dayMs + (m.day - 1) * dayMs + (hh * 60 * 60 * 1000) + (mm * 60 * 1000);
              const finalDate = new Date(epochMs + offset);

              batch.set(doc(db, 'matches_v1', matchId), {
                ...m,
                id: matchId,
                day: Number(m.day),
                seasonId,
                seasonNumber: activeSN,
                groupId: String(prefixedGroupId),
                leagueId: String(selectedLeagueId),
                divisionId: Number(leagueLevel),
                status: 'scheduled',
                isFinished: false,
                startTime: finalDate.toISOString(),
                scheduledAt: Timestamp.fromDate(finalDate),
                version: 31
              }, { merge: true });
            });
            
            batch.update(groupRef, { status: 'ready_for_battle', updatedAt: serverTimestamp() });
            await batch.commit();
          }

          // Генерируем Кубок один раз в день триггера
          const lastCupGen = sysStatus.data()?.lastCupGenerationDate || "";
          const todayStr = mskNow.toISOString().split('T')[0];

          if (lastCupGen !== todayStr) {
            await generatePyramidCup();
            await updateDoc(sysStatusRef, { lastCupGenerationDate: todayStr });
          }
        }

        // Расчет только если сезон реально идет
        if (!info.isOffseason && groupSnap.data()?.status === 'ready_for_battle') {
          const overdue = allSeasonMatches.filter(m => m.version === 31 && isMatchOverdue(m.startTime) && !m.isFinished);
          if (overdue.length > 0) {
            await forceResolveGroupMatches(selectedLeagueId, Number(leagueLevel), prefixedGroupId);
          }
        }

      } catch (e: any) {
        // Фоновая ошибка
      } finally {
        processingRef.current = false;
      }
    };

    const interval = setInterval(heartbeat, 30000); 
    heartbeat();
    return () => clearInterval(interval);
  }, [isLoaded, userId, selectedLeagueId, leagueLevel, groupId, allGroupPlayers, db, allSeasonMatches, isUserLoading, user?.uid]);

  return null;
}
