'use client';

/**
 * @fileOverview Ядро MMO-синхронизации v63 (FMO Gear Games Style).
 * Обеспечивает объединение реальных игроков в группы и автономную симуляцию мира.
 */

import { useEffect, useRef } from 'react';
import { useGameState } from '@/app/lib/store';
import { useUser, useFirestore } from '@/firebase';
import { 
  doc, getDoc, writeBatch, serverTimestamp, collection, query, where, getDocs, updateDoc, runTransaction, setDoc 
} from 'firebase/firestore';
import { getGlobalSeasonInfo, isMatchOverdue } from '@/app/lib/time-utils';
import { getStableGroupTeams, generateSeasonCalendar } from '@/app/lib/leagues-data';
import { simulateMobaMatch } from '@/ai/flows/simulate-moba-match';

const SYNC_VERSION = 60; // Единая версия для сезона

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

      const syncKey = `${userId}_s${currentSeason}_v${SYNC_VERSION}_fmo_final_v63`;
      if (syncInProgressRef.current === syncKey) return;
      syncInProgressRef.current = syncKey;

      try {
        const tableId = `s${currentSeason}_l${lId}_t${tier}_g${group}`;
        const tableRef = doc(db, 'league_tables_v1', tableId);
        
        // 1. Собираем ВСЕХ реальных игроков этой группы
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
          rank: d.data().rank || 8
        }));

        // 2. Проверяем/Создаем таблицу
        const tableSnap = await getDoc(tableRef);
        const teams = getStableGroupTeams(tier, group, lId, realPlayers);

        if (!tableSnap.exists()) {
          console.log(`[FMO ENGINE] Initializing NEW shared table: ${tableId}`);
          await setDoc(tableRef, {
            tableId, season: currentSeason, leagueId: lId, tier, group,
            teamData: teams, stats: {}, createdAt: serverTimestamp(), version: SYNC_VERSION
          });
          
          const batch = writeBatch(db);
          const matches = generateSeasonCalendar(teams, currentSeason, lId);
          matches.forEach(m => {
            const mId = `m_s${currentSeason}_${lId}_t${tier}_g${group}_d${m.day}_h${m.homeId}`;
            batch.set(doc(db, 'matches_v1', mId), {
              ...m, tableId, season: currentSeason, leagueId: lId, tier, groupId: String(group),
              status: 'scheduled', isFinished: false, version: SYNC_VERSION
            });
          });
          await batch.commit();
        } else {
          // Обновляем состав таблицы, если появились новые реальные игроки
          const tData = tableSnap.data();
          const existingTeams = tData.teamData || [];
          
          let needsUpdate = false;
          const updatedTeams = [...existingTeams];

          realPlayers.forEach(p => {
            const slotIdx = p.rank - 1;
            if (!updatedTeams[slotIdx] || updatedTeams[slotIdx].isBot || updatedTeams[slotIdx].id !== p.id) {
              updatedTeams[slotIdx] = { id: p.id, name: p.name, isBot: false, rank: p.rank };
              needsUpdate = true;
            }
          });

          if (needsUpdate) {
            console.log(`[FMO ENGINE] Updating shared table with new human players`);
            await updateDoc(tableRef, { teamData: updatedTeams });

            // Обновляем календарь для новых имен
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

        // 3. AUTO-RESOLVER (Симуляция ВСЕХ матчей группы)
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
            // Симулируем результат (для прототипа используем детерминированную логику или ИИ)
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
              // Детерминированный результат для матчей ботов
              const winProb = 0.5;
              const winsA = Math.random() < winProb ? 2 : (Math.random() < 0.3 ? 1 : 0);
              const winsB = winsA === 2 ? 0 : (winsA === 1 ? 1 : 2);
              result = { 
                winner: winsA > winsB ? mData.homeName : (winsB > winsA ? mData.awayName : "Draw"), 
                seriesScore: `${winsA}-${winsB}`, 
                games: [{ scoreA: winsA > 0 ? 1 : 0, scoreB: winsB > 0 ? 1 : 0, duration: "30:00", mvp: "Bot", matchSummary: "System simulation." }] 
              };
            }

            const scoreParts = result.seriesScore.split('-');
            const sA = parseInt(scoreParts[0]);
            const sB = parseInt(scoreParts[1]);

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
                updateS(mData.homeId, sA, sB);
                updateS(mData.awayId, sB, sA);
                transaction.update(tableRef, { stats, updatedAt: serverTimestamp() });
              }
              transaction.update(mDoc.ref, {
                scoreA: sA, scoreB: sB, status: 'finished', isFinished: true, simulation: result, finishedAt: serverTimestamp()
              });
            });
          }
        }

        setWorldReady(true);
      } catch (e) {
        console.error("[AUTO-MANAGER v63 ERROR]", e);
        setWorldReady(true);
      }
    };

    syncSharedWorld();
  }, [isLoaded, userId, displayName, selectedLeagueId, leagueLevel, groupId, rank, ownedPlayers, lineup, strategy, staff, bootcamp, db, isUserLoading, user, setWorldReady]);

  return null;
}
