'use server';

/**
 * Глобальный двигатель заполнения мира v131 (Universe Architect).
 * Использует FirestoreBatcher для автоматического управления лимитом 500 операций.
 */

import { 
  doc, getDoc, writeBatch, 
  Firestore, serverTimestamp, setDoc 
} from 'firebase/firestore';
import { initializeFirebase } from '@/firebase';
import { 
  getBotId, 
  getBotName,
  TEAMS_PER_GROUP, 
  generateSeasonCalendar,
  TOTAL_GROUPS
} from '@/app/lib/leagues-data';
import { getGlobalSeasonInfo } from '@/app/lib/time-utils';

/**
 * Внутренний помощник для управления массовыми записями.
 * Имитирует поведение BulkWriter для Client SDK.
 */
class FirestoreBatcher {
  private count = 0;
  private batch;
  constructor(private db: Firestore) {
    this.batch = writeBatch(db);
  }

  async set(ref: any, data: any) {
    this.batch.set(ref, data);
    this.count++;
    if (this.count >= 480) await this.commit();
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

const GROUPS_PER_CALL = 8; // Оптимально для ~450 операций (57 на группу)

function getGroupCoordinates(index: number) {
  if (index < 1) return { tier: 1, group: 1 };
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

async function injectGroupData(
  batcher: FirestoreBatcher, 
  db: Firestore, 
  leagueId: string, 
  tier: number, 
  group: number, 
  seasonNum: number
) {
  const tableId = `table_v131_S${seasonNum}_L${leagueId}_V${tier}_G${group}`;
  const tableRef = doc(db, 'league_tables_v2', tableId);
  
  const initialStats: any = {};
  const teamsForCalendar = [];

  for (let r = 1; r <= TEAMS_PER_GROUP; r++) {
    const bId = getBotId(leagueId, tier, group, r);
    const bName = getBotName(tier, group, r);
    initialStats[bId] = {
      id: bId, name: bName, rank: r,
      matchesPlayed: 0, wins: 0, draws: 0, losses: 0, points: 0, diff: 0,
      isBot: true, clubLogo: null
    };
    teamsForCalendar.push({ id: bId, name: bName, rank: r });
  }

  await batcher.set(tableRef, {
    id: tableId, leagueId, level: tier, group, season: seasonNum,
    stats: initialStats,
    createdAt: serverTimestamp(),
    version: 131
  });

  const calendar = generateSeasonCalendar(teamsForCalendar, seasonNum, leagueId);
  for (const m of calendar) {
    const mId = `match_v131_S${seasonNum}_L${leagueId}_V${tier}_G${group}_T${m.tour}_R${m.homeRank}_vs_R${m.awayRank}`;
    await batcher.set(doc(db, 'matches_v2', mId), {
      ...m,
      id: mId,
      leagueId, level: tier, groupId: group, season: seasonNum,
      isFinished: false, scoreA: 0, scoreB: 0,
      version: 131
    });
  }
}

export async function createGroupStructure(
  db: Firestore, 
  leagueId: string, 
  tier: number, 
  group: number, 
  seasonNum: number
) {
  const batcher = new FirestoreBatcher(db);
  await injectGroupData(batcher, db, leagueId, tier, group, seasonNum);
  await batcher.commit();
}

export async function initializeLeagueWorld(leagueId: string, targetSeason?: number) {
  const { firestore: db } = initializeFirebase();
  const info = getGlobalSeasonInfo();
  const seasonNum = targetSeason || info.activeSeasonNumber;

  const statusRef = doc(db, 'system_v1', `init_v131_S${seasonNum}_L${leagueId}`);
  const statusSnap = await getDoc(statusRef);
  
  let currentIndex = 0;
  if (statusSnap.exists()) {
    const data = statusSnap.data();
    if (data.status === 'completed' && data.version === 131) {
      return { status: 'COMPLETE', isComplete: true, currentIndex: TOTAL_GROUPS };
    }
    currentIndex = data.currentIndex || 0;
  }

  const batcher = new FirestoreBatcher(db);
  let processedInThisCall = 0;
  let lastProcessedIndex = currentIndex;

  while (processedInThisCall < GROUPS_PER_CALL && lastProcessedIndex < TOTAL_GROUPS) {
    const nextIndex = lastProcessedIndex + 1;
    const coords = getGroupCoordinates(nextIndex);
    
    const tableId = `table_v131_S${seasonNum}_L${leagueId}_V${coords.tier}_G${coords.group}`;
    const tableSnap = await getDoc(doc(db, 'league_tables_v2', tableId));
    
    if (!tableSnap.exists()) {
      await injectGroupData(batcher, db, leagueId, coords.tier, coords.group, seasonNum);
    } 

    lastProcessedIndex = nextIndex;
    processedInThisCall++;
  }

  await batcher.commit();

  const isComplete = lastProcessedIndex >= TOTAL_GROUPS;
  await setDoc(statusRef, {
    currentIndex: lastProcessedIndex,
    status: isComplete ? 'completed' : 'processing',
    updatedAt: serverTimestamp(),
    version: 131
  }, { merge: true });

  return { 
    status: isComplete ? 'FINISHED' : 'IN_PROGRESS', 
    currentIndex: lastProcessedIndex, 
    isComplete,
    progress: `Index: ${lastProcessedIndex}/${TOTAL_GROUPS}`
  };
}
