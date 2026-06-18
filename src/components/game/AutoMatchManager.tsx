'use client';

/**
 * @fileOverview Автономный менеджер синхронизации v32 "Infinite Cycles".
 * 
 * Логика:
 * 1. День 15, время >= 16:00 — Генерация календаря Лиги и Кубка для СЛЕДУЮЩЕГО сезона.
 * 2. Очистка старых данных при смене версии.
 * 3. Транзакционный расчет матчей в реальном времени.
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
        
        // Сезон, который мы должны сгенерировать сегодня в 16:00
        const nextSN = info.seasonNumber + 1;
        const nextSeasonId = `season_${nextSN}`;
        
        const league = LEAGUES.find(l => l.id === selectedLeagueId) || LEAGUES[0];
        const nextPrefixedGroupId = `${nextSeasonId}_league_${selectedLeagueId}_group_${groupId}`;
        
        // Глобальный статус системы для предотвращения дублей
        const sysStatusRef = doc(db, 'system_v1', 'status');
        const sysStatusSnap = await getDoc(sysStatusRef);
        const sysData = sysStatusSnap.exists() ? sysStatusSnap.data() : {};

        // 1. ПРОВЕРКА ТРИГГЕРА ГЕНЕРАЦИИ (День 15, 16:00)
        const isGenTime = info.dayOfCycle === 15 && mskNow.getHours() >= 16;
        
        if (isGenTime) {
          // Проверяем, генерировали ли мы уже этот сезон глобально
          const lastGenSeason = sysData.lastGeneratedSeason || 0;
          
          if (lastGenSeason < nextSN) {
            console.log(`[AUTO-GEN] Triggering Global Generation for Season ${nextSN}`);
            
            // Генерация Кубка (Атомарное действие на всю лигу)
            await generatePyramidCup(nextSN);
            
            // Обновляем глобальный флаг
            await updateDoc(sysStatusRef, { 
              lastGeneratedSeason: nextSN,
              lastGenTimestamp: serverTimestamp() 
            });
          }

          // Локальная генерация календаря группы (если еще нет)
          const groupRef = doc(db, 'leagues_v2', selectedLeagueId, 'divisions', String(leagueLevel), 'groups', nextPrefixedGroupId);
          const groupSnap = await getDoc(groupRef);

          if (!groupSnap.exists() || groupSnap.data()?.status !== 'ready_for_battle') {
            const currentTeams = getStableGroupTeams(Number(leagueLevel), Number(groupId), selectedLeagueId, allGroupPlayers);
            const calendar = generateSeasonCalendar(currentTeams);
            
            // Начало следующего сезона (День 1 следующего цикла)
            const nextSeasonEpochMs = info.nextSeasonStart.getTime();
            const dayMs = 24 * 60 * 60 * 1000;

            let batch = writeBatch(db);
            
            // Инициализация группы
            batch.set(groupRef, {
              id: nextPrefixedGroupId,
              seasonId: nextSeasonId,
              seasonNumber: nextSN,
              status: 'ready_for_battle',
              updatedAt: serverTimestamp()
            }, { merge: true });

            // Генерация матчей
            calendar.forEach((m) => {
              const matchId = `m_${nextPrefixedGroupId}_d${m.day}_${m.pairKey}`;
              const [hh, mm] = league.startTime.split(':').map(Number);
              const offset = (m.day - 1) * dayMs + (hh * 60 * 60 * 1000) + (mm * 60 * 1000);
              const finalDate = new Date(nextSeasonEpochMs + offset);

              batch.set(doc(db, 'matches_v1', matchId), {
                ...m,
                id: matchId,
                day: Number(m.day),
                seasonId: nextSeasonId,
                seasonNumber: nextSN,
                groupId: String(nextPrefixedGroupId),
                leagueId: String(selectedLeagueId),
                divisionId: Number(leagueLevel),
                status: 'scheduled',
                isFinished: false,
                startTime: finalDate.toISOString(),
                scheduledAt: Timestamp.fromDate(finalDate),
                version: 31
              }, { merge: true });
            });

            // Обнуление очков команд для нового сезона
            currentTeams.forEach(team => {
              const teamRef = doc(db, 'leagues_v2', selectedLeagueId, 'divisions', String(leagueLevel), 'groups', nextPrefixedGroupId, 'teams', team.id);
              batch.set(teamRef, {
                id: team.id,
                name: team.name,
                wins: 0, draws: 0, losses: 0, points: 0,
                updatedAt: serverTimestamp()
              }, { merge: true });
            });

            await batch.commit();
            console.log(`[AUTO-GEN] Group ${nextPrefixedGroupId} initialized successfully.`);
          }
        }

        // 2. РЕЗОЛВЕР МАТЧЕЙ (Если сезон идет)
        if (!info.isOffseason) {
          const seasonId = `season_${info.seasonNumber}`;
          const currentPrefixedGroupId = `${seasonId}_league_${selectedLeagueId}_group_${groupId}`;
          const overdue = allSeasonMatches.filter(m => isMatchOverdue(m.startTime) && !m.isFinished);
          
          if (overdue.length > 0) {
            await forceResolveGroupMatches(selectedLeagueId, Number(leagueLevel), currentPrefixedGroupId);
          }
        }

      } catch (e: any) {
        console.error("[AUTO-MANAGER ERROR]", e);
      } finally {
        processingRef.current = false;
      }
    };

    const interval = setInterval(heartbeat, 60000); 
    heartbeat();
    return () => clearInterval(interval);
  }, [isLoaded, userId, selectedLeagueId, leagueLevel, groupId, allGroupPlayers, db, allSeasonMatches, isUserLoading, user?.uid]);

  return null;
}
