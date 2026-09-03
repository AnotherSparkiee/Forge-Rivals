'use server';

/**
 * @fileOverview Модуль инициализации клуба v160 (Admin SDK Transition).
 */

import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase-admin';
import { 
  getGroupsCountInLevel, 
  getBotId, 
  getBotName,
  TEAMS_PER_GROUP,
  generateSeasonCalendar,
  getTableId,
  MAX_LEVELS
} from '@/app/lib/leagues-data';
import { getGlobalSeasonInfo } from '@/app/lib/time-utils';
import { InitializeClubSchema } from '@/app/lib/validation-schemas';
import { logger } from '@/app/lib/logger';
import { getActiveSeasonNumber } from './season-cycle';

async function provisionGroupInTransaction(
  transaction: any, 
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
    createdAt: FieldValue.serverTimestamp(),
    version: 140
  });

  const calendar = generateSeasonCalendar(teamsForCalendar, seasonNum, leagueId);
  for (const m of calendar) {
    const mId = `match_v140_S${seasonNum}_L${leagueId}_V${tier}_G${group}_T${m.tour}_R${m.homeRank}_vs_R${m.awayRank}`;
    transaction.set(adminDb.collection('matches_v2').doc(mId), {
      ...m, id: mId,
      leagueId, level: tier, groupId: group, season: seasonNum,
      isFinished: false, isProcessing: false, scoreA: 0, scoreB: 0, version: 140
    });
  }

  return initialStats;
}

export async function findStrategicPlacement(leagueId: string) {
  const db = adminDb;
  try {
    const snap = await db.collection('players_v14')
      .where('selectedLeagueId', '==', leagueId)
      .limit(1000)
      .get();
    
    const occupiedSlots = new Set<string>();
    snap.forEach(d => {
      const data = d.data();
      if (data.leagueLevel && data.groupId && data.rank) {
        occupiedSlots.add(`${data.leagueLevel}_${data.groupId}_${data.rank}`);
      }
    });

    for (let tier = MAX_LEVELS; tier >= 1; tier--) {
      const groupsInTier = getGroupsCountInLevel(tier);
      for (let group = 1; group <= groupsInTier; group++) {
        for (let rank = 1; rank <= 8; rank++) {
          const key = `${tier}_${group}_${rank}`;
          if (!occupiedSlots.has(key)) return { tier, group, rank };
        }
      }
    }
    return { tier: MAX_LEVELS, group: 1, rank: 1 };
  } catch (error) {
    logger.error("Error in findStrategicPlacement", error);
    return { tier: MAX_LEVELS, group: 1, rank: 1 };
  }
}

export async function initializeClubComplete(userId: string, email: string) {
  const placement = await findStrategicPlacement("ALPHA");
  if (!placement) {
    return { success: false, error: "NO_FREE_SLOTS" };
  }

  return await initializeClubV13(userId, {
    tier: placement.tier,
    group: placement.group,
    rank: placement.rank,
    email: email,
    selectedLeagueId: "ALPHA"
  });
}

