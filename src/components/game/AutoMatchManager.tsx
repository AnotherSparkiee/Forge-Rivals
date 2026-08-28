
'use client';

import { useEffect, useRef } from 'react';
import { useGameState } from '@/app/lib/store';
import { getGlobalSeasonInfo } from '@/app/lib/time-utils';
import { useFirestore, useUser } from '@/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';

/**
 * КЛИЕНТСКИЙ СИНХРОНИЗАТОР v19.0 (Pure Passive Sync)
 * Больше не запускает логику расчетов. Только синхронизирует локальное состояние
 * с результатами, которые серверный CRON уже записал в БД.
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

  // СИНХРОНИЗАЦИЯ КАЛЕНДАРЯ
  // Загружает матчи вашей группы, чтобы в интерфейсе всегда были актуальные счета и расписание
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
          console.log(`[PASSIVE SYNC] Loading group calendar for ${currentContext}`);
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
          console.error("[PASSIVE SYNC] Sync failed:", e);
        } finally {
          setWorldReady(true);
        }
      };

      syncMatches();
    }
  }, [isLoaded, selectedLeagueId, leagueLevel, groupId, user, saveToLocal, setWorldReady, db]);

  return null;
}
