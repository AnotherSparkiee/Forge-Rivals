'use server';

/**
 * @fileOverview Экстренный движок Кубка Пирамиды v4 (Emergency Fix).
 * 
 * Особенности:
 * 1. Генерирует Раунд 1 для ВСЕХ дивизионов (1-9) сразу.
 * 2. Дублирует типы данных (str/num) для гарантии срабатывания фильтров.
 * 3. Использует мультиформат даты (ISO, String, Timestamp).
 */

import { 
  collection, doc, getDocs, writeBatch, query, where, 
  Firestore, serverTimestamp, Timestamp
} from 'firebase/firestore';
import { initializeFirebase } from '@/firebase';
import { LEAGUES } from '@/app/lib/leagues-data';

interface CupMatch {
  cupMatchId: string;
  seasonId: string;
  seasonNumber: number;
  leagueId: string;
  leagueId_num: number;
  round: number;
  round_str: string;
  date: string;
  dateString: string;
  timestamp: any;
  homeTeamId: string | null;
  awayTeamId: string | null;
  status: 'scheduled' | 'finished';
  matchStatus: string;
  isFinished: boolean;
  winnerId: string | null;
  createdAt: any;
}

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
      console.log("[BATCH] Committed chunk.");
    }
  }
}

/**
 * ЭКСТРЕННАЯ ГЕНЕРАЦИЯ: Раунд 1 для всей лиги.
 */
export async function generatePyramidCup() {
  const { firestore: db } = initializeFirebase();
  const CURRENT_SEASON_NUM = 1;
  const CURRENT_SEASON_ID = "season_1";
  const TARGET_DATE_ISO = "2026-06-17T20:00:00.000Z";
  const TARGET_DATE_SHORT = "2026-06-17";
  const TARGET_TIMESTAMP = Timestamp.fromDate(new Date("2026-06-17T20:00:00Z"));

  console.log(`[EMERGENCY] Starting Total Generation for Season ${CURRENT_SEASON_NUM}`);

  for (let i = 0; i < LEAGUES.length; i++) {
    const league = LEAGUES[i];
    const leagueNum = i + 1;
    const batcher = new FirestoreBatcher(db);
    
    // 1. Сбор АБСОЛЮТНО ВСЕХ участников лиги (1-9 див)
    const q = query(
      collection(db, 'players_v10'),
      where('selectedLeagueId', '==', league.id)
    );
    
    const snap = await getDocs(q);
    const allTeams = snap.docs.map(d => ({ 
      id: d.id, 
      rank: Number(d.data().rank || 8),
      level: Number(d.data().leagueLevel || 9),
      // Имитируем глобальный ранг для сортировки (уровень + ранг внутри группы)
      globalPower: (Number(d.data().leagueLevel || 9) * 10) + Number(d.data().rank || 8)
    }));

    // Сортировка: Сильные (низкий globalPower) -> Слабые (высокий globalPower)
    allTeams.sort((a, b) => a.globalPower - b.globalPower);

    // 2. Формируем пары "От края до края" (Тотальный посев)
    let left = 0;
    let right = allTeams.length - 1;
    let matchNum = 1;

    while (left < right) {
      const strongTeam = allTeams[left];
      const weakTeam = allTeams[right];

      const matchId = `season_${CURRENT_SEASON_NUM}_league_${league.id}_round_1_match_${matchNum}`;

      await batcher.set(doc(db, 'cup_matches', matchId), {
        cupMatchId: matchId,
        
        // ДУБЛИРОВАНИЕ ТИПОВ:
        seasonId: CURRENT_SEASON_ID,
        seasonNumber: CURRENT_SEASON_NUM,
        leagueId: league.id,
        leagueId_num: leagueNum,
        
        round: 1,
        round_str: "1",

        // МУЛЬТИФОРМАТ ДАТЫ:
        date: TARGET_DATE_ISO,
        dateString: TARGET_DATE_SHORT,
        timestamp: TARGET_TIMESTAMP,

        // КОМАНДЫ:
        homeTeamId: weakTeam.id, // Слабый дома
        awayTeamId: strongTeam.id, // Сильный в гостях
        
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

    // Обработка нечетного количества
    if (left === right) {
      const matchId = `season_${CURRENT_SEASON_NUM}_league_${league.id}_round_1_match_${matchNum}`;
      await batcher.set(doc(db, 'cup_matches', matchId), {
        cupMatchId: matchId,
        seasonId: CURRENT_SEASON_ID,
        seasonNumber: CURRENT_SEASON_NUM,
        leagueId: league.id,
        leagueId_num: leagueNum,
        round: 1,
        date: TARGET_DATE_ISO,
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
  }
  
  return { success: true };
}

/**
 * РЕАКТИВНАЯ ГЕНЕРАЦИЯ СЛЕДУЮЩЕГО РАУНДА (Адаптированная).
 */
export async function checkAndGenerateNextRound(leagueId: string, seasonNumber: number, finishedRound: number) {
  const { firestore: db } = initializeFirebase();
  const seasonId = `season_${seasonNumber}`;

  // Проверка завершенности текущего раунда
  const qActive = query(
    collection(db, 'cup_matches'),
    where('seasonNumber', '==', seasonNumber),
    where('leagueId', '==', leagueId),
    where('round', '==', finishedRound),
    where('isFinished', '==', false)
  );

  const activeSnap = await getDocs(qActive);
  if (!activeSnap.empty) return; 

  console.log(`[CUP] Round ${finishedRound} in ${leagueId} COMPLETE. Advancing...`);

  // Сбор победителей
  const qWinners = query(
    collection(db, 'cup_matches'),
    where('seasonNumber', '==', seasonNumber),
    where('leagueId', '==', leagueId),
    where('round', '==', finishedRound)
  );
  const winnersSnap = await getDocs(qWinners);
  const winnersIds = winnersSnap.docs.map(d => d.data().winnerId).filter(Boolean);

  if (winnersIds.length <= 1) return;

  // Сортировка участников нового раунда
  const participantsData: any[] = [];
  for (const teamId of winnersIds) {
    const tDoc = await getDocs(query(collection(db, 'players_v10'), where('id', '==', teamId)));
    if (!tDoc.empty) {
      const d = tDoc.docs[0].data();
      participantsData.push({
        id: teamId,
        globalPower: (Number(d.leagueLevel || 9) * 10) + Number(d.rank || 8)
      });
    }
  }
  participantsData.sort((a, b) => a.globalPower - b.globalPower);

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

  if (left === right) {
    const matchId = `season_${seasonNumber}_league_${leagueId}_round_${nextRoundNum}_match_${mNum}`;
    await batcher.set(doc(db, 'cup_matches', matchId), {
      cupMatchId: matchId,
      seasonNumber,
      leagueId,
      round: nextRoundNum,
      date: nextDate,
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
