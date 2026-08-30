
'use server';

/**
 * @fileOverview Серверный модуль инициализации v140 (Absolute Isolation).
 * Ищет свободное место в уже созданной 511-групповой пирамиде.
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
 * Находит свободное место в текущем сезоне v14.
 * Приоритет: 1 Дивизион (Элита).
 */
export async function findStrategicPlacement(leagueId: string) {
  const { firestore: db } = initializeFirebase();

  try {
    const q = query(
      collection(db, 'players_v14'), 
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

    // Поиск свободного места сверху вниз (от Элиты к низу)
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
    return { tier: 1, group: 1, rank: 1 };
  } catch (error) {
    console.error("[PLACEMENT ERROR]", error);
    return { tier: 1, group: 1, rank: 1 };
  }
}

/**
 * Атомарная инициализация клуба v140.
 * Заменяет бота в существующей таблице на реального игрока.
 */
export async function initializeClubV13(userId: string, data: any) {
  const { firestore: db } = initializeFirebase();
  const seasonInfo = getGlobalSeasonInfo();
  const seasonNum = seasonInfo.activeSeasonNumber;

  const { tier, group, rank, clubName, clubLogo } = data;
  const leagueId = data.selectedLeagueId || "ALPHA";
  
  const tableId = `table_v140_S${seasonNum}_L${leagueId}_V${tier}_G${group}`;
  const tableRef = doc(db, 'league_tables_v2', tableId);
  
  let tableSnap = await getDoc(tableRef);

  // Если админ еще не создал мир, создаем группу JIT (для безопасности)
  if (!tableSnap.exists()) {
    console.warn(`[JIT v140] Table ${tableId} missing. Creating...`);
    await createGroupStructure(db, leagueId, tier, group, seasonNum);
    tableSnap = await getDoc(tableRef);
  } 

  const tableData = tableSnap.data();
  const stats = { ...tableData!.stats };

  // ГАРАНТИЯ 8/8: Заменяем бота по рангу или любого свободного бота
  const targetBotId = getBotId(leagueId, tier, group, rank);
  let botToReplaceId = (stats[targetBotId]?.isBot === true) 
    ? targetBotId 
    : Object.keys(stats).find(id => stats[id].isBot === true) || null;

  if (!botToReplaceId && !stats[userId]) {
    console.error(`[OVERFLOW v140] Group ${tier}.${group} is full!`);
    return { success: false, error: "GROUP_FULL" };
  }

  const batch = writeBatch(db);

  if (botToReplaceId) {
    const baseStats = stats[botToReplaceId];
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

    // Обновляем календарь (заменяем ID бота на ID игрока)
    const matchesQ = query(collection(db, 'matches_v2'), 
      where('leagueId', '==', leagueId),
      where('level', '==', tier),
      where('groupId', '==', group),
      where('season', '==', seasonNum),
      where('version', '==', 140)
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

  const playerRef = doc(db, 'players_v14', userId);
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
    version: 140
  }, { merge: true });

  await batch.commit();
  return { success: true, tier, group, rank };
}
