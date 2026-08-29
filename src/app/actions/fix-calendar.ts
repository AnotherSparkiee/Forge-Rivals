'use server';

/**
 * Скрипт-синхронизатор v111 (Autonomous Global Reseeder).
 * Реализует строго последовательный цикл: NUCLEAR_WIPE -> INIT_WORLD -> RESEED_PLAYERS.
 */

import { 
  collection, getDocs, doc, getDoc,
  serverTimestamp, query, where, limit, startAfter, orderBy, setDoc, deleteDoc, writeBatch 
} from 'firebase/firestore';
import { initializeFirebase } from '@/firebase';
import { getGlobalSeasonInfo } from '@/app/lib/time-utils';
import { initializeLeagueWorld } from './world-engine';
import { findStrategicPlacement, initializeClubV11 } from './season-init';

const PLAYERS_PER_CHUNK = 25; 
const DELETE_BATCH_SIZE = 500; 

export async function runGlobalEmergencyRepair() {
  const { firestore: db } = initializeFirebase();
  const info = getGlobalSeasonInfo();
  const seasonNum = info.activeSeasonNumber;
  const leagueId = "ALPHA";

  // Документ состояния ремонта v111
  const repairStatusRef = doc(db, 'system_v1', `repair_v111_S${seasonNum}_L${leagueId}`);
  const repairSnap = await getDoc(repairStatusRef);
  const repairData = repairSnap.exists() ? repairSnap.data() : { phase: 'NUCLEAR_WIPE', status: 'processing' };

  if (repairData.phase === 'COMPLETED') {
    return { status: 'ALL_READY', msg: 'World is fully initialized.' };
  }

  console.log(`[AUTONOMOUS REPAIR] v111, Phase: ${repairData.phase}`);

  /**
   * ФАЗА 1: NUCLEAR_WIPE
   * Удаление старых данных и сброс ВСЕХ игроков.
   */
  if (repairData.phase === 'NUCLEAR_WIPE') {
    // 1. Удаление таблиц S1
    const tablesQ = query(collection(db, 'league_tables_v1'), where('season', '==', 1), limit(DELETE_BATCH_SIZE));
    const tSnap = await getDocs(tablesQ);
    if (!tSnap.empty) {
      const batch = writeBatch(db);
      tSnap.docs.forEach(d => batch.delete(d.ref));
      await batch.commit();
      return { status: 'WIPING_TABLES', deleted: tSnap.size, msg: "Step 1: Cleaning old league tables..." };
    }

    // 2. Удаление матчей S1
    const matchesQ = query(collection(db, 'matches_v1'), where('season', '==', 1), limit(DELETE_BATCH_SIZE));
    const mSnap = await getDocs(matchesQ);
    if (!mSnap.empty) {
      const batch = writeBatch(db);
      mSnap.docs.forEach(d => batch.delete(d.ref));
      await batch.commit();
      return { status: 'WIPING_MATCHES', deleted: mSnap.size, msg: "Step 1: Cleaning match calendar (sequential wipe)..." };
    }

    // 3. Тотальный сброс игроков (безопасный обход через createdAt)
    let playersResetQ = query(
      collection(db, 'players_v11'),
      orderBy('createdAt', 'asc'),
      limit(100)
    );

    if (repairData.lastResetId) {
      playersResetQ = query(
        collection(db, 'players_v11'),
        orderBy('createdAt', 'asc'),
        startAfter(repairData.lastResetId),
        limit(100)
      );
    }

    const pSnap = await getDocs(playersResetQ);
    if (!pSnap.empty) {
      const batch = writeBatch(db);
      let needsResetCount = 0;
      pSnap.docs.forEach(d => {
        const p = d.data();
        // Сбрасываем только если есть что сбрасывать или сезон не 0
        if (p.leagueLevel !== null || p.lastProcessedSeason !== 0) {
          batch.update(d.ref, {
            leagueLevel: null,
            groupId: null,
            rank: null,
            targetLevel: null,
            targetGroup: null,
            targetRank: null,
            lastProcessedSeason: 0
          });
          needsResetCount++;
        }
      });
      
      const lastResetId = pSnap.docs[pSnap.docs.length - 1].data().createdAt;
      
      await batch.commit();
      await setDoc(repairStatusRef, { lastResetId }, { merge: true });
      return { status: 'RESETTING_PLAYERS', processed: pSnap.size, msg: "Step 1: Resetting manager coordinates for fresh start..." };
    }

    // 4. Очистка системных флагов и переход в INIT_WORLD
    await deleteDoc(doc(db, 'system_v1', `init_S${seasonNum}_L${leagueId}`)).catch(() => {});
    
    await setDoc(repairStatusRef, { 
      phase: 'INIT_WORLD', 
      status: 'processing',
      lastResetId: null, // очистка для следующего раза
      updatedAt: serverTimestamp()
    }, { merge: true });

    return { status: 'WIPE_COMPLETE', next: 'INIT_WORLD', msg: "Step 1 complete. Starting world reconstruction." };
  }

  /**
   * ФАЗА 2: INIT_WORLD
   * Создание структуры 511 групп с ботами.
   */
  if (repairData.phase === 'INIT_WORLD') {
    const worldRes = await initializeLeagueWorld(leagueId, seasonNum);
    if (worldRes.isComplete) {
      await setDoc(repairStatusRef, { 
        phase: 'RESEED_PLAYERS', 
        lastCreatedAt: null,
        updatedAt: serverTimestamp()
      }, { merge: true });
      return { status: 'PHASE_TRANSITION', next: 'RESEED_PLAYERS', msg: "Step 2: World built. Moving to player re-seeding." };
    }
    return { status: 'BUILDING_WORLD', currentIndex: worldRes.currentIndex, msg: `Step 2: Constructing pyramid: ${worldRes.currentIndex}/511` };
  }

  /**
   * ФАЗА 3: RESEED_PLAYERS
   * Расстановка реальных игроков по новым группам.
   */
  if (repairData.phase === 'RESEED_PLAYERS') {
    let playersQ = query(
      collection(db, 'players_v11'), 
      where('lastProcessedSeason', '!=', seasonNum),
      orderBy('lastProcessedSeason', 'asc'),
      orderBy('createdAt', 'asc'),
      limit(PLAYERS_PER_CHUNK)
    );

    if (repairData.lastCreatedAt) {
      playersQ = query(
        collection(db, 'players_v11'), 
        where('lastProcessedSeason', '!=', seasonNum),
        orderBy('lastProcessedSeason', 'asc'),
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
      return { status: 'ALL_COMPLETE', msg: "Step 3: League is fully restored and operational." };
    }

    let lastCreatedAt = null;
    let processed = 0;

    for (const pDoc of pSnap.docs) {
      const p = pDoc.data();
      lastCreatedAt = p.createdAt;
      
      try {
        let tier = p.targetLevel;
        let group = p.targetGroup;
        let rank = p.targetRank;

        if (!tier || !group) {
          const placement = await findStrategicPlacement(leagueId);
          tier = placement.tier;
          group = placement.group;
          rank = placement.rank;
        }
        
        await initializeClubV11(pDoc.id, {
          ...p,
          tier, group, rank,
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

    return { status: 'RESEEDING', processedCount: processed, msg: `Step 3: Placing managers on new positions: ${processed} processed.` };
  }

  return { status: 'UNKNOWN' };
}
