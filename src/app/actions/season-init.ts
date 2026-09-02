
'use server';

/**
 * @fileOverview Серверный модуль инициализации v141.
 * Реализует атомную подмену бота игроком для сохранения 8/8.
 * Внедрена логика проверки авторизации для соответствия Step 0 ТЗ.
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
    return { tier: 9, group: 256, rank: 1 };
  } catch (error) {
    console.error("[PLACEMENT ERROR]", error);
    return { tier: 9, group: 256, rank: 1 };
  }
}

/**
 * Атомарная инициализация клуба v141.
 * Внедрен механизм SELF-REPAIR и проверка безопасности Step 0.
 */
export async function initializeClubV13(userId: string, data: any) {
  if (!userId) return { success: false, error: "AUTH_REQUIRED" };
  
  const { firestore: db } = initializeFirebase();
  const seasonInfo = getGlobalSeasonInfo();
  const seasonNum = seasonInfo.activeSeasonNumber;

  // Безопасность: Проверяем, не занят ли уже этот userId
  const existingPlayerRef = doc(db, 'players_v14', userId);
  const existingSnap = await getDoc(existingPlayerRef);
  if (existingSnap.exists()) {
    const p = existingSnap.data();
    return { 
      success: true, 
      tier: p.leagueLevel, 
      group: p.groupId, 
      rank: p.rank, 
      numericId: p.numericId 
    };
  }

  const allPlayersSnap = await getDocs(collection(db, 'players_v14'));
  const numericId = allPlayersSnap.size + 1;

  const tier = Number(data.tier || 9);
  const group = Number(data.group || 1);
  const rank = Number(data.rank || 1);
  const clubName = String(data.clubName || "Commander");
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

  // SELF-REPAIR: Если в таблице меньше 8 команд, восстанавливаем ботов
  const existingRanks = new Set(Object.values(stats).map((s: any) => Number(s.rank)));
  if (Object.keys(stats).length < 8) {
    for (let r = 1; r <= 8; r++) {
      if (!existingRanks.has(r)) {
        const bId = getBotId(leagueId, tier, group, r);
        const bName = getBotName(tier, group, r);
        stats[bId] = {
          id: bId, name: bName, rank: r,
          matchesPlayed: 0, wins: 0, draws: 0, losses: 0, points: 0, diff: 0,
          isBot: true, clubLogo: null
        };
        existingRanks.add(r);
      }
    }
  }

  // ПОИСК ЖЕРТВЫ (Бота)
  let botToReplaceId = Object.keys(stats).find(id => stats[id].rank === rank && stats[id].isBot === true) || null;
  if (!botToReplaceId) {
    botToReplaceId = Object.keys(stats).find(id => stats[id].isBot === true) || null;
  }

  if (!botToReplaceId) return { success: false, error: "GROUP_FULL" };

  const batch = writeBatch(db);
  const baseStats = stats[botToReplaceId];
  const actualRank = Number(baseStats.rank);
  
  delete stats[botToReplaceId];
  
  stats[userId] = {
    ...baseStats,
    id: userId,
    name: clubName,
    clubLogo: data.clubLogo || null,
    rank: actualRank,
    isBot: false
  };

  if (Object.keys(stats).length !== 8) return { success: false, error: "INTEGRITY_FAIL" };

  batch.update(tableRef, { stats, updatedAt: serverTimestamp() });

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
    credits: 1000000,
    crystals: 50,
    experiencePoints: 0,
    managerLevel: 1,
    lastProcessedSeason: seasonNum,
    lastLoginDate: new Date().toISOString(),
    createdAt: serverTimestamp(),
    version: 140
  };

  batch.set(existingPlayerRef, finalPlayerData);

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
 */
export async function releasePlayerSlot(userId: string) {
  if (!userId) return { success: false };

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
