
'use server';

/**
 * Скрипт-синхронизатор v58 (Autonomous Global Reseeder).
 * Синхронизирует статусы Init и Repair для завершения постройки мира.
 */

import { 
  collection, getDocs, doc, getDoc,
  serverTimestamp, query, where, limit, startAfter, orderBy, setDoc 
} from 'firebase/firestore';
import { initializeFirebase } from '@/firebase';
import { getGlobalSeasonInfo } from '@/app/lib/time-utils';
import { initializeLeagueWorld } from './world-engine';
import { findStrategicPlacement, initializeClubV11 } from './season-init';

const PLAYERS_PER_CHUNK = 20;

/**
 * ГЛОБАЛЬНЫЙ РЕМОНТ МИРА v58.
 */
export async function runGlobalEmergencyRepair() {
  const { firestore: db } = initializeFirebase();
  const info = getGlobalSeasonInfo();
  const seasonNum = info.activeSeasonNumber;
  const leagueId = "ALPHA";

  const repairStatusRef = doc(db, 'system_v1', `repair_S${seasonNum}_L${leagueId}`);
  const repairSnap = await getDoc(repairStatusRef);
  const repairData = repairSnap.exists() ? repairSnap.data() : { phase: 'INIT_WORLD' };

  console.log(`[REPAIR v58] Season ${seasonNum}, Current Phase: ${repairData.phase}`);

  // ФАЗА 1: Постройка мира (Боты заполняют все 511 групп)
  if (repairData.phase === 'INIT_WORLD' || repairData.phase === 'WIPING') {
    const worldRes = await initializeLeagueWorld(leagueId, seasonNum);
    
    // Если world-engine сообщил о завершении всех 511 групп
    if (worldRes.isComplete) {
      console.log(`[REPAIR v58] World build complete. Moving to RESEED_PLAYERS.`);
      await setDoc(repairStatusRef, { 
        phase: 'RESEED_PLAYERS', 
        lastCreatedAt: null,
        updatedAt: serverTimestamp()
      }, { merge: true });
      return { status: 'PHASE_COMPLETE', nextPhase: 'RESEED_PLAYERS' };
    }
    
    return { status: 'PROCESSING_WORLD', progress: worldRes.currentIndex };
  }

  // ФАЗА 2: Переселение реальных игроков (замена ботов на их законных местах)
  if (repairData.phase === 'RESEED_PLAYERS') {
    let playersQ = query(
      collection(db, 'players_v11'), 
      orderBy('createdAt', 'asc'), 
      limit(PLAYERS_PER_CHUNK)
    );

    if (repairData.lastCreatedAt) {
      playersQ = query(
        collection(db, 'players_v11'), 
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

    let lastCreatedAt = repairData.lastCreatedAt;
    let processed = 0;

    for (const pDoc of pSnap.docs) {
      const p = pDoc.data();
      lastCreatedAt = p.createdAt;
      
      if (p.lastProcessedSeason === seasonNum && p.selectedLeagueId === leagueId && p.leagueLevel && p.groupId) {
        continue;
      }

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

    await setDoc(repairStatusRef, { lastCreatedAt, updatedAt: serverTimestamp() }, { merge: true });
    return { status: 'RESEEDING', processed };
  }

  return { status: 'ALREADY_DONE' };
}
