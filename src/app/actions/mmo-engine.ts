'use server';

/**
 * @fileOverview Глобальный MMO-Двигатель v13 (Targeted Calibration).
 * Ультимативное решение: расчет конкретной группы для мгновенного результата.
 */

import { 
  collection, doc, getDocs, 
  query, where, serverTimestamp, 
  runTransaction, Firestore, Timestamp
} from 'firebase/firestore';
import { initializeFirebase } from '@/firebase';
import { getGlobalSeasonInfo } from '@/app/lib/time-utils';
import { getMatchResult } from '@/app/lib/leagues-data';

/**
 * ТАРГЕТИРОВАННАЯ КАЛИБРОВКА ГРУППЫ:
 * Решает проблему таймаутов, обрабатывая только нужную группу.
 */
export async function forceResolveGroupMatches(leagueId: string, divisionId: number, groupId: string) {
  const { firestore: db } = initializeFirebase();
  const { seasonNumber } = getGlobalSeasonInfo();
  const seasonId = `season_${seasonNumber}`;

  console.log(`[V13 TARGETED] Syncing group ${groupId}...`);

  const q = query(
    collection(db, 'matches_v1'),
    where('groupId', '==', groupId),
    where('seasonId', '==', seasonId)
  );

  const snap = await getDocs(q);
  if (snap.empty) return { success: true, count: 0 };

  let resolvedCount = 0;
  const now = Date.now();

  for (const docSnap of snap.docs) {
    const m = docSnap.data();
    const startTime = m.startTime ? new Date(m.startTime).getTime() : 0;
    
    // Если время прошло и матч не завершен
    if (startTime > 0 && now > startTime && !m.isFinished && m.status !== 'finished') {
      const [sA, sB] = getMatchResult(m.homeId, m.awayId, m.day, seasonNumber);
      await runCalibrationTransaction(db, m, sA, sB, docSnap.id);
      resolvedCount++;
    }
  }

  return { success: true, count: resolvedCount };
}

async function runCalibrationTransaction(
  db: Firestore, 
  matchData: any,
  sA: number, 
  sB: number,
  matchDocId: string
) {
  const { homeId, awayId, leagueId, divisionId, groupId } = matchData;

  const homeRootRef = doc(db, 'players_v10', homeId);
  const awayRootRef = doc(db, 'players_v10', awayId);
  const homeTeamRef = doc(db, 'leagues_v2', leagueId, 'divisions', String(divisionId), 'groups', groupId, 'teams', homeId);
  const awayTeamRef = doc(db, 'leagues_v2', leagueId, 'divisions', String(divisionId), 'groups', groupId, 'teams', awayId);
  const matchRef = doc(db, 'matches_v1', matchDocId);
  
  const winnerId = sA > sB ? homeId : (sB > sA ? awayId : null);

  try {
    await runTransaction(db, async (transaction) => {
      const hRoot = await transaction.get(homeRootRef);
      const aRoot = await transaction.get(awayRootRef);

      // ШАГ 1: Обновление статистики команд
      if (hRoot.exists()) {
        const d = hRoot.data();
        let w = d.wins || 0, dr = d.draws || 0, l = d.losses || 0, p = d.points || 0;
        if (sA > sB) { w++; p += 3; } else if (sA < sB) { l++; } else { dr++; p += 1; }
        const update = { wins: w, draws: dr, losses: l, points: p, statString: `${w}-${dr}-${l}`, updatedAt: serverTimestamp() };
        transaction.update(homeRootRef, update);
        transaction.update(homeTeamRef, update);
      }

      if (aRoot.exists()) {
        const d = aRoot.data();
        let w = d.wins || 0, dr = d.draws || 0, l = d.losses || 0, p = d.points || 0;
        if (sB > sA) { w++; p += 3; } else if (sB < sA) { l++; } else { dr++; p += 1; }
        const update = { wins: w, draws: dr, losses: l, points: p, statString: `${w}-${dr}-${l}`, updatedAt: serverTimestamp() };
        transaction.update(awayRootRef, update);
        transaction.update(awayTeamRef, update);
      }

      // ШАГ 2: Закрытие матча (Тотальный Bypass)
      transaction.update(matchRef, {
        homeScore: sA, awayScore: sB,
        scoreA: sA, scoreB: sB,
        winnerId: winnerId,
        status: 'finished', matchStatus: 'finished', state: 'finished',
        isFinished: true, isCompleted: true,
        finishedAt: serverTimestamp()
      });
    });
  } catch (e) {
    console.error(`[TX FAILED] ${matchDocId}:`, e);
  }
}

/**
 * Legacy support for global resolve
 */
export async function forceResolveLeagueMatches() {
  const { firestore: db } = initializeFirebase();
  const { seasonNumber } = getGlobalSeasonInfo();
  const seasonId = `season_${seasonNumber}`;
  const q = query(collection(db, 'matches_v1'), where('seasonId', '==', seasonId));
  const snap = await getDocs(q);
  let count = 0;
  for (const d of snap.docs) {
    const m = d.data();
    if (m.startTime && new Date(m.startTime).getTime() < Date.now() && !m.isFinished) {
      const [sA, sB] = getMatchResult(m.homeId, m.awayId, m.day, seasonNumber);
      await runCalibrationTransaction(db, m, sA, sB, d.id);
      count++;
    }
  }
  return { success: true, count };
}
