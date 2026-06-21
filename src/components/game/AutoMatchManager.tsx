'use client';

/**
 * @fileOverview Автономный менеджер синхронизации v60.
 * Упрощенный триггер для серверной инициализации.
 */

import { useEffect, useRef } from 'react';
import { useGameState } from '@/app/lib/store';
import { useUser, useFirestore } from '@/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { getGlobalSeasonInfo } from '@/app/lib/time-utils';
import { ensureWorldInitialized } from '@/app/actions/season-init';

export function AutoMatchManager() {
  const { user, isUserLoading } = useUser();
  const { isLoaded, id: userId, selectedLeagueId, leagueLevel, groupId } = useGameState();
  const db = useFirestore();
  const processingRef = useRef(false);

  useEffect(() => {
    if (isUserLoading || !user?.uid || !isLoaded || !userId || !selectedLeagueId) return;

    const checkAndInit = async () => {
      if (processingRef.current) return;
      processingRef.current = true;

      try {
        const info = getGlobalSeasonInfo();
        const currentSN = info.seasonNumber;
        
        const tableId = `season_${currentSN}_tier_${leagueLevel}_group_${groupId}_league_${selectedLeagueId}`;
        const tableRef = doc(db, 'league_tables_v1', tableId);
        
        const tableSnap = await getDoc(tableRef);
        const needsInit = !tableSnap.exists() || (tableSnap.data()?.version || 0) < 35;

        if (needsInit) {
          console.log(`[SYNC] Triggering Server Init for Group ${groupId}...`);
          await ensureWorldInitialized(currentSN, selectedLeagueId, Number(leagueLevel), Number(groupId), userId);
          console.log("[SYNC] World Initialized.");
        }

      } catch (e: any) {
        console.error("[SYNC ERROR]", e);
      } finally {
        processingRef.current = false;
      }
    };

    const interval = setInterval(checkAndInit, 30000);
    checkAndInit();
    return () => clearInterval(interval);
  }, [isLoaded, userId, selectedLeagueId, leagueLevel, groupId, isUserLoading, user?.uid, db]);

  return null;
}
