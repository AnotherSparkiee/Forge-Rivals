'use server';

/**
 * @fileOverview Глобальный MMO-Двигатель v9.
 * Ультимативное решение проблемы "WAITING": тотальное дублирование статусов и транзакционный пересчет таблиц.
 */

import { 
  collection, doc, getDocs, getDoc, writeBatch, 
  query, where, serverTimestamp, setDoc, updateDoc, 
  runTransaction, Firestore, Timestamp
} from 'firebase/firestore';
import { initializeFirebase } from '@/firebase';
import { getMoscowTime, getGlobalSeasonInfo } from '@/app/lib/time-utils';
import { getMatchResult } from '@/app/lib/leagues-data';

/**
 * ЭКСТРЕННОЕ ПРОТАЛКИВАНИЕ (Anti-WAITING): 
 * Находит матчи, время которых прошло, и принудительно закрывает их всеми возможными флагами.
 */
export async function forceResolveLeagueMatches() {
  const { firestore: db } = initializeFirebase();
  const { seasonNumber } = getGlobalSeasonInfo();
  const seasonId = `season_${seasonNumber}`;
  const mskNow = getMoscowTime();

  console.log(`[ENGINE v9] Starting Emergency Resolution for Season ${seasonNumber}...`);

  // Ищем все матчи, которые не в статусе finished
  const q = query(
    collection(db, 'matches_v1'),
    where('seasonId', '==', seasonId),
    where('status', '!=', 'finished')
  );

  const snap = await getDocs(q);
  if (snap.empty) return { success: true, count: 0 };

  let resolvedCount = 0;
  let batch = writeBatch(db);

  for (const docSnap of snap.docs) {
    const m = docSnap.data();
    const startTime = new Date(m.startTime).getTime();
    
    // Если время матча прошло (+1 минута буфера)
    if (mskNow.getTime() > startTime + 60000) {
      const [sA, sB] = getMatchResult(m.homeId, m.awayId, m.day, seasonNumber);
      const winnerId = sA > sB ? m.homeId : (sB > sA ? m.awayId : null);
      const winnerName = sA > sB ? m.homeName : (sB > sA ? m.awayName : "Draw");

      const finishedData = {
        // ТОТАЛЬНОЕ ДУБЛИРОВАНИЕ СТАТУСОВ ДЛЯ ФРОНТЕНДА
        status: 'finished',
        matchStatus: 'finished',
        state: 'finished',
        isFinished: true,
        isCompleted: true,
        
        // РЕЗУЛЬТАТЫ
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
            matchSummary: "Combat concluded. All status flags bypassed." 
          }]
        }
      };

      batch.update(docSnap.ref, finishedData);
      resolvedCount++;

      // Выполняем транзакционный пересчет очков для этого конкретного матча
      await syncMatchResultsWithTransaction(db, m.homeId, m.awayId, sA, sB, m, seasonNumber);

      if (resolvedCount % 450 === 0) {
        await batch.commit();
        batch = writeBatch(db);
      }
    }
  }

  if (resolvedCount > 0) {
    await batch.commit();
    console.log(`[ENGINE v9] Total resolved: ${resolvedCount}`);
  }

  return { success: true, count: resolvedCount };
}

/**
 * ТРАНЗАКЦИОННЫЙ ПЕРЕСЧЕТ: 
 * Гарантирует, что очки будут начислены корректно в профиль игрока и в документ команды внутри лиги.
 */
async function syncMatchResultsWithTransaction(
  db: Firestore, 
  homeId: string, 
  awayId: string, 
  sA: number, 
  sB: number,
  matchData: any,
  seasonNumber: number
) {
  const seasonId = `season_${seasonNumber}`;
  
  // Пути к профилям (players_v10)
  const homeProfileRef = doc(db, 'players_v10', homeId);
  const awayProfileRef = doc(db, 'players_v10', awayId);

  // Пути к командам внутри структуры лиги (leagues_v2)
  const homeTeamRef = doc(db, 'leagues_v2', matchData.leagueId, 'divisions', String(matchData.divisionId), 'groups', matchData.groupId, 'teams', homeId);
  const awayTeamRef = doc(db, 'leagues_v2', matchData.leagueId, 'divisions', String(matchData.divisionId), 'groups', matchData.groupId, 'teams', awayId);

  try {
    await runTransaction(db, async (transaction) => {
      const hProf = await transaction.get(homeProfileRef);
      const aProf = await transaction.get(awayProfileRef);

      // 1. Обработка Хозяев
      if (hProf.exists()) {
        const d = hProf.data();
        let w = d.wins || 0, dr = d.draws || 0, l = d.losses || 0, p = d.points || 0;
        if (sA > sB) { w++; p += 3; } else if (sA < sB) { l++; } else { dr++; p += 1; }
        const update = { wins: w, draws: dr, losses: l, points: p, statString: `${w}-${dr}-${l}`, lastStandingsSync: serverTimestamp() };
        transaction.update(homeProfileRef, update);
        if ((await transaction.get(homeTeamRef)).exists()) transaction.update(homeTeamRef, update);
      }

      // 2. Обработка Гостей
      if (aProf.exists()) {
        const d = aProf.data();
        let w = d.wins || 0, dr = d.draws || 0, l = d.losses || 0, p = d.points || 0;
        if (sB > sA) { w++; p += 3; } else if (sB < sA) { l++; } else { dr++; p += 1; }
        const update = { wins: w, draws: dr, losses: l, points: p, statString: `${w}-${dr}-${l}`, lastStandingsSync: serverTimestamp() };
        transaction.update(awayProfileRef, update);
        if ((await transaction.get(awayTeamRef)).exists()) transaction.update(awayTeamRef, update);
      }
    });
  } catch (e) {
    console.error(`[Transaction Error] Match ${matchData.id}:`, e);
  }
}
