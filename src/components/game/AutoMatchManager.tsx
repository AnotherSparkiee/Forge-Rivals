
'use client';

/**
 * @fileOverview Ядро MMO-синхронизации v65 (Human Presence Patch).
 * Гарантирует интеграцию всех реальных игроков в общие таблицы и календари.
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

const SYNC_VERSION = 65; 

export function AutoMatchManager() {
  const { user, isUserLoading } = useUser();
  const { 
    isLoaded, id: userId, displayName, selectedLeagueId, 
    leagueLevel, groupId, setWorldReady, rank, 
    ownedPlayers, lineup, strategy, staff, bootcamp
  } = useGameState();
  const db = useFirestore();
  
  const syncInProgressRef = useRef<string | null>(null);

  useEffect(() => {
    if (isUserLoading || !user?.uid || !isLoaded || !selectedLeagueId || !displayName) return;

    const syncSharedWorld = async () => {
      const info = getGlobalSeasonInfo();
      const currentSeason = Number(info.activeSeasonNumber);
      const lId = String(selectedLeagueId);
      const tier = Number(leagueLevel);
      const group = Number(groupId);

      const syncKey = `${userId}_s${currentSeason}_v${SYNC_VERSION}_fmo_v65`;
      if (syncInProgressRef.current === syncKey) return;
      syncInProgressRef.current = syncKey;

      try {
        const tableId = `s${currentSeason}_l${lId}_t${tier}_g${group}`;
        const tableRef = doc(db, 'league_tables_v1', tableId);
        
        // 1. ПОЛУЧАЕМ ВСЕХ РЕАЛЬНЫХ ИГРОКОВ В ЭТОЙ ГРУППЕ
        const playersQuery = query(
          collection(db, 'players_v10'),
          where('selectedLeagueId', '==', lId),
          where('leagueLevel', '==', tier),
          where('groupId', '==', group)
        );
        const playersSnap = await getDocs(playersQuery);
        const realPlayers = playersSnap.docs.map(d => ({
          id: d.id,
          name: d.data().displayName || "Manager",
          rank: Number(d.data().rank || 8)
        }));

        // 2. СИНХРОНИЗАЦИЯ ТАБЛИЦЫ
        const tableSnap = await getDoc(tableRef);
        let currentTableTeams = getStableGroupTeams(tier, group, lId, realPlayers);
        
        if (!tableSnap.exists()) {
          console.log(`[V65] Initializing Table: ${tableId}`);
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
            });
          });
          await batch.commit();
        } else {
          // Если таблица есть, проверяем, все ли реальные люди в ней прописаны
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
            console.log(`[V65] Injecting humans into existing table ${tableId}`);
            await updateDoc(tableRef, { teamData: updatedTeams });
            
            // Также обновляем имена в матчах
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

        // 3. AUTO-RESOLVER (MMO Engine)
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
                teamA: mData.homeId === userId ? { name: displayName, strategy, heroes: squad, staffBonus: staff.coach?.skills?.primary, infraBonus: (bootcamp.bootcampLevel || 0) } : { name: mData.homeName, strategy: "Balanced", heroes: [] },
                teamB: mData.awayId === userId ? { name: displayName, strategy, heroes: squad, staffBonus: staff.coach?.skills?.primary, infraBonus: (bootcamp.bootcampLevel || 0) } : { name: mData.awayName, strategy: "Balanced", heroes: [] },
                isBo2: true
              });
            } else {
              const [sA, sB] = getMatchResult(mData.homeId, mData.awayId, currentSeason, false);
              result = { 
                winner: sA > sB ? mData.homeName : (sB > sA ? mData.awayName : "Draw"), 
                seriesScore: `${sA}-${sB}`, 
                games: [{ scoreA: sA > 0 ? 1 : 0, scoreB: sB > 0 ? 1 : 0, duration: "30:00", mvp: "Bot", matchSummary: "System simulation." }] 
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

        // 4. PYRAMID CUP SIMULATION
        const cupDocId = `cup_s${currentSeason}_l${lId}`;
        const cupRef = doc(db, 'cup_pyramid_v1', cupDocId);
        const cupSnap = await getDoc(cupRef);
        
        if (!cupSnap.exists() || info.dayOfCycle > (cupSnap.data().lastSimulatedDay || 0)) {
          const cupPlayersQuery = query(collection(db, 'players_v10'), where('selectedLeagueId', '==', lId));
          const cupPlayersSnap = await getDocs(cupPlayersQuery);
          const allLeaguePlayers = cupPlayersSnap.docs.map(d => ({ id: d.id, ...d.data() }));
          
          const participants = getLeagueCupParticipants(lId, allLeaguePlayers, currentSeason);
          const rounds: Record<string, any[]> = {};
          
          const simulateRound = (rNum: number) => {
            const matches: any[] = [];
            const matchCount = Math.pow(2, 12 - rNum);
            const cache = new Map();
            
            for (let i = 0; i < matchCount; i++) {
              const startIndex = i * Math.pow(2, rNum);
              const step = Math.pow(2, rNum - 1);
              const h = getWinnerOfBranch(participants, rNum - 1, startIndex, cache, info.dayOfCycle, currentSeason);
              const a = getWinnerOfBranch(participants, rNum - 1, startIndex + step, cache, info.dayOfCycle, currentSeason);
              
              if (h && a) {
                const [sA, sB] = getMatchResult(h.id, a.id, rNum, currentSeason);
                matches.push({ home: h, away: a, scoreA: sA, scoreB: sB });
              } else {
                matches.push({ home: h || { name: 'TBD' }, away: a || { name: 'TBD' }, scoreA: null, scoreB: null });
              }
            }
            return matches.slice(0, 32); 
          };

          rounds.r1 = simulateRound(1);
          rounds.r2 = simulateRound(2);
          rounds.r3 = simulateRound(3);
          rounds.r4 = simulateRound(4);
          rounds.r5 = simulateRound(5);

          await setDoc(cupRef, {
            id: cupDocId, leagueId: lId, season: currentSeason,
            rounds, lastSimulatedDay: info.dayOfCycle, updatedAt: serverTimestamp()
          }, { merge: true });
        }

        setWorldReady(true);
      } catch (e) {
        console.error("[WORLD ENGINE v65 ERROR]", e);
        setWorldReady(true);
      }
    };

    syncSharedWorld();
  }, [isLoaded, userId, displayName, selectedLeagueId, leagueLevel, groupId, rank, ownedPlayers, lineup, strategy, staff, bootcamp, db, isUserLoading, user, setWorldReady]);

  return null;
}
