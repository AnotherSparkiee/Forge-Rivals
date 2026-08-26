
'use client';

import { useEffect, useRef } from 'react';
import { useGameState } from '@/app/lib/store';
import { getGlobalSeasonInfo, isMatchOverdue } from '@/app/lib/time-utils';
import { 
  getMatchResult
} from '@/app/lib/leagues-data';
import { useFirestore, updateDocumentNonBlocking } from '@/firebase';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { initializeLeagueWorld } from '@/app/actions/world-engine';

/**
 * ГЛОБАЛЬНЫЙ МЕНЕДЖЕР МАТЧЕЙ v14.0 (Autonomous Cycle)
 * Автоматически инициализирует мир при обнаружении нового сезона.
 */
export function AutoMatchManager() {
  const { 
    isLoaded, selectedLeagueId, 
    leagueLevel, groupId, setWorldReady,
    allSeasonMatches, saveToLocal, lastProcessedSeason
  } = useGameState();
  
  const db = useFirestore();
  const syncStartedRef = useRef<string | null>(null);
  const worldInitLockRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isLoaded || !db) return;
    
    const info = getGlobalSeasonInfo();
    const currentSeason = info.activeSeasonNumber;

    // АВТО-ИНИЦИАЛИЗАЦИЯ МИРА (Цикличная)
    const checkWorldAndSync = async () => {
      // 1. Проверяем, не инициировали ли мы уже мир в этой сессии
      if (worldInitLockRef.current === currentSeason) return;
      
      const leagueId = selectedLeagueId || "ALPHA";
      
      try {
        // Проверяем наличие таблицы для текущего игрока или любой базовой таблицы сезона
        const sampleTableId = `table_S${currentSeason}_L${leagueId}_V1_G1`;
        const sampleSnap = await getDoc(doc(db, 'league_tables_v1', sampleTableId));
        
        if (!sampleSnap.exists()) {
          console.log(`[AUTO WORLD] Season ${currentSeason} not found. Running Autonomous Init...`);
          await initializeLeagueWorld(leagueId, currentSeason);
          worldInitLockRef.current = currentSeason;
        }

        // Если мы в межсезонье (день 15), готовим СЛЕДУЮЩИЙ сезон заранее
        if (info.isOffseason) {
          const nextSeason = currentSeason + 1;
          const nextSampleId = `table_S${nextSeason}_L${leagueId}_V1_G1`;
          const nextSnap = await getDoc(doc(db, 'league_tables_v1', nextSampleId));
          if (!nextSnap.exists()) {
            console.log(`[AUTO WORLD] Preparing Next Season S${nextSeason} structure...`);
            await initializeLeagueWorld(leagueId, nextSeason);
          }
        }
      } catch (e) {
        console.warn("[AUTO WORLD] Init check failed:", e);
      }
    };

    checkWorldAndSync();

    // СИНХРОНИЗАЦИЯ КАЛЕНДАРЯ
    if (!selectedLeagueId) {
      setWorldReady(true);
      return;
    }
    
    const currentContext = `${selectedLeagueId}_L${leagueLevel}_G${groupId}_S${currentSeason}`;
    if (syncStartedRef.current === currentContext) return;
    syncStartedRef.current = currentContext;

    const syncMatches = async () => {
      try {
        console.log(`[AUTO MATCH] Syncing calendar for ${currentContext}`);
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
        console.error("[AUTO MATCH] Sync failed:", e);
      } finally {
        setWorldReady(true);
      }
    };

    syncMatches();

    const resolveTimer = setInterval(async () => {
      if (!allSeasonMatches || allSeasonMatches.length === 0) return;

      const overdue = allSeasonMatches.filter(m => !m.isFinished && isMatchOverdue(m.startTime));
      if (overdue.length === 0) return;

      for (const m of overdue) {
        const matchRef = doc(db, 'matches_v1', m.id);
        const mSnap = await getDoc(matchRef);
        
        if (mSnap.exists() && !mSnap.data().isFinished) {
          const [sA, sB] = getMatchResult(m.homeRank, m.awayRank, leagueLevel, groupId, currentSeason, m.tour);
          
          updateDocumentNonBlocking(matchRef, {
            scoreA: sA, scoreB: sB, status: 'finished', isFinished: true,
            winnerId: sA > sB ? (mSnap.data().homeId || null) : (sB > sA ? (mSnap.data().awayId || null) : null),
            resolvedAt: new Date().toISOString()
          });
          
          const updated = allSeasonMatches.map(am => am.id === m.id ? { ...am, isFinished: true, scoreA: sA, scoreB: sB } : am);
          saveToLocal({ allSeasonMatches: updated });
        }
      }
    }, 30000);

    return () => clearInterval(resolveTimer);
  }, [isLoaded, selectedLeagueId, leagueLevel, groupId, allSeasonMatches, saveToLocal, setWorldReady, lastProcessedSeason, db]);

  return null;
}
