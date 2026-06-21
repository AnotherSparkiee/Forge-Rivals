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
    collection(db, 'matches_v1'),
    where('groupId', '==', String(groupId)),
    where('seasonNumber', '==', seasonNum),
    where('isFinished', '==', false),
    where('version', '==', 35)
  );

  const snap = await getDocs(q);
  if (snap.empty) return { success: true, count: 0 };

  let resolvedCount = 0;

  for (const docSnap of snap.docs) {
    const m = docSnap.data();
    
    if (isMatchOverdue(m.startTime)) {
      try {
        const seasonId = `season_${seasonNum}`;
        const tableId = m.tableId; // Новая связь через tableId

        // Команды теперь живут в иерархии leagues_v2
        const teamARef = doc(db, 'leagues_v2', leagueId, 'divisions', String(divisionId), 'groups', groupId, 'teams', m.homeId);
        const teamBRef = doc(db, 'leagues_v2', leagueId, 'divisions', String(divisionId), 'groups', groupId, 'teams', m.awayId);

        const [snapA, snapB] = await Promise.all([getDoc(teamARef), getDoc(teamBRef)]);
        
        const [heroesA, heroesB, staffA, staffB] = await Promise.all([
          getDocs(collection(teamARef, 'heroes')),
          getDocs(collection(teamBRef, 'heroes')),
          getDocs(collection(teamARef, 'staff')),
          getDocs(collection(teamBRef, 'staff'))
        ]);

        const dataA = snapA.data() || {};
        const dataB = snapB.data() || {};

        const squadA = heroesA.docs.map(d => ({ 
          ...d.data(), id: d.id, 
          isSub: dataA.lineup?.sub1 === d.id || dataA.lineup?.sub2 === d.id 
        }));
        const squadB = heroesB.docs.map(d => ({ 
          ...d.data(), id: d.id, 
          isSub: dataB.lineup?.sub1 === d.id || dataB.lineup?.sub2 === d.id 
        }));

        const coachA = staffA.docs.find(d => d.data().role === 'coach')?.data();
        const analystA = staffA.docs.find(d => d.data().role === 'analyst')?.data();
        const coachB = staffB.docs.find(d => d.data().role === 'coach')?.data();
        const analystB = staffB.docs.find(d => d.data().role === 'analyst')?.data();

        const simulation = await simulateMobaMatch({
          teamA: { 
            name: m.homeName, 
            strategy: dataA.strategy || 'Balanced Play', 
            heroes: squadA as any,
            infraBonus: (dataA.bootcamp?.bootcampLevel || 0) + (dataA.bootcamp?.tacticsHallLevel || 0),
            staffBonus: coachA?.skills?.primary || 0,
            analystBonus: analystA?.skills?.primary || 0
          },
          teamB: { 
            name: m.awayName, 
            strategy: dataB.strategy || 'Balanced Play', 
            heroes: squadB as any,
            infraBonus: (dataB.bootcamp?.bootcampLevel || 0) + (dataB.bootcamp?.tacticsHallLevel || 0),
            staffBonus: coachB?.skills?.primary || 0,
            analystBonus: analystB?.skills?.primary || 0
          },
          isBo2: true
        });

        const seriesScoreParts = simulation.seriesScore.split('-');
        const sA = parseInt(seriesScoreParts[0]);
        const sB = parseInt(seriesScoreParts[1]);
        const winnerId = sA > sB ? m.homeId : (sB > sA ? m.awayId : null);

        await runTransaction(db, async (transaction) => {
          // Обновляем статистику в документе таблицы (НОВИНКА v35)
          const tableRef = doc(db, 'league_tables_v1', tableId);
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
            version: 35
          });
        });

        resolvedCount++;
      } catch (e) {
        console.error(`[V35 ENGINE] Failed to resolve match:`, e);
      }
    }
  }

  return { success: true, count: resolvedCount };
}