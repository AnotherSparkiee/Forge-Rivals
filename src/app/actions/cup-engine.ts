'use server';

/**
 * @fileOverview Ультимативный антикризисный двигатель Кубка v9.
 * 
 * Особенности:
 * 1. Поддержка любого номера сезона для планирования.
 * 2. Генерация Раунда 1 для всех 16 лиг.
 */

import { 
  collection, doc, getDocs, writeBatch, query, where, 
  Firestore, serverTimestamp, Timestamp, getDoc
} from 'firebase/firestore';
import { initializeFirebase } from '@/firebase';
import { LEAGUES } from '@/app/lib/leagues-data';

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
 * ЭКСТРЕННАЯ ГЕНЕРАЦИЯ: Раунд 1 для всех 16 лиг на указанный сезон.
 */
export async function generatePyramidCup(targetSeasonNumber?: number) {
  const { firestore: db } = initializeFirebase();
  
  // Если сезон не указан, берем 1-й
  const SEASON_NUM = targetSeasonNumber || 1;
  const SEASON_ID = String(SEASON_NUM);

  // Опорная дата начала сезона (упрощенно для кубка, будет синхронизировано через time-utils)
  const TIMESTAMP_NOW = Timestamp.now();

  console.log(`[CUP ENGINE v9] Initializing Season ${SEASON_ID}...`);

  for (let i = 0; i < LEAGUES.length; i++) {
    const league = LEAGUES[i];
    const leagueNum = i + 1;
    const batcher = new FirestoreBatcher(db);
    
    // Сбор участников из мастер-индекса (players_v10)
    const q = query(
      collection(db, 'players_v10'),
      where('selectedLeagueId', '==', league.id)
    );
    
    const snap = await getDocs(q);
    const allTeams = snap.docs.map(d => {
      const data = d.data();
      return { 
        id: d.id, 
        name: data.displayName || "Manager",
        power: (Number(data.leagueLevel || 9) * 100) + Number(data.rank || 8),
      };
    });

    // Дозаполнение ботами до 16 или четного
    const minTeams = Math.max(16, allTeams.length + (allTeams.length % 2));
    while (allTeams.length < minTeams) {
      const botId = `sys_bot_cup_${league.id}_s${SEASON_ID}_${allTeams.length}`;
      allTeams.push({
        id: botId,
        name: `Elite Bot ${allTeams.length + 1}`,
        power: 1000 + allTeams.length,
      });
    }

    allTeams.sort((a, b) => b.power - a.power); // Сильные против слабых

    let left = 0;
    let right = allTeams.length - 1;
    let matchNum = 1;

    while (left < right) {
      const strongTeam = allTeams[left];
      const weakTeam = allTeams[right];

      const cupMatchId = `season_${SEASON_ID}_league_${league.id}_round_1_match_${matchNum}`;

      await batcher.set(doc(db, 'cup_matches', cupMatchId), {
        cupMatchId,
        seasonId: SEASON_ID,
        seasonId_num: SEASON_NUM,
        seasonNumber: SEASON_NUM,
        leagueId: league.id,
        leagueId_num: leagueNum,
        round: 1,
        round_str: "1",
        date: new Date().toISOString(),
        timestamp: TIMESTAMP_NOW,
        homeTeamId: weakTeam.id,
        awayTeamId: strongTeam.id,
        status: 'scheduled',
        matchStatus: 'scheduled',
        isFinished: false,
        winnerId: null,
        createdAt: serverTimestamp()
      });

      left++;
      right--;
      matchNum++;
    }

    await batcher.commit();
  }
  
  return { success: true };
}
