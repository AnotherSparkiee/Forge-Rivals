
'use server';

/**
 * @fileOverview Серверный модуль инициализации v72 (V12 Absolute Isolation).
 * Исправлена проблема переполнения групп (9-я команда).
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
 * Находит свободное место в текущем сезоне v12.
 * Сканирует занятые слоты реальных игроков.
 */
export async function findStrategicPlacement(leagueId: string) {
  const { firestore: db } = initializeFirebase();

  try {
    // Получаем всех игроков этой лиги в коллекции v12
    const q = query(
      collection(db, 'players_v12'), 
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

    // Ищем первое свободное место по иерархии (сверху вниз)
    for (let tier = 1; tier <= 9; tier++) {
      const groupsInTier = getGroupsCountInLevel(tier);
      for (let group = 1; group <= groupsInTier; group++) {
        for (let rank = 1; group <= 8; rank++) {
          const key = `${tier}_${group}_${rank}`;
          if (!occupiedSlots.has(key)) {
            return { tier, group, rank };
          }
          if (rank >= 8) break;
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
 * Атомарная инициализация клуба v12.
 * ГАРАНТИРУЕТ ровно 8 команд в группе.
 */
export async function initializeClubV11(userId: string, data: any) {
  const { firestore: db } = initializeFirebase();
  const seasonInfo = getGlobalSeasonInfo();
  const seasonNum = seasonInfo.activeSeasonNumber;

  const { tier, group, rank, clubName, clubLogo } = data;
  const leagueId = data.selectedLeagueId || "ALPHA";
  
  const tableId = `table_S${seasonNum}_L${leagueId}_V${tier}_G${group}`;
  const tableRef = doc(db, 'league_tables_v1', tableId);
  
  let tableSnap = await getDoc(tableRef);

  // JIT создание группы, если она еще не построена фоновым процессом
  if (!tableSnap.exists()) {
    console.warn(`[JIT] Table ${tableId} missing. Creating group structure...`);
    await createGroupStructure(db, leagueId, tier, group, seasonNum);
    tableSnap = await getDoc(tableRef);
  } 

  const tableData = tableSnap.data();
  const stats = { ...tableData!.stats };

  // ОПРЕДЕЛЕНИЕ ЦЕЛИ ДЛЯ ЗАМЕНЫ
  // Мы должны заменить БОТА, чтобы сохранить лимит в 8 команд.
  const targetBotId = getBotId(leagueId, tier, group, rank);
  let botToReplaceId = null;

  if (stats[targetBotId]) {
    botToReplaceId = targetBotId;
  } else {
    // Если на этом ранге уже человек, ищем ЛЮБОГО другого бота в этой группе
    botToReplaceId = Object.keys(stats).find(id => stats[id].isBot === true) || null;
  }

  // Если в группе нет ни одного бота, значит она реально полная (8 человек)
  if (!botToReplaceId && !stats[userId]) {
    console.error(`[OVERFLOW] Group ${tier}.${group} is full of humans!`);
    return { success: false, error: "GROUP_FULL" };
  }

  const batch = writeBatch(db);

  // Обновляем таблицу: заменяем бота на игрока
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

  // Обновляем матчи: меняем ID бота на ID игрока
  if (botToReplaceId) {
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
      if (mData.homeId === botToReplaceId) { updates.homeId = userId; updates.homeName = clubName; updates.homeLogo = clubLogo; }
      if (mData.awayId === botToReplaceId) { updates.awayId = userId; updates.awayName = clubName; updates.awayLogo = clubLogo; }
      if (Object.keys(updates).length > 0) batch.update(mDoc.ref, updates);
    });
  }

  // Сохраняем профиль в коллекцию v12
  const playerRef = doc(db, 'players_v12', userId);
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
    version: 12
  }, { merge: true });

  await batch.commit();
  return { success: true, tier, group, rank };
}
