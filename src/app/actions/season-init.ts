'use server';

/**
 * @fileOverview Серверный модуль инициализации v63 (Global Sync Support).
 * Убрано создание одиночных аварийных групп, чтобы игроки всегда попадали в общий мир.
 */

import { collection, getDocs, query, where, doc, getDoc, writeBatch, serverTimestamp } from 'firebase/firestore';
import { initializeFirebase } from '@/firebase';
import { 
  getGroupsCountInLevel, 
  getBotId, 
  TEAMS_PER_GROUP 
} from '@/app/lib/leagues-data';
import { getGlobalSeasonInfo } from '@/app/lib/time-utils';

/**
 * Находит свободное место, ПРИОРИТЕТНО в верхних дивизионах (Tier 1 -> Tier 9).
 */
export async function findStrategicPlacement(leagueId: string) {
  try {
    const { firestore: db } = initializeFirebase();
    const q = query(collection(db, 'players_v11'), where('selectedLeagueId', '==', leagueId));
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
            console.log(`[PLACEMENT] Found empty slot at Tier ${tier}, Group ${group}, Rank ${rank}`);
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
 */
export async function initializeClubV11(userId: string, data: any) {
  const { firestore: db } = initializeFirebase();
  const batch = writeBatch(db);
  const seasonInfo = getGlobalSeasonInfo();
  const seasonNum = seasonInfo.activeSeasonNumber;

  const { tier, group, rank, clubName, clubLogo, country } = data;
  const leagueId = data.selectedLeagueId || "ALPHA";
  
  const botId = getBotId(leagueId, tier, group, rank);
  const tableId = `table_S${seasonNum}_L${leagueId}_V${tier}_G${group}`;
  const tableRef = doc(db, 'league_tables_v1', tableId);
  const tableSnap = await getDoc(tableRef);

  if (!tableSnap.exists()) {
    // Если пирамида еще не достроилась до этой группы, мы НЕ создаем одиночную группу.
    // Вместо этого мы бросаем ошибку, чтобы клиент повторил попытку позже, 
    // когда автономный скрипт достроит мир.
    throw new Error(`LEAGUE_SECTOR_NOT_READY: Table ${tableId} is being prepared by the Architect.`);
  } 
  else {
    // ЗАХВАТ СЛОТА
    const tableData = tableSnap.data();
    const stats = { ...tableData.stats };

    if (stats[botId]) {
      const botStats = stats[botId];
      stats[userId] = {
        ...botStats,
        id: userId,
        name: clubName,
        clubLogo: clubLogo || null,
        isBot: false
      };
      delete stats[botId];
      batch.update(tableRef, { stats, updatedAt: serverTimestamp() });
    }

    // Обновляем календарь
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
  }

  // СОЗДАНИЕ ПРОФИЛЯ
  const playerRef = doc(db, 'players_v11', userId);
  batch.set(playerRef, {
    id: userId, displayName: clubName, clubName, clubLogo: clubLogo || null,
    selectedLeagueId: leagueId, leagueLevel: tier, groupId: group, rank,
    country: country || 'International', createdAt: serverTimestamp(),
    lastLoginDate: new Date().toISOString(), lastProcessedSeason: seasonNum, version: 11
  });

  await batch.commit();
  return { success: true, tier, group, rank };
}
