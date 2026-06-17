'use server';

/**
 * @fileOverview Ультимативный MMO-Двигатель v15 (Standings-First Architecture).
 * Серверный расчет результатов лиги.
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
 * ГЛАВНЫЙ СЕРВЕРНЫЙ РАСЧЕТ:
 * Находит ВСЕ просроченные матчи группы и выполняет транзакционное обновление таблиц и матчей.
 */
export async function forceResolveGroupMatches(leagueId: string, divisionId: number, groupId: string) {
  const { firestore: db } = initializeFirebase();
  const { seasonNumber } = getGlobalSeasonInfo();
  const seasonId = `season_${seasonNumber}`;

  console.log(`[SERVER-ACTION] Resolving Standings for group: ${groupId}`);

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
    
    // Если время матча наступило (08:00 / 20:00 и т.д.) и счета еще нет
    const isOverdue = startTime > 0 && mskNow > startTime;
    const isNotFinished = !m.isFinished && m.homeScore === undefined;

    if (isOverdue && isNotFinished) {
      const [sA, sB] = getMatchResult(m.homeId, m.awayId, m.day, seasonNumber);
      await runTableFirstTransaction(db, m, sA, sB, docSnap.id);
      resolvedCount++;
    }
  }

  return { success: true, count: resolvedCount };
}

/**
 * АТОМАРНАЯ ТРАНЗАКЦИЯ: ТАБЛИЦА -> МАТЧ
 * Гарантирует, что очки начисляются в первую очередь.
 */
async function runTableFirstTransaction(
  db: Firestore, 
  matchData: any,
  sA: number, 
  sB: number,
  matchDocId: string
) {
  const { homeId, awayId, leagueId, divisionId, groupId } = matchData;

  // Пути к данным команд
  const homeRootRef = doc(db, 'players_v10', homeId);
  const awayRootRef = doc(db, 'players_v10', awayId);
  const homeTeamRef = doc(db, 'leagues_v2', leagueId, 'divisions', String(divisionId), 'groups', groupId, 'teams', homeId);
  const awayTeamRef = doc(db, 'leagues_v2', leagueId, 'divisions', String(divisionId), 'groups', groupId, 'teams', awayId);
  const matchRef = doc(db, 'matches_v1', matchDocId);
  
  const winnerId = sA > sB ? homeId : (sB > sA ? awayId : null);

  try {
    await runTransaction(db, async (transaction) => {
      // 1. ЧИТАЕМ ТЕКУЩИЕ ДАННЫЕ
      const hRoot = await transaction.get(homeRootRef);
      const aRoot = await transaction.get(awayRootRef);

      // 2. ОБНОВЛЯЕМ ТАБЛИЦЫ (STANDINGS FIRST)
      if (hRoot.exists()) {
        const d = hRoot.data();
        let w = d.wins || 0, dr = d.draws || 0, l = d.losses || 0, p = d.points || 0;
        if (sA > sB) { w++; p += 3; } else if (sA < sB) { l++; } else { dr++; p += 1; }
        const update = { 
          wins: w, draws: dr, losses: l, points: p, 
          statString: `${w}-${dr}-${l}`, 
          updatedAt: serverTimestamp() 
        };
        transaction.update(homeRootRef, update);
        transaction.update(homeTeamRef, update);
      }

      if (aRoot.exists()) {
        const d = aRoot.data();
        let w = d.wins || 0, dr = d.draws || 0, l = d.losses || 0, p = d.points || 0;
        if (sB > sA) { w++; p += 3; } else if (sB < sA) { l++; } else { dr++; p += 1; }
        const update = { 
          wins: w, draws: dr, losses: l, points: p, 
          statString: `${w}-${dr}-${l}`, 
          updatedAt: serverTimestamp() 
        };
        transaction.update(awayRootRef, update);
        transaction.update(awayTeamRef, update);
      }

      // 3. ЗАКРЫВАЕМ МАТЧ (ПОСЛЕДНИЙ ШАГ)
      transaction.update(matchRef, {
        homeScore: sA, 
        awayScore: sB,
        scoreA: sA, 
        scoreB: sB,
        winnerId: winnerId,
        status: 'finished', 
        matchStatus: 'finished',
        isFinished: true, 
        isCompleted: true,
        finishedAt: serverTimestamp()
      });
    });
    console.log(`[SUCCESS] Match ${matchDocId} resolved and points awarded.`);
  } catch (e) {
    console.error(`[TX FAIL] Match ${matchDocId}:`, e);
  }
}
