'use server';

/**
 * Скрипт-синхронизатор v109 (Autonomous Global Reseeder).
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
const DELETE_BATCH_SIZE = 500; // Максимально допустимый лимит Firestore

export async function runGlobalEmergencyRepair() {
  const { firestore: db } = initializeFirebase();
  const info = getGlobalSeasonInfo();
  const seasonNum = info.activeSeasonNumber;
  const leagueId = "ALPHA";

  // Документ состояния ремонта v109
  const repairStatusRef = doc(db, 'system_v1', `repair_v109_S${seasonNum}_L${leagueId}`);
  const repairSnap = await getDoc(repairStatusRef);
  const repairData = repairSnap.exists() ? repairSnap.data() : { phase: 'NUCLEAR_WIPE', status: 'processing' };

  if (repairData.phase === 'COMPLETED') {
    return { status: 'ALL_READY', msg: 'World is fully initialized.' };
  }

  console.log(`[AUTONOMOUS REPAIR] v109, Phase: ${repairData.phase}`);

  /**
   * ФАЗА 1: NUCLEAR_WIPE
   * Удаление старых данных Сезона 1.
   */
  if (repairData.phase === 'NUCLEAR_WIPE') {
    // 1. Удаление таблиц (по 500 за раз)
    const tablesQ = query(collection(db, 'league_tables_v1'), where('season', '==', 1), limit(DELETE_BATCH_SIZE));
    const tSnap = await getDocs(tablesQ);
    if (!tSnap.empty) {
      const batch = writeBatch(db);
      tSnap.docs.forEach(d => batch.delete(d.ref));
      await batch.commit();
      return { status: 'WIPING_TABLES', deleted: tSnap.size, msg: "Cleaning old league tables..." };
    }

    // 2. Удаление матчей (по 500 за раз)
    const matchesQ = query(collection(db, 'matches_v1'), where('season', '==', 1), limit(DELETE_BATCH_SIZE));
    const mSnap = await getDocs(matchesQ);
    if (!mSnap.empty) {
      const batch = writeBatch(db);
      mSnap.docs.forEach(d => batch.delete(d.ref));
      await batch.commit();
      return { status: 'WIPING_MATCHES', deleted: mSnap.size, msg: "Cleaning match calendar (this may take 60-80 cycles)..." };
    }

    // 3. Сброс игроков (по 100 за раз для безопасности)
    const playersQ = query(collection(db, 'players_v11'), where('lastProcessedSeason', '!=', 0), limit(100));
    const pSnap = await getDocs(playersQ);
    if (!pSnap.empty) {
      const batch = writeBatch(db);
      pSnap.docs.forEach(d => {
        batch.update(d.ref, {
          leagueLevel: null,
          groupId: null,
          rank: null,
          lastProcessedSeason: 0
        });
      });
      await batch.commit();
      return { status: 'RESETTING_PLAYERS', updated: pSnap.size, msg: "Unseeding players for fresh placement..." };
    }

    // 4. Очистка системного флага и переход в INIT_WORLD
    await deleteDoc(doc(db, 'system_v1', `init_S${seasonNum}_L${leagueId}`)).catch(() => {});
    
    await setDoc(repairStatusRef, { 
      phase: 'INIT_WORLD', 
      status: 'processing',
      updatedAt: serverTimestamp()
    }, { merge: true });

    return { status: 'WIPE_COMPLETE', next: 'INIT_WORLD', msg: "Nuclear wipe finished. Starting world reconstruction." };
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
      return { status: 'PHASE_TRANSITION', next: 'RESEED_PLAYERS', msg: "World built. Moving to player re-seeding." };
    }
    return { status: 'BUILDING_WORLD', currentIndex: worldRes.currentIndex, msg: `Reconstructing pyramid: ${worldRes.currentIndex}/511` };
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
      return { status: 'ALL_COMPLETE', msg: "League is fully restored and operational." };
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

        // Если нет целевых координат (новая регистрация или сброс), ищем свободное место
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

    return { status: 'RESEEDING', processedCount: processed, msg: `Placing managers: ${processed} processed in this chunk.` };
  }

  return { status: 'UNKNOWN' };
}
