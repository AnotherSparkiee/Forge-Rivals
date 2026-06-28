
'use client';

/**
 * @fileOverview Ядро MMO-синхронизации v61.1 (Self-Healing World).
 * 1. Управляет стратегическим распределением (Great Redistribution).
 * 2. Вытесняет ботов из существующих таблиц и календарей при входе реального игрока.
 * 3. Автоматически разрешает (симулирует) матчи группы и обновляет Standings.
 */

import { useEffect, useRef } from 'react';
import { useGameState } from '@/app/lib/store';
import { useUser, useFirestore } from '@/firebase';
import { 
  doc, getDoc, writeBatch, serverTimestamp, collection, query, where, getDocs, updateDoc, runTransaction, setDoc 
} from 'firebase/firestore';
import { getGlobalSeasonInfo, isMatchOverdue } from '@/app/lib/time-utils';
import { LEAGUES, getStableGroupTeams, generateSeasonCalendar } from '@/app/lib/leagues-data';
import { simulateMobaMatch } from '@/ai/flows/simulate-moba-match';

const SYNC_VERSION = 60;

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
      
      const syncKey = `${userId}_s${currentSeason}_v${SYNC_VERSION}_sync_v61_1`;
      if (syncInProgressRef.current === syncKey) return;
      syncInProgressRef.current = syncKey;

      try {
        console.log(`[WORLD v61.1] Syncing node for ${displayName}...`);
        
        const rootRef = doc(db, 'players_v10', userId);
        const rootSnap = await getDoc(rootRef);
        const rootData = rootSnap.data() || {};
        
        let activeLevel = Number(rootData.leagueLevel || leagueLevel);
        let activeGroup = Number(rootData.groupId || groupId);
        let activeRank = Number(rootData.rank || rank || 1);

        // 1. STRATEGIC PLACEMENT (Redistribution v60)
        if (Number(rootData.version || 0) < SYNC_VERSION) {
          const q = query(collection(db, 'players_v10'), where('selectedLeagueId', '==', lId));
          const snap = await getDocs(q);
          const occupiedIndices = new Set<number>();
          
          snap.forEach(d => {
            const data = d.data();
            if (data.version === SYNC_VERSION) {
              const t = Number(data.leagueLevel);
              const g = Number(data.groupId);
              const r = Number(data.rank);
              if (t && g && r) {
                const groupsBefore = Math.pow(2, t - 1) - 1;
                const globalIndex = (groupsBefore * 8) + (g - 1) * 8 + (r - 1);
                occupiedIndices.add(globalIndex);
              }
            }
          });

          let foundIndex = 0;
          for (let i = 0; i < 4088; i++) {
            if (!occupiedIndices.has(i)) { foundIndex = i; break; }
          }

          const groupIndex = Math.floor(foundIndex / 8);
          activeLevel = Math.floor(Math.log2(groupIndex + 1)) + 1;
          const groupsBeforeTier = Math.pow(2, activeLevel - 1) - 1;
          activeGroup = (groupIndex - groupsBeforeTier) + 1;
          activeRank = (foundIndex % 8) + 1;

          await updateDoc(rootRef, {
            leagueLevel: activeLevel, groupId: activeGroup, rank: activeRank,
            version: SYNC_VERSION, lastProcessedSeason: currentSeason
          });
        }

        // 2. TABLE INITIALIZATION & BOT DISPLACEMENT
        const tableId = `s${currentSeason}_l${lId}_t${activeLevel}_g${activeGroup}`;
        const tableRef = doc(db, 'league_tables_v1', tableId);
        const tableSnap = await getDoc(tableRef);

        if (!tableSnap.exists()) {
          // Create fresh table with displacement
          const teams = getStableGroupTeams(activeLevel, activeGroup, lId, [{ id: userId, displayName, rank: activeRank }]);
          await setDoc(tableRef, {
            tableId, season: currentSeason, leagueId: lId, tier: activeLevel, group: activeGroup,
            teamData: teams, stats: {}, createdAt: serverTimestamp(), version: SYNC_VERSION
          });
          
          // Generate 56 matches for this group
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
          // Table exists - check if bot needs to be displaced
          const tData = tableSnap.data();
          const teams = tData.teamData || [];
          const slot = teams[activeRank - 1];

          if (slot && slot.isBot) {
            console.log(`[WORLD v61.1] Displacing bot ${slot.id} with ${displayName} at rank ${activeRank}`);
            const updatedTeams = [...teams];
            updatedTeams[activeRank - 1] = { id: userId, name: displayName, isBot: false, rank: activeRank };
            
            await updateDoc(tableRef, { teamData: updatedTeams });

            // Also update bot name in future matches for this group
            const qM = query(collection(db, 'matches_v1'), where('tableId', '==', tableId), where('isFinished', '==', false));
            const mSnap = await getDocs(qM);
            const batch = writeBatch(db);
            mSnap.forEach(mDoc => {
              const m = mDoc.data();
              const update: any = {};
              if (m.homeId === slot.id) { update.homeId = userId; update.homeName = displayName; }
              if (m.awayId === slot.id) { update.awayId = userId; update.awayName = displayName; }
              if (Object.keys(update).length > 0) batch.update(mDoc.ref, update);
            });
            await batch.commit();
          }
        }

        // 3. AUTO-RESOLVER (Process overdue matches)
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
            console.log(`[RESOLVER v61.1] Resolving match ${mDoc.id}`);
            
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
              // Bot vs Bot deterministic result
              const winsA = Math.random() > 0.5 ? 2 : (Math.random() > 0.5 ? 1 : 0);
              const winsB = winsA === 2 ? 0 : (winsA === 1 ? 1 : 2);
              result = { winner: winsA > winsB ? mData.homeName : (winsB > winsA ? mData.awayName : "Draw"), seriesScore: `${winsA}-${winsB}`, games: [{ scoreA: winsA > 0 ? 1 : 0, scoreB: winsB > 0 ? 1 : 0, duration: "32:00", mvp: "Bot", matchSummary: "Standard tactical engagement." }] };
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
        console.error("[AUTO-MANAGER v61.1 ERROR]", e);
        setWorldReady(true);
      }
    };

    syncSharedWorld();
  }, [isLoaded, userId, displayName, selectedLeagueId, leagueLevel, groupId, rank, ownedPlayers, lineup, strategy, staff, bootcamp, db, isUserLoading, user, setWorldReady]);

  return null;
}
