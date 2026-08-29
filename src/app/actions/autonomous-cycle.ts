
'use server';

/**
 * @fileOverview ГЛОБАЛЬНЫЙ АВТОНОМНЫЙ ДВИГАТЕЛЬ ЛИГИ v2.5 (V12 RESET).
 * Обрабатывает матчи и смену сезона. Целевая коллекция: players_v12.
 */

import { 
  collection, doc, getDocs, getDoc, query, where, 
  writeBatch, serverTimestamp, increment,
  Firestore, limit, setDoc, orderBy, startAfter
} from 'firebase/firestore';
import { initializeFirebase } from '@/firebase';
import { getMatchResult, getPromotionTarget, getRelegationTarget } from '@/app/lib/leagues-data';
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
  
  // Проверяем готовность мира по протоколу v115
  const repairStatusRef = doc(db, 'system_v1', `repair_v115_S${currentSeason}_LALPHA`);
  const repairSnap = await getDoc(repairStatusRef);
  const isRepairComplete = repairSnap.exists() && repairSnap.data().phase === 'COMPLETED';

  if (!isRepairComplete) {
    console.log(`[HEARTBEAT] World v12 not ready for S${currentSeason}. Running reset v115.`);
    const repairResult = await runGlobalEmergencyRepair();
    return { success: true, status: "REPAIRING", progress: repairResult.status };
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
    const [sA, sB] = getMatchResult(m.homeRank, m.awayRank, m.level, m.groupId, m.season, m.tour);
    const winnerId = sA > sB ? (m.homeId || null) : (sB > sA ? (m.awayId || null) : null);

    await batcher.update(matchDoc.ref, {
      scoreA: sA, scoreB: sB, winnerId,
      status: 'finished', isFinished: true,
      resolvedAt: serverTimestamp(), version: 12
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

export async function performSeasonTransition() {
  const { firestore: db } = initializeFirebase();
  const info = getGlobalSeasonInfo();
  
  if (!info.isOffseason) return { success: false, error: "Not an offseason yet" };

  const currentSeason = info.activeSeasonNumber;
  const transitionStatusRef = doc(db, 'system_v1', `transition_S${currentSeason}`);
  const statusSnap = await getDoc(transitionStatusRef);
  const status = statusSnap.exists() ? statusSnap.data() : { currentIndex: 0, status: 'processing' };

  if (status.status === 'completed') return { alreadyDone: true };

  const GROUPS_PER_CHUNK = 25;
  const startIdx = status.currentIndex || 0;
  const endIdx = Math.min(startIdx + GROUPS_PER_CHUNK, 511);

  const batcher = new FirestoreBatcher(db);

  for (let i = startIdx + 1; i <= endIdx; i++) {
    const coords = getGroupCoordinates(i);
    const tableId = `table_S${currentSeason}_LALPHA_V${coords.tier}_G${coords.group}`;
    const tableSnap = await getDoc(doc(db, 'league_tables_v1', tableId));

    if (tableSnap.exists()) {
      const tableData = tableSnap.data();
      const standings = Object.values(tableData.stats || {}).sort((a: any, b: any) => {
        if (b.points !== a.points) return b.points - a.points;
        return b.diff - a.diff;
      });

      for (let rank = 1; rank <= standings.length; rank++) {
        const team: any = standings[rank - 1];
        if (!team.id || team.isBot) continue;

        let nextLvl = coords.tier;
        let nextGrp = coords.group;
        let nextRank = rank;
        
        if (rank <= 2) {
          const promo = getPromotionTarget(coords.tier, coords.group);
          nextLvl = promo.level; nextGrp = promo.group; nextRank = 8; 
        } else if (rank >= 7) {
          const releg = getRelegationTarget(coords.tier, coords.group, rank);
          nextLvl = releg.level; nextGrp = releg.group; nextRank = 1; 
        }

        const playerRef = doc(db, 'players_v12', team.id);
        await batcher.update(playerRef, {
          targetLevel: nextLvl,
          targetGroup: nextGrp,
          targetRank: nextRank,
          lastProcessedSeason: 0 
        });
      }
    }
  }

  const isFinished = endIdx >= 511;
  await batcher.set(transitionStatusRef, {
    currentIndex: endIdx,
    status: isFinished ? 'completed' : 'processing',
    updatedAt: serverTimestamp()
  }, { merge: true });

  await batcher.commit();
  return { status: isFinished ? "COMPLETED" : "PROCESSING", processed: endIdx };
}

function getGroupCoordinates(index: number) {
  let tier = 1;
  let runningTotal = 0;
  while (tier <= 9) {
    const groupsInTier = Math.pow(2, tier - 1);
    if (index <= runningTotal + groupsInTier) {
      return { tier, group: index - runningTotal };
    }
    runningTotal += groupsInTier;
    tier++;
  }
  return { tier: 9, group: 256 };
}
