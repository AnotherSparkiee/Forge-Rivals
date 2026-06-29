'use client';

/**
 * @fileOverview Ядро MMO-синхронизации v64 (FMO Absolute Sync).
 * Принудительно собирает всех реальных игроков группы в одну таблицу и синхронизирует календарь.
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

const SYNC_VERSION = 64; 

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

      const syncKey = `${userId}_s${currentSeason}_v${SYNC_VERSION}`;
      if (syncInProgressRef.current === syncKey) return;
      syncInProgressRef.current = syncKey;

      console.log(`[WORLD SYNC v64] Auditing Group ${lId} T${tier} G${group}...`);

      try {
        const tableId = `s${currentSeason}_l${lId}_t${tier}_g${group}`;
        const tableRef = doc(db, 'league_tables_v1', tableId);
        
        // 1. ПОЛУЧЕНИЕ ТЕКУЩЕЙ ТАБЛИЦЫ (БЫСТРАЯ ПРОВЕРКА)
        const tableSnap = await getDoc(tableRef);
        let currentTeams = [];

        if (!tableSnap.exists()) {
          console.log(`[V64] INITIALIZING NEW TABLE: ${tableId}`);
          // Сначала создаем с одним игроком, чтобы убрать экран загрузки
          currentTeams = getStableGroupTeams(tier, group, lId, [{
            id: userId,
            name: displayName || "Manager",
            rank: Number(rank || 1),
            isBot: false
          }]);
          
          await setDoc(tableRef, {
            tableId, season: currentSeason, leagueId: lId, tier, group,
            teamData: currentTeams, stats: {}, createdAt: serverTimestamp(), version: SYNC_VERSION
          });
        }

        // 2. ПОИСК ВСЕХ РЕАЛЬНЫХ ИГРОКОВ (ФОНОВОЕ ОБНОВЛЕНИЕ)
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
          rank: Number(d.data().rank || 1),
          isBot: false
        }));

        const tableSnapRefreshed = await getDoc(tableRef);
        if (tableSnapRefreshed.exists()) {
          const tableData = tableSnapRefreshed.data();
          currentTeams = tableData.teamData || [];
          let needsUpdate = false;

          realPlayers.forEach(rp => {
            const slotIdx = rp.rank - 1;
            if (slotIdx >= 0 && slotIdx < 8) {
              if (!currentTeams[slotIdx] || currentTeams[slotIdx].id !== rp.id) {
                currentTeams[slotIdx] = rp;
                needsUpdate = true;
              }
            }
          });

          if (needsUpdate) {
            await updateDoc(tableRef, { teamData: currentTeams, updatedAt: serverTimestamp() });
          }
        }

        // 3. СИНХРОНИЗАЦИЯ КАЛЕНДАРЯ
        const matchesQuery = query(collection(db, 'matches_v1'), where('tableId', '==', tableId));
        const matchesSnap = await getDocs(matchesQuery);

        if (matchesSnap.empty) {
          console.log(`[V64] GENERATING CALENDAR FOR: ${tableId}`);
          const batch = writeBatch(db);
          const calendar = generateSeasonCalendar(currentTeams, currentSeason, lId);
          calendar.forEach(m => {
            const mId = `m_s${currentSeason}_${lId}_t${tier}_g${group}_d${m.day}_h${m.homeId}`;
            batch.set(doc(db, 'matches_v1', mId), {
              ...m, tableId, season: currentSeason, leagueId: lId, tier, groupId: String(group),
              status: 'scheduled', isFinished: false, version: SYNC_VERSION
            });
          });
          await batch.commit();
        }

        // Убираем экран загрузки
        setWorldReady(true);

        // 4. АВТО-РЕЗОЛВЕР (Симуляция просроченных матчей в фоне)
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
              const [sA, sB] = getMatchResult(mData.homeId, mData.awayId, currentSeason, false);
              simulation = { 
                winner: sA > sB ? mData.homeName : (sB > sA ? mData.awayName : "Ничья"), 
                seriesScore: `${sA}-${sB}`, 
                games: [{ scoreA: sA > 0 ? 1 : 0, scoreB: sB > 0 ? 1 : 0, duration: "30:00", mvp: "Bot", matchSummary: "Automated result." }] 
              };
            }

            const scoreParts = simulation.seriesScore.split('-');
            const fSA = parseInt(scoreParts[0]);
            const fSB = parseInt(scoreParts[1]);

            await runTransaction(db, async (transaction) => {
              const tCurrentSnap = await transaction.get(tableRef);
              if (tCurrentSnap.exists()) {
                const stats = tCurrentSnap.data().stats || {};
                const upd = (tid: string, s: number, os: number) => {
                  if (!stats[tid]) stats[tid] = { points: 0, matchesPlayed: 0, wins: 0, draws: 0, losses: 0, diff: 0 };
                  stats[tid].matchesPlayed++;
                  if (s > os) { stats[tid].wins++; stats[tid].points += 3; }
                  else if (s === os) { stats[tid].draws++; stats[tid].points += 1; }
                  else { stats[tid].losses++; }
                  stats[tid].diff += (s - os);
                };
                upd(mData.homeId, fSA, fSB);
                upd(mData.awayId, fSB, fSA);
                transaction.update(tableRef, { stats, updatedAt: serverTimestamp() });
              }
              transaction.update(mDoc.ref, {
                scoreA: fSA, scoreB: fSB, status: 'finished', isFinished: true, simulation, finishedAt: serverTimestamp()
              });
            });
          }
        }
      } catch (e) {
        console.error("[V64 SYNC ERROR]", e);
        setWorldReady(true);
      }
    };

    syncSharedWorld();
  }, [isLoaded, userId, displayName, selectedLeagueId, leagueLevel, groupId, rank, ownedPlayers, lineup, strategy, staff, bootcamp, db, isUserLoading, user, setWorldReady]);

  return null;
}
