'use server';

/**
 * @fileOverview Реактивный движок Кубка Пирамиды v3.
 * 
 * Логика:
 * 1. В межсезонье генерируется ТОЛЬКО Раунд 1 (Дивизионы 2-9).
 * 2. Дивизион 1 вступает во втором раунде.
 * 3. Следующий раунд генерируется только после завершения ВСЕХ матчей предыдущего в конкретной лиге.
 */

import { 
  collection, doc, getDocs, writeBatch, query, where, 
  getDoc, updateDoc, Firestore, serverTimestamp, orderBy, limit
} from 'firebase/firestore';
import { initializeFirebase } from '@/firebase';
import { LEAGUES } from '@/app/lib/leagues-data';

interface CupMatch {
  cupMatchId: string;
  seasonId: string;
  seasonNumber: number;
  leagueId: string;
  round: number;
  date: string; // ISO UTC
  homeTeamId: string | null;
  awayTeamId: string | null;
  status: 'scheduled' | 'finished';
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
 * ИНИЦИАЦИЯ КУБКА: Генерация ТОЛЬКО Раунда 1.
 */
export async function generatePyramidCup() {
  const { firestore: db } = initializeFirebase();
  const CURRENT_SEASON_NUM = 1;
  const CURRENT_SEASON_ID = "season_1";
  const TARGET_DATE = "2026-06-17T20:00:00Z";

  console.log(`[CUP] Starting initialization: Round 1 Only for Season ${CURRENT_SEASON_NUM}`);

  for (const league of LEAGUES) {
    const batcher = new FirestoreBatcher(db);
    
    // 1. Сбор участников Дивизионов 2-9
    const q = query(
      collection(db, 'players_v10'),
      where('selectedLeagueId', '==', league.id),
      where('leagueLevel', '>', 1)
    );
    
    const snap = await getDocs(q);
    const lowerTeams = snap.docs.map(d => ({ 
      id: d.id, 
      rank: Number(d.data().rank || 8),
      level: Number(d.data().leagueLevel || 9)
    }));

    // Сортировка от сильных к слабым (уровень -> ранг)
    lowerTeams.sort((a, b) => a.level - b.level || a.rank - b.rank);

    // 2. Формируем пары "От края до края"
    let left = 0;
    let right = lowerTeams.length - 1;
    let matchNum = 1;

    while (left < right) {
      const strongTeam = lowerTeams[left];
      const weakTeam = lowerTeams[right];

      const matchId = `season_${CURRENT_SEASON_NUM}_league_${league.id}_round_1_match_${matchNum}`;

      await batcher.set(doc(db, 'cup_matches', matchId), {
        cupMatchId: matchId,
        seasonId: CURRENT_SEASON_ID,
        seasonNumber: CURRENT_SEASON_NUM,
        leagueId: league.id,
        round: 1,
        date: TARGET_DATE,
        homeTeamId: weakTeam.id, // Слабый дома
        awayTeamId: strongTeam.id, // Сильный в гостях
        status: 'scheduled',
        winnerId: null,
        createdAt: serverTimestamp()
      } as CupMatch);

      left++;
      right--;
      matchNum++;
    }

    // Если нечетное число - последний автоматом проходит (имитация завершенного матча)
    if (left === right) {
      const matchId = `season_${CURRENT_SEASON_NUM}_league_${league.id}_round_1_match_${matchNum}`;
      await batcher.set(doc(db, 'cup_matches', matchId), {
        cupMatchId: matchId,
        seasonId: CURRENT_SEASON_ID,
        seasonNumber: CURRENT_SEASON_NUM,
        leagueId: league.id,
        round: 1,
        date: TARGET_DATE,
        homeTeamId: lowerTeams[left].id,
        awayTeamId: null,
        status: 'finished',
        winnerId: lowerTeams[left].id,
        createdAt: serverTimestamp()
      } as CupMatch);
    }

    await batcher.commit();
  }
  
  return { success: true };
}

/**
 * РЕАКТИВНАЯ ГЕНЕРАЦИЯ СЛЕДУЮЩЕГО РАУНДА.
 * Вызывается после записи winnerId в матч.
 */
export async function checkAndGenerateNextRound(leagueId: string, seasonNumber: number, finishedRound: number) {
  const { firestore: db } = initializeFirebase();
  const seasonId = `season_${seasonNumber}`;

  // 1. Проверяем, остались ли незавершенные матчи в этом раунде для этой лиги
  const qActive = query(
    collection(db, 'cup_matches'),
    where('seasonId', '==', seasonId),
    where('leagueId', '==', leagueId),
    where('round', '==', finishedRound),
    where('status', '==', 'scheduled')
  );

  const activeSnap = await getDocs(qActive);
  if (!activeSnap.empty) {
    console.log(`[CUP] Round ${finishedRound} in ${leagueId} still active. ${activeSnap.size} matches left.`);
    return; // Раунд еще идет
  }

  console.log(`[CUP] Round ${finishedRound} in ${leagueId} COMPLETE. Generating Round ${finishedRound + 1}...`);

  // 2. Собираем всех победителей
  const qWinners = query(
    collection(db, 'cup_matches'),
    where('seasonId', '==', seasonId),
    where('leagueId', '==', leagueId),
    where('round', '==', finishedRound)
  );
  const winnersSnap = await getDocs(qWinners);
  const winnersIds = winnersSnap.docs.map(d => d.data().winnerId).filter(Boolean);

  let nextParticipants: string[] = [...winnersIds];

  // 3. Если завершился Раунд 1 - добавляем Дивизион 1
  if (finishedRound === 1) {
    const qDiv1 = query(
      collection(db, 'players_v10'),
      where('selectedLeagueId', '==', leagueId),
      where('leagueLevel', '==', 1)
    );
    const div1Snap = await getDocs(qDiv1);
    div1Snap.forEach(d => nextParticipants.push(d.id));
  }

  if (nextParticipants.length <= 1) {
    console.log(`[CUP] Tournament for ${leagueId} has ended. Champion found.`);
    return;
  }

  // 4. Получаем данные о силе участников для посева
  const participantsData: any[] = [];
  for (const teamId of nextParticipants) {
    // В прототипе используем players_v10 как источник силы
    const tDoc = await getDoc(doc(db, 'players_v10', teamId));
    if (tDoc.exists()) {
      const d = tDoc.data();
      participantsData.push({
        id: teamId,
        level: Number(d.leagueLevel || 9),
        rank: Number(d.rank || 8)
      });
    }
  }

  // Сортировка: Сильные вверх
  participantsData.sort((a, b) => a.level - b.level || a.rank - b.rank);

  // 5. Генерируем новый раунд
  const batcher = new FirestoreBatcher(db);
  const nextRoundNum = finishedRound + 1;
  const nextRoundDate = new Date().toISOString(); // В продакшене: текущая дата + сдвиг

  let left = 0;
  let right = participantsData.length - 1;
  let matchNum = 1;

  while (left < right) {
    const strong = participantsData[left];
    const weak = participantsData[right];
    const matchId = `season_${seasonNumber}_league_${leagueId}_round_${nextRoundNum}_match_${matchNum}`;

    await batcher.set(doc(db, 'cup_matches', matchId), {
      cupMatchId: matchId,
      seasonId,
      seasonNumber,
      leagueId,
      round: nextRoundNum,
      date: nextRoundDate,
      homeTeamId: weak.id,
      awayTeamId: strong.id,
      status: 'scheduled',
      winnerId: null,
      createdAt: serverTimestamp()
    });

    left++;
    right--;
    matchNum++;
  }

  // Обработка нечетного количества
  if (left === right) {
    const matchId = `season_${seasonNumber}_league_${leagueId}_round_${nextRoundNum}_match_${matchNum}`;
    await batcher.set(doc(db, 'cup_matches', matchId), {
      cupMatchId: matchId,
      seasonId,
      seasonNumber,
      leagueId,
      round: nextRoundNum,
      date: nextRoundDate,
      homeTeamId: participantsData[left].id,
      awayTeamId: null,
      status: 'finished',
      winnerId: participantsData[left].id,
      createdAt: serverTimestamp()
    });
  }

  await batcher.commit();
}
