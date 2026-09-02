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
import { getTableId } from '@/app/lib/leagues-data';

export async function forceResolveGroupMatches(leagueId: string, divisionId: number, groupId: string) {
  const { firestore: db } = initializeFirebase();
  const seasonInfo = getGlobalSeasonInfo();
  
  if (!leagueId || !groupId) return { success: false, error: "Invalid parameters" };

  const seasonNum = Number(seasonInfo.activeSeasonNumber);

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
        const tableId = getTableId(seasonNum, leagueId, divisionId, Number(groupId));

        // Загрузка данных клубов (players_v14) для получения реальных составов и стратегий
        const [homeSnap, awaySnap] = await Promise.all([
          getDoc(doc(db, 'players_v14', m.homeId)),
          getDoc(doc(db, 'players_v14', m.awayId))
        ]);

        const getTeamData = (clubSnap: any) => {
          if (!clubSnap.exists()) return { heroes: [], strategy: 'Balanced Play' };
          const data = clubSnap.data();
          const squad = (data.ownedPlayers || []).filter((p: any) => 
            Object.values(data.lineup || {}).includes(p.id)
          ).map((p: any) => ({
            ...p,
            isSub: p.id === data.lineup?.sub_carry || p.id === data.lineup?.sub_mid || 
                   p.id === data.lineup?.sub_offlane || p.id === data.lineup?.sub_support || 
                   p.id === data.lineup?.sub_full_support
          }));
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
          isBo2: true
        });

        const seriesScoreParts = simulation.seriesScore.split('-');
        const sA = parseInt(seriesScoreParts[0]);
        const sB = parseInt(seriesScoreParts[1]);
        const winnerId = sA > sB ? m.homeId : (sB > sA ? m.awayId : null);

        await runTransaction(db, async (transaction) => {
          const tableRef = doc(db, 'league_tables_v2', tableId);
          const tableSnap = await transaction.get(tableRef);
          if (tableSnap.exists()) {
            const tableData = tableSnap.data();
            const stats = { ...tableData.stats };
            
            const updateStats = (id: string, sa: number, sb: number) => {
              if (stats[id]) {
                stats[id].matchesPlayed++;
                stats[id].wins += (sa > sb ? 1 : 0);
                stats[id].draws += (sa === sb ? 1 : 0);
                stats[id].losses += (sb > sa ? 1 : 0);
                stats[id].points += (sa > sb ? 3 : (sa === sb ? 1 : 0));
                stats[id].diff += (sa - sb);
              }
            };

            updateStats(m.homeId, sA, sB);
            updateStats(m.awayId, sB, sA);
            transaction.update(tableRef, { stats, updatedAt: serverTimestamp() });
          }

          transaction.update(docSnap.ref, {
            scoreA: sA, scoreB: sB,
            winnerId,
            status: 'finished',
            isFinished: true,
            simulation,
            finishedAt: serverTimestamp(),
            version: 140
          });
        });

        resolvedCount++;
      } catch (e) {
        console.error(`[MMO ENGINE] Failed to resolve match:`, e);
      }
    }
  }

  return { success: true, count: resolvedCount };
}
