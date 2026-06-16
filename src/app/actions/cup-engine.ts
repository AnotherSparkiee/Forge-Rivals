'use server';

/**
 * @fileOverview Ультимативный движок Кубка Пирамиды v6 (Emergency Edition).
 * 
 * Особенности:
 * 1. Собирает участников из /players_v10 (Мастер-индекс).
 * 2. Генерирует Раунд 1 для ВСЕХ дивизионов сразу (Тотальный посев 1-9 див).
 * 3. Дублирует типы данных (leagueId_num, seasonNumber) для обхода фильтров.
 * 4. Использует три формата даты: ISO, String, Timestamp.
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
      console.log("[BATCH] Committed successfully.");
    }
  }
}

/**
 * ЭКСТРЕННАЯ ГЕНЕРАЦИЯ: Раунд 1 для всей пирамиды (1-9 дивизионы).
 */
export async function generatePyramidCup() {
  const { firestore: db } = initializeFirebase();
  
  // КРИТИЧЕСКИЕ КОНСТАНТЫ
  const SEASON_NUM = 1; 
  const SEASON_ID = "1";
  const TARGET_DATE_ISO = "2026-06-17T20:00:00.000Z";
  const TARGET_DATE_SHORT = "2026-06-17";
  const TARGET_TIMESTAMP = Timestamp.fromDate(new Date("2026-06-17T20:00:00Z"));

  console.log(`[EMERGENCY V6] Starting Total Seeding for Season ${SEASON_NUM}...`);

  for (let i = 0; i < LEAGUES.length; i++) {
    const league = LEAGUES[i];
    const leagueNum = i + 1;
    const batcher = new FirestoreBatcher(db);
    
    // 1. Сбор ВСЕХ участников лиги из мастер-индекса
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
        // Глобальная сила: Чем меньше уровень и ранг, тем сильнее команда
        power: (Number(data.leagueLevel || 9) * 100) + Number(data.rank || 8)
      };
    });

    // 2. Дозаполнение ботами до четного количества (минимум 8 команд на лигу)
    const minTeams = Math.max(8, allTeams.length + (allTeams.length % 2));
    while (allTeams.length < minTeams) {
      const botId = `sys_bot_cup_${league.id}_${allTeams.length}`;
      allTeams.push({
        id: botId,
        name: `Elite Bot ${allTeams.length + 1}`,
        power: 1000 + allTeams.length 
      });
    }

    // Сортировка: Сильные (низкий power) -> Слабые (высокий power)
    allTeams.sort((a, b) => a.power - b.power);

    // 3. Формируем пары "От края до края" (Зеркальный посев всей лиги)
    let left = 0;
    let right = allTeams.length - 1;
    let matchNum = 1;

    while (left < right) {
      const strongTeam = allTeams[left];
      const weakTeam = allTeams[right];

      const matchId = `season_${SEASON_NUM}_league_${league.id}_round_1_match_${matchNum}`;

      await batcher.set(doc(db, 'cup_matches', matchId), {
        cupMatchId: matchId,
        
        // ДУБЛИРОВАНИЕ ТИПОВ (Защита от багов фильтрации):
        seasonId: SEASON_ID,
        seasonNumber: SEASON_NUM,
        seasonId_num: SEASON_NUM,
        
        leagueId: league.id,
        leagueId_num: leagueNum,
        leagueId_str: String(leagueNum),
        
        round: 1,
        round_str: "1",

        // МУЛЬТИФОРМАТ ДАТЫ:
        date: TARGET_DATE_ISO,
        dateString: TARGET_DATE_SHORT,
        timestamp: TARGET_TIMESTAMP,

        // КОМАНДЫ (Слабый всегда дома):
        homeTeamId: weakTeam.id,
        awayTeamId: strongTeam.id,
        
        // СТАТУСЫ:
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
    console.log(`[CUP V6] League ${league.id} seeded. Matches: ${matchNum - 1}`);
  }
  
  return { success: true };
}

/**
 * Реактивная генерация следующего раунда.
 * Вызывается при завершении матчей.
 */
export async function checkAndGenerateNextRound(leagueId: string, seasonNumber: number, finishedRound: number) {
  const { firestore: db } = initializeFirebase();

  // 1. Проверяем, завершен ли раунд в лиге
  const qActive = query(
    collection(db, 'cup_matches'),
    where('seasonNumber', '==', seasonNumber),
    where('leagueId', '==', leagueId),
    where('round', '==', finishedRound),
    where('status', '==', 'scheduled')
  );

  const activeSnap = await getDocs(qActive);
  if (!activeSnap.empty) return; 

  console.log(`[CUP] Advancing Round ${finishedRound} in ${leagueId}...`);

  // 2. Сбор победителей
  const qWinners = query(
    collection(db, 'cup_matches'),
    where('seasonNumber', '==', seasonNumber),
    where('leagueId', '==', leagueId),
    where('round', '==', finishedRound)
  );
  const winnersSnap = await getDocs(qWinners);
  const winnersIds = winnersSnap.docs.map(d => d.data().winnerId).filter(Boolean);

  if (winnersIds.length <= 1) return; 

  // 3. Сбор данных о силе участников следующего раунда
  const participantsData: any[] = [];
  for (const teamId of winnersIds) {
    const pDoc = await getDocs(query(collection(db, 'players_v10'), where('id', '==', teamId)));
    if (!pDoc.empty) {
      const d = pDoc.docs[0].data();
      participantsData.push({ id: teamId, power: (Number(d.leagueLevel || 9) * 100) + Number(d.rank || 8) });
    } else {
      participantsData.push({ id: teamId, power: 5000 });
    }
  }
  participantsData.sort((a, b) => a.power - b.power);

  // 4. Генерация нового раунда
  const batcher = new FirestoreBatcher(db);
  const nextRoundNum = finishedRound + 1;
  const nextDate = new Date().toISOString();

  let left = 0;
  let right = participantsData.length - 1;
  let mNum = 1;

  while (left < right) {
    const matchId = `season_${seasonNumber}_league_${leagueId}_round_${nextRoundNum}_match_${mNum}`;
    await batcher.set(doc(db, 'cup_matches', matchId), {
      cupMatchId: matchId,
      seasonNumber,
      leagueId,
      round: nextRoundNum,
      date: nextDate,
      homeTeamId: participantsData[right].id,
      awayTeamId: participantsData[left].id,
      status: 'scheduled',
      isFinished: false,
      winnerId: null,
      createdAt: serverTimestamp()
    });
    left++;
    right--;
    mNum++;
  }

  await batcher.commit();
}