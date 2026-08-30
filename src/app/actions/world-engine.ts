
'use server';

/**
 * Глобальный двигатель мира v140 (Manual Batch Architecture).
 * Создает структуру лиги порциями по 8 групп за вызов (456 операций).
 */

import { 
  doc, writeBatch, 
  Firestore, serverTimestamp, getDoc, setDoc 
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

const GROUPS_PER_CALL = 8; // 8 * 57 docs = 456 ops (Безопасный предел < 500)

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
 * Создает структуру одной группы (Таблица + Календарь) внутри батча.
 */
export async function injectGroupData(
  batch: any, 
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

  // Проверка целостности
  if (Object.keys(initialStats).length !== 8) return;

  batch.set(tableRef, {
    id: tableId, leagueId, level: tier, group, season: seasonNum,
    stats: initialStats,
    createdAt: serverTimestamp(),
    version: 140
  });

  const calendar = generateSeasonCalendar(teamsForCalendar, seasonNum, leagueId);
  for (const m of calendar) {
    const mId = `match_v140_S${seasonNum}_L${leagueId}_V${tier}_G${group}_T${m.tour}_R${m.homeRank}_vs_R${m.awayRank}`;
    batch.set(doc(db, 'matches_v2', mId), {
      ...m,
      id: mId,
      leagueId, level: tier, groupId: group, season: seasonNum,
      isFinished: false, scoreA: 0, scoreB: 0,
      version: 140
    });
  }
}

/**
 * JIT-создание группы (используется при регистрации, если группа не найдена).
 */
export async function createGroupStructure(
  db: Firestore, 
  leagueId: string, 
  tier: number, 
  group: number, 
  seasonNum: number
) {
  const batch = writeBatch(db);
  await injectGroupData(batch, db, leagueId, tier, group, seasonNum);
  await batch.commit();
  return { success: true };
}

/**
 * Основная функция мануальной постройки.
 * Создает следующие 8 групп в пирамиде.
 */
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

  if (currentIndex >= TOTAL_GROUPS) {
    return { status: 'COMPLETE', isComplete: true, currentIndex: TOTAL_GROUPS };
  }

  const batch = writeBatch(db);
  let processedInThisCall = 0;
  let nextIndex = currentIndex;

  while (processedInThisCall < GROUPS_PER_CALL && nextIndex < TOTAL_GROUPS) {
    nextIndex++;
    const coords = getGroupCoordinates(nextIndex);
    
    // Проверка существования (чтобы не перезаписывать живых игроков)
    const tableId = `table_v140_S${seasonNum}_L${leagueId}_V${coords.tier}_G${coords.group}`;
    const tableSnap = await getDoc(doc(db, 'league_tables_v2', tableId));
    
    if (!tableSnap.exists()) {
      await injectGroupData(batch, db, leagueId, coords.tier, coords.group, seasonNum);
    } 
    processedInThisCall++;
  }

  await batch.commit();

  const isComplete = nextIndex >= TOTAL_GROUPS;
  const resultData = {
    currentIndex: nextIndex,
    status: isComplete ? 'completed' : 'processing',
    updatedAt: serverTimestamp(),
    version: 140
  };

  await setDoc(statusRef, resultData, { merge: true });

  return { 
    status: isComplete ? 'FINISHED' : 'BATCH_DONE', 
    currentIndex: nextIndex, 
    isComplete,
    progress: `Index: ${nextIndex}/${TOTAL_GROUPS}`
  };
}
