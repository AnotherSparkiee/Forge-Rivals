'use client';

/**
 * @fileOverview Ядро MMO-синхронизации v52.1 (Resilient Grouping & Bot Displacement).
 * ГАРАНТИРУЕТ:
 * 1. Инициализацию группы лиги (standings + 56 matches) при первом входе.
 * 2. Атомарное вытеснение бота реальным игроком в его Rank-слоте.
 * 3. Транзит между сезонами и восстановление существующих игроков.
 */

import { useEffect, useRef } from 'react';
import { useGameState } from '@/app/lib/store';
import { useUser, useFirestore } from '@/firebase';
import { 
  doc, getDoc, writeBatch, serverTimestamp, updateDoc, setDoc, collection
} from 'firebase/firestore';
import { getGlobalSeasonInfo, GLOBAL_EPOCH_ISO } from '@/app/lib/time-utils';
import { LEAGUES, getStableGroupTeams } from '@/app/lib/leagues-data';

const SYNC_VERSION = 52;

export function AutoMatchManager() {
  const { user, isUserLoading } = useUser();
  const { 
    isLoaded, id: userId, displayName, selectedLeagueId, 
    leagueLevel, groupId, setWorldReady, rank, 
    lastProcessedSeason 
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
        let activeLevel = Number(leagueLevel);
        let activeGroup = Number(groupId);
        let activeRank = Number(rank || 1);

        // 1. SEASON TRANSITION (Promotion/Relegation)
        const lastProcessed = Number(lastProcessedSeason || 0);
        if (lastProcessed > 0 && currentSeason > lastProcessed) {
          console.log(`[SEASON TRANSITION v52] Processing Season ${lastProcessed} -> ${currentSeason}...`);
          
          const prevTableId = `s${lastProcessed}_l${lId}_t${activeLevel}_g${activeGroup}`;
          const prevTableSnap = await getDoc(doc(db, 'league_tables_v1', prevTableId));
          
          if (prevTableSnap.exists()) {
            const tableData = prevTableSnap.data();
            const stats = tableData.stats || {};
            
            const standings = (tableData.teamData || []).map((t: any) => ({
              id: t.id,
              points: stats[t.id]?.points || 0,
              diff: stats[t.id]?.diff || 0
            })).sort((a: any, b: any) => b.points - a.points || b.diff - a.diff);

            const myPosition = standings.findIndex((s: any) => s.id === userId) + 1;

            if (myPosition === 1 && activeLevel > 1) {
              activeLevel -= 1;
              activeGroup = Math.ceil(activeGroup / 2);
              activeRank = activeGroup % 2 === 1 ? 7 : 8; 
            } else if (myPosition >= 7 && activeLevel < 9) {
              activeLevel += 1;
              activeGroup = (activeGroup * 2) - (myPosition === 7 ? 1 : 0);
              activeRank = 1;
            }

            await updateDoc(rootRef, {
              leagueLevel: activeLevel,
              groupId: activeGroup,
              rank: activeRank,
              lastProcessedSeason: currentSeason
            });
          } else {
            await updateDoc(rootRef, { lastProcessedSeason: currentSeason });
          }
        } else if (lastProcessed === 0) {
          await updateDoc(rootRef, { lastProcessedSeason: currentSeason });
        }

        // 2. GROUP INITIALIZATION & BOT DISPLACEMENT
        const tableId = `s${currentSeason}_l${lId}_t${activeLevel}_g${activeGroup}`;
        const tableRef = doc(db, 'league_tables_v1', tableId);
        const tableSnap = await getDoc(tableRef);

        const seasonId = `season_${currentSeason}`;
        const prefixedGroupId = `${seasonId}_league_${lId}_group_${activeGroup}`;
        const teamInLeagueRef = doc(db, 'leagues_v2', lId, 'divisions', String(activeLevel), 'groups', prefixedGroupId, 'teams', userId);

        if (!tableSnap.exists()) {
          console.log(`[WORLD GEN v52] Initializing group structure for ${tableId}...`);
          const batch = writeBatch(db);
          
          const teams = getStableGroupTeams(activeLevel, activeGroup, lId, [{
            id: userId,
            displayName: String(displayName),
            rank: activeRank
          }]);

          const stats: any = {};
          teams.forEach(t => {
            stats[t.id] = { points: 0, matchesPlayed: 0, wins: 0, draws: 0, losses: 0, diff: 0 };
          });

          batch.set(tableRef, {
            id: tableId, season: currentSeason, leagueId: lId, tier: activeLevel, group: activeGroup,
            teams: teams.map(t => t.id),
            teamData: teams,
            stats,
            version: SYNC_VERSION,
            updatedAt: serverTimestamp()
          });

          // Ensure team document exists in leagues_v2 (Fixing "No document to update")
          batch.set(teamInLeagueRef, {
            id: userId,
            displayName: String(displayName),
            rank: activeRank,
            updatedAt: serverTimestamp(),
            version: SYNC_VERSION
          }, { merge: true });

          // Generate 56-match Calendar
          const leagueInfo = LEAGUES.find(l => l.id === lId) || LEAGUES[0];
          const [hh, mm] = leagueInfo.startTime.split(':').map(Number);
          const seasonStartMs = new Date(GLOBAL_EPOCH_ISO).getTime() + (currentSeason - 1) * 15 * 24 * 3600000;

          const teamIds = teams.map(t => t.id);
          const scheduleIndices = Array.from({ length: 8 }, (_, i) => i);
          
          for (let r = 0; r < 7; r++) {
            for (let i = 0; i < 4; i++) {
              let hIdx = scheduleIndices[i];
              let aIdx = scheduleIndices[7 - i];
              if (r % 2 === 1) [hIdx, aIdx] = [aIdx, hIdx];
              
              const hId = teamIds[hIdx];
              const aId = teamIds[aIdx];
              
              const createMatch = (day: number, h: string, a: string) => {
                const startTime = new Date(seasonStartMs + (day - 1) * 24 * 3600000 + hh * 3600000 + mm * 60000);
                const matchId = `m_v${SYNC_VERSION}_${tableId}_d${day}_h${h}`;
                batch.set(doc(db, 'matches_v1', matchId), {
                  id: matchId, tableId, season: currentSeason, tour: day, day,
                  homeId: h, homeName: teams.find(t => t.id === h)?.name || h,
                  awayId: a, awayName: teams.find(t => t.id === a)?.name || a,
                  startTime: startTime.toISOString(),
                  isFinished: false, version: SYNC_VERSION, createdAt: serverTimestamp()
                });
              };

              createMatch(r + 1, hId, aId);
              createMatch(r + 8, aId, hId);
            }
            const last = scheduleIndices.pop()!;
            scheduleIndices.splice(1, 0, last);
          }
          
          await batch.commit();
        } else {
          // Table exists, check for displacement or missing team doc
          const data = tableSnap.data();
          const batch = writeBatch(db);
          let needsCommit = false;

          if (data && !data.teams.includes(userId)) {
            const teamData = [...(data.teamData || [])];
            const slotIdx = activeRank - 1;
            
            if (teamData[slotIdx] && (teamData[slotIdx].isBot || String(teamData[slotIdx].id).startsWith('bot'))) {
              const botIdToRemove = teamData[slotIdx].id;
              teamData[slotIdx] = { id: userId, name: String(displayName), isBot: false, rank: activeRank };
              
              const newTeams = teamData.map((t: any) => t.id);
              const newStats = { ...(data.stats || {}) };
              delete newStats[botIdToRemove];
              newStats[userId] = { points: 0, matchesPlayed: 0, wins: 0, draws: 0, losses: 0, diff: 0 };
              
              batch.update(tableRef, { 
                teams: newTeams, teamData: teamData, stats: newStats, 
                updatedAt: serverTimestamp(), version: SYNC_VERSION 
              });
              needsCommit = true;
            }
          }

          // Force create team doc if missing
          batch.set(teamInLeagueRef, {
            id: userId,
            displayName: String(displayName),
            rank: activeRank,
            updatedAt: serverTimestamp(),
            version: SYNC_VERSION
          }, { merge: true });
          needsCommit = true;

          if (needsCommit) await batch.commit();
        }

        setWorldReady(true);
      } catch (e) {
        console.error("[AUTO-MANAGER v52.1 ERROR]", e);
        setWorldReady(true);
      }
    };

    syncSharedWorld();
  }, [isLoaded, userId, displayName, selectedLeagueId, leagueLevel, groupId, isUserLoading, user, db, setWorldReady, rank, lastProcessedSeason]);

  return null;
}
