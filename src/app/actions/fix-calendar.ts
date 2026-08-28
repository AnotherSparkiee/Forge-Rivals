'use server';

/**
 * Скрипт-синхронизатор v107 (Autonomous Global Reseeder).
 * Теперь использует протокол v107 для гарантированного закрытия дыр в дивизионах.
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

export async function runGlobalEmergencyRepair() {
  const { firestore: db } = initializeFirebase();
  const info = getGlobalSeasonInfo();
  const seasonNum = info.activeSeasonNumber;
  const leagueId = "ALPHA";

  // ПЕРЕХОД НА v107
  const repairStatusRef = doc(db, 'system_v1', `repair_v107_S${seasonNum}_L${leagueId}`);
  const repairSnap = await getDoc(repairStatusRef);
  const repairData = repairSnap.exists() ? repairSnap.data() : { phase: 'NUCLEAR_WIPE', status: 'processing' };

  if (repairData.phase === 'COMPLETED') {
    return { status: 'ALL_READY', msg: 'World is fully initialized.' };
  }

  console.log(`[AUTONOMOUS REPAIR] v107, Phase: ${repairData.phase}`);

  if (repairData.phase === 'NUCLEAR_WIPE') {
    // Сброс старого прогресса постройки, чтобы world-engine прошел все 511 групп еще раз
    await deleteDoc(doc(db, 'system_v1', `init_S${seasonNum}_L${leagueId}`)).catch(() => {});
    
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

    return { status: 'RESEEDING', processedCount: processed };
  }

  return { status: 'UNKNOWN' };
}
