'use server';

/**
 * @fileOverview MMO-Двигатель v19.1 (Season 1 / 2026 Reset).
 * Гарантирует зачисление очков в таблицу при наступлении времени матча.
 */

import { 
  collection, doc, getDocs, 
  query, where, serverTimestamp, 
  writeBatch, runTransaction
} from 'firebase/firestore';
import { initializeFirebase } from '@/firebase';
import { isMatchOverdue, getGlobalSeasonInfo } from '@/app/lib/time-utils';
import { getMatchResult } from '@/app/lib/leagues-data';

/**
 * ГЛАВНЫЙ СЕРВЕРНЫЙ РАСЧЕТ ГРУППЫ (Targeted Resolution):
 * Обрабатывает только одну группу лиги для предотвращения таймаутов.
 */
export async function forceResolveGroupMatches(leagueId: string, divisionId: number, groupId: string) {
  const { firestore: db } = initializeFirebase();
  const seasonInfo = getGlobalSeasonInfo();
  
  console.log(`[V19 RESOLVER] Processing Group: ${groupId} (Season ${seasonInfo.activeSeasonNumber})`);

  const q = query(
    collection(db, 'matches_v1'),
    where('groupId', '==', groupId)
  );

  const snap = await getDocs(q);
  if (snap.empty) return { success: true, count: 0 };

  let resolvedCount = 0;

  for (const docSnap of snap.docs) {
    const m = docSnap.data();
    
    // ПРОВЕРКА ВРЕМЕНИ
    const overdue = isMatchOverdue(m.startTime);
    const hasAnyScore = m.homeScore !== undefined || m.scoreA !== undefined || m.isFinished === true;

    if (overdue && !hasAnyScore) {
      console.log(`[V19] Resolving match: ${docSnap.id}`);
      
      const [sA, sB] = getMatchResult(m.homeId, m.awayId, m.day, seasonInfo.activeSeasonNumber);
      const winnerId = sA > sB ? m.homeId : (sB > sA ? m.awayId : null);

      try {
        await runTransaction(db, async (transaction) => {
          // ОБНОВЛЯЕМ МАТЧ
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

          // ПРИМЕЧАНИЕ: В MMO-архитектуре V19 таблица рассчитывается динамически 
          // на основе завершенных матчей (leagues-data.ts -> getGroupStandings).
          // Поэтому записи счета в документ матча достаточно для оживления таблицы.
        });
        resolvedCount++;
      } catch (e) {
        console.error(`[V19 ERROR] Match ${docSnap.id} failed:`, e);
      }
    }
  }

  return { success: true, count: resolvedCount };
}
