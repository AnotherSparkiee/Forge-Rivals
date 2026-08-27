
'use server';

/**
 * @fileOverview Глобальный двигатель инициализации мира v2.7 (Atomic & Data-Aware).
 * Особенности:
 * 1. Глубокая проверка (Data-Aware): Пропускает группу только если в ней есть данные (статистика).
 * 2. Атомарный Чекпойнт: Обновляет статус прогресса в том же батче, что и данные группы.
 * 3. Лимиты транзакций: Обработка 7 групп (400+ операций) за раз для гарантии успеха в 500-limit.
 */

import { 
  doc, getDoc, writeBatch, 
  Firestore, serverTimestamp, setDoc 
} from 'firebase/firestore';
import { initializeFirebase } from '@/firebase';
import { 
  getGroupsCountInLevel, 
  getBotId, 
  TEAMS_PER_GROUP, 
  generateSeasonCalendar 
} from '@/app/lib/leagues-data';
import { getGlobalSeasonInfo } from '@/app/lib/time-utils';

// 7 групп * 57 документов = 399 операций. Запас до лимита 500.
const GROUPS_PER_CHUNK = 7; 

/**
 * Внутреннее ядро подготовки данных группы.
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

  // 1. Создаем таблицу
  batch.set(tableRef, {
    id: tableId, leagueId, level: tier, group, season: seasonNum,
    stats: initialStats,
    createdAt: serverTimestamp(),
    version: 11
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
      version: 11
    });
  }
}

/**
 * Публичная функция JIT-создания (используется при регистрации игрока).
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

/**
 * Инициализирует мир лиги порциями. 
 * Гарантированно доводит количество групп до 511.
 */
export async function initializeLeagueWorld(leagueId: string, targetSeason?: number) {
  const { firestore: db } = initializeFirebase();
  const info = getGlobalSeasonInfo();
  const seasonNum = targetSeason || info.activeSeasonNumber;

  const statusRef = doc(db, 'system_v1', `init_S${seasonNum}_L${leagueId}`);
  const statusSnap = await getDoc(statusRef);
  
  let currentTier = 1;
  let currentGroup = 0; 
  let status = 'idle';

  if (statusSnap.exists()) {
    const data = statusSnap.data();
    if (data.status === 'completed') return { success: true, isComplete: true };
    
    status = data.status;
    currentTier = data.lastTier || 1;
    currentGroup = data.lastGroup || 0; 
  }

  let groupsProcessedInThisCall = 0;
  let tier = currentTier;
  let group = currentGroup;

  while (groupsProcessedInThisCall < GROUPS_PER_CHUNK && tier <= 9) {
    // 1. ОПРЕДЕЛЯЕМ СЛЕДУЮЩИЕ КООРДИНАТЫ
    let nextTier = tier;
    let nextGroup = group + 1;
    const maxInCurrentTier = Math.pow(2, nextTier - 1);
    
    if (nextGroup > maxInCurrentTier) {
      nextTier++;
      nextGroup = 1;
    }

    if (nextTier > 9) {
      // Все 511 групп обработаны
      await setDoc(statusRef, { 
        status: 'completed', 
        lastTier: 9, 
        lastGroup: 256, 
        finishedAt: serverTimestamp() 
      }, { merge: true });
      return { success: true, isComplete: true };
    }

    // 2. ОБРАБОТКА ГРУППЫ
    const tableId = `table_S${seasonNum}_L${leagueId}_V${nextTier}_G${nextGroup}`;
    const tableRef = doc(db, 'league_tables_v1', tableId);
    
    // Проверка существования данных (защита существующих игроков)
    const checkSnap = await getDoc(tableRef);
    const hasData = checkSnap.exists() && Object.keys(checkSnap.data()?.stats || {}).length > 0;
    
    const batch = writeBatch(db);
    
    if (!hasData) {
      console.log(`[WORLD ENGINE] Initializing group S${seasonNum} V${nextTier} G${nextGroup}`);
      prepareGroupData(batch, db, leagueId, nextTier, nextGroup, seasonNum);
    } else {
      console.log(`[WORLD ENGINE] Data found in S${seasonNum} V${nextTier} G${nextGroup}. Skipping.`);
    }

    // 3. АТОМАРНОЕ СОХРАНЕНИЕ ЧЕКПОЙНТА
    batch.set(statusRef, { 
      lastTier: nextTier,
      lastGroup: nextGroup,
      status: 'processing',
      updatedAt: serverTimestamp()
    }, { merge: true });

    await batch.commit();

    // Переходим к следующему шагу
    tier = nextTier;
    group = nextGroup;
    groupsProcessedInThisCall++;
  }
  
  return { 
    success: true, 
    processed: groupsProcessedInThisCall, 
    lastTier: tier, 
    lastGroup: group,
    isComplete: tier > 9
  };
}
