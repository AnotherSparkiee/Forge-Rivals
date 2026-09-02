'use server';

/**
 * @fileOverview Серверный модуль инициализации v149 (AUTO-SECTOR PROVISIONING).
 */

import { 
  collection, getDocs, query, where, doc, getDoc, 
  serverTimestamp, runTransaction, increment,
  Timestamp, limit
} from 'firebase/firestore';
import { authenticateAsSystem } from '@/firebase/system-auth';
import { initializeFirebase } from '@/firebase';
import { 
  getGroupsCountInLevel, 
  getBotId, 
  getBotName,
  TEAMS_PER_GROUP,
  generateSeasonCalendar
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

/**
 * Инициализирует структуру группы прямо внутри транзакции.
 */
async function provisionGroupInTransaction(
  transaction: any, 
  db: any, 
  leagueId: string, 
  tier: number, 
  group: number, 
  seasonNum: number,
  tableRef: any
) {
  const initialStats: any = {};
  const teamsForCalendar = [];

  for (let r = 1; r <= TEAMS_PER_GROUP; r++) {
    const bId = getBotId(leagueId, tier, group, r);
    const bName = getBotName(tier, group, r);
    initialStats[bId] = {
      id: bId, name: bName, rank: r,
      matchesPlayed: 0, wins: 0, draws: 0, losses: 0, points: 0, diff: 0,
      isBot: true, clubLogo: null
    };
    teamsForCalendar.push({ id: bId, name: bName, rank: r });
  }

  transaction.set(tableRef, {
    id: tableRef.id, leagueId, level: tier, group, season: seasonNum,
    stats: initialStats,
    createdAt: serverTimestamp(),
    version: 140
  });

  const calendar = generateSeasonCalendar(teamsForCalendar, seasonNum, leagueId);
  for (const m of calendar) {
    const mId = `match_v140_S${seasonNum}_L${leagueId}_V${tier}_G${group}_T${m.tour}_R${m.homeRank}_vs_R${m.awayRank}`;
    transaction.set(doc(db, 'matches_v2', mId), {
      ...m,
      id: mId,
      leagueId, level: tier, groupId: group, season: seasonNum,
      isFinished: false, scoreA: 0, scoreB: 0,
      version: 140
    });
  }

  return initialStats;
}

export async function findStrategicPlacement(leagueId: string) {
  await authenticateAsSystem();
  const { firestore: db } = initializeFirebase();

  try {
    const q = query(
      collection(db, 'players_v14'), 
      where('selectedLeagueId', '==', leagueId),
      limit(1000) // Добавлен лимит для безопасности
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

    for (let tier = 9; tier >= 1; tier--) {
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
    return { tier: 9, group: 1, rank: 1 };
  } catch (error) {
    return { tier: 9, group: 1, rank: 1 };
  }
}

export async function initializeClubV13(userId: string, data: any) {
  if (!userId) return { success: false, error: "AUTH_REQUIRED" };
  const { clubName, tier: validatedTier } = validateProfileData(data);
  
  const authRes = await authenticateAsSystem();
  if (!authRes.success) {
    return { success: false, error: `SYSTEM_AUTH_FAILED_${authRes.error}` };
  }

  await new Promise(resolve => setTimeout(resolve, 500));

  const { firestore: db } = initializeFirebase();

  const playerRef = doc(db, 'players_v14', userId);
  const leagueId = String(data.selectedLeagueId || "ALPHA");
  const tier = validatedTier;
  const group = Number(data.group || 1);
  const rank = Number(data.rank || 1);
  const seasonNum = getGlobalSeasonInfo().activeSeasonNumber;
  
  const tableId = `table_v140_S${seasonNum}_L${leagueId}_V${tier}_G${group}`;
  const tableRef = doc(db, 'league_tables_v2', tableId);
  const counterRef = doc(db, 'system_v1', 'global_stats');

  try {
    const result = await runTransaction(db, async (transaction) => {
      const playerSnap = await transaction.get(playerRef);
      const tableSnap = await transaction.get(tableRef);
      const counterSnap = await transaction.get(counterRef);

      if (playerSnap.exists()) {
        const p = playerSnap.data();
        return { success: true, tier: p.leagueLevel, group: p.groupId, rank: p.rank };
      }

      let stats;
      if (!tableSnap.exists()) {
        stats = await provisionGroupInTransaction(transaction, db, leagueId, tier, group, seasonNum, tableRef);
      } else {
        stats = tableSnap.data().stats;
      }

      const currentStats = { ...stats };
      let botToReplaceId = Object.keys(currentStats).find(id => Number(currentStats[id].rank) === rank && currentStats[id].isBot === true) || null;
      if (!botToReplaceId) {
        botToReplaceId = Object.keys(currentStats).find(id => currentStats[id].isBot === true) || null;
      }

      if (!botToReplaceId) throw new Error("GROUP_FULL");

      const baseStats = currentStats[botToReplaceId];
      const actualRank = Number(baseStats.rank);
      
      delete currentStats[botToReplaceId];
      currentStats[userId] = {
        ...baseStats,
        id: userId,
        name: clubName,
        clubLogo: data.clubLogo || null,
        rank: actualRank,
        isBot: false
      };

      transaction.update(tableRef, { stats: currentStats, updatedAt: serverTimestamp() });
      
      let nextNumericId = 1001;
      if (counterSnap.exists()) {
        nextNumericId = (counterSnap.data().totalPlayers || 1000) + 1;
      }
      transaction.set(counterRef, { totalPlayers: nextNumericId, updatedAt: serverTimestamp() }, { merge: true });

      const finalPlayerData = {
        id: userId, email: data.email || null, numericId: nextNumericId,
        displayName: clubName, clubName: clubName, country: data.country || 'International',
        selectedLeagueId: leagueId, leagueLevel: tier, groupId: group, rank: actualRank,
        credits: 1000000, crystals: 50, experiencePoints: 0, managerLevel: 1,
        lastProcessedSeason: seasonNum, lastLoginDate: new Date().toISOString(),
        createdAt: serverTimestamp(), version: 140
      };

      transaction.set(playerRef, finalPlayerData);
      return { success: true, tier, group, rank: actualRank, botToReplaceId };
    });

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
          updates.homeId = userId; updates.homeName = clubName; 
        }
        if (mData.awayId === result.botToReplaceId) { 
          updates.awayId = userId; updates.awayName = clubName; 
        }
        if (Object.keys(updates).length > 0) batch.update(mDoc.ref, updates);
      });
      await batch.commit();
    }

    return result;
  } catch (error: any) {
    console.error("[INITIALIZE CLUB ERROR]:", error.message);
    return { success: false, error: error.message };
  }
}

export async function releasePlayerSlot(userId: string) {
  if (!userId) return { success: false };
  await authenticateAsSystem();
  const { firestore: db } = initializeFirebase();
  const playerRef = doc(db, 'players_v14', userId);
  
  try {
    await runTransaction(db, async (transaction) => {
      const playerSnap = await transaction.get(playerRef);
      if (!playerSnap.exists()) return;
      const pData = playerSnap.data();
      const { leagueLevel: tier, groupId: group, rank, selectedLeagueId: leagueId, lastProcessedSeason: seasonNum } = pData;

      if (tier && group && rank && leagueId) {
        const tableId = `table_v140_S${seasonNum || 1}_L${leagueId}_V${tier}_G${group}`;
        const tableRef = doc(db, 'league_tables_v2', tableId);
        const tableSnap = await transaction.get(tableRef);

        if (tableSnap.exists()) {
          const stats = { ...tableSnap.data().stats };
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
    return { success: false, error: e.message };
  }
}
