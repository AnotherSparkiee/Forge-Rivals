'use server';

/**
 * @fileOverview Скрипт-синхронизатор v53 (Global Reseeder).
 * Реализует полную пересадку всех команд в актуальный Season 1 по дате регистрации.
 */

import { 
  collection, getDocs, doc, getDoc,
  serverTimestamp, query, where, limit, startAfter, updateDoc, orderBy, setDoc 
} from 'firebase/firestore';
import { initializeFirebase } from '@/firebase';
import { getGlobalSeasonInfo } from '@/app/lib/time-utils';
import { initializeLeagueWorld } from './world-engine';
import { findStrategicPlacement, initializeClubV11 } from './season-init';

/**
 * ГЛОБАЛЬНЫЙ РЕМОНТ МИРА v53.
 * Фаза 1: Постройка структуры 511 групп.
 * Фаза 2: Переселение ВСЕХ реальных игроков в Season 1 по приоритету createdAt.
 */
export async function runGlobalEmergencyRepair() {
  const { firestore: db } = initializeFirebase();
  const info = getGlobalSeasonInfo();
  const seasonNum = info.activeSeasonNumber;
  const leagueId = "ALPHA";

  const repairStatusRef = doc(db, 'system_v1', `repair_S${seasonNum}_L${leagueId}`);
  const repairSnap = await getDoc(repairStatusRef);
  const repairData = repairSnap.exists() ? repairSnap.data() : { phase: 'INIT_WORLD' };

  console.log(`[AUTONOMOUS REPAIR] Season ${seasonNum}, Phase: ${repairData.phase}`);

  // ФАЗА 1: Создание структуры мира (511 групп)
  if (repairData.phase === 'INIT_WORLD') {
    const worldRes = await initializeLeagueWorld(leagueId, seasonNum);
    if (worldRes.isComplete) {
      // Переходим к фазе пересадки игроков
      await setDoc(repairStatusRef, { phase: 'RESEED_PLAYERS', lastCreatedAt: null }, { merge: true });
      return { status: 'PHASE_COMPLETE', nextPhase: 'RESEED_PLAYERS' };
    }
    return { status: 'PROCESSING_WORLD', progress: `Tier ${worldRes.lastTier}, Group ${worldRes.lastGroup}` };
  }

  // ФАЗА 2: Переселение игроков (по 5 игроков за вызов)
  if (repairData.phase === 'RESEED_PLAYERS') {
    // Выбираем тех, кто еще не в текущем сезоне, начиная с самых ранних регистраций
    let playersQ = query(
      collection(db, 'players_v11'), 
      orderBy('createdAt', 'asc'), 
      limit(5)
    );

    if (repairData.lastCreatedAt) {
      playersQ = query(
        collection(db, 'players_v11'), 
        orderBy('createdAt', 'asc'), 
        startAfter(repairData.lastCreatedAt), 
        limit(5)
      );
    }
    
    const pSnap = await getDocs(playersQ);
    if (pSnap.empty) {
      await updateDoc(repairStatusRef, { phase: 'COMPLETED', finishedAt: serverTimestamp() });
      return { status: 'ALL_COMPLETE' };
    }

    let lastCreatedAt = repairData.lastCreatedAt;
    let processed = 0;

    for (const pDoc of pSnap.docs) {
      const p = pDoc.data();
      
      // Пропускаем, если игрок уже в правильной структуре
      if (p.lastProcessedSeason === seasonNum && p.selectedLeagueId === leagueId) {
        lastCreatedAt = p.createdAt;
        continue;
      }

      try {
        console.log(`[RESEEDING] Moving veteran player ${p.clubName || p.displayName} (created: ${p.createdAt})`);
        
        // 1. Ищем новое место в Season 1 (начиная с верхних дивизионов)
        const placement = await findStrategicPlacement(leagueId);
        
        // 2. Выполняем захват слота и обновление профиля
        await initializeClubV11(pDoc.id, {
          ...p,
          tier: placement.tier,
          group: placement.group,
          rank: placement.rank,
          selectedLeagueId: leagueId
        });

        processed++;
      } catch (e: any) {
        console.error(`[RESEED ERROR] ${pDoc.id}:`, e.message);
      }

      lastCreatedAt = p.createdAt;
    }

    await setDoc(repairStatusRef, { lastCreatedAt }, { merge: true });
    return { status: 'RESEEDING', processed };
  }

  return { status: 'ALREADY_DONE' };
}
