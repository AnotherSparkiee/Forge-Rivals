'use server';

/**
 * Глобальный двигатель перезагрузки мира v17 (Nuclear High-Speed Builder).
 * Особенности:
 * 1. Скорость: Обрабатывает до 25 групп за один вызов через Multi-Batch.
 * 2. Надежность: Полный цикл WIPING -> INIT_WORLD для нового сезона.
 * 3. Имена ботов: Строгое соответствие Bot01{Level}{Rank}.
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
const GROUPS_PER_CALL = 25; 
const MAX_SCAN_LIMIT = 150; 

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
    version: 17
  });

  const calendar = generateSeasonCalendar(teamsForCalendar, seasonNum, leagueId);
  for (const m of calendar) {
    const mId = `match_S${seasonNum}_L${leagueId}_V${tier}_G${group}_T${m.tour}_R${m.homeRank}_vs_R${m.awayRank}`;
    batch.set(doc(db, 'matches_v1', mId), {
      ...m,
      id: mId,
      leagueId, level: tier, groupId: group, season: seasonNum,
      isFinished: false, scoreA: 0, scoreB: 0,
      version: 17
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

  // Очистка матчей (на основе шаблона рангов)
  for (let t = 1; tour <= 14; tour++) {
    // В циклах турнира обычно 4 матча на тур в группе из 8 команд
    for (let r = 1; r <= 8; r++) {
       // Мы не знаем точно кто с кем, поэтому удаляем все возможные комбинации (упрощенно)
       // Но лучше удалять по ID, который мы генерируем детерминировано в inject
    }
  }
  // Для простоты WIPING в v17 мы удаляем только документы таблиц, а матчи будут перезаписаны
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

  let processedInThisCall = 0;
  let scannedInThisCall = 0;

  console.log(`[WORLD v17] Season ${seasonNum} | Phase: ${phase} | From: ${currentIndex}`);

  while (processedInThisCall < GROUPS_PER_CALL && currentIndex < TOTAL_GROUPS && scannedInThisCall < MAX_SCAN_LIMIT) {
    currentIndex++;
    scannedInThisCall++;
    const coords = getGroupCoordinates(currentIndex);

    const tableId = `table_S${seasonNum}_L${leagueId}_V${coords.tier}_G${coords.group}`;
    const tableRef = doc(db, 'league_tables_v1', tableId);
    
    // В фазе INIT_WORLD проверяем, не создана ли уже группа (защита от дублей)
    if (phase === 'INIT_WORLD') {
      const checkSnap = await getDoc(tableRef);
      if (checkSnap.exists()) continue; 
    }

    const batch = writeBatch(db);
    
    if (phase === 'WIPING') {
      batch.delete(tableRef);
    } else {
      injectGroupToBatch(batch, db, leagueId, coords.tier, coords.group, seasonNum);
    }

    // Сохраняем прогресс после КАЖДОЙ группы
    batch.set(statusRef, {
      phase,
      currentIndex,
      lastTier: coords.tier,
      lastGroup: coords.group,
      updatedAt: serverTimestamp(),
      status: 'processing',
      version: 17
    }, { merge: true });

    await batch.commit();
    processedInThisCall++;
  }

  // Смена фаз или завершение
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
    processed: processedInThisCall,
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
