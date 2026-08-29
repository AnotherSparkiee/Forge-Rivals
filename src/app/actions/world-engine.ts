'use server';

/**
 * Глобальный двигатель заполнения мира v111 (Atomic Per-Group Commits).
 * Особенности:
 * 1. Исправлен баг Batch Limit (500): Теперь КАЖДАЯ группа коммитится своим отдельным батчем (~58 операций).
 * 2. Атомарный прогресс: currentIndex сохраняется СРАЗУ после успешного создания каждой группы.
 * 3. Агрессивный ремонт: Группы с < 8 командами считаются битыми и пересоздаются.
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
  generateSeasonCalendar 
} from '@/app/lib/leagues-data';
import { getGlobalSeasonInfo } from '@/app/lib/time-utils';

const TOTAL_GROUPS = 511; 
const GROUPS_TO_CREATE_PER_CALL = 15; // Уменьшено для стабильности HTTP-запроса
const MAX_SCAN_LIMIT = 511; 

/**
 * Математически точный расчет координат бинарной пирамиды.
 */
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
 * Наполняет батч операциями для создания ОДНОЙ группы.
 * ~58 операций записи.
 */
function injectGroupData(
  batch: any, 
  db: Firestore, 
  leagueId: string, 
  tier: number, 
  group: number, 
  seasonNum: number
) {
  const tableId = `table_S${seasonNum}_L${leagueId}_V${tier}_G${group}`;
  const tableRef = doc(db, 'league_tables_v1', tableId);
  
  // Принудительно удаляем старый документ для чистой перезаписи
  batch.delete(tableRef);

  const initialStats: any = {};
  const teamsForCalendar = [];

  for (let r = 1; r <= TEAMS_PER_GROUP; r++) {
    const bId = getBotId(leagueId, tier, group, r);
    const bName = getBotName(tier, group, r);
    initialStats[bId] = {
      id: bId, name: bName, rank: r,
      matchesPlayed: 0, wins: 0, draws: 0, losses: 0, points: 0, diff: 0,
      isBot: true
    };
    teamsForCalendar.push({ id: bId, name: bName, rank: r });
  }

  batch.set(tableRef, {
    id: tableId, leagueId, level: tier, group, season: seasonNum,
    stats: initialStats,
    createdAt: serverTimestamp(),
    version: 111
  });

  const calendar = generateSeasonCalendar(teamsForCalendar, seasonNum, leagueId);
  for (const m of calendar) {
    const mId = `match_S${seasonNum}_L${leagueId}_V${tier}_G${group}_T${m.tour}_R${m.homeRank}_vs_R${m.awayRank}`;
    batch.set(doc(db, 'matches_v1', mId), {
      ...m,
      id: mId,
      leagueId, level: tier, groupId: group, season: seasonNum,
      isFinished: false, scoreA: 0, scoreB: 0,
      version: 111
    });
  }
}

export async function initializeLeagueWorld(leagueId: string, targetSeason?: number) {
  const { firestore: db } = initializeFirebase();
  const info = getGlobalSeasonInfo();
  const seasonNum = targetSeason || info.activeSeasonNumber;

  const statusRef = doc(db, 'system_v1', `init_S${seasonNum}_L${leagueId}`);
  const statusSnap = await getDoc(statusRef);
  
  let currentIndex = 0;
  if (statusSnap.exists()) {
    const data = statusSnap.data();
    if (data.status === 'completed') {
      return { status: 'COMPLETE', isComplete: true, currentIndex: TOTAL_GROUPS };
    }
    currentIndex = data.currentIndex || 0;
  }

  let createdInThisCall = 0;
  let scannedInThisCall = 0;

  console.log(`[WORLD ENGINE v111] Starting pyramid scan from index ${currentIndex}...`);

  while (createdInThisCall < GROUPS_TO_CREATE_PER_CALL && currentIndex < TOTAL_GROUPS && scannedInThisCall < MAX_SCAN_LIMIT) {
    currentIndex++;
    scannedInThisCall++;
    const coords = getGroupCoordinates(currentIndex);

    const tableId = `table_S${seasonNum}_L${leagueId}_V${coords.tier}_G${coords.group}`;
    const tableRef = doc(db, 'league_tables_v1', tableId);
    
    const checkSnap = await getDoc(tableRef);
    let needsRepair = true;
    
    if (checkSnap.exists()) {
      const data = checkSnap.data();
      if (data?.stats && Object.keys(data.stats).length >= 8) {
        needsRepair = false; 
      }
    }

    if (needsRepair) {
      console.log(`[WORLD ENGINE] Building Group ${currentIndex}: Div ${coords.tier} G${coords.group}`);
      
      // КЛЮЧЕВОЕ ИСПРАВЛЕНИЕ: Новый батч на КАЖДУЮ группу
      const groupBatch = writeBatch(db);
      injectGroupData(groupBatch, db, leagueId, coords.tier, coords.group, seasonNum);
      
      // Коммитим данные ОДНОЙ группы
      await groupBatch.commit();
      createdInThisCall++;
    }

    // Сохраняем currentIndex СРАЗУ после каждой итерации
    // Даже если группа была пропущена, мы должны зафиксировать, что этот индекс проверен
    await setDoc(statusRef, {
      currentIndex,
      status: currentIndex >= TOTAL_GROUPS ? 'completed' : 'processing',
      updatedAt: serverTimestamp(),
      version: 111
    }, { merge: true });
  }

  const isComplete = currentIndex >= TOTAL_GROUPS;

  return { 
    status: isComplete ? 'FINISHED' : 'IN_PROGRESS', 
    currentIndex, 
    created: createdInThisCall,
    scanned: scannedInThisCall,
    isComplete
  };
}

export async function createGroupStructure(
  db: any, 
  leagueId: string, 
  tier: number, 
  group: number, 
  seasonNum: number
) {
  const batch = writeBatch(db);
  injectGroupData(batch, db, leagueId, tier, group, seasonNum);
  await batch.commit();
}
