'use server';

/**
 * @fileOverview Глобальный двигатель инициализации мира v2.9 (Aggressive Gap Filling).
 * Особенности:
 * 1. Deep Scan: Пропускает существующие группы и активно ищет пустые сектора.
 * 2. High Throughput: Теперь сканирует до 150 секторов за один вызов, чтобы быстрее найти пустые.
 * 3. Атомарность: Группа создается целиком (57 документов), прогресс фиксируется мгновенно.
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

// Количество РЕАЛЬНО СОЗДАННЫХ групп за один вызов (лимит транзакции 500 операций)
const GROUPS_TO_CREATE_PER_CALL = 7; 
// Максимальное количество групп для сканирования (увеличено для быстрого поиска дыр)
const MAX_SCAN_PER_CALL = 150;

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
 * Сканирует пирамиду и заполняет пустые группы ботами автоматически.
 */
export async function initializeLeagueWorld(leagueId: string, targetSeason?: number) {
  const { firestore: db } = initializeFirebase();
  const info = getGlobalSeasonInfo();
  const seasonNum = targetSeason || info.activeSeasonNumber;

  const statusRef = doc(db, 'system_v1', `init_S${seasonNum}_L${leagueId}`);
  const statusSnap = await getDoc(statusRef);
  
  let currentTier = 1;
  let currentGroup = 0; 

  if (statusSnap.exists()) {
    const data = statusSnap.data();
    if (data.status === 'completed') return { success: true, isComplete: true };
    currentTier = data.lastTier || 1;
    currentGroup = data.lastGroup || 0; 
  }

  let groupsCreatedInThisCall = 0;
  let scanCount = 0;
  let tier = currentTier;
  let group = currentGroup;

  console.log(`[WORLD BUILDER] Scanning from V${tier} G${group}...`);

  while (groupsCreatedInThisCall < GROUPS_TO_CREATE_PER_CALL && scanCount < MAX_SCAN_PER_CALL && tier <= 9) {
    scanCount++;
    
    // 1. КООРДИНАТЫ СЛЕДУЮЩЕЙ ГРУППЫ
    group++;
    const maxInCurrentTier = Math.pow(2, tier - 1);
    if (group > maxInCurrentTier) {
      tier++;
      group = 1;
    }

    if (tier > 9) {
      await setDoc(statusRef, { 
        status: 'completed', 
        lastTier: 9, 
        lastGroup: 256, 
        finishedAt: serverTimestamp() 
      }, { merge: true });
      return { success: true, isComplete: true };
    }

    // 2. ПРОВЕРКА СУЩЕСТВОВАНИЯ (Защита данных игроков)
    const tableId = `table_S${seasonNum}_L${leagueId}_V${tier}_G${group}`;
    const tableRef = doc(db, 'league_tables_v1', tableId);
    const checkSnap = await getDoc(tableRef);
    
    // Группа считается живой, если документ есть и в нем есть статистика
    const hasData = checkSnap.exists() && Object.keys(checkSnap.data()?.stats || {}).length > 0;
    
    if (!hasData) {
      const batch = writeBatch(db);
      console.log(`[WORLD BUILDER] Initializing bot-group: V${tier} G${group}`);
      
      prepareGroupData(batch, db, leagueId, tier, group, seasonNum);
      
      // АТОМАРНЫЙ ЧЕКПОЙНТ ПРОГРЕССА
      batch.set(statusRef, { 
        lastTier: tier,
        lastGroup: group,
        status: 'processing',
        updatedAt: serverTimestamp()
      }, { merge: true });

      await batch.commit();
      groupsCreatedInThisCall++;
    } else {
      // ГРУППА УЖЕ ЕСТЬ - просто обновляем статусную отметку (без батча)
      await setDoc(statusRef, { 
        lastTier: tier,
        lastGroup: group,
        updatedAt: serverTimestamp()
      }, { merge: true });
    }
  }
  
  return { 
    success: true, 
    created: groupsCreatedInThisCall, 
    scanned: scanCount,
    lastTier: tier, 
    lastGroup: group,
    isComplete: tier > 9
  };
}
