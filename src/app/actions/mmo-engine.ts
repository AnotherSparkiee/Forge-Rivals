'use server';

/**
 * @fileOverview MMO-Двигатель v28 (Autonomous AI Resolver).
 * Выполняет полную симуляцию матча и сохраняет результат в БД.
 */

import { 
  collection, doc, getDocs, 
  query, where, serverTimestamp, 
  runTransaction, getDoc
} from 'firebase/firestore';
import { initializeFirebase } from '@/firebase';
import { isMatchOverdue, getGlobalSeasonInfo } from '@/app/lib/time-utils';
import { simulateMobaMatch } from '@/ai/flows/simulate-moba-match';

/**
 * ГЛАВНЫЙ СЕРВЕРНЫЙ РЕЗОЛВЕР (v28):
 * Выполняет расчет матча на основе реальных данных команд и сохраняет результат симуляции.
 */
export async function forceResolveGroupMatches(leagueId: string, divisionId: number, groupId: string) {
  const { firestore: db } = initializeFirebase();
  const seasonInfo = getGlobalSeasonInfo();
  
  if (!leagueId || !groupId) return { success: false, error: "Invalid parameters" };

  const seasonNum = Number(seasonInfo.activeSeasonNumber);

  // Ищем матчи текущего сезона, которые еще не завершены
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
    
    // Если время матча прошло (+35 мин окно) и он еще не рассчитан
    if (isMatchOverdue(m.startTime)) {
      try {
        // 1. Собираем данные команд для симулятора
        const teamARef = doc(db, 'leagues_v2', leagueId, 'divisions', String(divisionId), 'groups', groupId, 'teams', m.homeId);
        const teamBRef = doc(db, 'leagues_v2', leagueId, 'divisions', String(divisionId), 'groups', groupId, 'teams', m.awayId);

        const [snapA, snapB] = await Promise.all([getDoc(teamARef), getDoc(teamBRef)]);
        
        // Получаем героев команд
        const [heroesA, heroesB] = await Promise.all([
          getDocs(collection(teamARef, 'heroes')),
          getDocs(collection(teamBRef, 'heroes'))
        ]);

        const squadA = heroesA.docs.map(d => ({ ...d.data(), id: d.id, isSub: snapA.data()?.lineup?.sub1 === d.id || snapA.data()?.lineup?.sub2 === d.id }));
        const squadB = heroesB.docs.map(d => ({ ...d.data(), id: d.id, isSub: snapB.data()?.lineup?.sub1 === d.id || snapB.data()?.lineup?.sub2 === d.id }));

        const dataA = snapA.data() || {};
        const dataB = snapB.data() || {};

        // 2. ЗАПУСКАЕМ ИИ-СИМУЛЯТОР
        const simulation = await simulateMobaMatch({
          teamA: { 
            name: m.homeName, 
            strategy: dataA.strategy || 'Balanced Play', 
            heroes: squadA as any,
            infraBonus: (dataA.bootcamp?.bootcampLevel || 0) + (dataA.bootcamp?.tacticsHallLevel || 0),
            staffBonus: (dataA.staff?.coach?.skills?.primary || 0)
          },
          teamB: { 
            name: m.awayName, 
            strategy: dataB.strategy || 'Balanced Play', 
            heroes: squadB as any,
            infraBonus: (dataB.bootcamp?.bootcampLevel || 0) + (dataB.bootcamp?.tacticsHallLevel || 0),
            staffBonus: (dataB.staff?.coach?.skills?.primary || 0)
          },
          isBo2: true
        });

        const seriesScoreParts = simulation.seriesScore.split('-');
        const sA = parseInt(seriesScoreParts[0]);
        const sB = parseInt(seriesScoreParts[1]);
        const winnerId = sA > sB ? m.homeId : (sB > sA ? m.awayId : null);

        // 3. Сохраняем результат транзакцией
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
            simulation, // Сохраняем ВЕСЬ объект симуляции для просмотра
            finishedAt: serverTimestamp(),
            version: 32
          });
        });

        resolvedCount++;
      } catch (e) {
        console.error(`[V28 ENGINE] Failed to resolve match ${m.id}:`, e);
      }
    }
  }

  return { success: true, count: resolvedCount };
}
