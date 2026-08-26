'use server';

/**
 * @fileOverview Серверный модуль инициализации v60 (Slot Takeover Logic).
 * Реализует атомарный захват слота бота реальным игроком.
 */

import { collection, getDocs, query, where, doc, getDoc, writeBatch, serverTimestamp } from 'firebase/firestore';
import { initializeFirebase } from '@/firebase';
import { 
  getGroupsCountInLevel, 
  getDeterministicBotId, 
  getBotId, 
  TEAMS_PER_GROUP, 
  generateSeasonCalendar 
} from '@/app/lib/leagues-data';
import { getGlobalSeasonInfo } from '@/app/lib/time-utils';

/**
 * Находит свободное место (сверху вниз).
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
          if (!occupiedSlots.has(key)) return { tier, group, rank };
        }
      }
    }
    return { tier: 9, group: 1, rank: 1 };
  } catch (error) {
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

  // 1. ИНИЦИАЛИЗАЦИЯ ГРУППЫ (Если первый игрок)
  if (!tableSnap.exists()) {
    const initialStats: any = {};
    const teamsForCalendar = [];

    for (let r = 1; r <= TEAMS_PER_GROUP; r++) {
      const bId = getBotId(leagueId, tier, group, r);
      const isTargetSlot = (r === rank);
      const currentId = isTargetSlot ? userId : bId;
      const currentName = isTargetSlot ? clubName : bId;

      initialStats[currentId] = {
        id: currentId,
        name: currentName,
        rank: r,
        matchesPlayed: 0, wins: 0, draws: 0, losses: 0, points: 0, diff: 0,
        isBot: !isTargetSlot
      };

      teamsForCalendar.push({ id: currentId, name: currentName, rank: r });
    }

    batch.set(tableRef, {
      id: tableId, leagueId, level: tier, group, season: seasonNum,
      stats: initialStats,
      createdAt: serverTimestamp()
    });

    const calendar = generateSeasonCalendar(teamsForCalendar, seasonNum, leagueId);
    calendar.forEach(m => {
      const mId = `match_S${seasonNum}_L${leagueId}_V${tier}_G${group}_T${m.tour}_R${m.homeRank}_vs_R${m.awayRank}`;
      batch.set(doc(db, 'matches_v1', mId), {
        ...m,
        id: mId,
        leagueId, level: tier, groupId: group, season: seasonNum,
        isFinished: false,
        scoreA: 0, scoreB: 0,
        version: 11
      });
    });
  } 
  // 2. ЗАХВАТ СЛОТА (Если группа уже существует)
  else {
    const tableData = tableSnap.data();
    const stats = { ...tableData.stats };

    // Переносим статистику бота на игрока
    if (stats[botId]) {
      const botStats = stats[botId];
      stats[userId] = {
        ...botStats,
        id: userId,
        name: clubName,
        isBot: false
      };
      delete stats[botId];
      batch.update(tableRef, { stats, updatedAt: serverTimestamp() });
    }

    // Обновляем все матчи группы, где участвовал этот бот
    const matchesQ = query(collection(db, 'matches_v1'), 
      where('leagueId', '==', leagueId),
      where('level', '==', tier),
      where('groupId', '==', group),
      where('season', '==', seasonNum)
    );
    const matchesSnap = await getDocs(matchesQ);

    matchesSnap.forEach(mDoc => {
      const mData = mDoc.data();
      let needsUpdate = false;
      const updates: any = {};

      if (mData.homeId === botId) {
        updates.homeId = userId;
        updates.homeName = clubName;
        needsUpdate = true;
      }
      if (mData.awayId === botId) {
        updates.awayId = userId;
        updates.awayName = clubName;
        needsUpdate = true;
      }

      if (needsUpdate) {
        batch.update(mDoc.ref, updates);
      }
    });
  }

  // 3. СОЗДАНИЕ ПРОФИЛЯ
  const playerRef = doc(db, 'players_v11', userId);
  batch.set(playerRef, {
    id: userId,
    displayName: clubName,
    clubName: clubName,
    clubLogo: clubLogo,
    selectedLeagueId: leagueId,
    leagueLevel: tier,
    groupId: group,
    rank: rank,
    country: country,
    createdAt: serverTimestamp(),
    lastLoginDate: new Date().toISOString(),
    lastProcessedSeason: seasonNum,
    version: 11
  });

  await batch.commit();
  return { success: true, tier, group, rank };
}
