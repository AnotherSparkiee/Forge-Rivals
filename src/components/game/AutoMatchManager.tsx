'use client';

import { useEffect, useRef } from 'react';
import { useGameState } from '@/app/lib/store';
import { getGlobalSeasonInfo } from '@/app/lib/time-utils';
import { useFirestore, useUser } from '@/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { resolveDailyMatches } from '@/app/actions/autonomous-cycle';

/**
 * ГЛОБАЛЬНЫЙ СИНХРОНИЗАТОР v18.0 (Unconditional World Engine)
 * Запускает автономный цикл постройки мира сразу после авторизации пользователя.
 */
export function AutoMatchManager() {
  const { 
    isLoaded, selectedLeagueId, 
    leagueLevel, groupId, setWorldReady,
    saveToLocal
  } = useGameState();
  
  const { user } = useUser();
  const db = useFirestore();
  const syncStartedRef = useRef<string | null>(null);
  const heartbeatStartedRef = useRef(false);

  // 1. СИНХРОНИЗАЦИЯ КАЛЕНДАРЯ (только для зарегистрированных с лигой)
  useEffect(() => {
    if (!isLoaded || !db || !selectedLeagueId || !user) {
      if (isLoaded && !user) setWorldReady(true);
      return;
    }
    
    const info = getGlobalSeasonInfo();
    const currentSeason = info.activeSeasonNumber;
    const currentContext = `${selectedLeagueId}_L${leagueLevel}_G${groupId}_S${currentSeason}`;
    
    if (syncStartedRef.current !== currentContext) {
      syncStartedRef.current = currentContext;

      const syncMatches = async () => {
        try {
          console.log(`[AUTO SYNC] Syncing calendar for ${currentContext}`);
          const q = query(collection(db, 'matches_v1'), 
            where('leagueId', '==', selectedLeagueId),
            where('level', '==', leagueLevel),
            where('groupId', '==', groupId),
            where('season', '==', currentSeason)
          );
          const matchesSnap = await getDocs(q);
          const officialMatches = matchesSnap.docs.map(d => ({ ...d.data(), id: d.id }));
          
          if (officialMatches.length > 0) {
            saveToLocal({ 
              allSeasonMatches: officialMatches.sort((a, b) => a.tour - b.tour),
              seasonNumber: currentSeason
            });
          }
        } catch (e) {
          console.error("[AUTO SYNC] Sync failed:", e);
        } finally {
          setWorldReady(true);
        }
      };

      syncMatches();
    }
  }, [isLoaded, selectedLeagueId, leagueLevel, groupId, user, saveToLocal, setWorldReady, db]);

  // 2. ГЛОБАЛЬНОЕ СЕРДЦЕБИЕНИЕ (Запуск постройки мира ботами)
  // Работает для любого авторизованного пользователя
  useEffect(() => {
    if (!isLoaded || !db || !user || heartbeatStartedRef.current) return;

    heartbeatStartedRef.current = true;
    
    const triggerHeartbeat = async () => {
      try {
        console.log("[HEARTBEAT] Unconditional world build sync triggered...");
        // Серверный экшен теперь сам разберется с лигой и сезоном
        await resolveDailyMatches();
      } catch (e) {
        console.error("[HEARTBEAT] Cycle error:", e);
      }
    };

    triggerHeartbeat();
    // Повторяем каждые 3 минуты (ускорено) для активного заполнения пирамиды
    const interval = setInterval(triggerHeartbeat, 180000);
    return () => clearInterval(interval);
  }, [isLoaded, db, user]);

  return null;
}
