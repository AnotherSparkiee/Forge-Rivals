'use server';

/**
 * @fileOverview MMO-Двигатель v32 (Server-Side Staff-Aware AI Resolver).
 * Выполняет полную симуляцию матча и фиксирует результаты в глобальной коллекции.
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

  // Ищем только незавершенные матчи в конкретной группе
  const q = query(
    collection(db, 'matches_v1'),
    where('groupId', '==', String(groupId)),
    where('seasonNumber', '==', seasonNum),
    where('isFinished', '==', false)
  );

  const snap = await getDocs(q);
  if (snap.empty) return { success: true, count: 0 };

  let resolvedCount = 0;

  for (const docSnap of snap.docs) {
    const m = docSnap.data();
    
    if (isMatchOverdue(m.startTime)) {
      try {
        const teamARef = doc(db, 'leagues_v2', leagueId, 'divisions', String(divisionId), 'groups', groupId, 'teams', m.homeId);
        const teamBRef = doc(db, 'leagues_v2', leagueId, 'divisions', String(divisionId), 'groups', groupId, 'teams', m.awayId);

        const [snapA, snapB] = await Promise.all([getDoc(teamARef), getDoc(teamBRef)]);
        
        // Получаем составы и персонал
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

        // Запуск обоснованной симуляции
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

        // Атомарное обновление в транзакции
        await runTransaction(db, async (transaction) => {
          transaction.set(teamARef, {
            wins: (dataA.wins || 0) + (sA > sB ? 1 : 0),
            draws: (dataA.draws || 0) + (sA === sB ? 1 : 0),
            losses: (dataA.losses || 0) + (sB > sA ? 1 : 0),
            points: (dataA.points || 0) + (sA > sB ? 3 : (sA === sB ? 1 : 0)),
            updatedAt: serverTimestamp()
          }, { merge: true });

          transaction.set(teamBRef, {
            wins: (dataB.wins || 0) + (sB > sA ? 1 : 0),
            draws: (dataB.draws || 0) + (sA === sB ? 1 : 0),
            losses: (dataB.losses || 0) + (sA > sB ? 1 : 0),
            points: (dataB.points || 0) + (sB > sA ? 3 : (sA === sB ? 1 : 0)),
            updatedAt: serverTimestamp()
          }, { merge: true });

          transaction.update(docSnap.ref, {
            scoreA: sA, scoreB: sB,
            winnerId,
            status: 'finished',
            isFinished: true,
            simulation,
            finishedAt: serverTimestamp(),
            version: 32
          });
        });

        resolvedCount++;
      } catch (e) {
        console.error(`[V32 ENGINE] Failed to resolve match ${m.id}:`, e);
      }
    }
  }

  return { success: true, count: resolvedCount };
}