'use server';

/**
 * @fileOverview ГЛОБАЛЬНЫЙ АВТОНОМНЫЙ ДВИГАТЕЛЬ v148 (Season Config Sync).
 */

import { 
  collection, doc, getDocs, query, where, 
  writeBatch, serverTimestamp, increment,
  Firestore, limit, Timestamp
} from 'firebase/firestore';
import { initializeFirebase } from '@/firebase';
import { authenticateAsSystem } from '@/firebase/system-auth';
import { getMatchResult, getTableId } from '@/app/lib/leagues-data';
import { getGlobalSeasonInfo } from '@/app/lib/time-utils';
import { logger } from '@/app/lib/logger';
import { getActiveSeasonNumber } from './season-cycle';

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
  async updateTable(ref: any, data: any) {
    this.batch.set(ref, data, { merge: true });
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
  const info = getGlobalSeasonInfo();
  if (info.isOffseason) return { success: true, count: 0, msg: "Offseason Active" };

  await authenticateAsSystem();
  const { firestore: db } = initializeFirebase();
  
  // Получаем реальный активный сезон из конфига
  const currentSeason = await getActiveSeasonNumber(db);
  const nowIso = new Date().toISOString();

  const q = query(
    collection(db, 'matches_v2'),
    where('season', '==', currentSeason),
    where('isFinished', '==', false),
    where('isProcessing', '==', false),
    where('startTime', '<=', nowIso),
    where('version', '==', 140),
    limit(400) 
  );

  const snap = await getDocs(q);
  if (snap.empty) return { success: true, count: 0, progress: "All scheduled matches resolved" };

  const batcher = new FirestoreBatcher(db);
  let count = 0;
  const tableStatsAggr = new Map<string, Record<string, number>>();

  for (const matchDoc of snap.docs) {
    const m = matchDoc.data();
    
    // Атомарно блокируем матч перед расчетом (на уровне батча)
    await batcher.update(matchDoc.ref, { isProcessing: true });

    try {
      const [sA, sB] = getMatchResult(
        m.homeRank, m.awayRank, m.level, m.groupId, currentSeason, m.tour, m.resultSeed || 0
      );
      
      const winnerId = sA > sB ? (m.homeId || null) : (sB > sA ? (m.awayId || null) : null);

      await batcher.update(matchDoc.ref, {
        scoreA: sA, scoreB: sB, winnerId,
        status: 'finished', isFinished: true, isProcessing: false,
        resolvedAt: serverTimestamp()
      });

      const tableId = getTableId(currentSeason, m.leagueId, m.level, m.groupId);
      if (!tableStatsAggr.has(tableId)) tableStatsAggr.set(tableId, {});
      const aggr = tableStatsAggr.get(tableId)!;

      const updateStats = (id: string, sa: number, sb: number) => {
        if (!id) return;
        const prefix = `stats.${id}`;
        aggr[`${prefix}.matchesPlayed`] = (aggr[`${prefix}.matchesPlayed`] || 0) + 1;
        aggr[`${prefix}.wins`] = (aggr[`${prefix}.wins`] || 0) + (sa > sb ? 1 : 0);
        aggr[`${prefix}.draws`] = (aggr[`${prefix}.draws`] || 0) + (sa === sb ? 1 : 0);
        aggr[`${prefix}.losses`] = (aggr[`${prefix}.losses`] || 0) + (sb > sa ? 1 : 0);
        aggr[`${prefix}.points`] = (aggr[`${prefix}.points`] || 0) + (sa > sb ? 3 : (sa === sb ? 1 : 0));
        aggr[`${prefix}.diff`] = (aggr[`${prefix}.diff`] || 0) + (sa - sb);
      };

      updateStats(m.homeId, sA, sB);
      updateStats(m.awayId, sB, sA);
      count++;
    } catch (err) {
      console.error(`[AUTONOMOUS CYCLE] Failed match ${matchDoc.id}:`, err);
      // Снимаем блокировку при ошибке (пакетно)
      await batcher.update(matchDoc.ref, { isProcessing: false });
    }
  }

  for (const [tableId, stats] of tableStatsAggr.entries()) {
    const tableRef = doc(db, 'league_tables_v2', tableId);
    const firestoreStats: any = { updatedAt: serverTimestamp() };
    for (const [key, val] of Object.entries(stats)) {
      firestoreStats[key] = increment(val);
    }
    await batcher.updateTable(tableRef, firestoreStats);
  }

  await batcher.commit();
  logger.info(`Resolved ${count} matches via autonomous cycle`);
  return { success: true, count, progress: `Resolved ${count} matches` };
}
