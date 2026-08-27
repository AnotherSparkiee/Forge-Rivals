'use client';

import { useEffect, useRef } from 'react';
import { useGameState } from '@/app/lib/store';
import { getGlobalSeasonInfo } from '@/app/lib/time-utils';
import { useFirestore } from '@/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { resolveDailyMatches } from '@/app/actions/autonomous-cycle';

/**
 * ГЛОБАЛЬНЫЙ СИНХРОНИЗАТОР v16.0 (Active Heartbeat)
 * Этот компонент служит триггером для серверного автономного цикла.
 * Он инициирует расчеты на сервере и синхронизирует локальное состояние.
 */
export function AutoMatchManager() {
  const { 
    isLoaded, selectedLeagueId, 
    leagueLevel, groupId, setWorldReady,
    saveToLocal
  } = useGameState();
  
  const db = useFirestore();
  const syncStartedRef = useRef<string | null>(null);
  const heartbeatStartedRef = useRef(false);

  useEffect(() => {
    if (!isLoaded || !db || !selectedLeagueId) {
      if (isLoaded) setWorldReady(true);
      return;
    }
    
    const info = getGlobalSeasonInfo();
    const currentSeason = info.activeSeasonNumber;
    const currentContext = `${selectedLeagueId}_L${leagueLevel}_G${groupId}_S${currentSeason}`;
    
    // 1. ПЕРВИЧНАЯ СИНХРОНИЗАЦИЯ КАЛЕНДАРЯ
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

    // 2. СЕРВЕРНОЕ СЕРДЦЕБИЕНИЕ (Автономный цикл)
    // Мы вызываем это с клиента, чтобы имитировать Cron в среде разработки
    if (!heartbeatStartedRef.current) {
      heartbeatStartedRef.current = true;
      
      const triggerHeartbeat = async () => {
        try {
          console.log("[HEARTBEAT] Triggering autonomous league cycle...");
          await resolveDailyMatches();
        } catch (e) {
          console.error("[HEARTBEAT] Cycle error:", e);
        }
      };

      triggerHeartbeat();
      // Повторяем каждые 5 минут для поддержания жизни мира
      const interval = setInterval(triggerHeartbeat, 300000);
      return () => clearInterval(interval);
    }

  }, [isLoaded, selectedLeagueId, leagueLevel, groupId, saveToLocal, setWorldReady, db]);

  return null;
}
