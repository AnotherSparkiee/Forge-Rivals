
'use server';

/**
 * @fileOverview Ультимативный антикризисный двигатель Кубка v11 (TBD & Multi-League Support).
 * 
 * Особенности:
 * 1. Генерация Раунда 1 для всех 16 лиг.
 * 2. Использование TBD для пустых слотов.
 * 3. Детерминированный посев на основе силы и ID.
 */

import { 
  collection, doc, getDocs, writeBatch, query, where, 
  Firestore, serverTimestamp, Timestamp
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
  
  const SEASON_NUM = targetSeasonNumber || 1;
  const SEASON_ID = String(SEASON_NUM);
  const TIMESTAMP_NOW = Timestamp.now();

  console.log(`[CUP ENGINE v11] Initializing Season ${SEASON_ID} Brackets...`);

  // Сбор всех игроков один раз для оптимизации
  const playersSnap = await getDocs(collection(db, 'players_v10'));
  const allGlobalPlayers = playersSnap.docs.map(d => ({ id: d.id, ...d.data() }));

  for (let i = 0; i < LEAGUES.length; i++) {
    const league = LEAGUES[i];
    const leagueNum = i + 1;
    const batcher = new FirestoreBatcher(db);
    
    // Фильтрация игроков данной лиги
    const leagueTeams = allGlobalPlayers.filter((p: any) => p.selectedLeagueId === league.id).map((p: any) => ({
      id: p.id,
      name: p.displayName || "Manager",
      power: (Number(p.leagueLevel || 9) * 100) + Number(p.rank || 8),
    }));

    if (leagueTeams.length === 0) continue;

    // Находим ближайшую степень двойки для сетки (минимум 16)
    let bracketSize = 16;
    while (bracketSize < leagueTeams.length) {
      bracketSize *= 2;
    }

    leagueTeams.sort((a, b) => b.power - a.power); // Сильные против слабых

    // Массив слотов (реальные команды + null для TBD)
    const slots = new Array(bracketSize).fill(null);
    leagueTeams.forEach((team, idx) => {
      slots[idx] = team;
    });

    let left = 0;
    let right = bracketSize - 1;
    let matchNum = 1;

    while (left < right) {
      const home = slots[left];
      const away = slots[right];

      // Если в матче нет ни одной реальной команды - не создаем документ
      if (!home && !away) {
        left++; right--; matchNum++;
        continue;
      }

      const cupMatchId = `season_${SEASON_ID}_league_${league.id}_round_1_match_${matchNum}`;

      await batcher.set(doc(db, 'cup_matches', cupMatchId), {
        cupMatchId,
        seasonId: SEASON_ID,
        seasonId_num: SEASON_NUM,
        seasonNumber: SEASON_NUM,
        leagueId: league.id,
        leagueId_num: leagueNum,
        round: 1,
        date: new Date().toISOString(),
        timestamp: TIMESTAMP_NOW,
        homeTeamId: home?.id || 'TBD',
        homeTeamName: home?.name || 'TBD',
        awayTeamId: away?.id || 'TBD',
        awayTeamName: away?.name || 'TBD',
        status: 'scheduled',
        isFinished: false,
        winnerId: null,
        createdAt: serverTimestamp(),
        version: 11
      });

      left++;
      right--;
      matchNum++;
    }

    await batcher.commit();
    console.log(`[CUP ENGINE] Generated ${matchNum - 1} matches for League ${league.id}`);
  }
  
  return { success: true };
}
