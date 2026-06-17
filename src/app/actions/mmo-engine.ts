'use server';

/**
 * @fileOverview MMO-Двигатель v22 (Season 1 / 2026 Reset).
 * Гарантирует зачисление очков в таблицу при наступлении виртуального времени матча.
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
 * ГЛАВНЫЙ СЕРВЕРНЫЙ РАСЧЕТ ГРУППЫ (Targeted Resolution):
 * Обрабатывает одну группу. Начисляет очки.
 */
export async function forceResolveGroupMatches(leagueId: string, divisionId: number, groupId: string) {
  const { firestore: db } = initializeFirebase();
  const seasonInfo = getGlobalSeasonInfo();
  
  console.log(`[V22 RESOLVER] Processing Group: ${groupId}`);

  const q = query(
    collection(db, 'matches_v1'),
    where('groupId', '==', groupId)
  );

  const snap = await getDocs(q);
  if (snap.empty) return { success: true, count: 0 };

  let resolvedCount = 0;

  for (const docSnap of snap.docs) {
    const m = docSnap.data();
    
    // ПРОВЕРКА ВИРТУАЛЬНОГО ВРЕМЕНИ
    const overdue = isMatchOverdue(m.startTime);
    const hasAnyScore = m.homeScore !== undefined || m.scoreA !== undefined || m.isFinished === true;

    if (overdue && !hasAnyScore) {
      console.log(`[V22] Resolving match: ${docSnap.id}`);
      
      const [sA, sB] = getMatchResult(m.homeId, m.awayId, m.day, seasonInfo.activeSeasonNumber);
      const winnerId = sA > sB ? m.homeId : (sB > sA ? m.awayId : null);

      try {
        await runTransaction(db, async (transaction) => {
          // ОБНОВЛЯЕМ МАТЧ (Унифицируем поля счета)
          transaction.update(docSnap.ref, {
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
        resolvedCount++;
      } catch (e) {
        console.error(`[V22 ERROR] Match ${docSnap.id} failed:`, e);
      }
    }
  }

  return { success: true, count: resolvedCount };
}
