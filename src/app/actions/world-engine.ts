
'use server';

/**
 * Глобальный двигатель заполнения мира v116 (Atomic Bot-Only Support).
 * Особенности:
 * 1. Одна группа = один коммит батча (58 операций).
 * 2. Создает только ботов (8 на группу).
 * 3. Использует версию 116 для чистого старта.
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
const GROUPS_TO_CREATE_PER_CALL = 15; 
const MAX_SCAN_LIMIT = 511; 

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
    version: 116
  });

  const calendar = generateSeasonCalendar(teamsForCalendar, seasonNum, leagueId);
  for (const m of calendar) {
    const mId = `match_S${seasonNum}_L${leagueId}_V${tier}_G${group}_T${m.tour}_R${m.homeRank}_vs_R${m.awayRank}`;
    batch.set(doc(db, 'matches_v1', mId), {
      ...m,
      id: mId,
      leagueId, level: tier, groupId: group, season: seasonNum,
      isFinished: false, scoreA: 0, scoreB: 0,
      version: 116
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

  while (createdInThisCall < GROUPS_TO_CREATE_PER_CALL && currentIndex < TOTAL_GROUPS && scannedInThisCall < MAX_SCAN_LIMIT) {
    currentIndex++;
    scannedInThisCall++;
    const coords = getGroupCoordinates(currentIndex);

    const tableId = `table_S${seasonNum}_L${leagueId}_V${coords.tier}_G${coords.group}`;
    const tableRef = doc(db, 'league_tables_v1', tableId);
    
    const checkSnap = await getDoc(tableRef);
    let needsCreate = true;
    
    if (checkSnap.exists()) {
      const data = checkSnap.data();
      if (data?.stats && Object.keys(data.stats).length >= 8 && data.version === 116) {
        needsCreate = false; 
      }
    }

    if (needsCreate) {
      const groupBatch = writeBatch(db);
      injectGroupData(groupBatch, db, leagueId, coords.tier, coords.group, seasonNum);
      await groupBatch.commit();
      createdInThisCall++;
    }

    // Сохраняем прогресс сразу после каждой группы
    await setDoc(statusRef, {
      currentIndex,
      status: currentIndex >= TOTAL_GROUPS ? 'completed' : 'processing',
      updatedAt: serverTimestamp(),
      version: 116
    }, { merge: true });
  }

  const isComplete = currentIndex >= TOTAL_GROUPS;
  return { 
    status: isComplete ? 'FINISHED' : 'IN_PROGRESS', 
    currentIndex, 
    isComplete
  };
}
