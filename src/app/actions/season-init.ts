'use server';

/**
 * @fileOverview Серверный модуль инициализации v140.
 * Реализует атомную подмену бота игроком для сохранения 8/8.
 */

import { 
  collection, getDocs, query, where, doc, getDoc, 
  writeBatch, serverTimestamp, deleteDoc 
} from 'firebase/firestore';
import { initializeFirebase } from '@/firebase';
import { 
  getGroupsCountInLevel, 
  getBotId, 
  getBotName,
  TEAMS_PER_GROUP 
} from '@/app/lib/leagues-data';
import { getGlobalSeasonInfo } from '@/app/lib/time-utils';
import { createGroupStructure } from './world-engine';

/**
 * Находит свободное место в текущем сезоне v14.
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

    for (let tier = 1; tier <= 9; tier++) {
      const groupsInTier = getGroupsCountInLevel(tier);
      for (let group = 1; group <= groupsInTier; group++) {
        for (let rank = 1; rank <= 8; rank++) {
          const key = `${tier}_${group}_${rank}`;
          if (!occupiedSlots.has(key)) {
            return { tier: Number(tier), group: Number(group), rank: Number(rank) };
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
 * ВАЖНО: Только подмена бота, без удаления слотов.
 */
export async function initializeClubV13(userId: string, data: any) {
  const { firestore: db } = initializeFirebase();
  const seasonInfo = getGlobalSeasonInfo();
  const seasonNum = seasonInfo.activeSeasonNumber;

  const allPlayersSnap = await getDocs(collection(db, 'players_v14'));
  const numericId = allPlayersSnap.size + 1;

  // Принудительное приведение к числам
  const tier = Number(data.tier || 1);
  const group = Number(data.group || 1);
  const rank = Number(data.rank || 1);
  const clubName = String(data.clubName || "Manager");
  const leagueId = String(data.selectedLeagueId || "ALPHA");
  
  const tableId = `table_v140_S${seasonNum}_L${leagueId}_V${tier}_G${group}`;
  const tableRef = doc(db, 'league_tables_v2', tableId);
  
  let tableSnap = await getDoc(tableRef);

  if (!tableSnap.exists()) {
    await createGroupStructure(db, leagueId, tier, group, seasonNum);
    tableSnap = await getDoc(tableRef);
  } 

  const tableData = tableSnap.data();
  if (!tableData) return { success: false, error: "DATA_NOT_FOUND" };

  const stats = { ...tableData.stats };

  // Если игрок уже есть в этой таблице (например, повторный вызов)
  if (stats[userId]) {
    return { 
      success: true, 
      tier, 
      group, 
      rank: Number(stats[userId].rank), 
      numericId: tableData.numericId || numericId 
    };
  }

  // СТРОГАЯ ПОДМЕНА: Ищем бота, которого нужно заменить
  const targetBotId = getBotId(leagueId, tier, group, rank);
  let botToReplaceId = null;

  if (stats[targetBotId] && stats[targetBotId].isBot) {
    botToReplaceId = targetBotId;
  } else {
    // Если по каким-то причинам слот ранга занят не-ботом, берем любого бота в этой группе
    botToReplaceId = Object.keys(stats).find(id => stats[id].isBot === true) || null;
  }

  if (!botToReplaceId) {
    console.error(`[OVERFLOW v140] Group ${tier}.${group} has no bots left!`);
    return { success: false, error: "GROUP_FULL" };
  }

  const batch = writeBatch(db);

  // Сохраняем базовые данные бота (ранг)
  const baseStats = stats[botToReplaceId];
  const actualRank = Number(baseStats.rank);
  
  delete stats[botToReplaceId]; // Убираем бота из объекта
  
  stats[userId] = {
    ...baseStats,
    id: userId,
    name: clubName,
    clubLogo: data.clubLogo || null,
    rank: actualRank,
    isBot: false
  };

  // ПРОВЕРКА ФИНАЛЬНОГО СЧЕТА ПЕРЕД ЗАПИСЬЮ (8/8)
  if (Object.keys(stats).length !== 8) {
    console.error("[CRITICAL] Registration integrity failure. Found:", Object.keys(stats).length);
    return { success: false, error: "INTEGRITY_FAIL" };
  }

  batch.update(tableRef, { stats, updatedAt: serverTimestamp() });

  // Обновляем календарь v140: заменяем ID бота на ID игрока
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
      updates.homeLogo = data.clubLogo || null; 
    }
    if (mData.awayId === botToReplaceId) { 
      updates.awayId = userId; 
      updates.awayName = clubName; 
      updates.awayLogo = data.clubLogo || null; 
    }
    if (Object.keys(updates).length > 0) batch.update(mDoc.ref, updates);
  });

  const playerRef = doc(db, 'players_v14', userId);
  const finalPlayerData = {
    ...data,
    id: userId,
    numericId,
    displayName: clubName,
    clubName: clubName,
    country: data.country || 'International',
    selectedLeagueId: leagueId,
    leagueLevel: tier,
    groupId: group,
    rank: actualRank,
    lastProcessedSeason: seasonNum,
    lastLoginDate: new Date().toISOString(),
    createdAt: serverTimestamp(),
    version: 140
  };

  batch.set(playerRef, finalPlayerData, { merge: true });

  await batch.commit();
  return { 
    success: true, 
    tier, 
    group, 
    rank: actualRank, 
    numericId 
  };
}

