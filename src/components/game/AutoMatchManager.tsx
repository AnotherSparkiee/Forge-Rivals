'use client';

/**
 * @fileOverview Ядро MMO-синхронизации v70 (FMO Legacy Protocol).
 * Агрессивная интеграция реальных игроков в общие таблицы и календари.
 * Запуск сезона "на ходу" с автоматической симуляцией пропущенных дней.
 */

import { useEffect, useRef } from 'react';
import { useGameState } from '@/app/lib/store';
import { useUser, useFirestore } from '@/firebase';
import { 
  doc, getDoc, writeBatch, serverTimestamp, collection, query, where, getDocs, updateDoc, runTransaction, setDoc 
} from 'firebase/firestore';
import { getGlobalSeasonInfo, isMatchOverdue, getMoscowTime } from '@/app/lib/time-utils';
import { getStableGroupTeams, generateSeasonCalendar, getMatchResult } from '@/app/lib/leagues-data';
import { simulateMobaMatch } from '@/ai/flows/simulate-moba-match';
import { getLeagueCupParticipants, getWinnerOfBranch } from '@/app/lib/cup-utils';

const SYNC_VERSION = 70; 

export function AutoMatchManager() {
  const { user, isUserLoading } = useUser();
  const { 
    isLoaded, id: userId, displayName, selectedLeagueId, 
    leagueLevel, groupId, setWorldReady, rank, version,
    ownedPlayers, lineup, strategy, staff, bootcamp
  } = useGameState();
  const db = useFirestore();
  
  const syncInProgressRef = useRef<string | null>(null);

  useEffect(() => {
    if (isUserLoading || !user?.uid || !isLoaded || !selectedLeagueId || !displayName || Number(version || 0) < SYNC_VERSION) return;

    const syncSharedWorld = async () => {
      const info = getGlobalSeasonInfo();
      const currentSeason = Number(info.activeSeasonNumber);
      const lId = String(selectedLeagueId);
      const tier = Number(leagueLevel);
      const group = Number(groupId);

      const syncKey = `${userId}_s${currentSeason}_v${SYNC_VERSION}`;
      if (syncInProgressRef.current === syncKey) return;
      syncInProgressRef.current = syncKey;

      console.log(`[WORLD ENGINE v70] Synchronizing Group ${lId} T${tier} G${group}...`);

      try {
        const tableId = `s${currentSeason}_l${lId}_t${tier}_g${group}`;
        const tableRef = doc(db, 'league_tables_v1', tableId);
        
        // 1. SCAN FOR ALL REAL PLAYERS IN THIS GROUP
        const playersQuery = query(
          collection(db, 'players_v10'),
          where('selectedLeagueId', '==', lId),
          where('leagueLevel', '==', tier),
          where('groupId', '==', group),
          where('version', '==', SYNC_VERSION)
        );
        const playersSnap = await getDocs(playersQuery);
        const realPlayers = playersSnap.docs.map(d => ({
          id: d.id,
          name: d.data().displayName || "Manager",
          rank: Number(d.data().rank || 1)
        }));

        // 2. TABLE & CALENDAR INITIALIZATION
        const tableSnap = await getDoc(tableRef);
        let currentTableTeams = getStableGroupTeams(tier, group, lId, realPlayers);
        
        if (!tableSnap.exists()) {
          console.log(`[V70] First entry: Creating Table & Calendar for ${tableId}`);
          await setDoc(tableRef, {
            tableId, season: currentSeason, leagueId: lId, tier, group,
            teamData: currentTableTeams, stats: {}, createdAt: serverTimestamp(), version: SYNC_VERSION
          });
          
          const batch = writeBatch(db);
          const matches = generateSeasonCalendar(currentTableTeams, currentSeason, lId);
          matches.forEach(m => {
            const mId = `m_s${currentSeason}_${lId}_t${tier}_g${group}_d${m.day}_h${m.homeId}`;
            batch.set(doc(db, 'matches_v1', mId), {
              ...m, tableId, season: currentSeason, leagueId: lId, tier, groupId: String(group),
              status: 'scheduled', isFinished: false, version: SYNC_VERSION
            }, { merge: true });
          });
          await batch.commit();
        } else {
          // AGGRESSIVE SYNC: Inject humans into existing table
          const tData = tableSnap.data();
          let needsUpdate = false;
          const updatedTeams = [...(tData.teamData || currentTableTeams)];

          realPlayers.forEach(p => {
            const idx = p.rank - 1;
            if (!updatedTeams[idx] || updatedTeams[idx].isBot || updatedTeams[idx].id !== p.id) {
              updatedTeams[idx] = { id: p.id, name: p.name, isBot: false, rank: p.rank };
              needsUpdate = true;
            }
          });

          if (needsUpdate) {
            console.log(`[V70] Updating shared table with new human presence...`);
            await updateDoc(tableRef, { teamData: updatedTeams });
            
            const qM = query(collection(db, 'matches_v1'), where('tableId', '==', tableId), where('version', '==', SYNC_VERSION));
            const mSnap = await getDocs(qM);
            const mBatch = writeBatch(db);
            mSnap.forEach(mDoc => {
              const m = mDoc.data();
              const upd: any = {};
              updatedTeams.forEach(p => {
                if (m.homeId === p.id && m.homeName !== p.name) upd.homeName = p.name;
                if (m.awayId === p.id && m.awayName !== p.name) upd.awayName = p.name;
              });
              if (Object.keys(upd).length > 0) mBatch.update(mDoc.ref, upd);
            });
            await mBatch.commit();
          }
        }

        // 3. AUTO-RESOLVER (Simulate missed days)
        const qPending = query(
          collection(db, 'matches_v1'),
          where('tableId', '==', tableId),
          where('isFinished', '==', false),
          where('version', '==', SYNC_VERSION)
        );

        const pendingSnap = await getDocs(qPending);
        for (const mDoc of pendingSnap.docs) {
          const mData = mDoc.data();
          if (isMatchOverdue(mData.startTime)) {
            const isMeInvolved = mData.homeId === userId || mData.awayId === userId;
            let result;

            if (isMeInvolved) {
              const squad = ownedPlayers.filter(p => Object.values(lineup).includes(p.id)).map(p => ({
                name: p.name, role: p.role, overallRating: p.overallRating, proStats: p.proStats,
                isSub: p.id === lineup.sub1 || p.id === lineup.sub2
              }));

              result = await simulateMobaMatch({
                teamA: mData.homeId === userId ? { name: displayName, strategy, heroes: squad, staffBonus: staff.coach?.skills?.primary, infraBonus: (bootcamp.bootcampLevel || 0) } : { name: mData.homeName, strategy: "Balanced Play", heroes: [] },
                teamB: mData.awayId === userId ? { name: displayName, strategy, heroes: squad, staffBonus: staff.coach?.skills?.primary, infraBonus: (bootcamp.bootcampLevel || 0) } : { name: mData.awayName, strategy: "Balanced Play", heroes: [] },
                isBo2: true
              });
            } else {
              const [sA, sB] = getMatchResult(mData.homeId, mData.awayId, currentSeason, false);
              result = { 
                winner: sA > sB ? mData.homeName : (sB > sA ? mData.awayName : "Ничья"), 
                seriesScore: `${sA}-${sB}`, 
                games: [{ scoreA: sA > 0 ? 1 : 0, scoreB: sB > 0 ? 1 : 0, duration: "30:00", mvp: "Bot", matchSummary: "Симуляция автоматического дня." }] 
              };
            }

            const scoreParts = result.seriesScore.split('-');
            const finalSA = parseInt(scoreParts[0]);
            const finalSB = parseInt(scoreParts[1]);

            await runTransaction(db, async (transaction) => {
              const tCurrentSnap = await transaction.get(tableRef);
              if (tCurrentSnap.exists()) {
                const stats = tCurrentSnap.data().stats || {};
                const updateS = (tid: string, sc: number, osc: number) => {
                  if (!stats[tid]) stats[tid] = { points: 0, matchesPlayed: 0, wins: 0, draws: 0, losses: 0, diff: 0 };
                  stats[tid].matchesPlayed++;
                  if (sc > osc) { stats[tid].wins++; stats[tid].points += 3; }
                  else if (sc === osc) { stats[tid].draws++; stats[tid].points += 1; }
                  else { stats[tid].losses++; }
                  stats[tid].diff += (sc - osc);
                };
                updateS(mData.homeId, finalSA, finalSB);
                updateS(mData.awayId, finalSB, finalSA);
                transaction.update(tableRef, { stats, updatedAt: serverTimestamp() });
              }
              transaction.update(mDoc.ref, {
                scoreA: finalSA, scoreB: finalSB, status: 'finished', isFinished: true, simulation: result, finishedAt: serverTimestamp()
              });
            });
          }
        }

        setWorldReady(true);
      } catch (e) {
        console.error("[WORLD ENGINE v70 ERROR]", e);
        setWorldReady(true);
      }
    };

    syncSharedWorld();
  }, [isLoaded, userId, displayName, selectedLeagueId, leagueLevel, groupId, rank, version, ownedPlayers, lineup, strategy, staff, bootcamp, db, isUserLoading, user, setWorldReady]);

  return null;
}
