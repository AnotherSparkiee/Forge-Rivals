'use server';

/**
 * @fileOverview MMO-Двигатель v27 (Strict Types Resolution).
 * Исключает использование строковых дат и undefined в запросах.
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
 * ГЛАВНЫЙ СЕРВЕРНЫЙ РЕЗОЛВЕР (v27):
 * Рассчитывает матчи группы и ОДНОВРЕМЕННО обновляет турнирную таблицу.
 * Работает строго с числами для предотвращения Permission Denied.
 */
export async function forceResolveGroupMatches(leagueId: string, divisionId: number, groupId: string) {
  const { firestore: db } = initializeFirebase();
  const seasonInfo = getGlobalSeasonInfo();
  
  // ГАРД: Проверяем валидность входных данных
  if (!leagueId || !groupId) return { success: false, error: "Invalid parameters" };

  const seasonNum = Number(seasonInfo.activeSeasonNumber);

  // Query only matches for the CURRENT season that aren't finished
  const q = query(
    collection(db, 'matches_v1'),
    where('groupId', '==', String(groupId)),
    where('seasonNumber', '==', seasonNum),
    where('isFinished', '==', false)
  );

  const snap = await getDocs(q);
  if (snap.empty) {
    return { success: true, count: 0 };
  }

  let resolvedCount = 0;

  for (const docSnap of snap.docs) {
    const m = docSnap.data();
    const overdue = isMatchOverdue(m.startTime);
    const hasAnyScore = m.homeScore !== undefined || m.scoreA !== undefined || m.status === 'finished';

    if (overdue && !hasAnyScore) {
      const [sA, sB] = getMatchResult(m.homeId, m.awayId, m.day, seasonNum);
      const winnerId = sA > sB ? m.homeId : (sB > sA ? m.awayId : null);

      try {
        await runTransaction(db, async (transaction) => {
          // Path: leagues_v2 -> {leagueId} -> divisions -> {divId} -> groups -> {groupId} -> teams -> {userId}
          const teamARef = doc(db, 'leagues_v2', leagueId, 'divisions', String(divisionId), 'groups', groupId, 'teams', m.homeId);
          const teamBRef = doc(db, 'leagues_v2', leagueId, 'divisions', String(divisionId), 'groups', groupId, 'teams', m.awayId);

          const snapA = await transaction.get(teamARef);
          const snapB = await transaction.get(teamBRef);

          const dataA = snapA.exists() ? snapA.data() : { wins: 0, draws: 0, losses: 0, points: 0, name: m.homeName };
          const dataB = snapB.exists() ? snapB.data() : { wins: 0, draws: 0, losses: 0, points: 0, name: m.awayName };

          transaction.set(teamARef, {
            ...dataA,
            wins: (dataA.wins || 0) + (sA > sB ? 1 : 0),
            draws: (dataA.draws || 0) + (sA === sB ? 1 : 0),
            losses: (dataA.losses || 0) + (sB > sA ? 1 : 0),
            points: (dataA.points || 0) + (sA > sB ? 3 : (sA === sB ? 1 : 0)),
            lastMatchDay: Number(m.day),
            updatedAt: serverTimestamp()
          }, { merge: true });

          transaction.set(teamBRef, {
            ...dataB,
            wins: (dataB.wins || 0) + (sB > sA ? 1 : 0),
            draws: (dataB.draws || 0) + (sA === sB ? 1 : 0),
            losses: (dataB.losses || 0) + (sA > sB ? 1 : 0),
            points: (dataB.points || 0) + (sB > sA ? 3 : (sA === sB ? 1 : 0)),
            lastMatchDay: Number(m.day),
            updatedAt: serverTimestamp()
          }, { merge: true });

          transaction.update(docSnap.ref, {
            homeScore: sA, awayScore: sB,
            scoreA: sA, scoreB: sB,
            winnerId,
            status: 'finished',
            isFinished: true,
            finishedAt: serverTimestamp(),
            version: 27
          });
        });
        resolvedCount++;
      } catch (e) {
        console.error(`[V27 ENGINE] Transaction failed:`, e);
      }
    }
  }

  return { success: true, count: resolvedCount };
}
