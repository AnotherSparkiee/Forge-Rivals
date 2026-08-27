'use server';

/**
 * @fileOverview Глобальный двигатель инициализации мира v2.6 (Atomic & Protected).
 * Особенности:
 * 1. Проверка существования (Idempotency): Никогда не перезаписывает существующие группы.
 * 2. Пошаговый чекпойнт: Сохраняет прогресс в том же батче, что и данные группы.
 * 3. Безопасность лимитов: Каждая группа обрабатывается как отдельная транзакция.
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

// Количество групп за один вызов функции (для предотвращения таймаутов)
const GROUPS_PER_CHUNK = 8; 

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
  let currentGroup = 0; // Начинаем с нуля, чтобы первая группа была 1
  let status = 'idle';

  if (statusSnap.exists()) {
    const data = statusSnap.data();
    if (data.status === 'completed') return { success: true, isComplete: true };
    
    status = data.status;
    currentTier = data.lastTier || 1;
    currentGroup = data.lastGroup || 0; 
  } else {
    // Создаем начальный документ статуса
    await setDoc(statusRef, { 
      status: 'processing', 
      startedAt: serverTimestamp(),
      lastTier: 1,
      lastGroup: 0
    });
  }

  let groupsProcessedInThisCall = 0;
  let tier = currentTier;
  let group = currentGroup;

  while (groupsProcessedInThisCall < GROUPS_PER_CHUNK && tier <= 9) {
    // 1. Рассчитываем следующую группу
    group++;
    const maxGroupsInTier = Math.pow(2, tier - 1);
    
    if (group > maxGroupsInTier) {
      tier++;
      group = 1;
      if (tier > 9) break; // Все 511 групп проверены/созданы
    }

    const tableId = `table_S${seasonNum}_L${leagueId}_V${tier}_G${group}`;
    const tableRef = doc(db, 'league_tables_v1', tableId);
    
    // 2. КРИТИЧЕСКАЯ ПРОВЕРКА: Существует ли группа?
    const checkSnap = await getDoc(tableRef);
    
    const batch = writeBatch(db);
    
    if (!checkSnap.exists()) {
      console.log(`[WORLD ENGINE] Creating missing group S${seasonNum} V${tier} G${group}`);
      prepareGroupData(batch, db, leagueId, tier, group, seasonNum);
    } else {
      console.log(`[WORLD ENGINE] Skipping existing group S${seasonNum} V${tier} G${group}`);
      // Если группа есть, мы ничего не пишем в её таблицу, но должны обновить статус прогресса
    }

    // 3. Обновляем статус прогресса (Чекпойнт) ВСЕГДА (и при пропуске, и при создании)
    // Это гарантирует, что мы не застрянем на существующих группах
    batch.set(statusRef, { 
      lastTier: tier,
      lastGroup: group,
      status: tier > 9 ? 'completed' : 'processing',
      updatedAt: serverTimestamp(),
      finishedAt: tier > 9 ? serverTimestamp() : null
    }, { merge: true });

    await batch.commit();
    groupsProcessedInThisCall++;
  }
  
  const isFullyComplete = tier > 9;
  
  return { 
    success: true, 
    processed: groupsProcessedInThisCall, 
    lastTier: tier > 9 ? 9 : tier, 
    lastGroup: tier > 9 ? 256 : group,
    isComplete: isFullyComplete 
  };
}
