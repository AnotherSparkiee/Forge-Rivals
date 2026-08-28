'use server';

/**
 * Скрипт-синхронизатор v62 (Autonomous Global Reseeder).
 * 
 * Логика работы:
 * ФАЗА 0 (NUCLEAR_WIPE): Разовая полная очистка S1 данных при первом запуске.
 * ФАЗА 1 (INIT_WORLD): Проверка наличия всех 511 групп. Если нет - достройка ботами.
 * ФАЗА 2 (RESEED_PLAYERS): Порционное переселение реальных игроков на их места.
 * ФАЗА 3 (COMPLETED): Мир готов к расчету матчей.
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

/**
 * ГЛОБАЛЬНЫЙ РЕМОНТ И ИНИЦИАЛИЗАЦИЯ МИРА v62.
 */
export async function runGlobalEmergencyRepair() {
  const { firestore: db } = initializeFirebase();
  const info = getGlobalSeasonInfo();
  const seasonNum = info.activeSeasonNumber;
  const leagueId = "ALPHA";

  const repairStatusRef = doc(db, 'system_v1', `repair_S${seasonNum}_L${leagueId}`);
  const repairSnap = await getDoc(repairStatusRef);
  const repairData = repairSnap.exists() ? repairSnap.data() : { phase: 'NUCLEAR_WIPE', status: 'processing' };

  if (repairData.phase === 'COMPLETED') {
    return { status: 'ALL_READY', msg: 'World is fully initialized and reseeded.' };
  }

  console.log(`[AUTONOMOUS REPAIR] Season ${seasonNum}, Phase: ${repairData.phase}`);

  // ФАЗА 0: ОДНОРАЗОВЫЙ ГЛОБАЛЬНЫЙ СБРОС (Для S1)
  if (repairData.phase === 'NUCLEAR_WIPE') {
    console.log("[NUCLEAR] Starting Automatic Deep Clean for Season 1...");

    // 1. Удаление таблиц S1
    const tablesQ = query(collection(db, 'league_tables_v1'), where('season', '==', 1));
    const tablesSnap = await getDocs(tablesQ);
    for (const d of tablesSnap.docs) await deleteDoc(d.ref);

    // 2. Удаление матчей S1
    const matchesQ = query(collection(db, 'matches_v1'), where('season', '==', 1));
    const matchesSnap = await getDocs(matchesQ);
    for (const d of matchesSnap.docs) await deleteDoc(d.ref);

    // 3. Удаление старых системных флагов
    const sysRefs = [
      doc(db, 'system_v1', 'init_S1_LALPHA'),
      doc(db, 'system_v1', 'transition_S1')
    ];
    for (const r of sysRefs) await deleteDoc(r).catch(() => {});

    // 4. Сброс всех игроков в players_v11
    const playersSnap = await getDocs(collection(db, 'players_v11'));
    const batch = writeBatch(db);
    playersSnap.forEach(p => {
      batch.update(p.ref, {
        leagueLevel: null,
        groupId: null,
        rank: null,
        targetLevel: null,
        targetGroup: null,
        targetRank: null,
        lastProcessedSeason: 0
      });
    });
    await batch.commit();

    // Переход к инициализации мира
    await setDoc(repairStatusRef, { 
      phase: 'INIT_WORLD', 
      status: 'processing',
      updatedAt: serverTimestamp()
    }, { merge: true });

    return { status: 'WIPE_COMPLETE', next: 'INIT_WORLD' };
  }

  if (repairData.phase === 'INIT_WORLD') {
    const worldRes = await initializeLeagueWorld(leagueId, seasonNum);
    if (worldRes.isComplete) {
      await setDoc(repairStatusRef, { 
        phase: 'RESEED_PLAYERS', 
        lastCreatedAt: null,
        updatedAt: serverTimestamp()
      }, { merge: true });
      return { status: 'PHASE_TRANSITION', next: 'RESEED_PLAYERS' };
    }
    return { status: 'BUILDING_WORLD', currentIndex: worldRes.currentIndex };
  }

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
      return { status: 'ALL_COMPLETE' };
    }

    let lastCreatedAt = null;
    let processed = 0;

    for (const pDoc of pSnap.docs) {
      const p = pDoc.data();
      lastCreatedAt = p.createdAt;
      
      try {
        // Умная расстановка: сначала проверяем "целевые" координаты от миграции (performSeasonTransition)
        let tier = p.targetLevel;
        let group = p.targetGroup;
        let rank = p.targetRank;

        // Если целей нет (новый игрок или сбой) — ищем свободное место стратегически (снизу вверх)
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
        console.error(`[RESEED ERROR] Failed to place player ${pDoc.id}:`, e.message);
      }
    }

    await setDoc(repairStatusRef, { 
      lastCreatedAt, 
      updatedAt: serverTimestamp(),
      processedCount: (repairData.processedCount || 0) + processed
    }, { merge: true });

    return { status: 'RESEEDING', processedInThisChunk: processed };
  }

  return { status: 'UNKNOWN_STATE' };
}
