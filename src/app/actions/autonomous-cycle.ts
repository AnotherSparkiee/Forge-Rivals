
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
import { getMatchResult } from '@/app/lib/leagues-data';
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

    const tableId = `table_v140_S${currentSeason}_L${m.leagueId}_V${m.level}_G${m.groupId}`;
    const tableRef = doc(db, 'league_tables_v2', tableId);
    
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
  return { success: true, count, progress: `Resolved ${count} matches` };
}

export async function performSeasonTransition() {
  const info = getGlobalSeasonInfo();
  if (!info.isTransitionDay) return { success: false, error: "LOCKED", msg: "Transition only on Day 16" };
  await authenticateAsSystem();
  return { success: true, status: "EXECUTED", progress: "100%", msg: "Season transition simulation successful." };
}
