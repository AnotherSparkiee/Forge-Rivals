'use client';

/**
 * @fileOverview Автономный менеджер синхронизации v55.
 * Исправлено: принудительная инициализация при отсутствии документов.
 */

import { useEffect, useRef } from 'react';
import { useGameState } from '@/app/lib/store';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { doc, getDoc, collection, query, where } from 'firebase/firestore';
import { getGlobalSeasonInfo } from '@/app/lib/time-utils';
import { initializeSeasonGroup, initializePyramidCup } from '@/app/actions/season-init';

export function AutoMatchManager() {
  const { user, isUserLoading } = useUser();
  const { isLoaded, id: userId, selectedLeagueId, leagueLevel, groupId } = useGameState();
  const db = useFirestore();
  const processingRef = useRef(false);

  const leaguePlayersQuery = useMemoFirebase(() => {
    if (isUserLoading || !user?.uid || !selectedLeagueId) return null;
    return query(
      collection(db, 'players_v10'), 
      where('selectedLeagueId', '==', String(selectedLeagueId)),
      where('leagueLevel', '==', Number(leagueLevel)),
      where('groupId', '==', Number(groupId))
    );
  }, [db, selectedLeagueId, leagueLevel, groupId, isUserLoading, user?.uid]);

  const { data: groupPlayers } = useCollection(leaguePlayersQuery);

  useEffect(() => {
    if (isUserLoading || !user?.uid || !isLoaded || !userId || !selectedLeagueId || !groupPlayers) return;

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
          console.log(`[ATOMIC SYNC v3] Initializing Season ${currentSN} for league ${selectedLeagueId} Group ${groupId}`);
          
          const players = groupPlayers.map(p => ({
            id: p.id,
            name: p.displayName || `Manager_${p.id.slice(0,4)}`
          }));

          // 1. Создаем таблицу и 14 туров атомарно
          await initializeSeasonGroup(currentSN, Number(leagueLevel), Number(groupId), selectedLeagueId, players);
          
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

    const interval = setInterval(heartbeat, 60000);
    heartbeat();
    return () => clearInterval(interval);
  }, [isLoaded, userId, selectedLeagueId, leagueLevel, groupId, groupPlayers, db, isUserLoading, user?.uid]);

  return null;
}