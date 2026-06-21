'use client';

/**
 * @fileOverview Автономный менеджер синхронизации v67.
 * Проверяет наличие турнирных таблиц и участие пользователя в них.
 * Исправлена передача имени для инициализации.
 */

import { useEffect, useRef } from 'react';
import { useGameState } from '@/app/lib/store';
import { useUser, useFirestore } from '@/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { getGlobalSeasonInfo } from '@/app/lib/time-utils';
import { ensureWorldInitialized } from '@/app/actions/season-init';

export function AutoMatchManager() {
  const { user, isUserLoading } = useUser();
  const { isLoaded, id: userId, displayName, selectedLeagueId, leagueLevel, groupId } = useGameState();
  const db = useFirestore();
  const processingRef = useRef(false);

  useEffect(() => {
    if (isUserLoading || !user?.uid || !isLoaded || !userId || !selectedLeagueId) return;

    const checkAndInit = async () => {
      if (processingRef.current) return;
      processingRef.current = true;

      try {
        const info = getGlobalSeasonInfo();
        const currentSN = Number(info.seasonNumber);
        
        const tableId = `season_${currentSN}_tier_${leagueLevel}_group_${groupId}_league_${selectedLeagueId}`;
        const tableRef = doc(db, 'league_tables_v1', tableId);
        
        const tableSnap = await getDoc(tableRef);
        
        let needsInit = false;
        if (!tableSnap.exists()) {
          needsInit = true;
        } else {
          const data = tableSnap.data();
          const isUserMissing = !data.teams?.includes(userId);
          const isOldVersion = (data.version || 0) < 35;
          if (isUserMissing || isOldVersion) {
            needsInit = true;
          }
        }

        if (needsInit) {
          console.log(`[SYNC-v67] Synchronizing World Node: ${tableId}`);
          await ensureWorldInitialized(
            currentSN, 
            String(selectedLeagueId), 
            Number(leagueLevel), 
            Number(groupId), 
            userId,
            displayName || `Manager_${userId.slice(0, 4)}`
          );
        }
      } catch (e: any) {
        console.error("[SYNC ERROR]", e);
      } finally {
        processingRef.current = false;
      }
    };

    // Опрашиваем каждые 30 секунд для поддержания синхронизации
    const interval = setInterval(checkAndInit, 30000);
    checkAndInit();
    return () => clearInterval(interval);
  }, [isLoaded, userId, displayName, selectedLeagueId, leagueLevel, groupId, isUserLoading, user?.uid, db]);

  return null;
}