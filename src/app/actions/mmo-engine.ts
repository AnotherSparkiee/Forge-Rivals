'use server';

/**
 * @fileOverview MMO-Двигатель v25 (Transactional Standings Resolution).
 * Прямая запись результатов в таблицы лиги через атомарные транзакции.
 */

import { 
  collection, doc, getDocs, 
  query, where, serverTimestamp, 
  runTransaction
} from 'firebase/firestore';
import { initializeFirebase } from '@/firebase';
import { isMatchOverdue, getGlobalSeasonInfo } from '@/app/lib/time-utils';
import { getMatchResult } from '@/app/lib/leagues-data';

/**
 * ГЛАВНЫЙ СЕРВЕРНЫЙ РЕЗОЛВЕР (v25):
 * Рассчитывает матчи группы и ОДНОВРЕМЕННО обновляет турнирную таблицу.
 */
export async function forceResolveGroupMatches(leagueId: string, divisionId: number, groupId: string) {
  const { firestore: db } = initializeFirebase();
  const seasonInfo = getGlobalSeasonInfo();
  
  console.log(`[V25 ENGINE] Resolving Group: ${groupId}`);

  // Query only matches for the CURRENT season that aren't finished
  const q = query(
    collection(db, 'matches_v1'),
    where('groupId', '==', groupId),
    where('seasonNumber', '==', seasonInfo.activeSeasonNumber),
    where('isFinished', '==', false)
  );

  const snap = await getDocs(q);
  if (snap.empty) {
    console.log(`[V25 ENGINE] No pending matches found for group ${groupId}`);
    return { success: true, count: 0 };
  }

  let resolvedCount = 0;

  for (const docSnap of snap.docs) {
    const m = docSnap.data();
    
    // Check if virtual game time has passed
    const overdue = isMatchOverdue(m.startTime);
    const hasAnyScore = m.homeScore !== undefined || m.scoreA !== undefined || m.status === 'finished';

    if (overdue && !hasAnyScore) {
      const [sA, sB] = getMatchResult(m.homeId, m.awayId, m.day, seasonInfo.activeSeasonNumber);
      const winnerId = sA > sB ? m.homeId : (sB > sA ? m.awayId : null);

      try {
        await runTransaction(db, async (transaction) => {
          // 1. ПОДГОТОВКА СТАТИСТИКИ ТАБЛИЦЫ
          // Path: leagues_v2 -> {leagueId} -> divisions -> {divId} -> groups -> {groupId} -> teams -> {userId}
          const teamARef = doc(db, 'leagues_v2', leagueId, 'divisions', String(divisionId), 'groups', groupId, 'teams', m.homeId);
          const teamBRef = doc(db, 'leagues_v2', leagueId, 'divisions', String(divisionId), 'groups', groupId, 'teams', m.awayId);

          const snapA = await transaction.get(teamARef);
          const snapB = await transaction.get(teamBRef);

          const dataA = snapA.exists() ? snapA.data() : { wins: 0, draws: 0, losses: 0, points: 0, name: m.homeName };
          const dataB = snapB.exists() ? snapB.data() : { wins: 0, draws: 0, losses: 0, points: 0, name: m.awayName };

          // Update Team A
          transaction.set(teamARef, {
            ...dataA,
            wins: (dataA.wins || 0) + (sA > sB ? 1 : 0),
            draws: (dataA.draws || 0) + (sA === sB ? 1 : 0),
            losses: (dataA.losses || 0) + (sB > sA ? 1 : 0),
            points: (dataA.points || 0) + (sA > sB ? 3 : (sA === sB ? 1 : 0)),
            lastMatchDay: m.day,
            updatedAt: serverTimestamp()
          }, { merge: true });

          // Update Team B
          transaction.set(teamBRef, {
            ...dataB,
            wins: (dataB.wins || 0) + (sB > sA ? 1 : 0),
            draws: (dataB.draws || 0) + (sA === sB ? 1 : 0),
            losses: (dataB.losses || 0) + (sA > sB ? 1 : 0),
            points: (dataB.points || 0) + (sB > sA ? 3 : (sA === sB ? 1 : 0)),
            lastMatchDay: m.day,
            updatedAt: serverTimestamp()
          }, { merge: true });

          // 2. ОБНОВЛЕНИЕ МАТЧА (Standings-First)
          transaction.update(docSnap.ref, {
            homeScore: sA, awayScore: sB,
            scoreA: sA, scoreB: sB,
            winnerId,
            status: 'finished',
            isFinished: true,
            finishedAt: serverTimestamp(),
            version: 25
          });
        });
        resolvedCount++;
        console.log(`[V25 ENGINE] Resolved match: ${docSnap.id} (${sA}:${sB})`);
      } catch (e) {
        console.error(`[V25 CRITICAL] Transaction failed for ${docSnap.id}:`, e);
      }
    }
  }

  return { success: true, count: resolvedCount };
}