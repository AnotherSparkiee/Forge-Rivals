'use server';

/**
 * @fileOverview Глобальный MMO-Двигатель v10.
 * Ультимативное решение проблемы "WAITING": транзакционный расчет и мгновенный апдейт таблиц.
 */

import { 
  collection, doc, getDocs, writeBatch, 
  query, where, serverTimestamp, 
  runTransaction, Firestore, Timestamp
} from 'firebase/firestore';
import { initializeFirebase } from '@/firebase';
import { getMoscowTime, getGlobalSeasonInfo } from '@/app/lib/time-utils';
import { getMatchResult } from '@/app/lib/leagues-data';

/**
 * ЭКСТРЕННОЕ ПРОТАЛКИВАНИЕ (Anti-WAITING): 
 * Находит матчи, время которых прошло, симулирует результат и обновляет таблицы через транзакции.
 */
export async function forceResolveLeagueMatches() {
  const { firestore: db } = initializeFirebase();
  const { seasonNumber } = getGlobalSeasonInfo();
  const seasonId = `season_${seasonNumber}`;
  const mskNow = getMoscowTime();

  console.log(`[ENGINE v10] Starting Autonomous Resolution for Season ${seasonNumber}...`);

  // Ищем все матчи, которые не в статусе finished
  const q = query(
    collection(db, 'matches_v1'),
    where('seasonId', '==', seasonId),
    where('status', 'in', ['pending', 'scheduled', 'waiting'])
  );

  const snap = await getDocs(q);
  if (snap.empty) return { success: true, count: 0 };

  let resolvedCount = 0;

  for (const docSnap of snap.docs) {
    const m = docSnap.data();
    const startTime = new Date(m.startTime).getTime();
    
    // Если время матча прошло (+5 секунд буфера для надежности)
    if (mskNow.getTime() > startTime + 5000) {
      const [sA, sB] = getMatchResult(m.homeId, m.awayId, m.day, seasonNumber);
      
      // Выполняем транзакционный пересчет очков и закрытие матча
      await syncMatchResultsWithTransaction(db, m.homeId, m.awayId, sA, sB, m, seasonNumber, docSnap.id);
      resolvedCount++;
    }
  }

  console.log(`[ENGINE v10] Cycle complete. Resolved: ${resolvedCount}`);
  return { success: true, count: resolvedCount };
}

/**
 * ТРАНЗАКЦИОННЫЙ ПЕРЕСЧЕТ: 
 * Гарантирует, что очки будут начислены корректно в профиль игрока и в таблицу лиги одновременно.
 */
async function syncMatchResultsWithTransaction(
  db: Firestore, 
  homeId: string, 
  awayId: string, 
  sA: number, 
  sB: number,
  matchData: any,
  seasonNumber: number,
  matchDocId: string
) {
  // Пути к профилям (players_v10)
  const homeProfileRef = doc(db, 'players_v10', homeId);
  const awayProfileRef = doc(db, 'players_v10', awayId);

  // Пути к командам внутри структуры лиги (leagues_v2)
  const homeTeamRef = doc(db, 'leagues_v2', matchData.leagueId, 'divisions', String(matchData.divisionId), 'groups', matchData.groupId, 'teams', homeId);
  const awayTeamRef = doc(db, 'leagues_v2', matchData.leagueId, 'divisions', String(matchData.divisionId), 'groups', matchData.groupId, 'teams', awayId);
  
  // Путь к самому матчу
  const matchRef = doc(db, 'matches_v1', matchDocId);

  const winnerId = sA > sB ? homeId : (sB > sA ? awayId : null);
  const winnerName = sA > sB ? matchData.homeName : (sB > sA ? matchData.awayName : "Draw");

  try {
    await runTransaction(db, async (transaction) => {
      const hProf = await transaction.get(homeProfileRef);
      const aProf = await transaction.get(awayProfileRef);
      
      const hTeam = await transaction.get(homeTeamRef);
      const aTeam = await transaction.get(awayTeamRef);

      // 1. Обработка Хозяев
      if (hProf.exists()) {
        const d = hProf.data();
        let w = d.wins || 0, dr = d.draws || 0, l = d.losses || 0, p = d.points || 0;
        if (sA > sB) { w++; p += 3; } else if (sA < sB) { l++; } else { dr++; p += 1; }
        const update = { wins: w, draws: dr, losses: l, points: p, statString: `${w}-${dr}-${l}`, lastStandingsSync: serverTimestamp() };
        transaction.update(homeProfileRef, update);
        if (hTeam.exists()) transaction.update(homeTeamRef, update);
      }

      // 2. Обработка Гостей
      if (aProf.exists()) {
        const d = aProf.data();
        let w = d.wins || 0, dr = d.draws || 0, l = d.losses || 0, p = d.points || 0;
        if (sB > sA) { w++; p += 3; } else if (sB < sA) { l++; } else { dr++; p += 1; }
        const update = { wins: w, draws: dr, losses: l, points: p, statString: `${w}-${dr}-${l}`, lastStandingsSync: serverTimestamp() };
        transaction.update(awayProfileRef, update);
        if (aTeam.exists()) transaction.update(awayTeamRef, update);
      }

      // 3. Финализация матча со всеми байпасс-флагами
      transaction.update(matchRef, {
        status: 'finished',
        matchStatus: 'finished',
        state: 'finished',
        isFinished: true,
        isCompleted: true,
        scoreA: sA,
        scoreB: sB,
        homeScore: sA,
        awayScore: sB,
        winnerId: winnerId,
        finishedAt: serverTimestamp(),
        simulation: {
          winner: winnerName,
          seriesScore: `${sA}-${sB}`,
          games: [{ 
            scoreA: sA > 0 ? 1 : 0, 
            scoreB: sB > 0 ? 1 : 0, 
            duration: "35:00", 
            matchSummary: "Battle concluded by Autonomous Resolution Engine." 
          }]
        }
      });
    });
    console.log(`[SUCCESS] Match ${matchDocId} resolved and standings updated.`);
  } catch (e) {
    console.error(`[Transaction Error] Match ${matchDocId}:`, e);
  }
}
