'use server';

/**
 * @fileOverview MMO-Двигатель v40 (Admin SDK Transition).
 */

import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase-admin';
import { isMatchOverdue } from '@/app/lib/time-utils';
import { simulateMobaMatch } from '@/ai/flows/simulate-moba-match';
import { getTableId } from '@/app/lib/leagues-data';
import { getActiveSeasonNumber } from './season-cycle';

export async function forceResolveGroupMatches(leagueId: string, divisionId: number, groupId: string) {
  const db = adminDb;
  
  if (!leagueId || !groupId) return { success: false, error: "Invalid parameters" };

  const seasonNum = await getActiveSeasonNumber(db);

  const snap = await db.collection('matches_v2')
    .where('groupId', '==', String(groupId))
    .where('season', '==', seasonNum)
    .where('isFinished', '==', false)
    .where('isProcessing', '==', false)
    .get();

  if (snap.empty) return { success: true, count: 0 };

  let resolvedCount = 0;
  const batch = db.batch();
  const tableStatsAggr = new Map<string, Record<string, number>>();

  for (const docSnap of snap.docs) {
    const m = docSnap.data();
    
    if (isMatchOverdue(m.startTime)) {
      batch.update(docSnap.ref, { isProcessing: true });
      
      try {
        const tableId = getTableId(seasonNum, leagueId, divisionId, Number(groupId));

        const [homeSnap, awaySnap] = await Promise.all([
          db.collection('players_v14').doc(m.homeId).get(),
          db.collection('players_v14').doc(m.awayId).get()
        ]);

        const getTeamData = (clubSnap: any) => {
          if (!clubSnap.exists) return { heroes: [], strategy: 'Balanced Play', staffBonus: 0, infraBonus: 0 };
          const data = clubSnap.data();
          const lineupIds = Object.values(data.lineup || {});
          
          let squad = (data.ownedPlayers || []).filter((p: any) => lineupIds.includes(p.id));
          if (squad.length < 5) squad = (data.ownedPlayers || []).slice(0, 5);

          return {
            heroes: squad,
            strategy: data.strategy || 'Balanced Play',
            staffBonus: data.staff?.coach?.skills?.primary || 0,
            infraBonus: data.bootcamp?.bootcampLevel || 0
          };
        };

        const teamA = getTeamData(homeSnap);
        const teamB = getTeamData(awaySnap);

        const simulation = await simulateMobaMatch({
          teamA: { name: m.homeName, ...teamA },
          teamB: { name: m.awayName, ...teamB },
          isBo2: true,
          scoreA: undefined, 
          scoreB: undefined
        });

        const seriesScoreParts = simulation.seriesScore.split('-');
        const sA = parseInt(seriesScoreParts[0]);
        const sB = parseInt(seriesScoreParts[1]);
        const winnerId = sA > sB ? m.homeId : (sB > sA ? m.awayId : null);

        batch.update(docSnap.ref, {
          scoreA: sA, scoreB: sB, winnerId,
          status: 'finished', isFinished: true, isProcessing: false,
          simulation, finishedAt: FieldValue.serverTimestamp()
        });

        if (!tableStatsAggr.has(tableId)) tableStatsAggr.set(tableId, {});
        const aggr = tableStatsAggr.get(tableId)!;

        const updateStats = (id: string, sa: number, sb: number) => {
          if (!id) return;
          const prefix = `stats.${id}`;
          aggr[`${prefix}.matchesPlayed`] = (aggr[`${prefix}.matchesPlayed`] || 0) + 1;
          aggr[`${prefix}.wins`] = (aggr[`${prefix}.wins`] || 0) + (sa > sb ? 1 : 0);
          aggr[`${prefix}.draws`] = (aggr[`${prefix}.draws`] || 0) + (sa === sb ? 1 : 0);
          aggr[`${prefix}.losses`] = (aggr[`${prefix}.losses`] || 0) + (sb > sa ? 1 : 0);
          aggr[`${prefix}.points`] = (aggr[`${prefix}.points`] || 0) + (sa > sb ? 3 : (sa === sb ? 1 : 0));
          aggr[`${prefix}.diff`] = (aggr[`${prefix}.diff`] || 0) + (sa - sb);
        };

        updateStats(m.homeId, sA, sB);
        updateStats(m.awayId, sB, sA);
        resolvedCount++;
      } catch (e) {
        console.error(`[MMO ENGINE] Error processing match ${docSnap.id}:`, e);
        batch.update(docSnap.ref, { isProcessing: false });
      }
    }
  }

  for (const [tableId, stats] of tableStatsAggr.entries()) {
    const tableRef = db.collection('league_tables_v2').doc(tableId);
    const firestoreStats: any = { updatedAt: FieldValue.serverTimestamp() };
    for (const [key, val] of Object.entries(stats)) {
      firestoreStats[key] = FieldValue.increment(val);
    }
    batch.set(tableRef, firestoreStats, { merge: true });
  }

  await batch.commit();
  return { success: true, count: resolvedCount };
}
