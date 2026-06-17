'use server';

/**
 * @fileOverview Глобальный MMO-Двигатель v11 (Server-First).
 * Ультимативное решение: расчет таблицы В ПЕРВУЮ ОЧЕРЕДЬ.
 */

import { 
  collection, doc, getDocs, 
  query, where, serverTimestamp, 
  runTransaction, Firestore, Timestamp
} from 'firebase/firestore';
import { initializeFirebase } from '@/firebase';
import { getMoscowTime, getGlobalSeasonInfo } from '@/app/lib/time-utils';
import { getMatchResult } from '@/app/lib/leagues-data';

/**
 * ЭКСТРЕННОЕ ПРОТАЛКИВАНИЕ (Server Authority): 
 * Находит матчи, время которых прошло, и проводит транзакционный расчет.
 */
export async function forceResolveLeagueMatches() {
  const { firestore: db } = initializeFirebase();
  const { seasonNumber } = getGlobalSeasonInfo();
  const seasonId = `season_${seasonNumber}`;
  const mskNow = getMoscowTime();

  console.log(`[SERVER ENGINE v11] Autonomous Resolution Cycle for Season ${seasonNumber}...`);

  // Ищем матчи, которые не в статусе finished
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
    
    // Если время матча прошло (+5 секунд буфера)
    if (mskNow.getTime() > startTime + 5000) {
      const [sA, sB] = getMatchResult(m.homeId, m.awayId, m.day, seasonNumber);
      
      // Выполняем транзакционный пересчет очков и закрытие матча
      await syncMatchStandingsWithTransaction(db, m, sA, sB, seasonNumber, docSnap.id);
      resolvedCount++;
    }
  }

  console.log(`[SERVER ENGINE v11] Cycle complete. Resolved: ${resolvedCount}`);
  return { success: true, count: resolvedCount };
}

/**
 * ТРАНЗАКЦИОННЫЙ ПЕРЕСЧЕТ ТАБЛИЦЫ (STANDINGS FIRST): 
 * Гарантирует, что очки начисляются ДО или одновременно с закрытием матча.
 */
async function syncMatchStandingsWithTransaction(
  db: Firestore, 
  matchData: any,
  sA: number, 
  sB: number,
  seasonNumber: number,
  matchDocId: string
) {
  const { homeId, awayId, leagueId, divisionId, groupId } = matchData;

  // Пути к мастер-профилям
  const homeRootRef = doc(db, 'players_v10', homeId);
  const awayRootRef = doc(db, 'players_v10', awayId);

  // Пути к локальным командам в лиге
  const homeTeamRef = doc(db, 'leagues_v2', leagueId, 'divisions', String(divisionId), 'groups', groupId, 'teams', homeId);
  const awayTeamRef = doc(db, 'leagues_v2', leagueId, 'divisions', String(divisionId), 'groups', groupId, 'teams', awayId);
  
  const matchRef = doc(db, 'matches_v1', matchDocId);

  const winnerId = sA > sB ? homeId : (sB > sA ? awayId : null);
  const winnerName = sA > sB ? matchData.homeName : (sB > sA ? matchData.awayName : "Draw");

  try {
    await runTransaction(db, async (transaction) => {
      const hRoot = await transaction.get(homeRootRef);
      const aRoot = await transaction.get(awayRootRef);
      const hTeam = await transaction.get(homeTeamRef);
      const aTeam = await transaction.get(awayTeamRef);

      // 1. Обработка Хозяев (Wins/Draws/Losses)
      if (hRoot.exists()) {
        const d = hRoot.data();
        let w = d.wins || 0, dr = d.draws || 0, l = d.losses || 0, p = d.points || 0;
        if (sA > sB) { w++; p += 3; } else if (sA < sB) { l++; } else { dr++; p += 1; }
        const update = { wins: w, draws: dr, losses: l, points: p, statString: `${w}-${dr}-${l}`, lastProcessedMatch: matchDocId };
        transaction.update(homeRootRef, update);
        if (hTeam.exists()) transaction.update(homeTeamRef, update);
      }

      // 2. Обработка Гостей
      if (aRoot.exists()) {
        const d = aRoot.data();
        let w = d.wins || 0, dr = d.draws || 0, l = d.losses || 0, p = d.points || 0;
        if (sB > sA) { w++; p += 3; } else if (sB < sA) { l++; } else { dr++; p += 1; }
        const update = { wins: w, draws: dr, losses: l, points: p, statString: `${w}-${dr}-${l}`, lastProcessedMatch: matchDocId };
        transaction.update(awayRootRef, update);
        if (aTeam.exists()) transaction.update(awayTeamRef, update);
      }

      // 3. ФИНАЛИЗАЦИЯ МАТЧА (Total Bypass Statuses)
      transaction.update(matchRef, {
        status: 'finished',
        matchStatus: 'finished',
        state: 'finished',
        isFinished: true,
        isCompleted: true,
        homeScore: sA,
        awayScore: sB,
        scoreA: sA,
        scoreB: sB,
        winnerId: winnerId,
        finishedAt: serverTimestamp(),
        simulation: {
          winner: winnerName,
          seriesScore: `${sA}-${sB}`,
          games: [{ 
            scoreA: sA > 0 ? 1 : 0, 
            scoreB: sB > 0 ? 1 : 0, 
            duration: "35:00", 
            matchSummary: "Transaction finalized by Server Authority." 
          }]
        }
      });
    });
    console.log(`[SUCCESS] Standings updated and match ${matchDocId} closed.`);
  } catch (e) {
    console.error(`[TRANSACTION FAILED] Match ${matchDocId}:`, e);
  }
}