'use server';

/**
 * Скрипт Абсолютного Сброса v135 (Smart Deletion).
 */

import { 
  collection, getDocs, doc, getDoc,
  serverTimestamp, query, limit, setDoc, writeBatch 
} from 'firebase/firestore';
import { initializeFirebase } from '@/firebase';
import { authenticateAsSystem } from '@/firebase/system-auth';
import { getGlobalSeasonInfo } from '@/app/lib/time-utils';
import { initializeLeagueWorld } from './world-engine';
import { TOTAL_GROUPS } from '@/app/lib/leagues-data';

const DELETE_BATCH_SIZE = 500; 
const WIPE_LOOPS_PER_CALL = 3;

export async function runGlobalEmergencyRepair() {
  await authenticateAsSystem();
  const { firestore: db } = initializeFirebase();
  const info = getGlobalSeasonInfo();
  const seasonNum = info.activeSeasonNumber;
  const leagueId = "ALPHA";

  const repairStatusRef = doc(db, 'system_v1', `repair_v131_S${seasonNum}_L${leagueId}`);
  const repairSnap = await getDoc(repairStatusRef);
  const repairData = repairSnap.exists() ? repairSnap.data() : { phase: 'TOTAL_PURGE_V2' };

  if (repairData.phase === 'COMPLETED') {
    return { status: 'ALL_READY', msg: 'System stable.', progress: '100%' };
  }

  const WIPE_PHASES = [
    { phase: 'TOTAL_PURGE_V2', colls: ['league_tables_v2', 'matches_v2'], next: 'TOTAL_PURGE_V1' },
    { phase: 'TOTAL_PURGE_V1', colls: ['league_tables_v1', 'matches_v1'], next: 'TOTAL_PURGE_PLAYERS' },
    { phase: 'TOTAL_PURGE_PLAYERS', colls: ['players_v13', 'players_v12', 'players_v11'], next: 'WIPE_SOCIAL' },
    { phase: 'WIPE_SOCIAL', colls: ['global_chat_v2', 'friend_requests_v4', 'market_v7'], next: 'INIT_WORLD_V131' }
  ];

  const currentWipe = WIPE_PHASES.find(p => p.phase === repairData.phase);
  if (currentWipe) {
    let totalDeleted = 0;
    
    for (let i = 0; i < WIPE_LOOPS_PER_CALL; i++) {
      let loopDeleted = 0;
      for (const coll of currentWipe.colls) {
        const q = query(collection(db, coll), limit(DELETE_BATCH_SIZE));
        const snap = await getDocs(q);
        if (!snap.empty) {
          const batch = writeBatch(db);
          snap.docs.forEach(d => {
            const data = d.data();
            // Защита: в matches_v2 удаляем только BOT vs BOT
            if (coll === 'matches_v2') {
              const isBotVsBot = String(data.homeId).startsWith('BOT_') && String(data.awayId).startsWith('BOT_');
              if (!isBotVsBot) return; 
            }
            batch.delete(d.ref);
          });
          await batch.commit();
          loopDeleted += snap.size;
        }
      }
      totalDeleted += loopDeleted;
      if (loopDeleted === 0) break; 
    }

    if (totalDeleted > 0) {
      return { status: `WIPING_${repairData.phase}`, deleted: totalDeleted, phase: repairData.phase };
    }
    
    await setDoc(repairStatusRef, { phase: currentWipe.next }, { merge: true });
    return { status: `${repairData.phase}_CLEARED`, next: currentWipe.next };
  }

  if (repairData.phase === 'INIT_WORLD_V131') {
    const worldRes = await initializeLeagueWorld(leagueId, seasonNum);
    if (worldRes.isComplete) {
      await setDoc(repairStatusRef, { phase: 'COMPLETED', status: 'completed', finishedAt: serverTimestamp() }, { merge: true });
    }
    return { status: 'BUILDING_WORLD', progress: worldRes.progress };
  }

  return { status: 'UNKNOWN' };
}
