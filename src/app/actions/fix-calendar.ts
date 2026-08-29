
'use server';

/**
 * @fileOverview Скрипт Абсолютного Сброса v120 (Total Isolation Mode).
 * Переключает мир на коллекции v2 для гарантированного удаления старых игроков.
 */

import { 
  collection, getDocs, doc, getDoc,
  serverTimestamp, query, limit, setDoc, deleteDoc, writeBatch 
} from 'firebase/firestore';
import { initializeFirebase } from '@/firebase';
import { getGlobalSeasonInfo } from '@/app/lib/time-utils';
import { initializeLeagueWorld, TOTAL_GROUPS } from './world-engine';

const DELETE_BATCH_SIZE = 500; 

export async function runGlobalEmergencyRepair() {
  const { firestore: db } = initializeFirebase();
  const info = getGlobalSeasonInfo();
  const seasonNum = info.activeSeasonNumber;
  const leagueId = "ALPHA";

  // Документ состояния ремонта v120
  const repairStatusRef = doc(db, 'system_v1', `repair_v120_S${seasonNum}_L${leagueId}`);
  const repairSnap = await getDoc(repairStatusRef);
  const repairData = repairSnap.exists() ? repairSnap.data() : { phase: 'WIPE_OLD_V1' };

  if (repairData.phase === 'COMPLETED') {
    return { status: 'ALL_READY', msg: 'Season 1 v120 initialized. World v2 is empty and ready.' };
  }

  console.log(`[TOTAL PURGE] v120, Phase: ${repairData.phase}`);

  /**
   * ЭТАП 1: Очистка старых коллекций v1
   */
  if (repairData.phase === 'WIPE_OLD_V1') {
    const q = query(collection(db, 'league_tables_v1'), limit(DELETE_BATCH_SIZE));
    const snap = await getDocs(q);
    if (!snap.empty) {
      const batch = writeBatch(db);
      snap.docs.forEach(d => batch.delete(d.ref));
      await batch.commit();
      return { status: 'WIPING_OLD_TABLES', deleted: snap.size };
    }
    await setDoc(repairStatusRef, { phase: 'WIPE_MATCHES_V1' }, { merge: true });
    return { status: 'OLD_TABLES_CLEARED', next: 'WIPE_MATCHES_V1' };
  }

  if (repairData.phase === 'WIPE_MATCHES_V1') {
    const q = query(collection(db, 'matches_v1'), limit(DELETE_BATCH_SIZE));
    const snap = await getDocs(q);
    if (!snap.empty) {
      const batch = writeBatch(db);
      snap.docs.forEach(d => batch.delete(d.ref));
      await batch.commit();
      return { status: 'WIPING_OLD_MATCHES', deleted: snap.size };
    }
    await setDoc(repairStatusRef, { phase: 'WIPE_PLAYERS_ALL' }, { merge: true });
    return { status: 'OLD_MATCHES_CLEARED', next: 'WIPE_PLAYERS_ALL' };
  }

  /**
   * ЭТАП 2: Удаление ВСЕХ игроков (v10, v11, v12)
   */
  if (repairData.phase === 'WIPE_PLAYERS_ALL') {
    const collections = ['players_v12', 'players_v11', 'players_v10'];
    for (const collName of collections) {
      const q = query(collection(db, collName), limit(DELETE_BATCH_SIZE));
      const snap = await getDocs(q);
      if (!snap.empty) {
        const batch = writeBatch(db);
        snap.docs.forEach(d => batch.delete(d.ref));
        await batch.commit();
        return { status: `WIPING_${collName}`, deleted: snap.size };
      }
    }
    await setDoc(repairStatusRef, { phase: 'WIPE_SOCIAL' }, { merge: true });
    return { status: 'PLAYERS_CLEARED', next: 'WIPE_SOCIAL' };
  }

  /**
   * ЭТАП 3: Очистка социальных данных
   */
  if (repairData.phase === 'WIPE_SOCIAL') {
    const socialColls = ['global_chat_v2', 'friend_requests_v4', 'market_v7', 'notifications_v7', 'private_messages_v3'];
    for (const collName of socialColls) {
      const q = query(collection(db, collName), limit(DELETE_BATCH_SIZE));
      const snap = await getDocs(q);
      if (!snap.empty) {
        const batch = writeBatch(db);
        snap.docs.forEach(d => batch.delete(d.ref));
        await batch.commit();
        return { status: `WIPING_${collName}`, deleted: snap.size };
      }
    }
    await setDoc(repairStatusRef, { phase: 'INIT_WORLD_V2' }, { merge: true });
    return { status: 'SOCIAL_CLEARED', next: 'INIT_WORLD_V2' };
  }

  /**
   * ЭТАП 4: Постройка нового мира в v2
   */
  if (repairData.phase === 'INIT_WORLD_V2') {
    const worldRes = await initializeLeagueWorld(leagueId, seasonNum);
    if (worldRes.isComplete) {
      await setDoc(repairStatusRef, { 
        phase: 'COMPLETED', 
        status: 'completed',
        finishedAt: serverTimestamp()
      }, { merge: true });
      return { status: 'ALL_COMPLETE', msg: "Universe v120 built in V2 collections. No old records visible." };
    }
    return { 
      status: 'BUILDING_WORLD_V2', 
      currentIndex: worldRes.currentIndex,
      total: TOTAL_GROUPS,
      progress: `${Math.round((worldRes.currentIndex / TOTAL_GROUPS) * 100)}%`
    };
  }

  return { status: 'UNKNOWN' };
}
