'use client';

import { useEffect, useRef } from 'react';
import { useGameState } from '@/app/lib/store';
import { getGlobalSeasonInfo, isMatchOverdue } from '@/app/lib/time-utils';
import { 
  getMatchResult
} from '@/app/lib/leagues-data';
import { useFirestore, updateDocumentNonBlocking } from '@/firebase';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';

/**
 * ГЛОБАЛЬНЫЙ МЕНЕДЖЕР МАТЧЕЙ v13.0 (Cloud Sync Aware)
 * Синхронизирует расписание только после того, как профиль игрока подгружен из БД.
 */
export function AutoMatchManager() {
  const { 
    isLoaded, selectedLeagueId, 
    leagueLevel, groupId, setWorldReady,
    allSeasonMatches, saveToLocal, lastProcessedSeason
  } = useGameState();
  
  const db = useFirestore();
  const syncStartedRef = useRef<string | null>(null);

  useEffect(() => {
    // Ждем полной инициализации стора и получения leagueId из профиля
    if (!isLoaded || !selectedLeagueId || !db) return;
    
    // Предотвращаем повторную синхронизацию для того же лига-группа контекста
    const currentContext = `${selectedLeagueId}_L${leagueLevel}_G${groupId}`;
    if (syncStartedRef.current === currentContext) return;
    syncStartedRef.current = currentContext;

    const info = getGlobalSeasonInfo();
    const currentSeason = info.activeSeasonNumber;

    const syncMatches = async () => {
      try {
        console.log(`[AUTO MATCH] Syncing calendar for ${currentContext}, Season ${currentSeason}`);
        const q = query(collection(db, 'matches_v1'), 
          where('leagueId', '==', selectedLeagueId),
          where('level', '==', leagueLevel),
          where('groupId', '==', groupId),
          where('season', '==', currentSeason)
        );
        const matchesSnap = await getDocs(q);
        const officialMatches = matchesSnap.docs.map(d => ({ ...d.data(), id: d.id }));
        
        if (officialMatches.length > 0) {
          saveToLocal({ allSeasonMatches: officialMatches.sort((a, b) => a.tour - b.tour) });
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
          
          // Локальный апдейт
          const updated = allSeasonMatches.map(am => am.id === m.id ? { ...am, isFinished: true, scoreA: sA, scoreB: sB } : am);
          saveToLocal({ allSeasonMatches: updated });
        }
      }
    }, 30000);

    return () => clearInterval(resolveTimer);
  }, [isLoaded, selectedLeagueId, leagueLevel, groupId, allSeasonMatches, saveToLocal, setWorldReady, lastProcessedSeason, db]);

  return null;
}
