'use server';

/**
 * @fileOverview MMO-Двигатель v25 (Transactional Standings Resolution).
 * Прямая запись результатов в таблицы лиги через атомарные транзакции.
 */

import { 
  collection, doc, getDocs, 
  query, where, serverTimestamp, 
  runTransaction, getDoc
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

  const q = query(
    collection(db, 'matches_v1'),
    where('groupId', '==', groupId),
    where('seasonNumber', '==', seasonInfo.activeSeasonNumber)
  );

  const snap = await getDocs(q);
  if (snap.empty) return { success: true, count: 0 };

  let resolvedCount = 0;

  for (const docSnap of snap.docs) {
    const m = docSnap.data();
    
    // Проверка виртуального времени
    const overdue = isMatchOverdue(m.startTime);
    const hasAnyScore = m.homeScore !== undefined || m.scoreA !== undefined || m.status === 'finished';

    if (overdue && !hasAnyScore) {
      const [sA, sB] = getMatchResult(m.homeId, m.awayId, m.day, seasonInfo.activeSeasonNumber);
      const winnerId = sA > sB ? m.homeId : (sB > sA ? m.awayId : null);

      try {
        await runTransaction(db, async (transaction) => {
          // 1. ПОДГОТОВКА СТАТИСТИКИ ТАБЛИЦЫ
          const teamARef = doc(db, 'leagues_v2', leagueId, 'divisions', String(divisionId), 'groups', groupId, 'teams', m.homeId);
          const teamBRef = doc(db, 'leagues_v2', leagueId, 'divisions', String(divisionId), 'groups', groupId, 'teams', m.awayId);

          const snapA = await transaction.get(teamARef);
          const snapB = await transaction.get(teamBRef);

          if (snapA.exists()) {
            const data = snapA.data();
            const wins = (data.wins || 0) + (sA > sB ? 1 : 0);
            const draws = (data.draws || 0) + (sA === sB ? 1 : 0);
            const points = (data.points || 0) + (sA > sB ? 3 : (sA === sB ? 1 : 0));
            transaction.update(teamARef, { wins, draws, points, lastMatchDay: m.day });
          }

          if (snapB.exists()) {
            const data = snapB.data();
            const wins = (data.wins || 0) + (sB > sA ? 1 : 0);
            const draws = (data.draws || 0) + (sA === sB ? 1 : 0);
            const points = (data.points || 0) + (sB > sA ? 3 : (sA === sB ? 1 : 0));
            transaction.update(teamBRef, { wins, draws, points, lastMatchDay: m.day });
          }

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
      } catch (e) {
        console.error(`[V25 CRITICAL] Transaction failed for ${docSnap.id}:`, e);
      }
    }
  }

  return { success: true, count: resolvedCount };
}
