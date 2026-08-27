
'use client';

import { useEffect, useRef } from 'react';
import { useGameState } from '@/app/lib/store';
import { getGlobalSeasonInfo } from '@/app/lib/time-utils';
import { useFirestore } from '@/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';

/**
 * ГЛОБАЛЬНЫЙ СИНХРОНИЗАТОР v15.0 (Passive Listener)
 * Теперь этот компонент ТОЛЬКО синхронизирует локальное состояние игрока с БД.
 * Все расчеты (резолв матчей, смена сезона) перенесены на сервер.
 */
export function AutoMatchManager() {
  const { 
    isLoaded, selectedLeagueId, 
    leagueLevel, groupId, setWorldReady,
    saveToLocal
  } = useGameState();
  
  const db = useFirestore();
  const syncStartedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!isLoaded || !db || !selectedLeagueId) {
      if (isLoaded) setWorldReady(true);
      return;
    }
    
    const info = getGlobalSeasonInfo();
    const currentSeason = info.activeSeasonNumber;
    const currentContext = `${selectedLeagueId}_L${leagueLevel}_G${groupId}_S${currentSeason}`;
    
    if (syncStartedRef.current === currentContext) return;
    syncStartedRef.current = currentContext;

    const syncMatches = async () => {
      try {
        console.log(`[AUTO SYNC] Fetching official calendar for ${currentContext}`);
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

    // Слушатель обновлений: периодически проверяем завершенные матчи
    const refreshTimer = setInterval(syncMatches, 60000 * 5); // Раз в 5 минут

    return () => clearInterval(refreshTimer);
  }, [isLoaded, selectedLeagueId, leagueLevel, groupId, saveToLocal, setWorldReady, db]);

  return null;
}
