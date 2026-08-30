'use server';

/**
 * @fileOverview Серверный модуль инициализации v131 (Absolute Isolation).
 * Использует коллекции v2 и профили v13 для исключения конфликтов.
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
 * Находит свободное место в текущем сезоне v13.
 * Начинает поиск с нижнего (9) дивизиона.
 */
export async function findStrategicPlacement(leagueId: string) {
  const { firestore: db } = initializeFirebase();

  try {
    const q = query(
      collection(db, 'players_v13'), 
      where('selectedLeagueId', '==', leagueId)
    );
    const snap = await getDocs(q);
    
    const occupiedSlots = new Set<string>();
    snap.forEach(d => {
      const data = d.data();
      if (data.leagueLevel && data.groupId && data.rank) {
        const key = `${data.leagueLevel}_${data.groupId}_${data.rank}`;
        occupiedSlots.add(key);
      }
    });

    // Начинаем с 9 дивизиона (дно пирамиды) и идем вверх до 1
    for (let tier = 9; tier >= 1; tier--) {
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
 * Атомарная инициализация клуба v131 в коллекциях v2.
 */
export async function initializeClubV13(userId: string, data: any) {
  const { firestore: db } = initializeFirebase();
  const seasonInfo = getGlobalSeasonInfo();
  const seasonNum = seasonInfo.activeSeasonNumber;

  const { tier, group, rank, clubName, clubLogo } = data;
  const leagueId = data.selectedLeagueId || "ALPHA";
  
  const tableId = `table_v131_S${seasonNum}_L${leagueId}_V${tier}_G${group}`;
  const tableRef = doc(db, 'league_tables_v2', tableId);
  
  let tableSnap = await getDoc(tableRef);

  if (!tableSnap.exists()) {
    console.warn(`[JIT v131] Table ${tableId} missing. Creating...`);
    await createGroupStructure(db, leagueId, tier, group, seasonNum);
    tableSnap = await getDoc(tableRef);
  } 

  const tableData = tableSnap.data();
  const stats = { ...tableData!.stats };

  // ГАРАНТИЯ 8/8: Всегда заменяем бота.
  const targetBotId = getBotId(leagueId, tier, group, rank);
  let botToReplaceId = null;

  if (stats[targetBotId] && stats[targetBotId].isBot === true) {
    botToReplaceId = targetBotId;
  } else {
    botToReplaceId = Object.keys(stats).find(id => stats[id].isBot === true) || null;
  }

  if (!botToReplaceId && !stats[userId]) {
    console.error(`[OVERFLOW v131] Group ${tier}.${group} is full!`);
    return { success: false, error: "GROUP_FULL" };
  }

  const batch = writeBatch(db);

  if (botToReplaceId) {
    const baseStats = stats[botToReplaceId];
    
    // Удаляем бота ПЕРЕД добавлением игрока для точности
    delete stats[botToReplaceId];
    
    stats[userId] = {
      ...baseStats,
      id: userId,
      name: clubName || data.displayName || "Manager",
      clubLogo: clubLogo || data.clubLogo || null,
      rank: baseStats.rank, 
      isBot: false
    };

    batch.update(tableRef, { stats, updatedAt: serverTimestamp() });

    // Обновляем календарь v131
    const matchesQ = query(collection(db, 'matches_v2'), 
      where('leagueId', '==', leagueId),
      where('level', '==', tier),
      where('groupId', '==', group),
      where('season', '==', seasonNum),
      where('version', '==', 131)
    );
    const matchesSnap = await getDocs(matchesQ);

    matchesSnap.forEach(mDoc => {
      const mData = mDoc.data();
      const updates: any = {};
      if (mData.homeId === botToReplaceId) { 
        updates.homeId = userId; 
        updates.homeName = clubName; 
        updates.homeLogo = clubLogo || null; 
      }
      if (mData.awayId === botToReplaceId) { 
        updates.awayId = userId; 
        updates.awayName = clubName; 
        updates.awayLogo = clubLogo || null; 
      }
      if (Object.keys(updates).length > 0) batch.update(mDoc.ref, updates);
    });
  }

  const playerRef = doc(db, 'players_v13', userId);
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
    lastLoginDate: new Date().toISOString(),
    version: 131
  }, { merge: true });

  await batch.commit();
  return { success: true, tier, group, rank };
}