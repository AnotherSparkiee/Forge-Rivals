
'use server';

/**
 * @fileOverview Глобальный двигатель инициализации мира v2.8 (Deep Scan & Gap Filling).
 * Особенности:
 * 1. Deep Scan: Пропускает существующие группы и ищет пустые сектора, пока не создаст 7 новых групп за вызов.
 * 2. Data-Aware: Группа считается существующей только если в ней есть заполненная статистика.
 * 3. Пошаговая Атомарность: Чекпойнт прогресса обновляется мгновенно после каждой успешной записи.
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

// Количество РЕАЛЬНО СОЗДАННЫХ групп за один вызов (для соблюдения лимита 500 операций)
const GROUPS_TO_CREATE_PER_CALL = 7; 
// Максимальное количество групп для проверки за один вызов (защита от таймаута)
const MAX_SCAN_PER_CALL = 80;

/**
 * Внутреннее ядро подготовки данных группы (Таблица + Календарь).
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
 * Инициализирует мир лиги. 
 * Сканирует пирамиду и заполняет пустые группы ботами.
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

  let groupsCreatedInThisCall = 0;
  let scanCount = 0;
  let tier = currentTier;
  let group = currentGroup;

  console.log(`[WORLD ENGINE] Starting scan from V${tier} G${group}. Target: 511 groups.`);

  while (groupsCreatedInThisCall < GROUPS_TO_CREATE_PER_CALL && scanCount < MAX_SCAN_PER_CALL && tier <= 9) {
    scanCount++;
    
    // 1. ОПРЕДЕЛЯЕМ СЛЕДУЮЩИЕ КООРДИНАТЫ
    let nextTier = tier;
    let nextGroup = group + 1;
    const maxInCurrentTier = Math.pow(2, nextTier - 1);
    
    if (nextGroup > maxInCurrentTier) {
      nextTier++;
      nextGroup = 1;
    }

    if (nextTier > 9) {
      // Весь мир просканирован
      await setDoc(statusRef, { 
        status: 'completed', 
        lastTier: 9, 
        lastGroup: 256, 
        finishedAt: serverTimestamp() 
      }, { merge: true });
      return { success: true, isComplete: true };
    }

    // 2. ПРОВЕРКА ГРУППЫ
    const tableId = `table_S${seasonNum}_L${leagueId}_V${nextTier}_G${nextGroup}`;
    const tableRef = doc(db, 'league_tables_v1', tableId);
    
    const checkSnap = await getDoc(tableRef);
    const hasData = checkSnap.exists() && Object.keys(checkSnap.data()?.stats || {}).length > 0;
    
    if (!hasData) {
      // СОЗДАЕМ ГРУППУ
      const batch = writeBatch(db);
      console.log(`[WORLD ENGINE] Gap found! Initializing group S${seasonNum} V${nextTier} G${nextGroup}`);
      
      prepareGroupData(batch, db, leagueId, nextTier, nextGroup, seasonNum);
      
      // АТОМАРНЫЙ ЧЕКПОЙНТ (в том же батче)
      batch.set(statusRef, { 
        lastTier: nextTier,
        lastGroup: nextGroup,
        status: 'processing',
        updatedAt: serverTimestamp()
      }, { merge: true });

      await batch.commit();
      groupsCreatedInThisCall++;
    } else {
      // ГРУППА УЖЕ ЕСТЬ - просто обновляем чекпойнт (без батча, так как данных нет)
      // Мы не инкрементируем groupsCreatedInThisCall, позволяя циклу идти дальше
      await setDoc(statusRef, { 
        lastTier: nextTier,
        lastGroup: nextGroup,
        updatedAt: serverTimestamp()
      }, { merge: true });
    }

    // Переходим к следующему шагу
    tier = nextTier;
    group = nextGroup;
  }
  
  const isFinalComplete = tier > 9;
  
  return { 
    success: true, 
    created: groupsCreatedInThisCall, 
    scanned: scanCount,
    lastTier: tier, 
    lastGroup: group,
    isComplete: isFinalComplete
  };
}
