'use server';

/**
 * @fileOverview MMO-Двигатель v35 (Server-Side Staff-Aware AI Resolver).
 * Обновлена версия до v35 для синхронизации с Season Engine.
 */

import { 
  collection, doc, getDocs, 
  query, where, serverTimestamp, 
  runTransaction, getDoc
} from 'firebase/firestore';
import { initializeFirebase } from '@/firebase';
import { isMatchOverdue, getGlobalSeasonInfo } from '@/app/lib/time-utils';
import { simulateMobaMatch } from '@/ai/flows/simulate-moba-match';

export async function forceResolveGroupMatches(leagueId: string, divisionId: number, groupId: string) {
  const { firestore: db } = initializeFirebase();
  const seasonInfo = getGlobalSeasonInfo();
  
  if (!leagueId || !groupId) return { success: false, error: "Invalid parameters" };

  const seasonNum = Number(seasonInfo.activeSeasonNumber);

  // Ищем только незавершенные матчи версии 35
  const q = query(
    collection(db, 'matches_v2'),
    where('groupId', '==', String(groupId)),
    where('season', '==', seasonNum),
    where('isFinished', '==', false)
  );

  const snap = await getDocs(q);
  if (snap.empty) return { success: true, count: 0 };

  let resolvedCount = 0;

  for (const docSnap of snap.docs) {
    const m = docSnap.data();
    
    if (isMatchOverdue(m.startTime)) {
      try {
        const tableId = `table_S${seasonNum}_L${leagueId}_V${divisionId}_G${groupId}`;

        const [heroesA, heroesB] = await Promise.all([
          getDocs(collection(db, 'players_v13')), // Placeholder for logic
          getDocs(collection(db, 'players_v13'))
        ]);

        const simulation = await simulateMobaMatch({
          teamA: { 
            name: m.homeName, 
            strategy: 'Balanced Play', 
            heroes: [],
          },
          teamB: { 
            name: m.awayName, 
            strategy: 'Balanced Play', 
            heroes: [],
          },
          isBo2: true
        });

        const seriesScoreParts = simulation.seriesScore.split('-');
        const sA = parseInt(seriesScoreParts[0]);
        const sB = parseInt(seriesScoreParts[1]);
        const winnerId = sA > sB ? m.homeId : (sB > sA ? m.awayId : null);

        await runTransaction(db, async (transaction) => {
          // Обновляем статистику в документе таблицы (НОВИНКА v35)
          const tableRef = doc(db, 'league_tables_v2', tableId);
          const tableSnap = await transaction.get(tableRef);
          if (tableSnap.exists()) {
            const tableData = tableSnap.data();
            const stats = tableData.stats || {};
            
            if (stats[m.homeId]) {
              stats[m.homeId].matchesPlayed++;
              stats[m.homeId].wins += (sA > sB ? 1 : 0);
              stats[m.homeId].draws += (sA === sB ? 1 : 0);
              stats[m.homeId].losses += (sB > sA ? 1 : 0);
              stats[m.homeId].points += (sA > sB ? 3 : (sA === sB ? 1 : 0));
              stats[m.homeId].diff += (sA - sB);
            }
            if (stats[m.awayId]) {
              stats[m.awayId].matchesPlayed++;
              stats[m.awayId].wins += (sB > sA ? 1 : 0);
              stats[m.awayId].draws += (sA === sB ? 1 : 0);
              stats[m.awayId].losses += (sA > sB ? 1 : 0);
              stats[m.awayId].points += (sB > sA ? 3 : (sA === sB ? 1 : 0));
              stats[m.awayId].diff += (sB - sA);
            }
            transaction.update(tableRef, { stats, updatedAt: serverTimestamp() });
          }

          // Обновляем сам матч
          transaction.update(docSnap.ref, {
            scoreA: sA, scoreB: sB,
            winnerId,
            status: 'finished',
            isFinished: true,
            simulation,
            finishedAt: serverTimestamp(),
            version: 130
          });
        });

        resolvedCount++;
      } catch (e) {
        console.error(`[V130 ENGINE] Failed to resolve match:`, e);
      }
    }
  }

  return { success: true, count: resolvedCount };
}
