
'use server';

/**
 * @fileOverview Глобальный двигатель инициализации мира v1.8 (Fixed Multi-Group Logic).
 * Исправлена ошибка, из-за которой создавалась только одна группа на дивизион.
 */

import { 
  doc, getDoc, writeBatch, 
  Firestore, serverTimestamp, setDoc, updateDoc 
} from 'firebase/firestore';
import { initializeFirebase } from '@/firebase';
import { 
  getGroupsCountInLevel, 
  getBotId, 
  TEAMS_PER_GROUP, 
  generateSeasonCalendar 
} from '@/app/lib/leagues-data';
import { getGlobalSeasonInfo } from '@/app/lib/time-utils';

const GROUPS_PER_CHUNK = 40; 

/**
 * Создает структуру конкретной группы (таблица + календарь).
 */
export async function createGroupStructure(db: Firestore, leagueId: string, tier: number, group: number, seasonNum: number) {
  const batch = writeBatch(db);
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

  batch.set(tableRef, {
    id: tableId, leagueId, level: tier, group, season: seasonNum,
    stats: initialStats,
    createdAt: serverTimestamp(),
    version: 11
  });

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

  await batch.commit();
  return { tableId };
}

/**
 * Инициализирует мир лиги порциями. 
 * Генерирует пирамиду из 511 групп.
 */
export async function initializeLeagueWorld(leagueId: string, targetSeason?: number) {
  const { firestore: db } = initializeFirebase();
  const info = getGlobalSeasonInfo();
  const seasonNum = targetSeason || info.activeSeasonNumber;

  const statusRef = doc(db, 'system_v1', `init_S${seasonNum}_L${leagueId}`);
  const statusSnap = await getDoc(statusRef);
  
  let currentTier = 1;
  let currentGroup = 1;
  let status = 'idle';

  if (statusSnap.exists()) {
    const data = statusSnap.data();
    if (data.status === 'completed') return { success: true, isComplete: true };
    
    status = data.status;
    currentTier = data.lastTier || 1;
    currentGroup = (data.lastGroup || 0) + 1; // Начинаем со следующей после сохраненной
    
    if (currentGroup > getGroupsCountInLevel(currentTier)) {
      currentGroup = 1;
      currentTier++;
    }
  }

  if (currentTier > 9) {
    await updateDoc(statusRef, { status: 'completed', finishedAt: serverTimestamp() });
    return { success: true, isComplete: true };
  }

  if (status === 'idle') {
    await setDoc(statusRef, { 
      status: 'processing', 
      startedAt: serverTimestamp(),
      lastTier: 1,
      lastGroup: 0
    });
  }

  let groupsProcessed = 0;
  let tier = currentTier;
  let group = currentGroup;

  while (groupsProcessed < GROUPS_PER_CHUNK && tier <= 9) {
    const maxGroupsInTier = getGroupsCountInLevel(tier);
    
    while (group <= maxGroupsInTier && groupsProcessed < GROUPS_PER_CHUNK) {
      await createGroupStructure(db, leagueId, tier, group, seasonNum);
      groupsProcessed++;
      
      if (groupsProcessed >= GROUPS_PER_CHUNK) {
        // Мы достигли лимита чанка. Сохраняем текущие координаты.
        await updateDoc(statusRef, { 
          lastTier: tier,
          lastGroup: group,
          status: 'processing'
        });
        return { success: true, processed: groupsProcessed, lastTier: tier, lastGroup: group, isComplete: false };
      }

      group++;
    }
    
    // Если внутренний цикл закончился (прошли все группы в тире)
    tier++;
    group = 1;
  }
  
  const isFullyComplete = tier > 9;
  
  await updateDoc(statusRef, { 
    lastTier: isFullyComplete ? 9 : (tier - 1),
    lastGroup: isFullyComplete ? getGroupsCountInLevel(9) : group,
    status: isFullyComplete ? 'completed' : 'processing',
    finishedAt: isFullyComplete ? serverTimestamp() : null
  });

  return { 
    success: true, 
    processed: groupsProcessed, 
    lastTier: tier > 9 ? 9 : tier, 
    lastGroup: group,
    isComplete: isFullyComplete 
  };
}
