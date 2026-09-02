
'use server';

/**
 * Глобальный двигатель мира v145 (Privileged System Auth).
 */

import { 
  doc, writeBatch, 
  Firestore, serverTimestamp, getDoc, setDoc 
} from 'firebase/firestore';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { initializeFirebase } from '@/firebase';
import { 
  getBotId, 
  getBotName,
  TEAMS_PER_GROUP, 
  generateSeasonCalendar,
  TOTAL_GROUPS
} from '@/app/lib/leagues-data';
import { getGlobalSeasonInfo } from '@/app/lib/time-utils';

const SYSTEM_EMAIL = "system@internal.mobamanageronline.app";

async function authenticateAsSystem() {
  const { auth } = initializeFirebase();
  const password = process.env.SYSTEM_ACCOUNT_PASSWORD;
  if (!password) throw new Error("SYSTEM_AUTH_CRITICAL_ERROR: Password missing");
  await signInWithEmailAndPassword(auth, SYSTEM_EMAIL, password);
}

const GROUPS_PER_CALL = 8; 

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

export async function injectGroupData(
  batch: any, 
  db: Firestore, 
  leagueId: string, 
  tier: number, 
  group: number, 
  seasonNum: number
) {
  if (!leagueId || tier < 1 || tier > 9 || group < 1) return;

  const tableId = `table_v140_S${seasonNum}_L${leagueId}_V${tier}_G${group}`;
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

  if (Object.keys(initialStats).length !== 8) return;

  const tableRef = doc(db, 'league_tables_v2', tableId);
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

export async function createGroupStructure(
  db: Firestore, 
  leagueId: string, 
  tier: number, 
  group: number, 
  seasonNum: number
) {
  // Важно: вызывается из другого Server Action, поэтому повторная авторизация может не требоваться, 
  // но для надежности проводим её.
  await authenticateAsSystem();
  const batch = writeBatch(db);
  await injectGroupData(batch, db, leagueId, tier, group, seasonNum);
  await batch.commit();
}

export async function initializeLeagueWorld(leagueId: string, targetSeason?: number) {
  await authenticateAsSystem();
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

  if (currentIndex >= TOTAL_GROUPS) return { status: 'COMPLETE', isComplete: true };

  const batch = writeBatch(db);
  let processedInThisCall = 0;
  let nextIndex = currentIndex;

  while (processedInThisCall < GROUPS_PER_CALL && nextIndex < TOTAL_GROUPS) {
    nextIndex++;
    const coords = getGroupCoordinates(nextIndex);
    await injectGroupData(batch, db, leagueId, coords.tier, coords.group, seasonNum);
    processedInThisCall++;
  }

  await batch.commit();

  const isComplete = nextIndex >= TOTAL_GROUPS;
  await setDoc(statusRef, {
    currentIndex: nextIndex,
    status: isComplete ? 'completed' : 'processing',
    updatedAt: serverTimestamp(),
    version: 140
  }, { merge: true });

  return { status: isComplete ? 'FINISHED' : 'BATCH_DONE', currentIndex: nextIndex, isComplete, progress: `Index: ${nextIndex}/${TOTAL_GROUPS}` };
}
