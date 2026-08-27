'use server';

/**
 * @fileOverview Серверный модуль инициализации v64 (Deterministic Reseeding).
 * Улучшен поиск мест: теперь учитываются только игроки, уже распределенные в текущем сезоне.
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
 * Находит свободное место в текущем сезоне.
 * Приоритет: Дивизион 1 -> 9, Группа 1 -> N.
 */
export async function findStrategicPlacement(leagueId: string) {
  const { firestore: db } = initializeFirebase();
  const seasonInfo = getGlobalSeasonInfo();
  const seasonNum = seasonInfo.activeSeasonNumber;

  try {
    // Ищем только тех, кто УЖЕ в этом сезоне, чтобы понять какие слоты заняты
    const q = query(
      collection(db, 'players_v11'), 
      where('selectedLeagueId', '==', leagueId),
      where('lastProcessedSeason', '==', seasonNum)
    );
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
 * Может использоваться как для новых игроков, так и для миграции старых.
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
    throw new Error(`LEAGUE_SECTOR_NOT_READY: Table ${tableId} is missing.`);
  } 

  // ЗАХВАТ СЛОТА В ТАБЛИЦЕ
  const tableData = tableSnap.data();
  const stats = { ...tableData.stats };

  if (stats[botId]) {
    const botStats = stats[botId];
    stats[userId] = {
      ...botStats,
      id: userId,
      name: clubName || data.displayName || "Manager",
      clubLogo: clubLogo || data.clubLogo || null,
      isBot: false
    };
    delete stats[botId];
    batch.update(tableRef, { stats, updatedAt: serverTimestamp() });
  }

  // ОБНОВЛЕНИЕ КАЛЕНДАРЯ (Замена ID бота на ID игрока)
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

  // СОХРАНЕНИЕ ПРОФИЛЯ (Обновляем координаты и метку сезона)
  const playerRef = doc(db, 'players_v11', userId);
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
    version: 11
  }, { merge: true });

  await batch.commit();
  return { success: true, tier, group, rank };
}
