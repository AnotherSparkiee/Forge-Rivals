'use client';

/**
 * @fileOverview Автономный менеджер синхронизации v58.
 * Гарантированный запуск Лиги и Кубка при входе игрока.
 */

import { useEffect, useRef } from 'react';
import { useGameState } from '@/app/lib/store';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { doc, getDoc, collection } from 'firebase/firestore';
import { getGlobalSeasonInfo } from '@/app/lib/time-utils';
import { initializeSeasonGroup, initializePyramidCup } from '@/app/actions/season-init';

export function AutoMatchManager() {
  const { user, isUserLoading } = useUser();
  const { isLoaded, id: userId, selectedLeagueId, leagueLevel, groupId, displayName } = useGameState();
  const db = useFirestore();
  const processingRef = useRef(false);

  // Загружаем всех игроков лиги для распределения
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
        
        // ID таблицы по новому стандарту
        const tableId = `season_${currentSN}_tier_${leagueLevel}_group_${groupId}_league_${selectedLeagueId}`;
        const tableRef = doc(db, 'league_tables_v1', tableId);
        
        const tableSnap = await getDoc(tableRef);
        const needsInit = !tableSnap.exists() || (tableSnap.data()?.version || 0) < 35;

        if (needsInit) {
          console.log(`[WORLD SYNC v4.0] Initializing World for League ${selectedLeagueId} Group ${groupId}`);
          
          // 1. Фильтруем участников группы
          const groupPlayers = allGlobalPlayers.filter(p => 
            p.selectedLeagueId === selectedLeagueId &&
            Number(p.leagueLevel) === Number(leagueLevel) && 
            Number(p.groupId) === Number(groupId)
          );

          const playersToInit = groupPlayers.map(p => ({
            id: p.id,
            name: p.displayName || `Manager_${p.id.slice(0,4)}`
          }));

          // Убеждаемся, что мы в списке
          if (!playersToInit.some(p => p.id === userId)) {
            playersToInit.push({ id: userId, name: displayName || `Manager_${userId.slice(0,4)}` });
          }

          // 2. Атомарно создаем лигу и матчи
          await initializeSeasonGroup(currentSN, Number(leagueLevel), Number(groupId), selectedLeagueId, playersToInit);
          
          // 3. Атомарно создаем кубок лиги
          await initializePyramidCup(currentSN, selectedLeagueId);
          
          console.log("[WORLD SYNC] Operations completed successfully.");
        }

      } catch (e: any) {
        console.error("[WORLD SYNC ERROR]", e);
      } finally {
        processingRef.current = false;
      }
    };

    const interval = setInterval(heartbeat, 30000);
    heartbeat();
    return () => clearInterval(interval);
  }, [isLoaded, userId, selectedLeagueId, leagueLevel, groupId, allGlobalPlayers, db, isUserLoading, user?.uid, displayName]);

  return null;
}
