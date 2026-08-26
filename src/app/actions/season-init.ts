
'use server';

/**
 * @fileOverview Серверный модуль инициализации v61 (Tier 1 Priority).
 * Реализует приоритетное заполнение лиги сверху вниз и захват слотов ботов.
 */

import { collection, getDocs, query, where, doc, getDoc, writeBatch, serverTimestamp } from 'firebase/firestore';
import { initializeFirebase } from '@/firebase';
import { 
  getGroupsCountInLevel, 
  getBotId, 
  TEAMS_PER_GROUP, 
  generateSeasonCalendar 
} from '@/app/lib/leagues-data';
import { getGlobalSeasonInfo } from '@/app/lib/time-utils';

/**
 * Находит свободное место, ПРИОРИТЕТНО в верхних дивизионах (Tier 1 -> Tier 9).
 */
export async function findStrategicPlacement(leagueId: string) {
  try {
    const { firestore: db } = initializeFirebase();
    // Получаем всех реальных игроков лиги для карты занятости
    const q = query(collection(db, 'players_v11'), where('selectedLeagueId', '==', leagueId));
    const snap = await getDocs(q);
    
    const occupiedSlots = new Set<string>();
    snap.forEach(d => {
      const data = d.data();
      const key = `${data.leagueLevel}_${data.groupId}_${data.rank}`;
      occupiedSlots.add(key);
    });

    // Проходим по всей пирамиде сверху вниз
    for (let tier = 1; tier <= 9; tier++) {
      const groupsInTier = getGroupsCountInLevel(tier);
      for (let group = 1; group <= groupsInTier; group++) {
        for (let rank = 1; rank <= 8; rank++) {
          const key = `${tier}_${group}_${rank}`;
          // Если в этом слоте (Тир-Группа-Ранг) нет реального игрока — возвращаем его
          if (!occupiedSlots.has(key)) {
            console.log(`[PLACEMENT] Found empty slot at Tier ${tier}, Group ${group}, Rank ${rank}`);
            return { tier, group, rank };
          }
        }
      }
    }
    
    // Если всё забито (что маловероятно), возвращаем самый низ
    return { tier: 9, group: 1, rank: 1 };
  } catch (error) {
    console.error("[PLACEMENT ERROR]", error);
    return { tier: 9, group: 1, rank: 1 };
  }
}

/**
 * Атомарная инициализация клуба с захватом слота бота в уже проинициализированном мире.
 */
export async function initializeClubV11(userId: string, data: any) {
  const { firestore: db } = initializeFirebase();
  const batch = writeBatch(db);
  const seasonInfo = getGlobalSeasonInfo();
  const seasonNum = seasonInfo.activeSeasonNumber;

  const { tier, group, rank, clubName, clubLogo, country } = data;
  const leagueId = data.selectedLeagueId || "ALPHA";
  
  // Вычисляем ID бота, которого мы заменяем
  const botId = getBotId(leagueId, tier, group, rank);

  const tableId = `table_S${seasonNum}_L${leagueId}_V${tier}_G${group}`;
  const tableRef = doc(db, 'league_tables_v1', tableId);
  const tableSnap = await getDoc(tableRef);

  if (!tableSnap.exists()) {
    // В теории мир уже проинициализирован, но на случай сбоя создаем группу локально
    console.warn(`[INIT] Table ${tableId} not found in DB. Performing emergency group init.`);
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
      createdAt: serverTimestamp(),
      version: 11
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
  else {
    // ЗАХВАТ СЛОТА (Мир существует)
    const tableData = tableSnap.data();
    const stats = { ...tableData.stats };

    // 1. Переносим накопленную статистику бота на игрока
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

    // 2. Обновляем календарь: во всех матчах группы заменяем BOT_ID на User_ID
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

  // 3. СОЗДАНИЕ ПРОФИЛЯ ИГРОКА
  const playerRef = doc(db, 'players_v11', userId);
  batch.set(playerRef, {
    id: userId,
    displayName: clubName,
    clubName: clubName,
    clubLogo: clubLogo || null,
    selectedLeagueId: leagueId,
    leagueLevel: tier,
    groupId: group,
    rank: rank,
    country: country || 'International',
    createdAt: serverTimestamp(),
    lastLoginDate: new Date().toISOString(),
    lastProcessedSeason: seasonNum,
    version: 11
  });

  await batch.commit();
  console.log(`[INIT] Player ${userId} successfully placed at Tier ${tier}, Group ${group}, Rank ${rank}`);
  return { success: true, tier, group, rank };
}
