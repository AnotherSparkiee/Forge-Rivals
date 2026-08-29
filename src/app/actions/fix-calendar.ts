'use server';

/**
 * Скрипт Абсолютного Сброса v131 (Safe Batches).
 * Очищает коллекции порциями по 1500 доков для предотвращения таймаутов.
 */

import { 
  collection, getDocs, doc, getDoc,
  serverTimestamp, query, limit, setDoc, deleteDoc, writeBatch 
} from 'firebase/firestore';
import { initializeFirebase } from '@/firebase';
import { getGlobalSeasonInfo } from '@/app/lib/time-utils';
import { initializeLeagueWorld } from './world-engine';
import { TOTAL_GROUPS } from '@/app/lib/leagues-data';

const DELETE_BATCH_SIZE = 500; 
const WIPE_LOOPS_PER_CALL = 3; // Удаляем до 1500 доков за один вызов для безопасности

export async function runGlobalEmergencyRepair() {
  const { firestore: db } = initializeFirebase();
  const info = getGlobalSeasonInfo();
  const seasonNum = info.activeSeasonNumber;
  const leagueId = "ALPHA";

  const repairStatusRef = doc(db, 'system_v1', `repair_v131_S${seasonNum}_L${leagueId}`);
  const repairSnap = await getDoc(repairStatusRef);
  const repairData = repairSnap.exists() ? repairSnap.data() : { phase: 'TOTAL_PURGE_V2' };

  if (repairData.phase === 'COMPLETED') {
    return { status: 'ALL_READY', msg: 'Season 1 v131 world fully built and ready.', progress: '100%' };
  }

  const WIPE_PHASES = [
    { phase: 'TOTAL_PURGE_V2', colls: ['league_tables_v2', 'matches_v2'], next: 'TOTAL_PURGE_V1' },
    { phase: 'TOTAL_PURGE_V1', colls: ['league_tables_v1', 'matches_v1'], next: 'TOTAL_PURGE_PLAYERS' },
    { phase: 'TOTAL_PURGE_PLAYERS', colls: ['players_v13', 'players_v12', 'players_v11'], next: 'WIPE_SOCIAL' },
    { phase: 'WIPE_SOCIAL', colls: ['global_chat_v2', 'friend_requests_v4', 'market_v7'], next: 'INIT_WORLD_V131' }
  ];

  const currentWipe = WIPE_PHASES.find(p => p.phase === repairData.phase);
  if (currentWipe) {
    let totalDeleted = 0;
    
    for (let i = 0; i < WIPE_LOOPS_PER_CALL; i++) {
      let loopDeleted = 0;
      for (const coll of currentWipe.colls) {
        const q = query(collection(db, coll), limit(DELETE_BATCH_SIZE));
        const snap = await getDocs(q);
        if (!snap.empty) {
          const batch = writeBatch(db);
          snap.docs.forEach(d => batch.delete(d.ref));
          await batch.commit();
          loopDeleted += snap.size;
        }
      }
      totalDeleted += loopDeleted;
      if (loopDeleted === 0) break; 
    }

    if (totalDeleted > 0) {
      return { 
        status: `WIPING_${repairData.phase}`, 
        deleted: totalDeleted, 
        phase: repairData.phase,
        progress: `Удалено: ${totalDeleted} (${repairData.phase})` 
      };
    }
    
    await setDoc(repairStatusRef, { phase: currentWipe.next }, { merge: true });
    return { status: `${repairData.phase}_CLEARED`, next: currentWipe.next, progress: `Переход к ${currentWipe.next}...` };
  }

  if (repairData.phase === 'INIT_WORLD_V131') {
    const worldRes = await initializeLeagueWorld(leagueId, seasonNum);
    const progressVal = Math.round((worldRes.currentIndex / TOTAL_GROUPS) * 100);
    
    if (worldRes.isComplete) {
      await setDoc(repairStatusRef, { 
        phase: 'COMPLETED', 
        status: 'completed',
        finishedAt: serverTimestamp(),
        version: 131
      }, { merge: true });
      return { status: 'ALL_COMPLETE', msg: "Universe v131 built. 511 groups ready.", progress: '100%' };
    }
    
    return { 
      status: 'BUILDING_WORLD_V131', 
      currentIndex: worldRes.currentIndex,
      total: TOTAL_GROUPS,
      progress: `Постройка: ${worldRes.currentIndex}/${TOTAL_GROUPS} (${progressVal}%)`
    };
  }

  return { status: 'UNKNOWN', progress: '0%' };
}
