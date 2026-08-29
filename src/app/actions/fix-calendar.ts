
'use server';

/**
 * Скрипт-синхронизатор v115 (V12 Absolute Reset).
 * Реализует строго последовательный цикл: NUCLEAR_WIPE -> INIT_WORLD -> RESEED_PLAYERS.
 * Полностью очищает таблицы и матчи, сбрасывает всех игроков v12.
 */

import { 
  collection, getDocs, doc, getDoc,
  serverTimestamp, query, where, limit, startAfter, orderBy, setDoc, deleteDoc, writeBatch 
} from 'firebase/firestore';
import { initializeFirebase } from '@/firebase';
import { getGlobalSeasonInfo } from '@/app/lib/time-utils';
import { initializeLeagueWorld } from './world-engine';
import { findStrategicPlacement, initializeClubV11 } from './season-init';

const PLAYERS_PER_CHUNK = 50; 
const DELETE_BATCH_SIZE = 500; 

export async function runGlobalEmergencyRepair() {
  const { firestore: db } = initializeFirebase();
  const info = getGlobalSeasonInfo();
  const seasonNum = info.activeSeasonNumber;
  const leagueId = "ALPHA";

  // Документ состояния ремонта v115 (Полный перезапуск v12)
  const repairStatusRef = doc(db, 'system_v1', `repair_v115_S${seasonNum}_L${leagueId}`);
  const repairSnap = await getDoc(repairStatusRef);
  const repairData = repairSnap.exists() ? repairSnap.data() : { phase: 'NUCLEAR_WIPE', status: 'processing' };

  if (repairData.phase === 'COMPLETED') {
    return { status: 'ALL_READY', msg: 'World v12 is fully initialized and reseeded.' };
  }

  console.log(`[AUTONOMOUS REPAIR] v115 (V12 RESET), Phase: ${repairData.phase}`);

  /**
   * ФАЗА 1: NUCLEAR_WIPE
   * Удаление ВСЕХ старых данных матчей и таблиц и сброс игроков.
   */
  if (repairData.phase === 'NUCLEAR_WIPE') {
    // 1. Удаление ВСЕХ таблиц (без фильтра сезона для чистоты)
    const tablesQ = query(collection(db, 'league_tables_v1'), limit(DELETE_BATCH_SIZE));
    const tSnap = await getDocs(tablesQ);
    if (!tSnap.empty) {
      const batch = writeBatch(db);
      tSnap.docs.forEach(d => batch.delete(d.ref));
      await batch.commit();
      return { status: 'WIPING_TABLES', deleted: tSnap.size, msg: "Step 1: Wiping ALL league tables..." };
    }

    // 2. Удаление ВСЕХ матчей
    const matchesQ = query(collection(db, 'matches_v1'), limit(DELETE_BATCH_SIZE));
    const mSnap = await getDocs(matchesQ);
    if (!mSnap.empty) {
      const batch = writeBatch(db);
      mSnap.docs.forEach(d => batch.delete(d.ref));
      await batch.commit();
      return { status: 'WIPING_MATCHES', deleted: mSnap.size, msg: "Step 1: Wiping ALL matches (28k+)..." };
    }

    // 3. Сброс игроков v12
    let playersResetQ = query(
      collection(db, 'players_v12'),
      orderBy('createdAt', 'asc'),
      limit(100)
    );

    if (repairData.lastResetId) {
      playersResetQ = query(
        collection(db, 'players_v12'),
        orderBy('createdAt', 'asc'),
        startAfter(repairData.lastResetId),
        limit(100)
      );
    }

    const pSnap = await getDocs(playersResetQ);
    if (!pSnap.empty) {
      const batch = writeBatch(db);
      pSnap.docs.forEach(d => {
        batch.update(d.ref, {
          leagueLevel: null,
          groupId: null,
          rank: null,
          targetLevel: null,
          targetGroup: null,
          targetRank: null,
          lastProcessedSeason: 0,
          version: 12
        });
      });
      
      const lastResetId = pSnap.docs[pSnap.docs.length - 1].data().createdAt;
      
      await batch.commit();
      await setDoc(repairStatusRef, { lastResetId }, { merge: true });
      return { status: 'RESETTING_PLAYERS', processed: pSnap.size, msg: "Step 1: Resetting manager v12 coordinates..." };
    }

    // 4. Очистка системных флагов и переход в INIT_WORLD
    await deleteDoc(doc(db, 'system_v1', `init_S${seasonNum}_L${leagueId}`)).catch(() => {});
    
    await setDoc(repairStatusRef, { 
      phase: 'INIT_WORLD', 
      status: 'processing',
      lastResetId: null,
      updatedAt: serverTimestamp()
    }, { merge: true });

    return { status: 'WIPE_COMPLETE', next: 'INIT_WORLD', msg: "Step 1 complete. World wiped. Starting fresh v12 construction." };
  }

  /**
   * ФАЗА 2: INIT_WORLD
   */
  if (repairData.phase === 'INIT_WORLD') {
    const worldRes = await initializeLeagueWorld(leagueId, seasonNum);
    if (worldRes.isComplete) {
      await setDoc(repairStatusRef, { 
        phase: 'RESEED_PLAYERS', 
        lastCreatedAt: null,
        updatedAt: serverTimestamp()
      }, { merge: true });
      return { status: 'PHASE_TRANSITION', next: 'RESEED_PLAYERS', msg: "Step 2: Pyramid v12 built. Moving to re-seeding." };
    }
    return { status: 'BUILDING_WORLD', currentIndex: worldRes.currentIndex, msg: `Step 2: Building pyramid v12: ${worldRes.currentIndex}/511` };
  }

  /**
   * ФАЗА 3: RESEED_PLAYERS
   */
  if (repairData.phase === 'RESEED_PLAYERS') {
    let playersQ = query(
      collection(db, 'players_v12'), 
      where('lastProcessedSeason', '==', 0),
      orderBy('createdAt', 'asc'),
      limit(PLAYERS_PER_CHUNK)
    );

    if (repairData.lastCreatedAt) {
      playersQ = query(
        collection(db, 'players_v12'), 
        where('lastProcessedSeason', '==', 0),
        orderBy('createdAt', 'asc'),
        startAfter(repairData.lastCreatedAt), 
        limit(PLAYERS_PER_CHUNK)
      );
    }
    
    const pSnap = await getDocs(playersQ);
    
    if (pSnap.empty) {
      await setDoc(repairStatusRef, { 
        phase: 'COMPLETED', 
        status: 'completed',
        finishedAt: serverTimestamp() 
      }, { merge: true });
      return { status: 'ALL_COMPLETE', msg: "Step 3: All v12 players re-seeded. Season 1 ready." };
    }

    let lastCreatedAt = null;
    let processed = 0;

    for (const pDoc of pSnap.docs) {
      const p = pDoc.data();
      lastCreatedAt = p.createdAt;
      
      try {
        const placement = await findStrategicPlacement(leagueId);
        
        await initializeClubV11(pDoc.id, {
          ...p,
          tier: placement.tier,
          group: placement.group,
          rank: placement.rank,
          selectedLeagueId: leagueId,
          lastProcessedSeason: seasonNum
        });
        processed++;
      } catch (e: any) {
        console.error(`[RESEED ERROR] ${pDoc.id}:`, e.message);
      }
    }

    await setDoc(repairStatusRef, { 
      lastCreatedAt, 
      updatedAt: serverTimestamp()
    }, { merge: true });

    return { status: 'RESEEDING', processedCount: processed, msg: `Step 3: Placing players into clean v12 world: ${processed} processed.` };
  }

  return { status: 'UNKNOWN' };
}
