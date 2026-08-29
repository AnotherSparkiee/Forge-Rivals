'use server';

/**
 * Глобальный двигатель заполнения мира v131 (Universe Architect).
 * Оптимизирован для предотвращения таймаутов (15 групп за вызов).
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

const GROUPS_TO_CREATE_PER_CALL = 15; // Безопасный лимит для предотвращения таймаутов Server Actions

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
  const tableId = `table_v131_S${seasonNum}_L${leagueId}_V${tier}_G${group}`;
  const tableRef = doc(db, 'league_tables_v2', tableId);
  
  const initialStats: any = {};
  const teamsForCalendar = [];

  // ГАРАНТИЯ: всегда ровно 8 ботов
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

  batch.set(tableRef, {
    id: tableId, leagueId, level: tier, group, season: seasonNum,
    stats: initialStats,
    createdAt: serverTimestamp(),
    version: 131
  });

  const calendar = generateSeasonCalendar(teamsForCalendar, seasonNum, leagueId);
  for (const m of calendar) {
    const mId = `match_v131_S${seasonNum}_L${leagueId}_V${tier}_G${group}_T${m.tour}_R${m.homeRank}_vs_R${m.awayRank}`;
    batch.set(doc(db, 'matches_v2', mId), {
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
  const batch = writeBatch(db);
  injectGroupData(batch, db, leagueId, tier, group, seasonNum);
  await batch.commit();
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

  let processedInThisCall = 0;

  while (processedInThisCall < GROUPS_TO_CREATE_PER_CALL && currentIndex < TOTAL_GROUPS) {
    const nextIndex = currentIndex + 1;
    const coords = getGroupCoordinates(nextIndex);
    
    const tableId = `table_v131_S${seasonNum}_L${coords.tier}_G${coords.group}`;
    const batch = writeBatch(db);
    
    // Инъекция данных группы
    injectGroupData(batch, db, leagueId, coords.tier, coords.group, seasonNum);
    
    // Обновление прогресса в ТОМ ЖЕ батче
    batch.set(statusRef, {
      currentIndex: nextIndex,
      status: nextIndex >= TOTAL_GROUPS ? 'completed' : 'processing',
      updatedAt: serverTimestamp(),
      version: 131
    }, { merge: true });

    await batch.commit();
    currentIndex = nextIndex;
    processedInThisCall++;
  }

  const isComplete = currentIndex >= TOTAL_GROUPS;
  return { 
    status: isComplete ? 'FINISHED' : 'IN_PROGRESS', 
    currentIndex, 
    isComplete,
    progress: `Built: ${currentIndex}/${TOTAL_GROUPS}`
  };
}
