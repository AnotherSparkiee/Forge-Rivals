'use client';

/**
 * @fileOverview Ядро MMO-синхронизации v60 (Great Redistribution).
 * 1. Проводит полный сброс мира и перераспределение игроков по высшим доступным уровням.
 * 2. Инициализирует группы по 8 команд (1 игрок + 7 ботов).
 * 3. Генерирует календарь из 56 матчей на Сезон 1.
 */

import { useEffect, useRef } from 'react';
import { useGameState } from '@/app/lib/store';
import { useUser, useFirestore } from '@/firebase';
import { 
  doc, getDoc, writeBatch, serverTimestamp, collection, query, where, getDocs, updateDoc 
} from 'firebase/firestore';
import { getGlobalSeasonInfo, GLOBAL_EPOCH_ISO } from '@/app/lib/time-utils';
import { LEAGUES, getStableGroupTeams } from '@/app/lib/leagues-data';

const SYNC_VERSION = 60;

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
        const rootSnap = await getDoc(rootRef);
        const rootData = rootSnap.data() || {};
        
        let activeLevel = Number(rootData.leagueLevel || leagueLevel);
        let activeGroup = Number(rootData.groupId || groupId);
        let activeRank = Number(rootData.rank || rank || 1);

        // 1. GREAT REDISTRIBUTION (v60 Patch)
        if (Number(rootData.version || 0) < SYNC_VERSION) {
          console.log(`[GREAT REDISTRIBUTION v60] Relocating manager ${displayName}...`);
          
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
            if (!occupiedIndices.has(i)) {
              foundIndex = i;
              break;
            }
          }

          const groupIndex = Math.floor(foundIndex / 8);
          activeLevel = Math.floor(Math.log2(groupIndex + 1)) + 1;
          const groupsBeforeTier = Math.pow(2, activeLevel - 1) - 1;
          activeGroup = (groupIndex - groupsBeforeTier) + 1;
          activeRank = (foundIndex % 8) + 1;

          await updateDoc(rootRef, {
            leagueLevel: activeLevel,
            groupId: activeGroup,
            rank: activeRank,
            version: SYNC_VERSION,
            lastProcessedSeason: currentSeason
          });
        }

        // 2. GROUP INITIALIZATION
        const tableId = `s${currentSeason}_l${lId}_t${activeLevel}_g${activeGroup}`;
        const tableRef = doc(db, 'league_tables_v1', tableId);
        const tableSnap = await getDoc(tableRef);

        const seasonId = `season_${currentSeason}`;
        const prefixedGroupId = `${seasonId}_league_${lId}_group_${activeGroup}`;
        const teamInLeagueRef = doc(db, 'leagues_v2', lId, 'divisions', String(activeLevel), 'groups', prefixedGroupId, 'teams', userId);

        if (!tableSnap.exists()) {
          console.log(`[WORLD GEN v60] Initializing group ${tableId}...`);
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

          batch.set(teamInLeagueRef, {
            id: userId,
            displayName: String(displayName),
            rank: activeRank,
            updatedAt: serverTimestamp(),
            version: SYNC_VERSION
          }, { merge: true });

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
          // Robust Displacement check
          const data = tableSnap.data();
          const batch = writeBatch(db);
          let needsCommit = false;

          if (data) {
            const teamData = [...(data.teamData || [])];
            const slotIdx = activeRank - 1;
            const currentSlotTeam = teamData[slotIdx];
            
            // Check if player is NOT in teams array OR their slot is occupied by a bot
            const isMissingInArray = !data.teams.includes(userId);
            const isSlotOccupiedByBot = currentSlotTeam && (currentSlotTeam.isBot || String(currentSlotTeam.id).toLowerCase().startsWith('bot'));

            if (isMissingInArray || isSlotOccupiedByBot) {
              console.log(`[DISPLACEMENT v60] Correcting table for ${displayName} at slot ${activeRank}`);
              
              const botIdToRemove = isSlotOccupiedByBot ? currentSlotTeam.id : null;
              
              teamData[slotIdx] = { id: userId, name: String(displayName), isBot: false, rank: activeRank };
              
              const newTeams = teamData.map((t: any) => t.id);
              const newStats = { ...(data.stats || {}) };
              
              if (botIdToRemove) delete newStats[botIdToRemove];
              if (!newStats[userId]) {
                newStats[userId] = { points: 0, matchesPlayed: 0, wins: 0, draws: 0, losses: 0, diff: 0 };
              }
              
              batch.update(tableRef, { 
                teams: newTeams, teamData: teamData, stats: newStats, 
                updatedAt: serverTimestamp(), version: SYNC_VERSION 
              });
              needsCommit = true;
            }
          }

          batch.set(teamInLeagueRef, {
            id: userId, displayName: String(displayName), rank: activeRank,
            updatedAt: serverTimestamp(), version: SYNC_VERSION
          }, { merge: true });
          needsCommit = true;

          if (needsCommit) await batch.commit();
        }

        setWorldReady(true);
      } catch (e) {
        console.error("[AUTO-MANAGER v60 ERROR]", e);
        setWorldReady(true);
      }
    };

    syncSharedWorld();
  }, [isLoaded, userId, displayName, selectedLeagueId, leagueLevel, groupId, isUserLoading, user, db, setWorldReady, rank, lastProcessedSeason]);

  return null;
}
