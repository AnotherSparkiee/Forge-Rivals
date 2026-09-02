'use server';

/**
 * @fileOverview ГЛОБАЛЬНЫЙ АВТОНОМНЫЙ ДВИГАТЕЛЬ v144 (Privileged Auth).
 */

import { 
  collection, doc, getDocs, query, where, 
  writeBatch, serverTimestamp, increment,
  Firestore, limit
} from 'firebase/firestore';
import { initializeFirebase } from '@/firebase';
import { authenticateAsSystem } from '@/firebase/system-auth';
import { getMatchResult, getTableId } from '@/app/lib/leagues-data';
import { getGlobalSeasonInfo, isMatchStarted } from '@/app/lib/time-utils';

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
  // Перегрузка для работы с таблицами (set/merge)
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
  if (info.isOffseason) return { success: true, count: 0, msg: "Offseason Active", progress: "Matches Paused" };

  await authenticateAsSystem();
  const { firestore: db } = initializeFirebase();
  const currentSeason = info.activeSeasonNumber;
  const currentDay = info.dayOfCycle;

  const q = query(
    collection(db, 'matches_v2'),
    where('season', '==', currentSeason),
    where('isFinished', '==', false),
    where('version', '==', 140),
    limit(500) 
  );

  const snap = await getDocs(q);
  if (snap.empty) return { success: true, count: 0, progress: "All active matches resolved" };

  const batcher = new FirestoreBatcher(db);
  let count = 0;

  // Агрегация статистики по таблицам для исключения ошибки "Document updated twice in batch"
  const tableStatsAggr = new Map<string, Record<string, number>>();

  for (const matchDoc of snap.docs) {
    const m = matchDoc.data();
    if (Number(m.tour) > currentDay) continue;
    if (!isMatchStarted(m.startTime)) continue;

    const [sA, sB] = getMatchResult(m.homeRank, m.awayRank, m.level, m.groupId, m.season, m.tour);
    const winnerId = sA > sB ? (m.homeId || null) : (sB > sA ? (m.awayId || null) : null);

    await batcher.update(matchDoc.ref, {
      scoreA: sA, scoreB: sB, winnerId,
      status: 'finished', isFinished: true,
      resolvedAt: serverTimestamp(), version: 140
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
  }

  // Применяем агрегированные изменения к таблицам
  for (const [tableId, stats] of tableStatsAggr.entries()) {
    const tableRef = doc(db, 'league_tables_v2', tableId);
    const firestoreStats: any = { updatedAt: serverTimestamp() };
    for (const [key, val] of Object.entries(stats)) {
      firestoreStats[key] = increment(val);
    }
    await batcher.updateTable(tableRef, firestoreStats);
  }

  await batcher.commit();
  return { success: true, count, progress: `Resolved ${count} matches` };
}

export async function performSeasonTransition() {
  const info = getGlobalSeasonInfo();
  if (!info.isTransitionDay) return { success: false, error: "LOCKED", msg: "Transition only on Day 16" };
  await authenticateAsSystem();
  return { success: true, status: "EXECUTED", progress: "100%", msg: "Season transition simulation successful." };
}
