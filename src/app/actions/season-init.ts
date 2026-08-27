
'use server';

/**
 * @fileOverview Серверный модуль инициализации v65 (Resilient Initialization).
 * Добавлена JIT-инициализация групп, если они отсутствуют в базе.
 */

import { collection, getDocs, query, where, doc, getDoc, writeBatch, serverTimestamp } from 'firebase/firestore';
import { initializeFirebase } from '@/firebase';
import { 
  getGroupsCountInLevel, 
  getBotId, 
  TEAMS_PER_GROUP 
} from '@/app/lib/leagues-data';
import { getGlobalSeasonInfo } from '@/app/lib/time-utils';
import { createGroupStructure } from './world-engine';

/**
 * Находит свободное место в текущем сезоне.
 * Приоритет: Дивизион 1 -> 9, Группа 1 -> N.
 */
export async function findStrategicPlacement(leagueId: string) {
  const { firestore: db } = initializeFirebase();
  const seasonInfo = getGlobalSeasonInfo();
  const seasonNum = seasonInfo.activeSeasonNumber;

  try {
    const q = query(
      collection(db, 'players_v11'), 
      where('selectedLeagueId', '==', leagueId),
      where('lastProcessedSeason', '==', seasonNum)
    );
    const snap = await getDocs(q);
    
    const occupiedSlots = new Set<string>();
    snap.forEach(d => {
      const data = d.data();
      const key = `${data.leagueLevel}_${data.groupId}_${data.rank}`;
      occupiedSlots.add(key);
    });

    for (let tier = 1; tier <= 9; tier++) {
      const groupsInTier = getGroupsCountInLevel(tier);
      for (let group = 1; group <= groupsInTier; group++) {
        for (let rank = 1; rank <= 8; rank++) {
          const key = `${tier}_${group}_${rank}`;
          if (!occupiedSlots.has(key)) {
            return { tier, group, rank };
          }
        }
      }
    }
    return { tier: 9, group: 1, rank: 1 };
  } catch (error) {
    console.error("[PLACEMENT ERROR]", error);
    return { tier: 9, group: 1, rank: 1 };
  }
}

/**
 * Атомарная инициализация клуба с захватом слота бота.
 * Включает самовосстановление группы, если она еще не создана.
 */
export async function initializeClubV11(userId: string, data: any) {
  const { firestore: db } = initializeFirebase();
  const seasonInfo = getGlobalSeasonInfo();
  const seasonNum = seasonInfo.activeSeasonNumber;

  const { tier, group, rank, clubName, clubLogo, country } = data;
  const leagueId = data.selectedLeagueId || "ALPHA";
  
  const botId = getBotId(leagueId, tier, group, rank);
  const tableId = `table_S${seasonNum}_L${leagueId}_V${tier}_G${group}`;
  const tableRef = doc(db, 'league_tables_v1', tableId);
  
  let tableSnap = await getDoc(tableRef);

  // JIT INITIALIZATION: Если сектора нет, создаем его на лету
  if (!tableSnap.exists()) {
    console.warn(`[JIT] Table ${tableId} missing. Creating group structure...`);
    await createGroupStructure(db, leagueId, tier, group, seasonNum);
    tableSnap = await getDoc(tableRef);
    
    if (!tableSnap.exists()) {
      throw new Error(`LEAGUE_SECTOR_FAILED: Failed to initialize table ${tableId}`);
    }
  } 

  const batch = writeBatch(db);
  const tableData = tableSnap.data();
  const stats = { ...tableData!.stats };

  if (stats[botId]) {
    const botStats = stats[botId];
    stats[userId] = {
      ...botStats,
      id: userId,
      name: clubName || data.displayName || "Manager",
      clubLogo: clubLogo || data.clubLogo || null,
      isBot: false
    };
    delete stats[botId];
    batch.update(tableRef, { stats, updatedAt: serverTimestamp() });
  }

  // ОБНОВЛЕНИЕ КАЛЕНДАРЯ
  const matchesQ = query(collection(db, 'matches_v1'), 
    where('leagueId', '==', leagueId),
    where('level', '==', tier),
    where('groupId', '==', group),
    where('season', '==', seasonNum)
  );
  const matchesSnap = await getDocs(matchesQ);

  matchesSnap.forEach(mDoc => {
    const mData = mDoc.data();
    const updates: any = {};
    if (mData.homeId === botId) { updates.homeId = userId; updates.homeName = clubName; updates.homeLogo = clubLogo; }
    if (mData.awayId === botId) { updates.awayId = userId; updates.awayName = clubName; updates.awayLogo = clubLogo; }
    if (Object.keys(updates).length > 0) batch.update(mDoc.ref, updates);
  });

  // СОХРАНЕНИЕ ПРОФИЛЯ
  const playerRef = doc(db, 'players_v11', userId);
  batch.set(playerRef, {
    ...data,
    id: userId,
    displayName: clubName || data.displayName,
    clubName: clubName || data.clubName,
    selectedLeagueId: leagueId,
    leagueLevel: tier,
    groupId: group,
    rank,
    lastProcessedSeason: seasonNum,
    version: 11
  }, { merge: true });

  await batch.commit();
  return { success: true, tier, group, rank };
}
