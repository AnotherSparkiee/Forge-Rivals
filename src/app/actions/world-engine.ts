'use server';

/**
 * Глобальный двигатель мира v152 (Admin SDK Transition).
 */

import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase-admin';
import { 
  getBotId, 
  getBotName,
  TEAMS_PER_GROUP, 
  generateSeasonCalendar,
  TOTAL_GROUPS,
  MAX_LEVELS
} from '@/app/lib/leagues-data';
import { getGlobalSeasonInfo } from '@/app/lib/time-utils';

const GROUPS_PER_CALL = 100; 

function getGroupCoordinates(index: number) {
  if (index < 1) return { tier: 1, group: 1 };
  let tier = 1;
  let runningTotal = 0;
  while (tier <= MAX_LEVELS) {
    const groupsInTier = Math.pow(2, tier - 1);
    if (index <= runningTotal + groupsInTier) {
      return { tier, group: index - runningTotal };
    }
    runningTotal += groupsInTier;
    tier++;
  }
  return { tier: MAX_LEVELS, group: Math.pow(2, MAX_LEVELS - 1) };
}

async function injectGroupData(
  transaction: any, 
  leagueId: string, 
  tier: number, 
  group: number, 
  seasonNum: number
) {
  const tableId = `table_v140_S${seasonNum}_L${leagueId}_V${tier}_G${group}`;
  const tableRef = adminDb.collection('league_tables_v2').doc(tableId);
  
  const tableSnap = await transaction.get(tableRef);
  
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

  if (!tableSnap.exists) {
    transaction.set(tableRef, {
      id: tableId, leagueId, level: tier, group, season: seasonNum,
      stats: initialStats,
      createdAt: FieldValue.serverTimestamp(),
      version: 140
    });
  }

  const calendar = generateSeasonCalendar(teamsForCalendar, seasonNum, leagueId);
  for (const m of calendar) {
    const mId = `match_v140_S${seasonNum}_L${leagueId}_V${tier}_G${group}_T${m.tour}_R${m.homeRank}_vs_R${m.awayRank}`;
    const matchRef = adminDb.collection('matches_v2').doc(mId);
    transaction.set(matchRef, {
      ...m, id: mId, leagueId, level: tier, groupId: group, season: seasonNum,
      isFinished: false, isProcessing: false, scoreA: 0, scoreB: 0, version: 140
    });
  }
}

export async function initializeLeagueWorld(leagueId: string, targetSeason?: number) {
  const db = adminDb;
  const info = getGlobalSeasonInfo();
  const seasonNum = targetSeason || info.activeSeasonNumber;

  const statusRef = db.collection('system_v1').doc(`init_v140_S${seasonNum}_L${leagueId}`);
  
  return await db.runTransaction(async (transaction) => {
    const statusSnap = await transaction.get(statusRef);
    let currentIndex = 0;
    
    if (statusSnap.exists) {
      const data = statusSnap.data()!;
      if (data.status === 'completed' && data.version === 140) {
        return { status: 'COMPLETE', isComplete: true, currentIndex: TOTAL_GROUPS };
      }
      currentIndex = data.currentIndex || 0;
    }

    if (currentIndex >= TOTAL_GROUPS) return { status: 'COMPLETE', isComplete: true };

    let processedCount = 0;
    let nextIndex = currentIndex;

    while (processedCount < GROUPS_PER_CALL && nextIndex < TOTAL_GROUPS) {
      nextIndex++;
      const coords = getGroupCoordinates(nextIndex);
      await injectGroupData(transaction, leagueId, coords.tier, coords.group, seasonNum);
      processedCount++;
    }

    const isComplete = nextIndex >= TOTAL_GROUPS;
    transaction.set(statusRef, {
      currentIndex: nextIndex,
      status: isComplete ? 'completed' : 'processing',
      updatedAt: FieldValue.serverTimestamp(),
      version: 140
    }, { merge: true });

    return { 
      status: isComplete ? 'FINISHED' : 'BATCH_DONE', 
      currentIndex: nextIndex, 
      isComplete, 
      progress: `Index: ${nextIndex}/${TOTAL_GROUPS}` 
    };
  });
}
