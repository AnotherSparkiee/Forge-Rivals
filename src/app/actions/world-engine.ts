
'use server';

/**
 * @fileOverview Глобальный двигатель инициализации мира v1.4.
 * Создает всю структуру лиги (511 групп) со всеми ботами и календарями.
 */

import { 
  collection, doc, getDoc, writeBatch, 
  Firestore, serverTimestamp, setDoc 
} from 'firebase/firestore';
import { initializeFirebase } from '@/firebase';
import { 
  getGroupsCountInLevel, 
  getBotId, 
  TEAMS_PER_GROUP, 
  generateSeasonCalendar 
} from '@/app/lib/leagues-data';
import { getGlobalSeasonInfo } from '@/app/lib/time-utils';

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
export async function initializeLeagueWorld(leagueId: string, targetSeason?: number) {
  const { firestore: db } = initializeFirebase();
  const info = getGlobalSeasonInfo();
  const seasonNum = targetSeason || info.activeSeasonNumber;

  const statusRef = doc(db, 'system_v1', `init_S${seasonNum}_L${leagueId}`);
  const statusSnap = await getDoc(statusRef);
  if (statusSnap.exists() && statusSnap.data().status === 'completed') {
    return { success: true, alreadyDone: true };
  }

  await setDoc(statusRef, { status: 'processing', startedAt: serverTimestamp() }, { merge: true });

  console.log(`[WORLD ENGINE v1.4] STARTING GLOBAL INIT: League ${leagueId}, Season ${seasonNum}`);

  let totalGroupsCreated = 0;

  for (let tier = 1; tier <= 9; tier++) {
    const groupsInTier = getGroupsCountInLevel(tier);
    for (let group = 1; group <= groupsInTier; group++) {
      const tableId = `table_S${seasonNum}_L${leagueId}_V${tier}_G${group}`;
      const tableRef = doc(db, 'league_tables_v1', tableId);
      
      const groupBatcher = new FirestoreBatcher(db);
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

      await groupBatcher.set(tableRef, {
        id: tableId, leagueId, level: tier, group, season: seasonNum,
        stats: initialStats,
        createdAt: serverTimestamp(),
        version: 11
      });

      const calendar = generateSeasonCalendar(teamsForCalendar, seasonNum, leagueId);
      for (const m of calendar) {
        const mId = `match_S${seasonNum}_L${leagueId}_V${tier}_G${group}_T${m.tour}_R${m.homeRank}_vs_R${m.awayRank}`;
        await groupBatcher.set(doc(db, 'matches_v1', mId), {
          ...m,
          id: mId,
          leagueId, level: tier, groupId: group, season: seasonNum,
          isFinished: false, scoreA: 0, scoreB: 0,
          version: 11
        });
      }

      await groupBatcher.commit();
      totalGroupsCreated++;
    }
  }

  await setDoc(statusRef, { status: 'completed', finishedAt: serverTimestamp() }, { merge: true });
  return { success: true, created: totalGroupsCreated };
}
