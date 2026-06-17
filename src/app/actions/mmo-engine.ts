'use server';

/**
 * @fileOverview Глобальный MMO-Двигатель v12 (Calibration Mode).
 * Ультимативное решение: жесткий пересчет таблиц и срыв статуса WAITING.
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
 * ЖЕСТКАЯ КАЛИБРОВКА (Step-by-Step Sync):
 * 1. Находит матчи за 2026-06-17.
 * 2. Генерирует результат.
 * 3. Транзакционно обновляет таблицы (Wins/Points).
 * 4. Закрывает матч всеми возможными флагами.
 */
export async function forceResolveLeagueMatches() {
  const { firestore: db } = initializeFirebase();
  const { seasonNumber } = getGlobalSeasonInfo();
  const seasonId = `season_${seasonNumber}`;
  const CURRENT_DATE_STR = "2026-06-17"; 

  console.log(`[V12 CALIBRATION] Starting forced sync for ${CURRENT_DATE_STR}...`);

  const q = query(
    collection(db, 'matches_v1'),
    where('seasonId', '==', seasonId),
    where('status', 'in', ['pending', 'scheduled', 'waiting', 'playing'])
  );

  const snap = await getDocs(q);
  if (snap.empty) return { success: true, count: 0 };

  let resolvedCount = 0;

  for (const docSnap of snap.docs) {
    const m = docSnap.data();
    
    // Фильтр по дате из ТЗ
    if (m.startTime && m.startTime.includes(CURRENT_DATE_STR)) {
      const [sA, sB] = getMatchResult(m.homeId, m.awayId, m.day, seasonNumber);
      
      // ВЫПОЛНЯЕМ ШАГ 1 и 2 (Сначала таблицы, потом матч)
      await runCalibrationTransaction(db, m, sA, sB, docSnap.id);
      resolvedCount++;
    }
  }

  console.log(`[V12 CALIBRATION] Success. Resolved: ${resolvedCount}`);
  return { success: true, count: resolvedCount };
}

async function runCalibrationTransaction(
  db: Firestore, 
  matchData: any,
  sA: number, 
  sB: number,
  matchDocId: string
) {
  const { homeId, awayId, leagueId, divisionId, groupId, homeName, awayName } = matchData;

  // Пути к мастер-профилям
  const homeRootRef = doc(db, 'players_v10', homeId);
  const awayRootRef = doc(db, 'players_v10', awayId);

  // Пути к локальным командам в лиге
  const homeTeamRef = doc(db, 'leagues_v2', leagueId, 'divisions', String(divisionId), 'groups', groupId, 'teams', homeId);
  const awayTeamRef = doc(db, 'leagues_v2', leagueId, 'divisions', String(divisionId), 'groups', groupId, 'teams', awayId);
  
  const matchRef = doc(db, 'matches_v1', matchDocId);
  const winnerId = sA > sB ? homeId : (sB > sA ? awayId : null);

  try {
    await runTransaction(db, async (transaction) => {
      const hRoot = await transaction.get(homeRootRef);
      const aRoot = await transaction.get(awayRootRef);

      // ШАГ 1: ПРЯМОЙ ПЕРЕСЧЕТ ТАБЛИЦ (Приоритет №1)
      if (hRoot.exists()) {
        const d = hRoot.data();
        let w = d.wins || 0, dr = d.draws || 0, l = d.losses || 0, p = d.points || 0;
        if (sA > sB) { w++; p += 3; } else if (sA < sB) { l++; } else { dr++; p += 1; }
        const update = { wins: w, draws: dr, losses: l, points: p, statString: `${w}-${dr}-${l}` };
        transaction.update(homeRootRef, update);
        transaction.update(homeTeamRef, update);
      }

      if (aRoot.exists()) {
        const d = aRoot.data();
        let w = d.wins || 0, dr = d.draws || 0, l = d.losses || 0, p = d.points || 0;
        if (sB > sA) { w++; p += 3; } else if (sB < sA) { l++; } else { dr++; p += 1; }
        const update = { wins: w, draws: dr, losses: l, points: p, statString: `${w}-${dr}-${l}` };
        transaction.update(awayRootRef, update);
        transaction.update(awayTeamRef, update);
      }

      // ШАГ 2: УНИЧТОЖЕНИЕ ПЛАШКИ WAITING (Жесткий оверрайд статусов)
      transaction.update(matchRef, {
        homeScore: sA,
        awayScore: sB,
        scoreA: sA,
        scoreB: sB,
        winnerId: winnerId,
        status: 'finished',
        matchStatus: 'finished',
        state: 'finished',
        isFinished: true,
        isCompleted: true,
        finishedAt: serverTimestamp()
      });
    });
  } catch (e) {
    console.error(`[CALIBRATION FAILED] ${matchDocId}:`, e);
  }
}
