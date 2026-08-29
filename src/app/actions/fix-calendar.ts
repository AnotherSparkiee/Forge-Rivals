
'use server';

/**
 * @fileOverview Скрипт Абсолютного Сброса v116.
 * Последовательность: 
 * 1. Удаление ВСЕХ таблиц.
 * 2. Удаление ВСЕХ матчей.
 * 3. Удаление ВСЕХ профилей игроков v12 (Чистый старт).
 * 4. Удаление старых системных флагов.
 * 5. Создание чистого мира (511 групп с ботами).
 */

import { 
  collection, getDocs, doc, getDoc,
  serverTimestamp, query, limit, setDoc, deleteDoc, writeBatch 
} from 'firebase/firestore';
import { initializeFirebase } from '@/firebase';
import { getGlobalSeasonInfo } from '@/app/lib/time-utils';
import { initializeLeagueWorld } from './world-engine';

const DELETE_BATCH_SIZE = 500; 

export async function runGlobalEmergencyRepair() {
  const { firestore: db } = initializeFirebase();
  const info = getGlobalSeasonInfo();
  const seasonNum = info.activeSeasonNumber;
  const leagueId = "ALPHA";

  // Документ состояния ремонта v116 (Чистый старт v12)
  const repairStatusRef = doc(db, 'system_v1', `repair_v116_S${seasonNum}_L${leagueId}`);
  const repairSnap = await getDoc(repairStatusRef);
  const repairData = repairSnap.exists() ? repairSnap.data() : { phase: 'WIPE_TABLES' };

  if (repairData.phase === 'COMPLETED') {
    return { status: 'ALL_READY', msg: 'Season 1 initialized. 511 bot groups created. Players can join now.' };
  }

  console.log(`[AUTONOMOUS RESET] v116, Phase: ${repairData.phase}`);

  /**
   * ЭТАП 1: Очистка таблиц
   */
  if (repairData.phase === 'WIPE_TABLES') {
    const q = query(collection(db, 'league_tables_v1'), limit(DELETE_BATCH_SIZE));
    const snap = await getDocs(q);
    if (!snap.empty) {
      const batch = writeBatch(db);
      snap.docs.forEach(d => batch.delete(d.ref));
      await batch.commit();
      return { status: 'WIPING_TABLES', deleted: snap.size };
    }
    await setDoc(repairStatusRef, { phase: 'WIPE_MATCHES' }, { merge: true });
    return { status: 'TABLES_CLEARED', next: 'WIPE_MATCHES' };
  }

  /**
   * ЭТАП 2: Очистка календаря
   */
  if (repairData.phase === 'WIPE_MATCHES') {
    const q = query(collection(db, 'matches_v1'), limit(DELETE_BATCH_SIZE));
    const snap = await getDocs(q);
    if (!snap.empty) {
      const batch = writeBatch(db);
      snap.docs.forEach(d => batch.delete(d.ref));
      await batch.commit();
      return { status: 'WIPING_MATCHES', deleted: snap.size };
    }
    await setDoc(repairStatusRef, { phase: 'WIPE_PLAYERS' }, { merge: true });
    return { status: 'MATCHES_CLEARED', next: 'WIPE_PLAYERS' };
  }

  /**
   * ЭТАП 3: Удаление старых игроков v12
   */
  if (repairData.phase === 'WIPE_PLAYERS') {
    const q = query(collection(db, 'players_v12'), limit(DELETE_BATCH_SIZE));
    const snap = await getDocs(q);
    if (!snap.empty) {
      const batch = writeBatch(db);
      snap.docs.forEach(d => batch.delete(d.ref));
      await batch.commit();
      return { status: 'WIPING_PLAYERS', deleted: snap.size };
    }
    await setDoc(repairStatusRef, { phase: 'WIPE_SYSTEM' }, { merge: true });
    return { status: 'PLAYERS_CLEARED', next: 'WIPE_SYSTEM' };
  }

  /**
   * ЭТАП 4: Удаление системных флагов
   */
  if (repairData.phase === 'WIPE_SYSTEM') {
    await deleteDoc(doc(db, 'system_v1', `init_S${seasonNum}_L${leagueId}`)).catch(() => {});
    await deleteDoc(doc(db, 'system_v1', `repair_v115_S${seasonNum}_L${leagueId}`)).catch(() => {});
    await deleteDoc(doc(db, 'system_v1', `repair_v114_S${seasonNum}_L${leagueId}`)).catch(() => {});
    
    await setDoc(repairStatusRef, { phase: 'INIT_WORLD' }, { merge: true });
    return { status: 'SYSTEM_CLEARED', next: 'INIT_WORLD' };
  }

  /**
   * ЭТАП 5: Постройка нового мира (только боты)
   */
  if (repairData.phase === 'INIT_WORLD') {
    const worldRes = await initializeLeagueWorld(leagueId, seasonNum);
    if (worldRes.isComplete) {
      await setDoc(repairStatusRef, { 
        phase: 'COMPLETED', 
        status: 'completed',
        finishedAt: serverTimestamp()
      }, { merge: true });
      return { status: 'ALL_COMPLETE', msg: "Pyramid v116 built: 511 bot-only groups ready." };
    }
    return { status: 'BUILDING_WORLD', currentIndex: worldRes.currentIndex };
  }

  return { status: 'UNKNOWN' };
}
