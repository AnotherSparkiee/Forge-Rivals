
'use client';

/**
 * @fileOverview Ядро MMO-синхронизации v61 (Self-Simulating World).
 * 1. Управляет распределением игроков (Great Redistribution).
 * 2. Автоматически разрешает (симулирует) матчи группы, время которых наступило.
 * 3. Обновляет турнирные таблицы на основе реальных результатов симуляции.
 */

import { useEffect, useRef } from 'react';
import { useGameState } from '@/app/lib/store';
import { useUser, useFirestore } from '@/firebase';
import { 
  doc, getDoc, writeBatch, serverTimestamp, collection, query, where, getDocs, updateDoc, runTransaction 
} from 'firebase/firestore';
import { getGlobalSeasonInfo, GLOBAL_EPOCH_ISO, isMatchOverdue } from '@/app/lib/time-utils';
import { LEAGUES, getStableGroupTeams } from '@/app/lib/leagues-data';
import { simulateMobaMatch } from '@/ai/flows/simulate-moba-match';

const SYNC_VERSION = 60;

export function AutoMatchManager() {
  const { user, isUserLoading } = useUser();
  const { 
    isLoaded, id: userId, displayName, selectedLeagueId, 
    leagueLevel, groupId, setWorldReady, rank, 
    lastProcessedSeason, strategy, ownedPlayers, lineup, staff, bootcamp
  } = useGameState();
  const db = useFirestore();
  
  const syncInProgressRef = useRef<string | null>(null);

  useEffect(() => {
    if (isUserLoading || !user?.uid || !isLoaded || !selectedLeagueId || !displayName) return;

    const syncSharedWorld = async () => {
      const info = getGlobalSeasonInfo();
      const currentSeason = Number(info.activeSeasonNumber);
      const lId = String(selectedLeagueId);
      
      const syncKey = `${userId}_s${currentSeason}_v${SYNC_VERSION}_sync`;
      if (syncInProgressRef.current === syncKey) return;
      syncInProgressRef.current = syncKey;

      try {
        const rootRef = doc(db, 'players_v10', userId);
        const rootSnap = await getDoc(rootRef);
        const rootData = rootSnap.data() || {};
        
        let activeLevel = Number(rootData.leagueLevel || leagueLevel);
        let activeGroup = Number(rootData.groupId || groupId);
        let activeRank = Number(rootData.rank || rank || 1);

        // 1. REDISTRIBUTION & PLACEMENT (v60 Standard)
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

        // 2. WORLD RESOLVER (v61 - Auto Match Processor)
        const tableId = `s${currentSeason}_l${lId}_t${activeLevel}_g${activeGroup}`;
        const tableRef = doc(db, 'league_tables_v1', tableId);
        
        // Поиск просроченных матчей в этой группе
        const qMatches = query(
          collection(db, 'matches_v1'),
          where('tableId', '==', tableId),
          where('isFinished', '==', false),
          where('version', '==', SYNC_VERSION)
        );

        const matchSnap = await getDocs(qMatches);
        if (!matchSnap.empty) {
          console.log(`[RESOLVER v61] Checking ${matchSnap.size} pending matches for group ${tableId}...`);
          
          for (const mDoc of matchSnap.docs) {
            const mData = mDoc.data();
            if (isMatchOverdue(mData.startTime)) {
              console.log(`[RESOLVER v61] Processing overdue match: ${mDoc.id}`);
              
              // Заглушка для симуляции бот-матча или матча игрока
              const isPlayerHome = mData.homeId === userId;
              const isPlayerAway = mData.awayId === userId;

              let result;
              if (isPlayerHome || isPlayerAway) {
                // Если играет текущий игрок - используем его реальный состав
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
                // Бот против бота - быстрая детерминированная симуляция
                const winsA = Math.random() > 0.5 ? 2 : (Math.random() > 0.5 ? 1 : 0);
                const winsB = winsA === 2 ? 0 : (winsA === 1 ? 1 : 2);
                result = { winner: winsA > winsB ? mData.homeName : (winsB > winsA ? mData.awayName : "Draw"), seriesScore: `${winsA}-${winsB}`, games: [{ scoreA: winsA > 0 ? 1 : 0, scoreB: winsB > 0 ? 1 : 0, duration: "32:00", mvp: "Bot", matchSummary: "Standard tactical engagement." }] };
              }

              const scoreParts = result.seriesScore.split('-');
              const sA = parseInt(scoreParts[0]);
              const sB = parseInt(scoreParts[1]);

              // Атомарное обновление матча и таблицы
              await runTransaction(db, async (transaction) => {
                const tSnap = await transaction.get(tableRef);
                if (tSnap.exists()) {
                  const tData = tSnap.data();
                  const stats = tData.stats || {};
                  
                  const updateStats = (id: string, score: number, oppScore: number) => {
                    if (!stats[id]) stats[id] = { points: 0, matchesPlayed: 0, wins: 0, draws: 0, losses: 0, diff: 0 };
                    stats[id].matchesPlayed++;
                    if (score > oppScore) { stats[id].wins++; stats[id].points += 3; }
                    else if (score === oppScore) { stats[id].draws++; stats[id].points += 1; }
                    else { stats[id].losses++; }
                    stats[id].diff += (score - oppScore);
                  };

                  updateStats(mData.homeId, sA, sB);
                  updateStats(mData.awayId, sB, sA);
                  transaction.update(tableRef, { stats, updatedAt: serverTimestamp() });
                }

                transaction.update(mDoc.ref, {
                  scoreA: sA, scoreB: sB, winnerId: sA > sB ? mData.homeId : (sB > sA ? mData.awayId : null),
                  status: 'finished', isFinished: true, simulation: result, finishedAt: serverTimestamp()
                });
              });
            }
          }
        }

        setWorldReady(true);
      } catch (e) {
        console.error("[AUTO-MANAGER v61 ERROR]", e);
        setWorldReady(true);
      }
    };

    syncSharedWorld();
  }, [isLoaded, userId, displayName, selectedLeagueId, leagueLevel, groupId, isUserLoading, user, db, setWorldReady, rank, lastProcessedSeason, strategy, ownedPlayers, lineup, staff, bootcamp]);

  return null;
}
