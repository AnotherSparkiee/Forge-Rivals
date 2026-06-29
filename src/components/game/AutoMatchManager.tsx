'use client';

/**
 * @fileOverview Ядро MMO-синхронизации v66 (FMO Absolute Sync).
 * Агрессивно вписывает игрока в мир, генерирует календарь и симулирует матчи всей группы.
 */

import { useEffect, useRef } from 'react';
import { useGameState } from '@/app/lib/store';
import { useUser, useFirestore } from '@/firebase';
import { 
  doc, getDoc, writeBatch, serverTimestamp, collection, query, where, getDocs, updateDoc, runTransaction, setDoc 
} from 'firebase/firestore';
import { getGlobalSeasonInfo, isMatchOverdue } from '@/app/lib/time-utils';
import { getStableGroupTeams, generateSeasonCalendar, getMatchResult } from '@/app/lib/leagues-data';
import { simulateMobaMatch } from '@/ai/flows/simulate-moba-match';

const SYNC_VERSION = 66; 

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
    if (isUserLoading || !user?.uid || !isLoaded || !selectedLeagueId) return;

    const syncSharedWorld = async () => {
      const info = getGlobalSeasonInfo();
      const currentSeason = Number(info.activeSeasonNumber);
      const lId = String(selectedLeagueId);
      const tier = Number(leagueLevel);
      const group = Number(groupId);
      const myRank = Number(rank || 1);

      const syncKey = `${userId}_s${currentSeason}_v${SYNC_VERSION}`;
      if (syncInProgressRef.current === syncKey) return;
      syncInProgressRef.current = syncKey;

      const tableId = `s${currentSeason}_l${lId}_t${tier}_g${group}`;
      const tableRef = doc(db, 'league_tables_v1', tableId);

      // Fail-safe: если синхронизация затянется, всё равно разблокируем UI через 5 секунд
      const failSafeTimer = setTimeout(() => {
        console.warn("[SYNC v66] Fail-safe triggered. Unlocking UI.");
        setWorldReady(true);
      }, 5000);

      try {
        console.log(`[WORLD SYNC v66] Initializing Protocol for ${tableId}`);

        // 1. ПОЛУЧЕНИЕ ИЛИ СОЗДАНИЕ ТАБЛИЦЫ
        let tableSnap = await getDoc(tableRef);
        let teamData = [];

        if (!tableSnap.exists()) {
          console.log(`[V66] Table missing. Creating full group skeleton.`);
          teamData = getStableGroupTeams(tier, group, lId, [{
            id: userId,
            name: displayName || "Manager",
            rank: myRank,
            isBot: false
          }]);
          
          await setDoc(tableRef, {
            tableId, season: currentSeason, leagueId: lId, tier, group,
            teamData, stats: {}, createdAt: serverTimestamp(), version: SYNC_VERSION
          });
        } else {
          const data = tableSnap.data();
          teamData = data.teamData || [];
          
          // Проверяем, вписан ли Я в таблицу на свое место
          const mySlotIndex = myRank - 1;
          const mySlot = teamData[mySlotIndex];
          if (!mySlot || mySlot.id !== userId) {
            console.log(`[V66] Player missing from slot ${myRank}. Forcing injection.`);
            teamData[mySlotIndex] = {
              id: userId,
              name: displayName || "Manager",
              rank: myRank,
              isBot: false
            };
            await updateDoc(tableRef, { teamData, updatedAt: serverTimestamp() });
          }
        }

        // 2. СИНХРОНИЗАЦИЯ КАЛЕНДАРЯ
        const matchesQuery = query(collection(db, 'matches_v1'), where('tableId', '==', tableId));
        const matchesSnap = await getDocs(matchesQuery);

        if (matchesSnap.empty) {
          console.log(`[V66] Matches missing. Generating 56-match cycle.`);
          const batch = writeBatch(db);
          const calendar = generateSeasonCalendar(teamData, currentSeason, lId);
          calendar.forEach(m => {
            const mId = `m_s${currentSeason}_${lId}_t${tier}_g${group}_d${m.day}_h${m.homeId}`;
            batch.set(doc(db, 'matches_v1', mId), {
              ...m, tableId, season: currentSeason, leagueId: lId, tier, groupId: String(group),
              status: 'scheduled', isFinished: false, version: SYNC_VERSION
            });
          });
          await batch.commit();
        } else {
          // Принудительное обновление имен в матчах (если там стоят BOT ID)
          const batch = writeBatch(db);
          let needsUpdate = false;
          matchesSnap.docs.forEach(d => {
            const m = d.data();
            const correctHome = teamData.find(t => t.id === m.homeId)?.name || m.homeName;
            const correctAway = teamData.find(t => t.id === m.awayId)?.name || m.awayName;
            
            if (m.homeName !== correctHome || m.awayName !== correctAway) {
              needsUpdate = true;
              batch.update(d.ref, { homeName: correctHome, awayName: correctAway });
            }
          });
          if (needsUpdate) {
            console.log(`[V66] Updating match participant names to match table.`);
            await batch.commit();
          }
        }

        // РАЗБЛОКИРОВКА UI
        clearTimeout(failSafeTimer);
        setWorldReady(true);

        // 3. АВТО-РЕЗОЛВЕР (Фоновая симуляция просроченных игр всей группы)
        const pendingQuery = query(
          collection(db, 'matches_v1'),
          where('tableId', '==', tableId),
          where('isFinished', '==', false)
        );
        const pendingSnap = await getDocs(pendingQuery);

        for (const mDoc of pendingSnap.docs) {
          const mData = mDoc.data();
          if (isMatchOverdue(mData.startTime)) {
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
              // Детерминированный результат для ботов
              const [sA, sB] = getMatchResult(mData.homeId, mData.awayId, currentSeason, false);
              simulation = { 
                winner: sA > sB ? mData.homeName : (sB > sA ? mData.awayName : "Ничья"), 
                seriesScore: `${sA}-${sB}`, 
                games: [{ scoreA: sA > 0 ? 1 : 0, scoreB: sB > 0 ? 1 : 0, duration: "30:00", mvp: "Bot System", matchSummary: "Automatic FMO Resolution." }] 
              };
            }

            const scoreParts = simulation.seriesScore.split('-');
            const fSA = parseInt(scoreParts[0]);
            const fSB = parseInt(scoreParts[1]);

            await runTransaction(db, async (transaction) => {
              const tCurrentSnap = await transaction.get(tableRef);
              if (tCurrentSnap.exists()) {
                const stats = tCurrentSnap.data().stats || {};
                const updateStat = (tid: string, s: number, os: number) => {
                  if (!stats[tid]) stats[tid] = { points: 0, matchesPlayed: 0, wins: 0, draws: 0, losses: 0, diff: 0 };
                  stats[tid].matchesPlayed++;
                  if (s > os) { stats[tid].wins++; stats[tid].points += 3; }
                  else if (s === os) { stats[tid].draws++; stats[tid].points += 1; }
                  else { stats[tid].losses++; }
                  stats[tid].diff += (s - os);
                };
                updateStat(mData.homeId, fSA, fSB);
                updateStat(mData.awayId, fSB, fSA);
                transaction.update(tableRef, { stats, updatedAt: serverTimestamp() });
              }
              transaction.update(mDoc.ref, {
                scoreA: fSA, scoreB: fSB, status: 'finished', isFinished: true, simulation, finishedAt: serverTimestamp()
              });
            });
          }
        }
      } catch (e) {
        console.error("[V66 SYNC ERROR]", e);
        clearTimeout(failSafeTimer);
        setWorldReady(true);
      }
    };

    syncSharedWorld();
  }, [isLoaded, userId, displayName, selectedLeagueId, leagueLevel, groupId, rank, ownedPlayers, lineup, strategy, staff, bootcamp, db, isUserLoading, user, setWorldReady]);

  return null;
}
