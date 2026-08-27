
'use server';

/**
 * @fileOverview Скрипт-миграция v45: Глобальное восстановление мира под Сезон 1.
 * Выполняет две задачи:
 * 1. Создает структуру мира (511 групп) для актуального номера сезона.
 * 2. Перепривязывает всех существующих игроков к новым таблицам и календарям.
 */

import { 
  collection, getDocs, writeBatch, doc, getDoc,
  serverTimestamp, query, where, Firestore 
} from 'firebase/firestore';
import { initializeFirebase } from '@/firebase';
import { getGlobalSeasonInfo } from '@/app/lib/time-utils';
import { 
  getGroupsCountInLevel, getBotId, TEAMS_PER_GROUP, generateSeasonCalendar 
} from '@/app/lib/leagues-data';

class FirestoreBatcher {
  private count = 0;
  private batch;
  constructor(private db: Firestore) {
    this.batch = writeBatch(db);
  }
  async set(ref: any, data: any, options?: any) {
    this.batch.set(ref, data, options || {});
    this.count++;
    if (this.count >= 480) await this.commit();
  }
  async update(ref: any, data: any) {
    this.batch.update(ref, data);
    this.count++;
    if (this.count >= 480) await this.commit();
  }
  async commit() {
    if (this.count > 0) {
      await this.batch.commit();
      this.batch = writeBatch(this.db);
      this.count = 0;
    }
  }
}

/**
 * ГЛОБАЛЬНЫЙ РЕМОНТ МИРА.
 * Запускает цикл создания таблиц/матчей для S1 и миграцию игроков.
 */
export async function runGlobalEmergencyRepair() {
  const { firestore: db } = initializeFirebase();
  const info = getGlobalSeasonInfo();
  const seasonNum = info.activeSeasonNumber; // Гарантированно 1 при новой эпохе
  const leagueId = "ALPHA";

  console.log(`[REPAIR] Starting full world restoration for Season ${seasonNum}...`);

  const batcher = new FirestoreBatcher(db);

  // 1. ПЕРЕИНИЦИАЛИЗАЦИЯ ВСЕХ 511 ГРУПП (Создаем пустой мир из ботов)
  for (let tier = 1; tier <= 9; tier++) {
    const groupsInTier = getGroupsCountInLevel(tier);
    for (let group = 1; group <= groupsInTier; group++) {
      const tableId = `table_S${seasonNum}_L${leagueId}_V${tier}_G${group}`;
      const initialStats: any = {};
      const teamsForCalendar = [];

      for (let r = 1; r <= TEAMS_PER_GROUP; r++) {
        const bId = getBotId(leagueId, tier, group, r);
        initialStats[bId] = {
          id: bId, name: bId, rank: r,
          matchesPlayed: 0, wins: 0, draws: 0, losses: 0, points: 0, diff: 0,
          isBot: true
        };
        teamsForCalendar.push({ id: bId, name: bId, rank: r });
      }

      await batcher.set(doc(db, 'league_tables_v1', tableId), {
        id: tableId, leagueId, level: tier, group, season: seasonNum,
        stats: initialStats,
        createdAt: serverTimestamp(),
        version: 45
      });

      const calendar = generateSeasonCalendar(teamsForCalendar, seasonNum, leagueId);
      calendar.forEach(m => {
        const mId = `match_S${seasonNum}_L${leagueId}_V${tier}_G${group}_T${m.tour}_R${m.homeRank}_vs_R${m.awayRank}`;
        batcher.set(doc(db, 'matches_v1', mId), {
          ...m,
          id: mId, leagueId, level: tier, groupId: group, season: seasonNum,
          isFinished: false, scoreA: 0, scoreB: 0,
          version: 45
        });
      });
    }
  }
  await batcher.commit();

  // 2. МИГРАЦИЯ РЕАЛЬНЫХ ИГРОКОВ (Внедряем их в только что созданный мир S1)
  const playersSnap = await getDocs(collection(db, 'players_v11'));
  console.log(`[REPAIR] Relinking ${playersSnap.size} players to Season ${seasonNum} tables...`);

  for (const pDoc of playersSnap.docs) {
    const p = pDoc.data();
    const tier = Number(p.leagueLevel);
    const group = Number(p.groupId);
    const rank = Number(p.rank);
    const userId = p.id;
    const clubName = p.clubName || p.displayName;
    const clubLogo = p.clubLogo || null;

    const botId = getBotId(leagueId, tier, group, rank);
    const tableId = `table_S${seasonNum}_L${leagueId}_V${tier}_G${group}`;
    const tableRef = doc(db, 'league_tables_v1', tableId);
    
    // Обновляем таблицу
    const tableSnap = await getDoc(tableRef);
    if (tableSnap.exists()) {
      const stats = { ...tableSnap.data().stats };
      if (stats[botId]) {
        stats[userId] = {
          ...stats[botId],
          id: userId, name: clubName, clubLogo: clubLogo, isBot: false
        };
        delete stats[botId];
        await batcher.update(tableRef, { stats, updatedAt: serverTimestamp() });
      }
    }

    // Обновляем календарь для этого игрока
    const matchesQ = query(collection(db, 'matches_v1'), 
      where('leagueId', '==', leagueId),
      where('level', '==', tier),
      where('groupId', '==', group),
      where('season', '==', seasonNum)
    );
    const mSnap = await getDocs(matchesQ);
    mSnap.forEach(mDoc => {
      const mData = mDoc.data();
      const updates: any = {};
      if (mData.homeId === botId) { updates.homeId = userId; updates.homeName = clubName; updates.homeLogo = clubLogo; }
      if (mData.awayId === botId) { updates.awayId = userId; updates.awayName = clubName; updates.awayLogo = clubLogo; }
      if (Object.keys(updates).length > 0) {
        batcher.update(mDoc.ref, updates);
      }
    });
  }

  await batcher.commit();
  console.log(`[REPAIR] World restoration sequence COMPLETED.`);
  return { success: true };
}
