'use client';

/**
 * @fileOverview Автономный менеджер синхронизации v56.
 * Исправлено: фильтрация на клиенте для обхода требований к индексам Firestore.
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

  // Облегченный запрос: только по LeagueId, чтобы избежать композитных индексов
  const leaguePlayersQuery = useMemoFirebase(() => {
    if (isUserLoading || !user?.uid || !selectedLeagueId) return null;
    return query(
      collection(db, 'players_v10'), 
      where('selectedLeagueId', '==', String(selectedLeagueId))
    );
  }, [db, selectedLeagueId, isUserLoading, user?.uid]);

  const { data: allLeaguePlayers } = useCollection(leaguePlayersQuery);

  useEffect(() => {
    if (isUserLoading || !user?.uid || !isLoaded || !userId || !selectedLeagueId || !allLeaguePlayers) return;

    const heartbeat = async () => {
      if (processingRef.current) return;
      processingRef.current = true;

      try {
        const info = getGlobalSeasonInfo();
        const currentSN = info.seasonNumber;
        
        // ID таблицы по новому стандарту
        const tableId = `season_${currentSN}_tier_${leagueLevel}_group_${groupId}_league_${selectedLeagueId}`;
        const tableRef = doc(db, 'league_tables', tableId);
        
        const tableSnap = await getDoc(tableRef);
        if (!tableSnap.exists()) {
          console.log(`[ATOMIC SYNC v3.5] Initializing Season ${currentSN} for league ${selectedLeagueId} Group ${groupId}`);
          
          // Фильтруем игроков этой конкретной группы на клиенте
          const groupPlayers = allLeaguePlayers.filter(p => 
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

    const interval = setInterval(heartbeat, 30000);
    heartbeat();
    return () => clearInterval(interval);
  }, [isLoaded, userId, selectedLeagueId, leagueLevel, groupId, allLeaguePlayers, db, isUserLoading, user?.uid, displayName]);

  return null;
}