/**
 * Возвращает слот лиги боту при удалении или сбросе игрока.
 * Гарантирует сохранение структуры 8/8.
 */
export async function releasePlayerSlot(userId: string) {
  const { firestore: db } = initializeFirebase();
  const playerRef = doc(db, 'players_v14', userId);
  const playerSnap = await getDoc(playerRef);

  if (!playerSnap.exists()) return { success: true };

  const pData = playerSnap.data();
  const { 
    leagueLevel: tier, 
    groupId: group, 
    rank, 
    selectedLeagueId: leagueId, 
    lastProcessedSeason: seasonNum 
  } = pData;

  if (tier && group && rank && leagueId) {
    const currentSeason = seasonNum || 1;
    const tableId = `table_v140_S${currentSeason}_L${leagueId}_V${tier}_G${group}`;
    const tableRef = doc(db, 'league_tables_v2', tableId);
    const tableSnap = await getDoc(tableRef);

    if (tableSnap.exists()) {
      const tableData = tableSnap.data();
      const stats = { ...tableData.stats };
      const botId = getBotId(leagueId, tier, group, rank);
      const botName = getBotName(tier, group, rank);

      if (stats[userId]) {
        const currentStats = stats[userId];
        delete stats[userId];
        
        stats[botId] = {
          ...currentStats,
          id: botId,
          name: botName,
          isBot: true,
          clubLogo: null,
          rank: Number(rank)
        };

        const batch = writeBatch(db);
        batch.update(tableRef, { stats, updatedAt: serverTimestamp() });

        const matchesQ = query(collection(db, 'matches_v2'), 
          where('leagueId', '==', leagueId),
          where('level', '==', tier),
          where('groupId', '==', group),
          where('season', '==', currentSeason),
          where('version', '==', 140)
        );
        const matchesSnap = await getDocs(matchesQ);

        matchesSnap.forEach(mDoc => {
          const mData = mDoc.data();
          const updates: any = {};
          if (mData.homeId === userId) { 
            updates.homeId = botId; 
            updates.homeName = botName; 
            updates.homeLogo = null; 
          }
          if (mData.awayId === userId) { 
            updates.awayId = botId; 
            updates.awayName = botName; 
            updates.awayLogo = null; 
          }
          if (Object.keys(updates).length > 0) batch.update(mDoc.ref, updates);
        });

        await batch.commit();
      }
    }
  }

  await deleteDoc(playerRef);
  return { success: true };
}
