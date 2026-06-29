'use client';

/**
 * @fileOverview Ядро MMO-синхронизации v61 (Infinite Engine).
 * Принудительная инициализация таблиц, календарей и инъекция игрока.
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

const SYNC_VERSION = 61; 

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
    if (isUserLoading || !user?.uid || !isLoaded || !selectedLeagueId || !displayName) return;

    const syncSharedWorld = async () => {
      const info = getGlobalSeasonInfo();
      const currentSeason = Number(info.activeSeasonNumber);
      const lId = String(selectedLeagueId);
      const tier = Number(leagueLevel);
      const group = Number(groupId);

      const syncKey = `${userId}_s${currentSeason}_v${SYNC_VERSION}`;
      if (syncInProgressRef.current === syncKey) return;
      syncInProgressRef.current = syncKey;

      console.log(`[WORLD SYNC v61] Processing Group ${lId} T${tier} G${group}...`);

      try {
        const tableId = `cycle_${currentSeason}_l${lId}_t${tier}_g${group}`;
        const tableRef = doc(db, 'league_tables_v1', tableId);
        
        // 1. Инициализация таблицы если её нет
        let tableSnap = await getDoc(tableRef);
        
        if (!tableSnap.exists()) {
          console.log(`[V61] INITIALIZING NEW GROUP: ${tableId}`);
          const baseTeams = getStableGroupTeams(tier, group, lId, []);
          await setDoc(tableRef, {
            tableId, season: currentSeason, leagueId: lId, tier, group,
            teamData: baseTeams, stats: {}, createdAt: serverTimestamp(), version: SYNC_VERSION
          });
          
          // Генерируем календарь для новой группы
          const batch = writeBatch(db);
          const matches = generateSeasonCalendar(baseTeams, currentSeason, lId);
          matches.forEach(m => {
            const mId = `m_s${currentSeason}_${lId}_t${tier}_g${group}_d${m.day}_h${m.homeId}`;
            batch.set(doc(db, 'matches_v1', mId), {
              ...m, tableId, season: currentSeason, leagueId: lId, tier, groupId: String(group),
              status: 'scheduled', isFinished: false, version: SYNC_VERSION
            }, { merge: true });
          });
          await batch.commit();
          tableSnap = await getDoc(tableRef);
        }

        // 2. ИНЪЕКЦИЯ ИГРОКА: Проверяем слот
        const currentData = tableSnap.data();
        const teams = currentData?.teamData || [];
        const mySlotIdx = rank - 1;

        if (!teams[mySlotIdx] || teams[mySlotIdx].id !== userId || teams[mySlotIdx].name !== displayName) {
          console.log(`[V61] INJECTING PLAYER: Replacing bot at slot ${rank} with ${displayName}`);
          const updatedTeams = [...teams];
          updatedTeams[mySlotIdx] = { id: userId, name: displayName, isBot: false, rank };
          
          await updateDoc(tableRef, { teamData: updatedTeams });

          // Обновляем имена в календаре матчей группы
          const qM = query(
            collection(db, 'matches_v1'), 
            where('tableId', '==', tableId), 
            where('version', '==', SYNC_VERSION)
          );
          const mSnap = await getDocs(qM);
          const mBatch = writeBatch(db);
          mSnap.forEach(mDoc => {
            const m = mDoc.data();
            if (m.homeId === userId) mBatch.update(mDoc.ref, { homeName: displayName });
            if (m.awayId === userId) mBatch.update(mDoc.ref, { awayName: displayName });
          });
          await mBatch.commit();
        }

        // 3. ПРОВЕРКА КАЛЕНДАРЯ: Если таблица есть, но матчи исчезли
        const qCheckMatches = query(
          collection(db, 'matches_v1'), 
          where('tableId', '==', tableId), 
          where('version', '==', SYNC_VERSION)
        );
        const checkSnap = await getDocs(qCheckMatches);
        
        if (checkSnap.empty) {
          console.log(`[V61] RESTORING MISSING CALENDAR for ${tableId}`);
          const mBatch = writeBatch(db);
          const matches = generateSeasonCalendar(teams, currentSeason, lId);
          matches.forEach(m => {
            const mId = `m_s${currentSeason}_${lId}_t${tier}_g${group}_d${m.day}_h${m.homeId}`;
            mBatch.set(doc(db, 'matches_v1', mId), {
              ...m, tableId, season: currentSeason, leagueId: lId, tier, groupId: String(group),
              status: 'scheduled', isFinished: false, version: SYNC_VERSION
            }, { merge: true });
          });
          await mBatch.commit();
        }

        // 4. РЕЗОЛВЕР: Симулируем прошедшие игры
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
            console.log(`[V61] AUTO-RESOLVING: ${mData.homeName} vs ${mData.awayName}`);
            
            const isMeHome = mData.homeId === userId;
            const isMeAway = mData.awayId === userId;
            let simulation;

            if (isMeHome || isMeAway) {
              const squad = ownedPlayers.filter(p => Object.values(lineup).includes(p.id)).map(p => ({
                name: p.name, role: p.role, overallRating: p.overallRating, proStats: p.proStats,
                isSub: p.id === lineup.sub1 || p.id === lineup.sub2
              }));

              simulation = await simulateMobaMatch({
                teamA: isMeHome ? { name: displayName, strategy, heroes: squad, staffBonus: staff.coach?.skills?.primary, infraBonus: (bootcamp.bootcampLevel || 0) } : { name: mData.homeName, strategy: "Balanced Play", heroes: [] },
                teamB: isMeAway ? { name: displayName, strategy, heroes: squad, staffBonus: staff.coach?.skills?.primary, infraBonus: (bootcamp.bootcampLevel || 0) } : { name: mData.awayName, strategy: "Balanced Play", heroes: [] },
                isBo2: true
              });
            } else {
              const [sA, sB] = getMatchResult(mData.homeId, mData.awayId, currentSeason, false);
              simulation = { 
                winner: sA > sB ? mData.homeName : (sB > sA ? mData.awayName : "Ничья"), 
                seriesScore: `${sA}-${sB}`, 
                games: [{ scoreA: sA > 0 ? 1 : 0, scoreB: sB > 0 ? 1 : 0, duration: "30:00", mvp: "Bot", matchSummary: "Automatic battle resolution." }] 
              };
            }

            const scoreParts = simulation.seriesScore.split('-');
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
                scoreA: finalSA, scoreB: finalSB, status: 'finished', isFinished: true, simulation, finishedAt: serverTimestamp()
              });
            });
          }
        }

        setWorldReady(true);
      } catch (e) {
        console.error("[V61 SYNC ERROR]", e);
        setWorldReady(true);
      }
    };

    syncSharedWorld();
  }, [isLoaded, userId, displayName, selectedLeagueId, leagueLevel, groupId, rank, version, ownedPlayers, lineup, strategy, staff, bootcamp, db, isUserLoading, user, setWorldReady]);

  return null;
}