export async function initializeClubV13(userId: string, data: any) {
  const clubName = data.clubName || `Manager_${Math.floor(1000 + Math.random() * 9000)}`;
  const country = data.country || "International";
  const clubLogo = data.clubLogo || "https://iili.io/CYIAgVa.webp";

  const payload = {
    ...data,
    clubName,
    country,
    clubLogo
  };

  const validation = InitializeClubSchema.safeParse(payload);
  if (!validation.success) {
    logger.warn("Invalid initializeClubV13 parameters", { errors: validation.error.format() });
    return { success: false, error: "INVALID_PARAMS" };
  }

  const db = adminDb;
  const seasonNum = await getActiveSeasonNumber(db);
  const info = getGlobalSeasonInfo();
  const effectiveSeason = info.dayOfCycle >= 15 ? seasonNum + 1 : seasonNum;

  const { tier, group, rank, selectedLeagueId: leagueId } = validation.data;

  const playerRef = db.collection('players_v14').doc(userId);
  const tableId = getTableId(effectiveSeason, leagueId, tier, group);
  const tableRef = db.collection('league_tables_v2').doc(tableId);
  const counterRef = db.collection('system_v1').doc('global_stats');

  try {
    const result = await db.runTransaction(async (transaction) => {
      const [playerSnap, tableSnap, counterSnap] = await Promise.all([
        transaction.get(playerRef),
        transaction.get(tableRef),
        transaction.get(counterRef)
      ]);

      if (playerSnap.exists) {
        const p = playerSnap.data();
        return { success: true, tier: p.leagueLevel, group: p.groupId, rank: p.rank };
      }

      let stats;
      if (!tableSnap.exists) {
        stats = await provisionGroupInTransaction(transaction, leagueId, tier, group, effectiveSeason, tableRef);
      } else {
        stats = tableSnap.data().stats;
      }

      const currentStats = { ...stats };
      const botId = Object.keys(currentStats).find(id => Number(currentStats[id].rank) === rank && currentStats[id].isBot);
      if (!botId) throw new Error("SECTOR_NOT_READY");

      const baseStats = currentStats[botId];
      const actualRank = Number(baseStats.rank);
      
      delete currentStats[botId];
      currentStats[userId] = { ...baseStats, id: userId, name: clubName, clubLogo, rank: actualRank, isBot: false };

      transaction.update(tableRef, { stats: currentStats, updatedAt: FieldValue.serverTimestamp() });
      
      const nextNumericId = (counterSnap.exists ? (counterSnap.data().totalPlayers || 1000) : 1000) + 1;
      transaction.set(counterRef, { totalPlayers: nextNumericId, updatedAt: FieldValue.serverTimestamp() }, { merge: true });

      const finalPlayerData = {
        id: userId, email: data.email, numericId: nextNumericId,
        displayName: clubName, clubName, country,
        selectedLeagueId: leagueId, leagueLevel: tier, groupId: group, rank: actualRank,
        credits: 1000000, crystals: 50, experiencePoints: 0, managerLevel: 1,
        lastProcessedSeason: effectiveSeason, lastLoginDate: new Date().toISOString(),
        createdAt: FieldValue.serverTimestamp(), version: 140
      };

      transaction.set(playerRef, finalPlayerData);
      return { success: true, tier, group, rank: actualRank, botToReplaceId: botId, numericId: nextNumericId, clubName, clubLogo, country };
    });

    if (result.success && result.botToReplaceId) {
      const snap = await db.collection('matches_v2')
        .where('leagueId', '==', leagueId) 
        .where('level', '==', tier) 
        .where('groupId', '==', group) 
        .where('version', '==', 140)
        .where('season', '==', effectiveSeason)
        .get();
      
      const b = db.batch();
      snap.forEach(d => {
        const m = d.data();
        const up: any = {};
        if (m.homeId === result.botToReplaceId) { up.homeId = userId; up.homeName = clubName; }
        if (m.awayId === result.botToReplaceId) { up.awayId = userId; up.awayName = clubName; }
        if (Object.keys(up).length > 0) b.update(d.ref, up);
      });
      await b.commit();
    }

    return result;
  } catch (error: any) {
    logger.error(`[INIT CLUB] Transaction Critical Error: ${error.message}`);
    return { success: false, error: error.message };
  }
}

export async function releasePlayerSlot(userId: string) {
  const db = adminDb;
  try {
    const playerRef = db.collection('players_v14').doc(userId);
    const pSnap = await playerRef.get();
    if (!pSnap.exists) return { success: false };
    
    const p = pSnap.data()!;
    const seasonNum = await getActiveSeasonNumber(db);
    const tableId = getTableId(seasonNum, p.selectedLeagueId, p.leagueLevel, p.groupId);
    const tableRef = db.collection('league_tables_v2').doc(tableId);
    
    await db.runTransaction(async (transaction) => {
      const tSnap = await transaction.get(tableRef);
      if (!tSnap.exists) return;
      
      const stats = { ...tSnap.data().stats };
      const botId = getBotId(p.selectedLeagueId, p.leagueLevel, p.groupId, p.rank);
      const botName = getBotName(p.leagueLevel, p.groupId, p.rank);
      
      delete stats[userId];
      stats[botId] = {
        id: botId, name: botName, rank: p.rank,
        matchesPlayed: 0, wins: 0, draws: 0, losses: 0, points: 0, diff: 0,
        isBot: true, clubLogo: null
      };
      
      transaction.update(tableRef, { stats, updatedAt: FieldValue.serverTimestamp() });
      transaction.delete(playerRef);
    });
    
    return { success: true };
  } catch (e) {
    logger.error("Release slot failed:", e);
    return { success: false };
  }
}
