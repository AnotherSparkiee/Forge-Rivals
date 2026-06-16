'use server';

/**
 * @fileOverview Ультимативный антикризисный двигатель Кубка v7.
 * 
 * Особенности:
 * 1. Генерация Раунда 1 для всех 16 лиг (Сезон 2).
 * 2. Дублирование типов (str/num) для пробития любых фильтров.
 * 3. Мультиформатные даты и статусы.
 * 4. Поэтапная генерация раундов (Раунд 2 создается только после финиша Раунда 1).
 */

import { 
  collection, doc, getDocs, writeBatch, query, where, 
  Firestore, serverTimestamp, Timestamp, getDoc, setDoc
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
      console.log("[BATCH] Committed successfully.");
    }
  }
}

/**
 * ЭКСТРЕННАЯ ГЕНЕРАЦИЯ: Раунд 1 для всех 16 лиг.
 */
export async function generatePyramidCup() {
  const { firestore: db } = initializeFirebase();
  
  // КРИТИЧЕСКИЕ КОНСТАНТЫ ИЗ ВАШЕГО СКРИПТА
  const SEASON = "2"; 
  const DATE_ISO = "2026-06-17T20:00:00.000Z";
  const DATE_SHORT = "2026-06-17";
  const TIMESTAMP_NOW = Timestamp.fromDate(new Date("2026-06-17T20:00:00Z"));

  console.log(`[EMERGENCY V7] Starting Total Generation for Season ${SEASON}...`);

  for (let i = 0; i < LEAGUES.length; i++) {
    const league = LEAGUES[i];
    const leagueNum = i + 1;
    const batcher = new FirestoreBatcher(db);
    
    // 1. Сбор участников из мастер-индекса (players_v10)
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
        // Сила: чем меньше уровень и ранг, тем выше в списке
        power: (Number(data.leagueLevel || 9) * 100) + Number(data.rank || 8),
        divisionId: String(data.leagueLevel || "9")
      };
    });

    // Дозаполнение ботами до 16 или четного (минимум 16 на лигу для теста)
    const minTeams = Math.max(16, allTeams.length + (allTeams.length % 2));
    while (allTeams.length < minTeams) {
      const botId = `sys_bot_cup_${league.id}_${allTeams.length}`;
      allTeams.push({
        id: botId,
        name: `Elite Bot ${allTeams.length + 1}`,
        power: 1000 + allTeams.length,
        divisionId: "9"
      });
    }

    // Сортировка: Сильные (низкий power) -> Слабые (высокий power)
    allTeams.sort((a, b) => a.power - b.power);

    // 2. Формируем пары "От края до края"
    let left = 0;
    let right = allTeams.length - 1;
    let matchNum = 1;

    while (left < right) {
      const strongTeam = allTeams[left];
      const weakTeam = allTeams[right];

      const cupMatchId = `season_${SEASON}_league_${league.id}_round_1_match_${matchNum}`;

      await batcher.set(doc(db, 'cup_matches', cupMatchId), {
        cupMatchId,
        
        // ДУБЛИРОВАНИЕ ТИПОВ ДЛЯ СТРОГИХ ФИЛЬТРОВ:
        seasonId: SEASON,
        seasonId_num: Number(SEASON),
        seasonNumber: Number(SEASON),
        
        leagueId: league.id,
        leagueId_num: leagueNum,
        
        round: 1,
        round_str: "1",

        // МУЛЬТИФОРМАТ ДАТЫ:
        date: DATE_ISO,
        dateString: DATE_SHORT,
        timestamp: TIMESTAMP_NOW,

        // КОМАНДЫ (Слабый всегда дома):
        homeTeamId: weakTeam.id,
        awayTeamId: strongTeam.id,
        
        // ДУБЛИРОВАНИЕ СТАТУСОВ:
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

    // Автопроход для нечетного
    if (left === right) {
      const cupMatchId = `season_${SEASON}_league_${league.id}_round_1_match_${matchNum}`;
      await batcher.set(doc(db, 'cup_matches', cupMatchId), {
        cupMatchId,
        seasonId: SEASON,
        seasonId_num: Number(SEASON),
        seasonNumber: Number(SEASON),
        leagueId: league.id,
        leagueId_num: leagueNum,
        round: 1,
        round_str: "1",
        date: DATE_ISO,
        dateString: DATE_SHORT,
        timestamp: TIMESTAMP_NOW,
        homeTeamId: allTeams[left].id,
        awayTeamId: null,
        status: 'finished',
        matchStatus: 'finished',
        isFinished: true,
        winnerId: allTeams[left].id,
        createdAt: serverTimestamp()
      });
    }

    await batcher.commit();
    console.log(`[CUP V7] League ${league.id} initialized. Matches: ${matchNum}`);
  }
  
  return { success: true };
}

/**
 * РЕАКТИВНЫЙ ТРИГГЕР: Генерация следующего раунда.
 * Вызывается при завершении любого матча.
 */
export async function advanceCupRound(leagueId: string, seasonId: string, finishedRound: number) {
  const { firestore: db } = initializeFirebase();

  // 1. Проверяем, завершен ли весь раунд в лиге
  const qActive = query(
    collection(db, 'cup_matches'),
    where('seasonId', '==', seasonId),
    where('leagueId', '==', leagueId),
    where('round', '==', finishedRound),
    where('status', '==', 'scheduled')
  );

  const activeSnap = await getDocs(qActive);
  if (!activeSnap.empty) return; // Еще есть живые игры

  console.log(`[CUP] Advancing Round ${finishedRound} in ${leagueId}...`);

  // 2. Сбор победителей
  const qWinners = query(
    collection(db, 'cup_matches'),
    where('seasonId', '==', seasonId),
    where('leagueId', '==', leagueId),
    where('round', '==', finishedRound)
  );
  const winnersSnap = await getDocs(qWinners);
  const winnersIds = winnersSnap.docs.map(d => d.data().winnerId).filter(Boolean);

  if (winnersIds.length <= 1) return; // Финал завершен

  // 3. Сбор данных о силе для перепосева
  const participantsData: any[] = [];
  for (const teamId of winnersIds) {
    const pDoc = await getDoc(doc(db, 'players_v10', teamId!));
    if (pDoc.exists()) {
      const d = pDoc.data();
      participantsData.push({ id: teamId, power: (Number(d.leagueLevel || 9) * 100) + Number(d.rank || 8) });
    } else {
      participantsData.push({ id: teamId, power: 9999 });
    }
  }

  participantsData.sort((a, b) => a.power - b.power);

  // 4. Генерация нового раунда
  const batcher = new FirestoreBatcher(db);
  const nextRoundNum = finishedRound + 1;
  const nextDateISO = new Date().toISOString();

  let left = 0;
  let right = participantsData.length - 1;
  let mNum = 1;

  while (left < right) {
    const strong = participantsData[left];
    const weak = participantsData[right];
    const mId = `season_${seasonId}_league_${leagueId}_round_${nextRoundNum}_match_${mNum}`;

    await batcher.set(doc(db, 'cup_matches', mId), {
      cupMatchId: mId,
      seasonId,
      seasonId_num: Number(seasonId),
      leagueId,
      round: nextRoundNum,
      round_str: String(nextRoundNum),
      date: nextDateISO,
      dateString: nextDateISO.split('T')[0],
      timestamp: Timestamp.now(),
      homeTeamId: weak.id,
      awayTeamId: strong.id,
      status: 'scheduled',
      matchStatus: 'scheduled',
      isFinished: false,
      winnerId: null,
      createdAt: serverTimestamp()
    });

    left++;
    right--;
    mNum++;
  }

  if (left === right) {
    const mId = `season_${seasonId}_league_${leagueId}_round_${nextRoundNum}_match_${mNum}`;
    await batcher.set(doc(db, 'cup_matches', mId), {
      cupMatchId: mId,
      seasonId,
      leagueId,
      round: nextRoundNum,
      date: nextDateISO,
      homeTeamId: participantsData[left].id,
      awayTeamId: null,
      status: 'finished',
      isFinished: true,
      winnerId: participantsData[left].id,
      createdAt: serverTimestamp()
    });
  }

  await batcher.commit();
}
