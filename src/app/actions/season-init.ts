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
 * Атомарная инициализация клуба v131 в коллекциях v2.
 */
export async function initializeClubV13(userId: string, data: any) {
  const { firestore: db } = initializeFirebase();
  const seasonInfo = getGlobalSeasonInfo();
  const seasonNum = seasonInfo.activeSeasonNumber;

  const { tier, group, rank, clubName, clubLogo } = data;
  const leagueId = data.selectedLeagueId || "ALPHA";
  
  // КЛЮЧЕВОЕ ИЗМЕНЕНИЕ v131: префикс в ID таблицы
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

  // Логика захвата слота: ищем конкретного бота
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

  if (botToReplaceId || !stats[userId]) {
    const baseStats = botToReplaceId ? stats[botToReplaceId] : { matchesPlayed: 0, wins: 0, draws: 0, losses: 0, points: 0, diff: 0 };
    
    stats[userId] = {
      ...baseStats,
      id: userId,
      name: clubName || data.displayName || "Manager",
      clubLogo: clubLogo || data.clubLogo || null,
      rank: rank,
      isBot: false
    };

    if (botToReplaceId && botToReplaceId !== userId) {
      delete stats[botToReplaceId];
    }
    
    batch.update(tableRef, { stats, updatedAt: serverTimestamp() });
  }

  // Обновляем календарь (matches_v2 с префиксом v131)
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
    if (mData.homeId === botToReplaceId) { updates.homeId = userId; updates.homeName = clubName; updates.homeLogo = clubLogo; }
    if (mData.awayId === botToReplaceId) { updates.awayId = userId; updates.awayName = clubName; updates.awayLogo = clubLogo; }
    if (Object.keys(updates).length > 0) batch.update(mDoc.ref, updates);
  });

  // Создаем профиль в v13
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
