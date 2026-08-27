'use server';

/**
 * Глобальный двигатель перезагрузки мира v16 (High-Speed Multi-Batch Builder).
 * Особенности:
 * 1. Скорость: Обрабатывает до 25 групп за один вызов, используя индивидуальные батчи.
 * 2. Надежность: Атомарное сохранение прогресса после каждой группы.
 * 3. Игнорирование пустоты: Заполняет все 511 групп ботами самостоятельно.
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
const GROUPS_PER_CALL = 25; // Обрабатываем 25 групп за один серверный вызов (25 батчей)
const MAX_SCAN_LIMIT = 150; // Пролетаем до 150 секторов в поиске пустот

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
  return { tier: 1, group: 1 };
}

/**
 * Ядро подготовки данных группы (Таблица + Календарь).
 */
function injectGroupToBatch(
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
    version: 16
  });

  const calendar = generateSeasonCalendar(teamsForCalendar, seasonNum, leagueId);
  for (const m of calendar) {
    const mId = `match_S${seasonNum}_L${leagueId}_V${tier}_G${group}_T${m.tour}_R${m.homeRank}_vs_R${m.awayRank}`;
    batch.set(doc(db, 'matches_v1', mId), {
      ...m,
      id: mId,
      leagueId, level: tier, groupId: group, season: seasonNum,
      isFinished: false, scoreA: 0, scoreB: 0,
      version: 16
    });
  }
}

/**
 * Очистка данных группы.
 */
function wipeGroupInBatch(
  batch: any, 
  db: Firestore, 
  leagueId: string, 
  tier: number, 
  group: number, 
  seasonNum: number
) {
  const tableId = `table_S${seasonNum}_L${leagueId}_V${tier}_G${group}`;
  batch.delete(doc(db, 'league_tables_v1', tableId));

  // Очистка матчей (на основе шаблона)
  const teams = Array.from({ length: 8 }, (_, i) => ({ rank: i + 1 }));
  const calendar = generateSeasonCalendar(teams, seasonNum, leagueId);
  for (const m of calendar) {
    const mId = `match_S${seasonNum}_L${leagueId}_V${tier}_G${group}_T${m.tour}_R${m.homeRank}_vs_R${m.awayRank}`;
    batch.delete(doc(db, 'matches_v1', mId));
  }
}

/**
 * Главный цикл инициализации мира. 
 */
export async function initializeLeagueWorld(leagueId: string, targetSeason?: number) {
  const { firestore: db } = initializeFirebase();
  const info = getGlobalSeasonInfo();
  const seasonNum = targetSeason || info.activeSeasonNumber;

  const statusRef = doc(db, 'system_v1', `init_S${seasonNum}_L${leagueId}`);
  const statusSnap = await getDoc(statusRef);
  
  let phase = 'WIPING'; 
  let currentIndex = 0;

  if (statusSnap.exists()) {
    const data = statusSnap.data();
    if (data.status === 'completed') return { success: true, isComplete: true };
    phase = data.phase || 'WIPING';
    currentIndex = data.currentIndex || 0;
  }

  let createdInThisCall = 0;
  let scannedInThisCall = 0;
  let lastTier = 1;
  let lastGroup = 1;

  console.log(`[WORLD v16] Starting ${phase} from index ${currentIndex}`);

  while (createdInThisCall < GROUPS_PER_CALL && scannedInThisCall < MAX_SCAN_LIMIT && currentIndex < TOTAL_GROUPS) {
    currentIndex++;
    scannedInThisCall++;
    const coords = getGroupCoordinates(currentIndex);
    lastTier = coords.tier;
    lastGroup = coords.group;

    const tableId = `table_S${seasonNum}_L${leagueId}_V${coords.tier}_G${coords.group}`;
    const tableRef = doc(db, 'league_tables_v1', tableId);
    
    // Проверка существования (только в фазе постройки)
    if (phase === 'INIT_WORLD') {
      const checkSnap = await getDoc(tableRef);
      if (checkSnap.exists() && checkSnap.data().stats) {
        continue; // Группа уже есть, летим дальше
      }
    }

    // Создаем батч для ОДНОЙ группы (57-58 операций)
    const batch = writeBatch(db);
    
    if (phase === 'WIPING') {
      wipeGroupInBatch(batch, db, leagueId, coords.tier, coords.group, seasonNum);
    } else {
      injectGroupToBatch(batch, db, leagueId, coords.tier, coords.group, seasonNum);
    }

    // Сохраняем прогресс в ТОМ ЖЕ батче
    batch.set(statusRef, {
      phase,
      currentIndex,
      lastTier,
      lastGroup,
      updatedAt: serverTimestamp(),
      status: 'processing'
    }, { merge: true });

    await batch.commit();
    createdInThisCall++;
  }

  // Проверка завершения фазы
  if (currentIndex >= TOTAL_GROUPS) {
    if (phase === 'WIPING') {
      await setDoc(statusRef, { 
        phase: 'INIT_WORLD', 
        currentIndex: 0, 
        updatedAt: serverTimestamp() 
      }, { merge: true });
      return { success: true, phase: 'PHASE_CHANGED', next: 'INIT_WORLD' };
    } else {
      await setDoc(statusRef, { 
        status: 'completed', 
        updatedAt: serverTimestamp() 
      }, { merge: true });
      return { success: true, isComplete: true };
    }
  }

  return { 
    success: true, 
    phase, 
    currentIndex, 
    processed: createdInThisCall,
    scanned: scannedInThisCall
  };
}

/**
 * JIT-создание структуры группы (безопасное).
 */
export async function createGroupStructure(
  db: any, 
  leagueId: string, 
  tier: number, 
  group: number, 
  seasonNum: number
) {
  const batch = writeBatch(db);
  injectGroupToBatch(batch, db, leagueId, tier, group, seasonNum);
  await batch.commit();
}
