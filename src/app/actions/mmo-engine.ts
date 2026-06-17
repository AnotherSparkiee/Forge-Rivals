'use server';

/**
 * @fileOverview Ультимативный MMO-Двигатель v17 (Match-First Consistency).
 * Применяет результаты ТОЛЬКО к документам матчей, чтобы избежать конфликтов прав доступа.
 * Таблицы рассчитываются динамически на основе завершенных матчей.
 */

import { 
  collection, doc, getDocs, 
  query, where, serverTimestamp, 
  Firestore, writeBatch
} from 'firebase/firestore';
import { initializeFirebase } from '@/firebase';
import { isMatchOverdue } from '@/app/lib/time-utils';
import { getMatchResult, LEAGUES } from '@/app/lib/leagues-data';

/**
 * ГЛАВНЫЙ СЕРВЕРНЫЙ РАСЧЕТ ГРУППЫ:
 * Находит все просроченные матчи и прописывает им результаты.
 */
export async function forceResolveGroupMatches(leagueId: string, divisionId: number, groupId: string) {
  const { firestore: db } = initializeFirebase();
  const league = LEAGUES.find(l => l.id === leagueId) || LEAGUES[0];

  console.log(`[V17 ENGINE] Resolving group: ${groupId}`);

  const q = query(
    collection(db, 'matches_v1'),
    where('groupId', '==', groupId)
  );

  const snap = await getDocs(q);
  if (snap.empty) return { success: true, count: 0 };

  const batch = writeBatch(db);
  let resolvedCount = 0;

  for (const docSnap of snap.docs) {
    const m = docSnap.data();
    
    // Проверка просрочки по игровому времени (день + час)
    const overdue = isMatchOverdue(m.day, league.startTime);
    const hasAnyScore = m.homeScore !== undefined || m.scoreA !== undefined;

    if (overdue && !hasAnyScore) {
      const [sA, sB] = getMatchResult(m.homeId, m.awayId, m.day, m.seasonNumber || 1);
      const winnerId = sA > sB ? m.homeId : (sB > sA ? m.awayId : null);

      // Обновляем ТОЛЬКО документ матча (это разрешено правилами безопасности)
      batch.update(docSnap.ref, {
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
      resolvedCount++;
    }
  }

  if (resolvedCount > 0) {
    await batch.commit();
    console.log(`[V17 SUCCESS] Resolved ${resolvedCount} matches in group ${groupId}`);
  }

  return { success: true, count: resolvedCount };
}
