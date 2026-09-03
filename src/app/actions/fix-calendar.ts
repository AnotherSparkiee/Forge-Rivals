'use server';

/**
 * Скрипт Абсолютного Сброса v141 (Admin SDK Transition).
 */

import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase-admin';
import { initializeLeagueWorld } from './world-engine';
import { getActiveSeasonNumber } from './season-cycle';

const DELETE_BATCH_SIZE = 500; 
const WIPE_LOOPS_PER_CALL = 3;

export async function runGlobalEmergencyRepair() {
  const db = adminDb;
  const seasonNum = await getActiveSeasonNumber(db);
  const leagueId = "ALPHA";

  const repairStatusRef = db.collection('system_v1').doc(`repair_v140_S${seasonNum}_L${leagueId}`);
  const repairSnap = await repairStatusRef.get();
  const repairData = repairSnap.exists ? repairSnap.data()! : { phase: 'TOTAL_PURGE_V2' };

  if (repairData.phase === 'COMPLETED') {
    return { status: 'ALL_READY', msg: 'System stable.', progress: '100%' };
  }

  const WIPE_PHASES = [
    { phase: 'TOTAL_PURGE_V2', colls: ['league_tables_v2', 'matches_v2'], next: 'TOTAL_PURGE_V1' },
    { phase: 'TOTAL_PURGE_V1', colls: ['league_tables_v1', 'matches_v1'], next: 'TOTAL_PURGE_PLAYERS' },
    { phase: 'TOTAL_PURGE_PLAYERS', colls: ['players_v13', 'players_v12', 'players_v11'], next: 'WIPE_SOCIAL' },
    { phase: 'WIPE_SOCIAL', colls: ['global_chat_v2', 'friend_requests_v4', 'market_v7'], next: 'INIT_WORLD_V140' }
  ];

  const currentWipe = WIPE_PHASES.find(p => p.phase === repairData.phase);
  if (currentWipe) {
    let totalDeleted = 0;
    
    for (let i = 0; i < WIPE_LOOPS_PER_CALL; i++) {
      let loopDeleted = 0;
      for (const coll of currentWipe.colls) {
        const snap = await db.collection(coll).limit(DELETE_BATCH_SIZE).get();
        if (!snap.empty) {
          const batch = db.batch();
          snap.docs.forEach(d => {
            const data = d.data();
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
    
    await repairStatusRef.set({ phase: currentWipe.next }, { merge: true });
    return { status: `${repairData.phase}_CLEARED`, next: currentWipe.next };
  }

  if (repairData.phase === 'INIT_WORLD_V140') {
    const worldRes = await initializeLeagueWorld(leagueId, seasonNum);
    if (worldRes.isComplete) {
      await repairStatusRef.set({ 
        phase: 'COMPLETED', 
        status: 'completed', 
        finishedAt: FieldValue.serverTimestamp() 
      }, { merge: true });
    }
    return { status: 'BUILDING_WORLD', progress: worldRes.progress };
  }

  return { status: 'UNKNOWN' };
}
