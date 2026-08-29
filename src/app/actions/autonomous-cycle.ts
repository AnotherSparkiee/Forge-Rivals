
'use server';

/**
 * @fileOverview ГЛОБАЛЬНЫЙ АВТОНОМНЫЙ ДВИГАТЕЛЬ ЛИГИ v2.6 (V12 RESET).
 * Обрабатывает матчи. Целевая коллекция: players_v12.
 */

import { 
  collection, doc, getDocs, getDoc, query, where, 
  writeBatch, serverTimestamp, increment,
  Firestore, limit
} from 'firebase/firestore';
import { initializeFirebase } from '@/firebase';
import { getMatchResult } from '@/app/lib/leagues-data';
import { getGlobalSeasonInfo } from '@/app/lib/time-utils';
import { runGlobalEmergencyRepair } from './fix-calendar';

class FirestoreBatcher {
  private count = 0;
  private batch;
  constructor(private db: Firestore) {
    this.batch = writeBatch(db);
  }
  async update(ref: any, data: any) {
    this.batch.update(ref, data);
    this.count++;
    if (this.count >= 480) await this.commit();
  }
  async set(ref: any, data: any, options?: any) {
    this.batch.set(ref, data, options);
    this.count++;
    if (this.count >= 480) await this.commit();
  }
  async commit() {
    if (this.count > 0) {
      await this.batch.commit();
      this.batch = writeBatch(this.db);
      this.count = 0;
    }
  }
}

export async function resolveDailyMatches() {
  const { firestore: db } = initializeFirebase();
  const info = getGlobalSeasonInfo();
  const currentSeason = info.activeSeasonNumber;
  
  // Проверяем готовность мира по протоколу v116 (Чистый старт)
  const repairStatusRef = doc(db, 'system_v1', `repair_v116_S${currentSeason}_LALPHA`);
  const repairSnap = await getDoc(repairStatusRef);
  const isRepairComplete = repairSnap.exists() && repairSnap.data().phase === 'COMPLETED';

  if (!isRepairComplete) {
    console.log(`[HEARTBEAT] World v12 not ready for S${currentSeason}. Running reset v116.`);
    const repairResult = await runGlobalEmergencyRepair();
    return { success: true, status: "INITIALIZING_WORLD", details: repairResult.status };
  }

  if (info.isOffseason) return { success: true, count: 0, msg: "Offseason: matches paused" };

  const q = query(
    collection(db, 'matches_v1'),
    where('season', '==', currentSeason),
    where('tour', '==', info.dayOfCycle),
    where('isFinished', '==', false),
    limit(100) 
  );

  const snap = await getDocs(q);
  if (snap.empty) return { success: true, count: 0 };

  const batcher = new FirestoreBatcher(db);
  let count = 0;

  for (const matchDoc of snap.docs) {
    const m = matchDoc.data();
    // Двойной круг: Ранги используются для детерминированного исхода
    const [sA, sB] = getMatchResult(m.homeRank, m.awayRank, m.level, m.groupId, m.season, m.tour);
    const winnerId = sA > sB ? (m.homeId || null) : (sB > sA ? (m.awayId || null) : null);

    await batcher.update(matchDoc.ref, {
      scoreA: sA, scoreB: sB, winnerId,
      status: 'finished', isFinished: true,
      resolvedAt: serverTimestamp(), version: 116
    });

    const tableId = `table_S${currentSeason}_L${m.leagueId}_V${m.level}_G${m.groupId}`;
    const tableRef = doc(db, 'league_tables_v1', tableId);
    
    const statsUpdate: any = {};
    if (m.homeId) {
      statsUpdate[`stats.${m.homeId}.matchesPlayed`] = increment(1);
      statsUpdate[`stats.${m.homeId}.wins`] = increment(sA > sB ? 1 : 0);
      statsUpdate[`stats.${m.homeId}.draws`] = increment(sA === sB ? 1 : 0);
      statsUpdate[`stats.${m.homeId}.losses`] = increment(sB > sA ? 1 : 0);
      statsUpdate[`stats.${m.homeId}.points`] = increment(sA > sB ? 3 : (sA === sB ? 1 : 0));
      statsUpdate[`stats.${m.homeId}.diff`] = increment(sA - sB);
    }
    if (m.awayId) {
      statsUpdate[`stats.${m.awayId}.matchesPlayed`] = increment(1);
      statsUpdate[`stats.${m.awayId}.wins`] = increment(sB > sA ? 1 : 0);
      statsUpdate[`stats.${m.awayId}.draws`] = increment(sA === sB ? 1 : 0);
      statsUpdate[`stats.${m.awayId}.losses`] = increment(sA > sB ? 1 : 0);
      statsUpdate[`stats.${m.awayId}.points`] = increment(sB > sA ? 3 : (sA === sB ? 1 : 0));
      statsUpdate[`stats.${m.awayId}.diff`] = increment(sB - sA);
    }

    await batcher.update(tableRef, { ...statsUpdate, updatedAt: serverTimestamp() });
    count++;
  }

  await batcher.commit();
  return { success: true, count };
}
