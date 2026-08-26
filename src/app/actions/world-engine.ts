'use server';

/**
 * @fileOverview Глобальный двигатель инициализации мира v1.0.
 * Создает всю структуру лиги (511 групп) со всеми ботами и календарями.
 */

import { 
  collection, doc, getDoc, writeBatch, 
  Firestore, serverTimestamp 
} from 'firebase/firestore';
import { initializeFirebase } from '@/firebase';
import { 
  getGroupsCountInLevel, 
  getBotId, 
  TEAMS_PER_GROUP, 
  generateSeasonCalendar 
} from '@/app/lib/leagues-data';

class FirestoreBatcher {
  private count = 0;
  private batch;
  constructor(private db: Firestore) {
    this.batch = writeBatch(db);
  }

  async set(ref: any, data: any) {
    this.batch.set(ref, data);
    this.count++;
    if (this.count >= 450) {
      await this.commit();
      this.batch = writeBatch(this.db);
      this.count = 0;
    }
  }

  async commit() {
    if (this.count > 0) {
      await this.batch.commit();
      this.count = 0;
    }
  }
}

/**
 * Инициализирует весь мир лиги для конкретного сезона.
 * Генерирует 511 групп, 511 таблиц и ~28616 матчей.
 */
export async function initializeLeagueWorld(leagueId: string, seasonNum: number) {
  const { firestore: db } = initializeFirebase();
  const batcher = new FirestoreBatcher(db);

  console.log(`[WORLD ENGINE] Starting global initialization for League ${leagueId}, Season ${seasonNum}`);

  for (let tier = 1; tier <= 9; tier++) {
    const groupsInTier = getGroupsCountInLevel(tier);
    console.log(`[WORLD ENGINE] Initializing Tier ${tier} (${groupsInTier} groups)...`);

    for (let group = 1; group <= groupsInTier; group++) {
      const tableId = `table_S${seasonNum}_L${leagueId}_V${tier}_G${group}`;
      const tableRef = doc(db, 'league_tables_v1', tableId);
      
      // Проверка на идемпотентность
      const tableSnap = await getDoc(tableRef);
      if (tableSnap.exists()) continue;

      const initialStats: any = {};
      const teamsForCalendar = [];

      for (let r = 1; r <= TEAMS_PER_GROUP; r++) {
        const bId = getBotId(leagueId, tier, group, r);
        initialStats[bId] = {
          id: bId,
          name: bId,
          rank: r,
          matchesPlayed: 0, wins: 0, draws: 0, losses: 0, points: 0, diff: 0,
          isBot: true
        };
        teamsForCalendar.push({ id: bId, name: bId, rank: r });
      }

      await batcher.set(tableRef, {
        id: tableId, leagueId, level: tier, group, season: seasonNum,
        stats: initialStats,
        createdAt: serverTimestamp(),
        version: 11
      });

      const calendar = generateSeasonCalendar(teamsForCalendar, seasonNum, leagueId);
      for (const m of calendar) {
        const mId = `match_S${seasonNum}_L${leagueId}_V${tier}_G${group}_T${m.tour}_R${m.homeRank}_vs_R${m.awayRank}`;
        await batcher.set(doc(db, 'matches_v1', mId), {
          ...m,
          id: mId,
          leagueId, level: tier, groupId: group, season: seasonNum,
          isFinished: false,
          scoreA: 0, scoreB: 0,
          version: 11
        });
      }
    }
  }

  await batcher.commit();
  console.log(`[WORLD ENGINE] Global initialization complete.`);
  return { success: true };
}
