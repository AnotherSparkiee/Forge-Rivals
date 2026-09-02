'use server';

/**
 * @fileOverview Модуль инициализации клуба v150 (Zod & Security).
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
import { InitializeClubSchema } from '@/app/lib/validation-schemas';
import { logger } from '@/app/lib/logger';

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
      ...m, id: mId,
      leagueId, level: tier, groupId: group, season: seasonNum,
      isFinished: false, scoreA: 0, scoreB: 0, version: 140
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
      limit(1000)
    );
    const snap = await getDocs(q);
    
    const occupiedSlots = new Set<string>();
    snap.forEach(d => {
      const data = d.data();
      if (data.leagueLevel && data.groupId && data.rank) {
        occupiedSlots.add(`${data.leagueLevel}_${data.groupId}_${data.rank}`);
      }
    });

    for (let tier = 9; tier >= 1; tier--) {
      const groupsInTier = getGroupsCountInLevel(tier);
      for (let group = 1; group <= groupsInTier; group++) {
        for (let rank = 1; rank <= 8; rank++) {
          const key = `${tier}_${group}_${rank}`;
          if (!occupiedSlots.has(key)) return { tier, group, rank };
        }
      }
    }
    return { tier: 9, group: 1, rank: 1 };
  } catch (error) {
    logger.error("Error in findStrategicPlacement", error);
    return { tier: 9, group: 1, rank: 1 };
  }
}

export async function initializeClubV13(userId: string, data: any) {
  // 1. Валидация входа
  const validation = InitializeClubSchema.safeParse(data);
  if (!validation.success) {
    logger.warn("Invalid initializeClubV13 parameters", { errors: validation.error.format() });
    return { success: false, error: "INVALID_PARAMS" };
  }

  const authRes = await authenticateAsSystem();
  if (!authRes.success) return { success: false, error: `SYSTEM_AUTH_FAILED_${authRes.error}` };

  const { firestore: db } = initializeFirebase();
  const seasonNum = getGlobalSeasonInfo().activeSeasonNumber;
  const { clubName, tier, group, rank, selectedLeagueId: leagueId } = validation.data;

  const playerRef = doc(db, 'players_v14', userId);
  const tableId = `table_v140_S${seasonNum}_L${leagueId}_V${tier}_G${group}`;
  const tableRef = doc(db, 'league_tables_v2', tableId);
  const counterRef = doc(db, 'system_v1', 'global_stats');

  try {
    const result = await runTransaction(db, async (transaction) => {
      // ПОРЯДОК: Сначала все GET
      const [playerSnap, tableSnap, counterSnap] = await Promise.all([
        transaction.get(playerRef),
        transaction.get(tableRef),
        transaction.get(counterRef)
      ]);

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
      const botId = Object.keys(currentStats).find(id => Number(currentStats[id].rank) === rank && currentStats[id].isBot);
      if (!botId) throw new Error("SECTOR_NOT_READY");

      const baseStats = currentStats[botId];
      const actualRank = Number(baseStats.rank);
      
      delete currentStats[botId];
      currentStats[userId] = { ...baseStats, id: userId, name: clubName, clubLogo: data.clubLogo || null, rank: actualRank, isBot: false };

      transaction.update(tableRef, { stats: currentStats, updatedAt: serverTimestamp() });
      
      const nextNumericId = (counterSnap.exists() ? (counterSnap.data().totalPlayers || 1000) : 1000) + 1;
      transaction.set(counterRef, { totalPlayers: nextNumericId, updatedAt: serverTimestamp() }, { merge: true });

      const finalPlayerData = {
        id: userId, email: data.email, numericId: nextNumericId,
        displayName: clubName, clubName, country: data.country || 'International',
        selectedLeagueId: leagueId, leagueLevel: tier, groupId: group, rank: actualRank,
        credits: 1000000, crystals: 50, experiencePoints: 0, managerLevel: 1,
        lastProcessedSeason: seasonNum, lastLoginDate: new Date().toISOString(),
        createdAt: serverTimestamp(), version: 140
      };

      transaction.set(playerRef, finalPlayerData);
      return { success: true, tier, group, rank: actualRank, botToReplaceId: botId, numericId: nextNumericId };
    });

    if (result.success && result.botToReplaceId) {
      logger.info("New club initialized", { userId, clubName, tier, group, rank });
      // Фоновое обновление матчей (без ожидания)
      const matchesQ = query(collection(db, 'matches_v2'), where('leagueId', '==', leagueId), where('level', '==', tier), where('groupId', '==', group), where('version', '==', 140));
      getDocs(matchesQ).then(snap => {
        const { writeBatch } = require('firebase/firestore');
        const b = writeBatch(db);
        snap.forEach(d => {
          const m = d.data();
          const up: any = {};
          if (m.homeId === result.botToReplaceId) { up.homeId = userId; up.homeName = clubName; }
          if (m.awayId === result.botToReplaceId) { up.awayId = userId; up.awayName = clubName; }
          if (Object.keys(up).length > 0) b.update(d.ref, up);
        });
        b.commit();
      });
    }

    return result;
  } catch (error: any) {
    logger.error("Transaction failed in initializeClubV13", error, { userId });
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
      const p = playerSnap.data();
      const { leagueLevel: tier, groupId: group, rank, selectedLeagueId: leagueId, lastProcessedSeason: seasonNum } = p;

      const tableId = `table_v140_S${seasonNum || 1}_L${leagueId}_V${tier}_G${group}`;
      const tableRef = doc(db, 'league_tables_v2', tableId);
      const tableSnap = await transaction.get(tableRef);

      if (tableSnap.exists()) {
        const stats = { ...tableSnap.data().stats };
        const bId = getBotId(leagueId, tier, group, rank);
        if (stats[userId]) {
          const cur = stats[userId];
          delete stats[userId];
          stats[bId] = { ...cur, id: bId, name: getBotName(tier, group, rank), isBot: true, clubLogo: null, rank: Number(rank) };
          transaction.update(tableRef, { stats, updatedAt: serverTimestamp() });
        }
      }
      transaction.delete(playerRef);
    });
    logger.info("Player slot released", { userId });
    return { success: true };
  } catch (e: any) {
    logger.error("Error in releasePlayerSlot", e, { userId });
    return { success: false, error: e.message };
  }
}
