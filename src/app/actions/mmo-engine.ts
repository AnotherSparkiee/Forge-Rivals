'use server';

/**
 * @fileOverview Ультимативный MMO-Двигатель v18 (Reality-Driven).
 * Расчитывает результаты матчей лиги на основе реального времени.
 */

import { 
  collection, doc, getDocs, 
  query, where, serverTimestamp, 
  writeBatch
} from 'firebase/firestore';
import { initializeFirebase } from '@/firebase';
import { isMatchOverdue } from '@/app/lib/time-utils';
import { getMatchResult } from '@/app/lib/leagues-data';

/**
 * ГЛАВНЫЙ СЕРВЕРНЫЙ РАСЧЕТ ГРУППЫ:
 * Находит все просроченные матчи по реальному времени и прописывает им результаты.
 */
export async function forceResolveGroupMatches(leagueId: string, divisionId: number, groupId: string) {
  const { firestore: db } = initializeFirebase();

  console.log(`[V18 ENGINE] Scanning group: ${groupId}`);

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
    
    // ПРЯМАЯ ПРОВЕРКА ВРЕМЕНИ (V18)
    const overdue = isMatchOverdue(m.startTime);
    const hasAnyScore = m.homeScore !== undefined || m.scoreA !== undefined || m.isFinished === true;

    if (overdue && !hasAnyScore) {
      const [sA, sB] = getMatchResult(m.homeId, m.awayId, m.day, m.seasonNumber || 1);
      const winnerId = sA > sB ? m.homeId : (sB > sA ? m.awayId : null);

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
    console.log(`[V18 SUCCESS] Resolved ${resolvedCount} matches in group ${groupId}`);
  }

  return { success: true, count: resolvedCount };
}
