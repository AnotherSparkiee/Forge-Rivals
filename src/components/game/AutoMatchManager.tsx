
'use client';

/**
 * @fileOverview Ядро MMO-синхронизации v62 (Self-Healing World).
 * Полная автоматизация лиги в стиле FMO:
 * 1. Вытеснение ботов при входе реального игрока.
 * 2. Авто-симуляция просроченных матчей группы.
 * 3. Обновление Standings в реальном времени.
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

const SYNC_VERSION = 62;

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
      
      const syncKey = `${userId}_s${currentSeason}_v${SYNC_VERSION}_fmo_final`;
      if (syncInProgressRef.current === syncKey) return;
      syncInProgressRef.current = syncKey;

      try {
        console.log(`[FMO ENGINE v62] Syncing node for ${displayName}...`);
        
        const rootRef = doc(db, 'players_v10', userId);
        const rootSnap = await getDoc(rootRef);
        const rootData = rootSnap.data() || {};
        
        const activeLevel = Number(rootData.leagueLevel || leagueLevel);
        const activeGroup = Number(rootData.groupId || groupId);
        const activeRank = Number(rootData.rank || rank || 1);

        const tableId = `s${currentSeason}_l${lId}_t${activeLevel}_g${activeGroup}`;
        const tableRef = doc(db, 'league_tables_v1', tableId);
        const tableSnap = await getDoc(tableRef);

        // 1. ИНИЦИАЛИЗАЦИЯ ТАБЛИЦЫ И КАЛЕНДАРЯ
        if (!tableSnap.exists()) {
          const teams = getStableGroupTeams(activeLevel, activeGroup, lId, [{ id: userId, displayName, rank: activeRank }]);
          await setDoc(tableRef, {
            tableId, season: currentSeason, leagueId: lId, tier: activeLevel, group: activeGroup,
            teamData: teams, stats: {}, createdAt: serverTimestamp(), version: SYNC_VERSION
          });
          
          const batch = writeBatch(db);
          const matches = generateSeasonCalendar(teams, currentSeason, lId);
          matches.forEach(m => {
            const mId = `m_s${currentSeason}_${lId}_t${activeLevel}_g${activeGroup}_d${m.day}_h${m.homeId}`;
            batch.set(doc(db, 'matches_v1', mId), {
              ...m, tableId, season: currentSeason, leagueId: lId, tier: activeLevel, groupId: String(activeGroup),
              status: 'scheduled', isFinished: false, version: SYNC_VERSION
            });
          });
          await batch.commit();
        } else {
          // 2. ВЫТЕСНЕНИЕ БОТА (Если игрок зашел в готовую таблицу)
          const tData = tableSnap.data();
          const teams = tData.teamData || [];
          const slot = teams[activeRank - 1];

          if (slot && slot.isBot) {
            console.log(`[FMO ENGINE] Displacing bot ${slot.id} -> ${displayName}`);
            const updatedTeams = [...teams];
            updatedTeams[activeRank - 1] = { id: userId, name: displayName, isBot: false, rank: activeRank };
            await updateDoc(tableRef, { teamData: updatedTeams });

            const qM = query(collection(db, 'matches_v1'), where('tableId', '==', tableId), where('isFinished', '==', false));
            const mSnap = await getDocs(qM);
            const batch = writeBatch(db);
            mSnap.forEach(mDoc => {
              const m = mDoc.data();
              const upd: any = {};
              if (m.homeId === slot.id) { upd.homeId = userId; upd.homeName = displayName; }
              if (m.awayId === slot.id) { upd.awayId = userId; upd.awayName = displayName; }
              if (Object.keys(upd).length > 0) batch.update(mDoc.ref, upd);
            });
            await batch.commit();
          }
        }

        // 3. AUTO-RESOLVER (Симуляция всех прошедших игр группы)
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
            console.log(`[RESOLVER v62] Processing overdue match: ${mDoc.id}`);
            
            const isPlayerHome = mData.homeId === userId;
            const isPlayerAway = mData.awayId === userId;
            let result;

            if (isPlayerHome || isPlayerAway) {
              const squad = ownedPlayers.filter(p => Object.values(lineup).includes(p.id)).map(p => ({
                name: p.name, role: p.role, overallRating: p.overallRating, proStats: p.proStats,
                isSub: p.id === lineup.sub1 || p.id === lineup.sub2
              }));

              result = await simulateMobaMatch({
                teamA: isPlayerHome ? { name: displayName, strategy, heroes: squad, staffBonus: staff.coach?.skills?.primary, infraBonus: (bootcamp.bootcampLevel || 0) } : { name: mData.homeName, strategy: "Balanced", heroes: [] },
                teamB: isPlayerAway ? { name: displayName, strategy, heroes: squad, staffBonus: staff.coach?.skills?.primary, infraBonus: (bootcamp.bootcampLevel || 0) } : { name: mData.awayName, strategy: "Balanced", heroes: [] },
                isBo2: true
              });
            } else {
              const winsA = Math.random() > 0.5 ? 2 : (Math.random() > 0.3 ? 1 : 0);
              const winsB = winsA === 2 ? 0 : (winsA === 1 ? 1 : 2);
              result = { 
                winner: winsA > winsB ? mData.homeName : (winsB > winsA ? mData.awayName : "Draw"), 
                seriesScore: `${winsA}-${winsB}`, 
                games: [{ scoreA: winsA > 0 ? 1 : 0, scoreB: winsB > 0 ? 1 : 0, duration: "35:00", mvp: "Bot", matchSummary: "Automated simulation." }] 
              };
            }

            const scoreParts = result.seriesScore.split('-');
            const sA = parseInt(scoreParts[0]);
            const sB = parseInt(scoreParts[1]);

            await runTransaction(db, async (transaction) => {
              const tCurrentSnap = await transaction.get(tableRef);
              if (tCurrentSnap.exists()) {
                const stats = tCurrentSnap.data().stats || {};
                const updateStats = (id: string, sc: number, osc: number) => {
                  if (!stats[id]) stats[id] = { points: 0, matchesPlayed: 0, wins: 0, draws: 0, losses: 0, diff: 0 };
                  stats[id].matchesPlayed++;
                  if (sc > osc) { stats[id].wins++; stats[id].points += 3; }
                  else if (sc === osc) { stats[id].draws++; stats[id].points += 1; }
                  else { stats[id].losses++; }
                  stats[id].diff += (sc - osc);
                };
                updateStats(mData.homeId, sA, sB);
                updateStats(mData.awayId, sB, sA);
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
        console.error("[AUTO-MANAGER v62 ERROR]", e);
        setWorldReady(true);
      }
    };

    syncSharedWorld();
  }, [isLoaded, userId, displayName, selectedLeagueId, leagueLevel, groupId, rank, ownedPlayers, lineup, strategy, staff, bootcamp, db, isUserLoading, user, setWorldReady]);

  return null;
}
