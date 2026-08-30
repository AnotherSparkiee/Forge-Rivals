
'use server';

/**
 * Глобальный двигатель заполнения мира v140 (BulkWriter Architecture).
 * Создает полную структуру лиги (511 групп) до регистрации игроков.
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

class ClientBulkWriter {
  private currentBatch;
  private opCount = 0;
  private totalOps = 0;
  private pendingCommits: Promise<void>[] = [];

  constructor(private db: Firestore) {
    this.currentBatch = writeBatch(this.db);
  }

  private async flush() {
    const batchToCommit = this.currentBatch;
    this.pendingCommits.push(batchToCommit.commit());
    this.currentBatch = writeBatch(this.db);
    this.opCount = 0;
  }

  async set(ref: any, data: any, options?: any) {
    if (options) this.currentBatch.set(ref, data, options);
    else this.currentBatch.set(ref, data);
    this.opCount++;
    this.totalOps++;
    if (this.opCount >= 480) await this.flush();
  }

  async close() {
    if (this.opCount > 0) {
      this.pendingCommits.push(this.currentBatch.commit());
    }
    await Promise.all(this.pendingCommits);
    return { totalOps: this.totalOps };
  }
}

const GROUPS_PER_CALL = 25; 

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

/**
 * Внутренняя функция для инъекции данных группы (Таблица + Календарь).
 */
export async function injectGroupData(
  writer: ClientBulkWriter, 
  db: Firestore, 
  leagueId: string, 
  tier: number, 
  group: number, 
  seasonNum: number
) {
  const tableId = `table_v140_S${seasonNum}_L${leagueId}_V${tier}_G${group}`;
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

  if (Object.keys(initialStats).length !== 8) {
    throw new Error(`CRITICAL: Group integrity failure at L${tier} G${group}`);
  }

  await writer.set(tableRef, {
    id: tableId, leagueId, level: tier, group, season: seasonNum,
    stats: initialStats,
    createdAt: serverTimestamp(),
    version: 140
  });

  const calendar = generateSeasonCalendar(teamsForCalendar, seasonNum, leagueId);
  for (const m of calendar) {
    const mId = `match_v140_S${seasonNum}_L${leagueId}_V${tier}_G${group}_T${m.tour}_R${m.homeRank}_vs_R${m.awayRank}`;
    await writer.set(doc(db, 'matches_v2', mId), {
      ...m,
      id: mId,
      leagueId, level: tier, groupId: group, season: seasonNum,
      isFinished: false, scoreA: 0, scoreB: 0,
      version: 140
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
  const writer = new ClientBulkWriter(db);
  await injectGroupData(writer, db, leagueId, tier, group, seasonNum);
  return await writer.close();
}

export async function initializeLeagueWorld(leagueId: string, targetSeason?: number) {
  const { firestore: db } = initializeFirebase();
  const info = getGlobalSeasonInfo();
  const seasonNum = targetSeason || info.activeSeasonNumber;

  const statusRef = doc(db, 'system_v1', `init_v140_S${seasonNum}_L${leagueId}`);
  const statusSnap = await getDoc(statusRef);
  
  let currentIndex = 0;
  if (statusSnap.exists()) {
    const data = statusSnap.data();
    if (data.status === 'completed' && data.version === 140) {
      return { status: 'COMPLETE', isComplete: true, currentIndex: TOTAL_GROUPS };
    }
    currentIndex = data.currentIndex || 0;
  }

  const writer = new ClientBulkWriter(db);
  let lastProcessedIndex = currentIndex;
  let groupsBuiltInThisCall = 0;

  while (groupsBuiltInThisCall < GROUPS_PER_CALL && lastProcessedIndex < TOTAL_GROUPS) {
    const nextIndex = lastProcessedIndex + 1;
    const coords = getGroupCoordinates(nextIndex);
    
    const tableId = `table_v140_S${seasonNum}_L${leagueId}_V${coords.tier}_G${coords.group}`;
    const tableSnap = await getDoc(doc(db, 'league_tables_v2', tableId));
    
    if (!tableSnap.exists()) {
      await injectGroupData(writer, db, leagueId, coords.tier, coords.group, seasonNum);
      groupsBuiltInThisCall++;
    } 

    lastProcessedIndex = nextIndex;
  }

  await writer.close();

  const isComplete = lastProcessedIndex >= TOTAL_GROUPS;
  await setDoc(statusRef, {
    currentIndex: lastProcessedIndex,
    status: isComplete ? 'completed' : 'processing',
    updatedAt: serverTimestamp(),
    version: 140
  }, { merge: true });

  return { 
    status: isComplete ? 'FINISHED' : 'IN_PROGRESS', 
    currentIndex: lastProcessedIndex, 
    isComplete,
    progress: `Index: ${lastProcessedIndex}/${TOTAL_GROUPS}`
  };
}
