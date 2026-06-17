'use server';

/**
 * @fileOverview Ультимативный MMO-Двигатель v16 (Absolute Standings Priority).
 * Серверный расчет результатов лиги с гарантированным обновлением таблиц.
 */

import { 
  collection, doc, getDocs, 
  query, where, serverTimestamp, 
  runTransaction, Firestore, getDoc
} from 'firebase/firestore';
import { initializeFirebase } from '@/firebase';
import { getGlobalSeasonInfo, getMoscowTime } from '@/app/lib/time-utils';
import { getMatchResult } from '@/app/lib/leagues-data';

/**
 * ГЛАВНЫЙ СЕРВЕРНЫЙ РАСЧЕТ ГРУППЫ:
 * Находит ВСЕ просроченные матчи группы и выполняет атомарные транзакции.
 */
export async function forceResolveGroupMatches(leagueId: string, divisionId: number, groupId: string) {
  const { firestore: db } = initializeFirebase();
  const { activeSeasonNumber } = getGlobalSeasonInfo();
  const seasonId = `season_${activeSeasonNumber}`;

  console.log(`[V16 ENGINE] Resolving group: ${groupId} (Season ${activeSeasonNumber})`);

  const q = query(
    collection(db, 'matches_v1'),
    where('groupId', '==', groupId),
    where('seasonId', '==', seasonId)
  );

  const snap = await getDocs(q);
  if (snap.empty) return { success: true, count: 0 };

  let resolvedCount = 0;
  const mskNow = getMoscowTime().getTime();

  for (const docSnap of snap.docs) {
    const m = docSnap.data();
    const startTime = m.startTime ? new Date(m.startTime).getTime() : 0;
    
    // ПРОВЕРКА V16: Только если времени прошло больше 5 сек и счета НЕТ НИГДЕ
    const isOverdue = startTime > 0 && mskNow > (startTime + 5000);
    const hasAnyScore = m.homeScore !== undefined || m.scoreA !== undefined;

    if (isOverdue && !hasAnyScore) {
      const [sA, sB] = getMatchResult(m.homeId, m.awayId, m.day, activeSeasonNumber);
      await runAbsoluteTransaction(db, m, sA, sB, docSnap.id, seasonId);
      resolvedCount++;
    }
  }

  return { success: true, count: resolvedCount };
}

/**
 * АБСОЛЮТНАЯ ТРАНЗАКЦИЯ V16: ТАБЛИЦЫ -> МАТЧ
 * Очки начисляются ПЕРЕД закрытием матча.
 */
async function runAbsoluteTransaction(
  db: Firestore, 
  matchData: any,
  sA: number, 
  sB: number,
  matchDocId: string,
  seasonId: string
) {
  const { homeId, awayId, leagueId, divisionId, groupId } = matchData;

  const homeRootRef = doc(db, 'players_v10', homeId);
  const awayRootRef = doc(db, 'players_v10', awayId);
  
  const homeLeagueRef = doc(db, 'leagues_v2', leagueId, 'divisions', String(divisionId), 'groups', groupId, 'teams', homeId);
  const awayLeagueRef = doc(db, 'leagues_v2', leagueId, 'divisions', String(divisionId), 'groups', groupId, 'teams', awayId);
  
  const matchRef = doc(db, 'matches_v1', matchDocId);
  const winnerId = sA > sB ? homeId : (sB > sA ? awayId : null);

  try {
    await runTransaction(db, async (transaction) => {
      // 1. ПОЛУЧАЕМ ТЕКУЩИЕ ДАННЫЕ
      const hRoot = await transaction.get(homeRootRef);
      const aRoot = await transaction.get(awayRootRef);

      // 2. ОБНОВЛЯЕМ ТАБЛИЦЫ (STANDINGS)
      if (hRoot.exists()) {
        const d = hRoot.data();
        let w = d.wins || 0, dr = d.draws || 0, l = d.losses || 0, p = d.points || 0, played = d.played || 0;
        played++;
        if (sA > sB) { w++; p += 3; } else if (sA < sB) { l++; } else { dr++; p += 1; }
        const update = { 
          wins: w, draws: dr, losses: l, points: p, played,
          statString: `${w}-${dr}-${l}`, 
          updatedAt: serverTimestamp() 
        };
        transaction.update(homeRootRef, update);
        transaction.set(homeLeagueRef, update, { merge: true });
      }

      if (aRoot.exists()) {
        const d = aRoot.data();
        let w = d.wins || 0, dr = d.draws || 0, l = d.losses || 0, p = d.points || 0, played = d.played || 0;
        played++;
        if (sB > sA) { w++; p += 3; } else if (sB < sA) { l++; } else { dr++; p += 1; }
        const update = { 
          wins: w, draws: dr, losses: l, points: p, played,
          statString: `${w}-${dr}-${l}`, 
          updatedAt: serverTimestamp() 
        };
        transaction.update(awayRootRef, update);
        transaction.set(awayLeagueRef, update, { merge: true });
      }

      // 3. ЗАКРЫВАЕМ МАТЧ (TOTAL BYPASS)
      transaction.update(matchRef, {
        homeScore: sA, awayScore: sB,
        scoreA: sA, scoreB: sB,
        winnerId: winnerId,
        status: 'finished', 
        matchStatus: 'finished',
        state: 'finished',
        isFinished: true, 
        isCompleted: true,
        finishedAt: serverTimestamp()
      });
    });
    console.log(`[V16 SUCCESS] Match ${matchDocId} resolved.`);
  } catch (e) {
    console.error(`[V16 FAIL] Match ${matchDocId}:`, e);
  }
}
