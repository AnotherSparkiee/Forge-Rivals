'use server';

/**
 * Скрипт-синхронизатор v60 (Autonomous Global Reseeder).
 * 
 * Логика работы:
 * ФАЗА 1 (INIT_WORLD): Проверка наличия всех 511 групп. Если нет - достройка ботами.
 * ФАЗА 2 (RESEED_PLAYERS): Порционное переселение реальных игроков на их места.
 * ФАЗА 3 (COMPLETED): Мир готов к расчету матчей.
 */

import { 
  collection, getDocs, doc, getDoc,
  serverTimestamp, query, where, limit, startAfter, orderBy, setDoc 
} from 'firebase/firestore';
import { initializeFirebase } from '@/firebase';
import { getGlobalSeasonInfo } from '@/app/lib/time-utils';
import { initializeLeagueWorld } from './world-engine';
import { findStrategicPlacement, initializeClubV11 } from './season-init';

const PLAYERS_PER_CHUNK = 25; // Оптимальный размер порции для одного вызова

/**
 * ГЛОБАЛЬНЫЙ РЕМОНТ И ИНИЦИАЛИЗАЦИЯ МИРА v60.
 * Вызывается через Cron /api/cron/initialize-world
 */
export async function runGlobalEmergencyRepair() {
  const { firestore: db } = initializeFirebase();
  const info = getGlobalSeasonInfo();
  const seasonNum = info.activeSeasonNumber;
  const leagueId = "ALPHA";

  // Документ статуса ремонта для текущего сезона
  const repairStatusRef = doc(db, 'system_v1', `repair_S${seasonNum}_L${leagueId}`);
  const repairSnap = await getDoc(repairStatusRef);
  const repairData = repairSnap.exists() ? repairSnap.data() : { phase: 'INIT_WORLD', status: 'processing' };

  if (repairData.phase === 'COMPLETED') {
    return { status: 'ALL_READY', msg: 'World is fully initialized and reseeded.' };
  }

  console.log(`[AUTONOMOUS REPAIR] Season ${seasonNum}, Phase: ${repairData.phase}`);

  // ФАЗА 1: Постройка мира (Боты заполняют все 511 групп)
  if (repairData.phase === 'INIT_WORLD') {
    const worldRes = await initializeLeagueWorld(leagueId, seasonNum);
    
    // Если world-engine сообщил о завершении постройки (isComplete: true)
    if (worldRes.isComplete) {
      console.log(`[REPAIR v60] World build complete. Moving to RESEED_PLAYERS.`);
      await setDoc(repairStatusRef, { 
        phase: 'RESEED_PLAYERS', 
        lastCreatedAt: null,
        updatedAt: serverTimestamp()
      }, { merge: true });
      return { status: 'PHASE_TRANSITION', next: 'RESEED_PLAYERS' };
    }
    
    return { status: 'BUILDING_WORLD', currentIndex: worldRes.currentIndex };
  }

  // ФАЗА 2: Переселение реальных игроков (замена ботов на их законных местах)
  if (repairData.phase === 'RESEED_PLAYERS') {
    // Ищем игроков, которые еще не были размещены в этом сезоне
    let playersQ = query(
      collection(db, 'players_v11'), 
      where('lastProcessedSeason', '!=', seasonNum),
      orderBy('lastProcessedSeason', 'asc'),
      orderBy('createdAt', 'asc'), // Приоритет старым игрокам (высокие дивизионы)
      limit(PLAYERS_PER_CHUNK)
    );

    // Если в прошлом шаге мы сохранили точку остановки
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
    
    // Если игроков для переселения больше нет - завершаем процесс
    if (pSnap.empty) {
      console.log(`[REPAIR v60] Reseeding complete. Finalizing world.`);
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
        // Находим свободное стратегическое место (игнорируя текущие неверные координаты)
        const placement = await findStrategicPlacement(leagueId);
        
        // Переселяем игрока (захват слота бота)
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
        console.error(`[RESEED ERROR] Failed to place player ${pDoc.id}:`, e.message);
      }
    }

    // Сохраняем прогресс для следующего вызова Cron
    await setDoc(repairStatusRef, { 
      lastCreatedAt, 
      updatedAt: serverTimestamp(),
      processedCount: (repairData.processedCount || 0) + processed
    }, { merge: true });

    return { status: 'RESEEDING', processedInThisChunk: processed };
  }

  return { status: 'UNKNOWN_STATE' };
}
