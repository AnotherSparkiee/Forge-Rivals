'use client';

/**
 * @fileOverview Автономный менеджер синхронизации v57.
 * Оптимизация: загрузка всех игроков лиги без индекса и клиентская фильтрация.
 */

import { useEffect, useRef } from 'react';
import { useGameState } from '@/app/lib/store';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { doc, getDoc, collection, query, where } from 'firebase/firestore';
import { getGlobalSeasonInfo } from '@/app/lib/time-utils';
import { initializeSeasonGroup, initializePyramidCup } from '@/app/actions/season-init';

export function AutoMatchManager() {
  const { user, isUserLoading } = useUser();
  const { isLoaded, id: userId, selectedLeagueId, leagueLevel, groupId, displayName } = useGameState();
  const db = useFirestore();
  const processingRef = useRef(false);

  // Оптимизация: убираем 'where', чтобы запрос работал без ручного создания индекса в Firebase
  // Для прототипа это самый надежный способ гарантировать появление данных.
  const allPlayersQuery = useMemoFirebase(() => {
    if (isUserLoading || !user?.uid) return null;
    return collection(db, 'players_v10');
  }, [db, isUserLoading, user?.uid]);

  const { data: allGlobalPlayers } = useCollection(allPlayersQuery);

  useEffect(() => {
    if (isUserLoading || !user?.uid || !isLoaded || !userId || !selectedLeagueId || !allGlobalPlayers) return;

    const heartbeat = async () => {
      if (processingRef.current) return;
      processingRef.current = true;

      try {
        const info = getGlobalSeasonInfo();
        const currentSN = info.seasonNumber;
        
        // ID таблицы в унифицированной коллекции v1
        const tableId = `season_${currentSN}_tier_${leagueLevel}_group_${groupId}_league_${selectedLeagueId}`;
        const tableRef = doc(db, 'league_tables_v1', tableId);
        
        const tableSnap = await getDoc(tableRef);
        const needsInit = !tableSnap.exists() || (tableSnap.data()?.version || 0) < 35;

        if (needsInit) {
          console.log(`[ATOMIC SYNC v3.5] Initializing Season ${currentSN} for league ${selectedLeagueId} Group ${groupId}`);
          
          // Фильтруем игроков этой конкретной группы на клиенте (MAX reliability)
          const groupPlayers = allGlobalPlayers.filter(p => 
            p.selectedLeagueId === String(selectedLeagueId) &&
            Number(p.leagueLevel) === Number(leagueLevel) && 
            Number(p.groupId) === Number(groupId)
          );

          // Убеждаемся, что текущий игрок точно включен с актуальным именем
          const playersToInit = groupPlayers.map(p => ({
            id: p.id,
            name: p.displayName || `Manager_${p.id.slice(0,4)}`
          }));

          const hasMe = playersToInit.some(p => p.id === userId);
          if (!hasMe) {
            playersToInit.push({
              id: userId,
              name: displayName || `Manager_${userId.slice(0,4)}`
            });
          }

          // 1. Создаем таблицу и 14 туров атомарно
          await initializeSeasonGroup(currentSN, Number(leagueLevel), Number(groupId), selectedLeagueId, playersToInit);
          
          // 2. Создаем сетку кубка для всей лиги атомарно
          await initializePyramidCup(currentSN, selectedLeagueId);
          
          console.log("[ATOMIC SYNC] Season data established successfully.");
        }

      } catch (e: any) {
        console.error("[GLOBAL SYNC ERROR]", e);
      } finally {
        processingRef.current = false;
      }
    };

    const interval = setInterval(heartbeat, 15000);
    heartbeat();
    return () => clearInterval(interval);
  }, [isLoaded, userId, selectedLeagueId, leagueLevel, groupId, allGlobalPlayers, db, isUserLoading, user?.uid, displayName]);

  return null;
}