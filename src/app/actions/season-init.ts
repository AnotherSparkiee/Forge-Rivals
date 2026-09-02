'use server';

/**
 * @fileOverview Серверный модуль инициализации v146 (TRANSACTIONAL & PRIVILEGED).
 * Исправлена проблема PERMISSION_DENIED через принудительную синхронизацию Auth.
 */

import { 
  collection, getDocs, query, where, doc, getDoc, 
  serverTimestamp, runTransaction, increment
} from 'firebase/firestore';
import { authenticateAsSystem } from '@/firebase/system-auth';
import { initializeFirebase } from '@/firebase';
import { 
  getGroupsCountInLevel, 
  getBotId, 
  getBotName,
  TEAMS_PER_GROUP 
} from '@/app/lib/leagues-data';
import { getGlobalSeasonInfo } from '@/app/lib/time-utils';

function validateProfileData(data: any) {
  const clubName = String(data.clubName || "").trim();
  if (clubName.length < 3 || clubName.length > 20) {
    throw new Error("INVALID_CLUB_NAME_LENGTH");
  }
  const tier = Number(data.tier);
  if (isNaN(tier) || tier < 1 || tier > 9) {
    throw new Error("INVALID_LEAGUE_LEVEL");
  }
  return { clubName, tier };
}

export async function findStrategicPlacement(leagueId: string) {
  await authenticateAsSystem();
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
    return { tier: 9, group: 256, rank: 1 };
  }
}

export async function initializeClubV13(userId: string, data: any) {
  if (!userId) return { success: false, error: "AUTH_REQUIRED" };
  const { clubName, tier: validatedTier } = validateProfileData(data);
  
  // 1. ПРИНУДИТЕЛЬНАЯ СИСТЕМНАЯ АВТОРИЗАЦИЯ
  const authRes = await authenticateAsSystem();
  if (!authRes.success) {
    console.error(`[SYSTEM AUTH] Failed for initializeClubV13: ${authRes.error}`);
    return { success: false, error: `SYSTEM_AUTH_FAILED_${authRes.error}` };
  }

  const { firestore: db } = initializeFirebase();

  const playerRef = doc(db, 'players_v14', userId);
  const leagueId = String(data.selectedLeagueId || "ALPHA");
  const tier = validatedTier;
  const group = Number(data.group || 1);
  const rank = Number(data.rank || 1);
  
  const tableId = `table_v140_S${getGlobalSeasonInfo().activeSeasonNumber}_L${leagueId}_V${tier}_G${group}`;
  const tableRef = doc(db, 'league_tables_v2', tableId);
  const counterRef = doc(db, 'system_v1', 'global_stats');

  try {
    const result = await runTransaction(db, async (transaction) => {
      // Проверка существующего профиля
      const playerSnap = await transaction.get(playerRef);
      if (playerSnap.exists()) {
        const p = playerSnap.data();
        return { success: true, tier: p.leagueLevel, group: p.groupId, rank: p.rank, numericId: p.numericId };
      }

      // Проверка доступности таблицы
      let tableSnap = await transaction.get(tableRef);
      if (!tableSnap.exists()) {
        throw new Error("SECTOR_NOT_READY");
      }

      const tableData = tableSnap.data();
      const stats = { ...tableData.stats };

      // Поиск бота для замены
      let botToReplaceId = Object.keys(stats).find(id => Number(stats[id].rank) === rank && stats[id].isBot === true) || null;
      if (!botToReplaceId) {
        botToReplaceId = Object.keys(stats).find(id => stats[id].isBot === true) || null;
      }

      if (!botToReplaceId) {
        throw new Error("GROUP_FULL");
      }

      // Атомарный счетчик
      const counterSnap = await transaction.get(counterRef);
      let numericId = 1000;
      if (counterSnap.exists()) {
        numericId = (counterSnap.data().totalPlayers || 1000) + 1;
      }
      transaction.set(counterRef, { totalPlayers: numericId, updatedAt: serverTimestamp() }, { merge: true });

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

      // ОБНОВЛЕНИЕ ТАБЛИЦЫ
      transaction.update(tableRef, { stats, updatedAt: serverTimestamp() });

      // СОЗДАНИЕ ПРОФИЛЯ
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
        lastProcessedSeason: getGlobalSeasonInfo().activeSeasonNumber,
        lastLoginDate: new Date().toISOString(),
        createdAt: serverTimestamp(),
        version: 140
      };

      transaction.set(playerRef, finalPlayerData);

      return { success: true, tier, group, rank: actualRank, numericId, botToReplaceId };
    });

    // Обновление матчей (вне транзакции)
    if (result.success && result.botToReplaceId) {
      const matchesQ = query(collection(db, 'matches_v2'), 
        where('leagueId', '==', leagueId),
        where('level', '==', tier),
        where('groupId', '==', group),
        where('version', '==', 140)
      );
      const matchesSnap = await getDocs(matchesQ);
      
      const { writeBatch } = await import('firebase/firestore');
      const batch = writeBatch(db);
      
      matchesSnap.forEach(mDoc => {
        const mData = mDoc.data();
        const updates: any = {};
        if (mData.homeId === result.botToReplaceId) { 
          updates.homeId = userId; 
          updates.homeName = clubName; 
          updates.homeLogo = data.clubLogo || null; 
        }
        if (mData.awayId === result.botToReplaceId) { 
          updates.awayId = userId; 
          updates.awayName = clubName; 
          updates.awayLogo = data.clubLogo || null; 
        }
        if (Object.keys(updates).length > 0) batch.update(mDoc.ref, updates);
      });
      await batch.commit();
    }

    return result;
  } catch (error: any) {
    console.error("[INITIALIZE CLUB ERROR]:", error.code, error.message);
    return { success: false, error: error.message };
  }
}

export async function releasePlayerSlot(userId: string) {
  if (!userId) return { success: false };

  const authRes = await authenticateAsSystem();
  if (!authRes.success) {
    return { success: false, error: `SYSTEM_AUTH_FAILED_${authRes.error}` };
  }

  const { firestore: db } = initializeFirebase();
  const playerRef = doc(db, 'players_v14', userId);
  
  try {
    await runTransaction(db, async (transaction) => {
      const playerSnap = await transaction.get(playerRef);
      if (!playerSnap.exists()) return;

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
        const tableSnap = await transaction.get(tableRef);

        if (tableSnap.exists()) {
          const tableData = tableSnap.data();
          const stats = { ...tableData.stats };
          const botId = getBotId(leagueId, tier, group, rank);
          const botName = getBotName(tier, group, rank);

          if (stats[userId]) {
            const currentStats = stats[userId];
            delete stats[userId];
            stats[botId] = { ...currentStats, id: botId, name: botName, isBot: true, clubLogo: null, rank: Number(rank) };
            
            transaction.update(tableRef, { stats, updatedAt: serverTimestamp() });
          }
        }
      }
      transaction.delete(playerRef);
    });
    return { success: true };
  } catch (e: any) {
    console.error("[RELEASE SLOT ERROR]:", e.message);
    return { success: false, error: e.message };
  }
}
