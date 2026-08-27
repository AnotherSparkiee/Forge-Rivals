'use server';

/**
 * Глобальный двигатель перезагрузки мира v12 (Nuclear Rebuild).
 * Особенности:
 * 1. Двухфазная очистка: сначала WIPING (удаление всех 511 групп), затем INIT (создание).
 * 2. Детерминированная итерация: расчет координат Tier/Group по индексу 1..511.
 * 3. Атомарность: Группа создается целиком (57 документов) в одном батче.
 */

import { 
  doc, getDoc, writeBatch, 
  Firestore, serverTimestamp, setDoc, deleteDoc
} from 'firebase/firestore';
import { initializeFirebase } from '@/firebase';
import { 
  getBotId, 
  TEAMS_PER_GROUP, 
  generateSeasonCalendar 
} from '@/app/lib/leagues-data';
import { getGlobalSeasonInfo } from '@/app/lib/time-utils';

const TOTAL_GROUPS = 511; // 1 + 2 + 4 + 8 + 16 + 32 + 64 + 128 + 256
const GROUPS_PER_CALL = 7; // ~400 операций (лимит 500)

/**
 * Рассчитывает координаты группы (Tier, Group) по сквозному индексу 1..511.
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
  return { tier: 10, group: 1 }; // End of pyramid
}

/**
 * Подготовка данных группы (Таблица + Календарь).
 */
function prepareGroupData(
  batch: any, 
  db: Firestore, 
  leagueId: string, 
  tier: number, 
  group: number, 
  seasonNum: number
) {
  const tableId = `table_S${seasonNum}_L${leagueId}_V${tier}_G${group}`;
  const tableRef = doc(db, 'league_tables_v1', tableId);
  
  const initialStats: any = {};
  const teamsForCalendar = [];

  for (let r = 1; r <= TEAMS_PER_GROUP; r++) {
    const bId = getBotId(leagueId, tier, group, r);
    initialStats[bId] = {
      id: bId, name: bId, rank: r,
      matchesPlayed: 0, wins: 0, draws: 0, losses: 0, points: 0, diff: 0,
      isBot: true
    };
    teamsForCalendar.push({ id: bId, name: bId, rank: r });
  }

  // 1. Создаем таблицу (overwrite)
  batch.set(tableRef, {
    id: tableId, leagueId, level: tier, group, season: seasonNum,
    stats: initialStats,
    createdAt: serverTimestamp(),
    version: 12
  });

  // 2. Создаем календарь (56 матчей)
  const calendar = generateSeasonCalendar(teamsForCalendar, seasonNum, leagueId);
  for (const m of calendar) {
    const mId = `match_S${seasonNum}_L${leagueId}_V${tier}_G${group}_T${m.tour}_R${m.homeRank}_vs_R${m.awayRank}`;
    batch.set(doc(db, 'matches_v1', mId), {
      ...m,
      id: mId,
      leagueId, level: tier, groupId: group, season: seasonNum,
      isFinished: false, scoreA: 0, scoreB: 0,
      version: 12
    });
  }
}

/**
 * Удаление данных группы (Таблица + Календарь).
 */
function wipeGroupData(
  batch: any, 
  db: Firestore, 
  leagueId: string, 
  tier: number, 
  group: number, 
  seasonNum: number
) {
  const tableId = `table_S${seasonNum}_L${leagueId}_V${tier}_G${group}`;
  batch.delete(doc(db, 'league_tables_v1', tableId));

  const teams = Array.from({ length: 8 }, (_, i) => ({ rank: i + 1 }));
  const calendar = generateSeasonCalendar(teams, seasonNum, leagueId);
  for (const m of calendar) {
    const mId = `match_S${seasonNum}_L${leagueId}_V${tier}_G${group}_T${m.tour}_R${m.homeRank}_vs_R${m.awayRank}`;
    batch.delete(doc(db, 'matches_v1', mId));
  }
}

/**
 * Запуск полной очистки.
 */
export async function nuclearResetWorld(leagueId: string = "ALPHA") {
  const { firestore: db } = initializeFirebase();
  const info = getGlobalSeasonInfo();
  const seasonNum = info.activeSeasonNumber;
  const statusRef = doc(db, 'system_v1', `init_S${seasonNum}_L${leagueId}`);

  await setDoc(statusRef, {
    status: 'wiping',
    phase: 'WIPING',
    currentIndex: 0,
    updatedAt: serverTimestamp(),
    version: 12
  });

  return { success: true, message: "Nuclear wipe initiated." };
}

/**
 * Главный цикл инициализации / перестройки.
 */
export async function initializeLeagueWorld(leagueId: string, targetSeason?: number) {
  const { firestore: db } = initializeFirebase();
  const info = getGlobalSeasonInfo();
  const seasonNum = targetSeason || info.activeSeasonNumber;

  const statusRef = doc(db, 'system_v1', `init_S${seasonNum}_L${leagueId}`);
  const statusSnap = await getDoc(statusRef);
  
  let phase = 'INIT_WORLD';
  let currentIndex = 0;

  if (statusSnap.exists()) {
    const data = statusSnap.data();
    if (data.status === 'completed') return { success: true, isComplete: true };
    phase = data.phase || 'INIT_WORLD';
    currentIndex = data.currentIndex || 0;
  }

  const batch = writeBatch(db);
  let processed = 0;

  console.log(`[WORLD ENGINE v12] Phase: ${phase}, Index: ${currentIndex}`);

  while (processed < GROUPS_PER_CALL && currentIndex < TOTAL_GROUPS) {
    currentIndex++;
    const { tier, group } = getGroupCoordinates(currentIndex);

    if (phase === 'WIPING') {
      wipeGroupData(batch, db, leagueId, tier, group, seasonNum);
    } else {
      prepareGroupData(batch, db, leagueId, tier, group, seasonNum);
    }

    processed++;
  }

  // Обновление статуса
  const isPhaseEnd = currentIndex >= TOTAL_GROUPS;
  let nextStatus = 'processing';
  let nextPhase = phase;
  let nextIndex = currentIndex;

  if (isPhaseEnd) {
    if (phase === 'WIPING') {
      nextPhase = 'INIT_WORLD';
      nextIndex = 0;
      console.log(`[WORLD ENGINE v12] Wipe complete. Starting Initialization.`);
    } else {
      nextStatus = 'completed';
      console.log(`[WORLD ENGINE v12] Initialization complete.`);
    }
  }

  batch.set(statusRef, {
    status: nextStatus,
    phase: nextPhase,
    currentIndex: nextIndex,
    lastTier: getGroupCoordinates(nextIndex).tier,
    lastGroup: getGroupCoordinates(nextIndex).group,
    updatedAt: serverTimestamp(),
    version: 12
  }, { merge: true });

  await batch.commit();

  return { 
    success: true, 
    phase, 
    processed, 
    currentIndex: nextIndex, 
    isComplete: nextStatus === 'completed' 
  };
}

/**
 * JIT-создание структуры группы (безопасное).
 */
export async function createGroupStructure(
  db: Firestore, 
  leagueId: string, 
  tier: number, 
  group: number, 
  seasonNum: number
) {
  const batch = writeBatch(db);
  prepareGroupData(batch, db, leagueId, tier, group, seasonNum);
  await batch.commit();
}
