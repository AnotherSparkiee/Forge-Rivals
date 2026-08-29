'use server';

/**
 * @fileOverview Скрипт Абсолютного Сброса v131 (Clean Environment).
 * Очищает ВСЕ коллекции v1/v2 и запускает постройку пирамиды v131.
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

export async function runGlobalEmergencyRepair() {
  const { firestore: db } = initializeFirebase();
  const info = getGlobalSeasonInfo();
  const seasonNum = info.activeSeasonNumber;
  const leagueId = "ALPHA";

  // Документ состояния ремонта v131
  const repairStatusRef = doc(db, 'system_v1', `repair_v131_S${seasonNum}_L${leagueId}`);
  const repairSnap = await getDoc(repairStatusRef);
  const repairData = repairSnap.exists() ? repairSnap.data() : { phase: 'TOTAL_PURGE_V2' };

  if (repairData.phase === 'COMPLETED') {
    return { status: 'ALL_READY', msg: 'Season 1 v131 world fully built and ready.' };
  }

  console.log(`[WORLD ARCHITECT v131] Phase: ${repairData.phase}`);

  /**
   * ЭТАП 1: Тотальная очистка (Wipe everything)
   */
  const WIPE_PHASES = [
    { phase: 'TOTAL_PURGE_V2', colls: ['league_tables_v2', 'matches_v2'], next: 'TOTAL_PURGE_V1' },
    { phase: 'TOTAL_PURGE_V1', colls: ['league_tables_v1', 'matches_v1'], next: 'TOTAL_PURGE_PLAYERS' },
    { phase: 'TOTAL_PURGE_PLAYERS', colls: ['players_v13', 'players_v12', 'players_v11'], next: 'WIPE_SOCIAL' },
    { phase: 'WIPE_SOCIAL', colls: ['global_chat_v2', 'friend_requests_v4', 'market_v7'], next: 'INIT_WORLD_V131' }
  ];

  const currentWipe = WIPE_PHASES.find(p => p.phase === repairData.phase);
  if (currentWipe) {
    for (const coll of currentWipe.colls) {
      // БЕЗУСЛОВНОЕ удаление любых документов
      const q = query(collection(db, coll), limit(DELETE_BATCH_SIZE));
      const snap = await getDocs(q);
      if (!snap.empty) {
        const batch = writeBatch(db);
        snap.docs.forEach(d => batch.delete(d.ref));
        await batch.commit();
        return { status: `WIPING_${coll.toUpperCase()}`, deleted: snap.size, phase: repairData.phase };
      }
    }
    
    await setDoc(repairStatusRef, { phase: currentWipe.next }, { merge: true });
    return { status: `${repairData.phase}_CLEARED`, next: currentWipe.next };
  }

  /**
   * ЭТАП 2: Постройка нового мира в v131 (511 групп)
   */
  if (repairData.phase === 'INIT_WORLD_V131') {
    const worldRes = await initializeLeagueWorld(leagueId, seasonNum);
    if (worldRes.isComplete) {
      await setDoc(repairStatusRef, { 
        phase: 'COMPLETED', 
        status: 'completed',
        finishedAt: serverTimestamp(),
        version: 131
      }, { merge: true });
      return { status: 'ALL_COMPLETE', msg: "Universe v131 built. 511 groups ready." };
    }
    return { 
      status: 'BUILDING_WORLD_V131', 
      currentIndex: worldRes.currentIndex,
      total: TOTAL_GROUPS,
      progress: `${Math.round((worldRes.currentIndex / TOTAL_GROUPS) * 100)}%`
    };
  }

  return { status: 'UNKNOWN' };
}
