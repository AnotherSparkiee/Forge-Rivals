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
import { getGlobalSeasonInfo, isMatchOverdue } from '@/app/lib/time-utils';
import { getMatchResult, LEAGUES } from '@/app/lib/leagues-data';

/**
 * ГЛАВНЫЙ СЕРВЕРНЫЙ РАСЧЕТ ГРУППЫ:
 * Находит ВСЕ просроченные матчи группы и выполняет атомарные транзакции.
 */
export async function forceResolveGroupMatches(leagueId: string, divisionId: number, groupId: string) {
  const { firestore: db } = initializeFirebase();
  const { activeSeasonNumber } = getGlobalSeasonInfo();
  const seasonId = `season_${activeSeasonNumber}`;
  const league = LEAGUES.find(l => l.id === leagueId) || LEAGUES[0];

  console.log(`[V16 ENGINE] Resolving group: ${groupId} (Season ${activeSeasonNumber})`);

  const q = query(
    collection(db, 'matches_v1'),
    where('groupId', '==', groupId),
    where('seasonId', '==', seasonId)
  );

  const snap = await getDocs(q);
  if (snap.empty) return { success: true, count: 0 };

  let resolvedCount = 0;

  for (const docSnap of snap.docs) {
    const m = docSnap.data();
    
    // ПРОВЕРКА V16: Через универсальный хелпер игрового времени
    const overdue = isMatchOverdue(m.day, league.startTime);
    const hasAnyScore = m.homeScore !== undefined || m.scoreA !== undefined;

    if (overdue && !hasAnyScore) {
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

      // 2. ОБНОВЛЯЕМ ТАБЛИЦЫ (Для реальных игроков и ботов)
      const updatePoints = (currentData: any, scoreSelf: number, scoreOpp: number) => {
        let w = (currentData?.wins || 0);
        let dr = (currentData?.draws || 0);
        let l = (currentData?.losses || 0);
        let p = (currentData?.points || 0);
        let played = (currentData?.played || 0);
        
        played++;
        if (scoreSelf > scoreOpp) { w++; p += 3; } 
        else if (scoreSelf < scoreOpp) { l++; } 
        else { dr++; p += 1; }
        
        return { 
          wins: w, draws: dr, losses: l, points: p, played,
          statString: `${w}-${dr}-${l}`, 
          updatedAt: serverTimestamp() 
        };
      };

      if (hRoot.exists()) {
        const update = updatePoints(hRoot.data(), sA, sB);
        transaction.update(homeRootRef, update);
        transaction.set(homeLeagueRef, update, { merge: true });
      } else {
        // Если это бот — обновляем только запись в лиге
        const hLeagueSnap = await transaction.get(homeLeagueRef);
        const update = updatePoints(hLeagueSnap.data(), sA, sB);
        transaction.set(homeLeagueRef, update, { merge: true });
      }

      if (aRoot.exists()) {
        const update = updatePoints(aRoot.data(), sB, sA);
        transaction.update(awayRootRef, update);
        transaction.set(awayLeagueRef, update, { merge: true });
      } else {
        const aLeagueSnap = await transaction.get(awayLeagueRef);
        const update = updatePoints(aLeagueSnap.data(), sB, sA);
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