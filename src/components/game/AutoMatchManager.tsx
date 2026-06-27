'use client';

/**
 * @fileOverview Ядро MMO-синхронизации v48 (Living Ecosystem).
 * ГАРАНТИРУЕТ:
 * 1. Замещение ботов реальными игроками согласно их Rank (слоту).
 * 2. Генерацию 56 матчей сезона при первом создании группы.
 * 3. Атомарное создание таблиц версии 48.
 */

import { useEffect, useRef } from 'react';
import { useGameState } from '@/app/lib/store';
import { useUser, useFirestore } from '@/firebase';
import { 
  doc, getDoc, writeBatch, serverTimestamp, updateDoc, setDoc
} from 'firebase/firestore';
import { getGlobalSeasonInfo, GLOBAL_EPOCH_ISO } from '@/app/lib/time-utils';
import { LEAGUES, getStableGroupTeams } from '@/app/lib/leagues-data';

export function AutoMatchManager() {
  const { user, isUserLoading } = useUser();
  const { isLoaded, id: userId, displayName, selectedLeagueId, leagueLevel, groupId, setWorldReady, rank } = useGameState();
  const db = useFirestore();
  
  const syncInProgressRef = useRef<string | null>(null);

  useEffect(() => {
    if (isUserLoading || !user?.uid || !isLoaded || !selectedLeagueId || !displayName) return;

    const syncSharedWorld = async () => {
      const info = getGlobalSeasonInfo();
      const sNum = Number(info.activeSeasonNumber);
      const lId = String(selectedLeagueId);
      const tier = Number(leagueLevel);
      const grp = Number(groupId);
      const myRank = Number(rank || 1);
      
      const tableId = `s${sNum}_l${lId}_t${tier}_g${grp}`;
      
      if (syncInProgressRef.current === tableId) return;
      syncInProgressRef.current = tableId;

      // Если генерация еще не наступила (до 28.06 16:00)
      if (!info.isGenerationDay && info.isPreSeason) {
        setWorldReady(true);
        return;
      }

      try {
        const tableRef = doc(db, 'league_tables_v1', tableId);
        const tableSnap = await getDoc(tableRef);
        const myName = String(displayName);

        // 1. СИНХРОНИЗАЦИЯ ГРУППЫ ЛИГИ (8 команд)
        if (!tableSnap.exists() || (tableSnap.data()?.version || 0) < 48) {
          const batch = writeBatch(db);
          
          // Получаем стабильный список из 8 команд (user + 7 bots)
          // Важно: realPlayersInGroup теперь передает объект с rank
          const teams = getStableGroupTeams(tier, grp, lId, [{
            id: userId,
            displayName: myName,
            rank: myRank
          }]);

          const stats: any = {};
          teams.forEach(t => {
            stats[t.id] = { points: 0, matchesPlayed: 0, wins: 0, draws: 0, losses: 0, diff: 0 };
          });

          batch.set(tableRef, {
            id: tableId, season: sNum, leagueId: lId, tier: tier, group: grp,
            teams: teams.map(t => t.id),
            teamData: teams,
            stats,
            version: 48,
            updatedAt: serverTimestamp()
          });

          const leagueInfo = LEAGUES.find(l => l.id === lId) || LEAGUES[0];
          const [hh, mm] = leagueInfo.startTime.split(':').map(Number);
          const seasonStartMs = new Date(GLOBAL_EPOCH_ISO).getTime() + (sNum - 1) * 15 * 24 * 3600000;

          // Генерируем 56 матчей (14 туров в 2 круга)
          const teamIds = teams.map(t => t.id);
          const n = 8;
          for (let r = 0; r < n - 1; r++) {
            for (let i = 0; i < n / 2; i++) {
              let hIdx = i;
              let aIdx = n - 1 - i;
              if (r % 2 === 1) [hIdx, aIdx] = [aIdx, hIdx];
              
              const hId = teamIds[hIdx];
              const aId = teamIds[aIdx];
              
              const createMatch = (day: number, h: string, a: string) => {
                const startTime = new Date(seasonStartMs + (day - 1) * 24 * 3600000 + hh * 3600000 + mm * 60000);
                const matchId = `m_v48_${tableId}_d${day}_h${h}`;
                const mRef = doc(db, 'matches_v1', matchId);
                batch.set(mRef, {
                  id: matchId, tableId, season: sNum, tour: day, day,
                  homeId: h, homeName: teams.find(t => t.id === h)?.name || h,
                  awayId: a, awayName: teams.find(t => t.id === a)?.name || a,
                  startTime: startTime.toISOString(),
                  isFinished: false, version: 48, createdAt: serverTimestamp()
                });
              };

              createMatch(r + 1, hId, aId);
              createMatch(r + 1 + (n - 1), aId, hId);
            }
            const last = teamIds.pop()!;
            teamIds.splice(1, 0, last);
          }
          await batch.commit();
        } else {
          // Если группа уже есть, проверяем, не нужно ли заменить бота игроком в СВОЕМ слоте (rank)
          const data = tableSnap.data();
          if (data && !data.teams.includes(userId)) {
            const teamData = [...(data.teamData || [])];
            const slotIdx = myRank - 1;
            
            // Если в нашем слоте сидит бот — выселяем его
            if (teamData[slotIdx] && (teamData[slotIdx].isBot || teamData[slotIdx].id.startsWith('bot'))) {
              const botIdToRemove = teamData[slotIdx].id;
              teamData[slotIdx] = { id: userId, name: myName, isBot: false, rank: myRank };
              
              const newTeams = teamData.map((t: any) => t.id);
              const newStats = { ...(data.stats || {}) };
              delete newStats[botIdToRemove];
              newStats[userId] = { points: 0, matchesPlayed: 0, wins: 0, draws: 0, losses: 0, diff: 0 };
              
              await updateDoc(tableRef, { 
                teams: newTeams, 
                teamData: teamData, 
                stats: newStats, 
                updatedAt: serverTimestamp(), 
                version: 48 
              });
            }
          }
        }

        // 2. СИНХРОНИЗАЦИЯ КУБКА ПИРАМИДЫ (v48)
        const cupId = `cup_s${sNum}_l${lId}`;
        const cupRef = doc(db, 'cup_pyramid_v1', cupId);
        const cupSnap = await getDoc(cupRef);

        if (!cupSnap.exists() || (cupSnap.data()?.version || 0) < 48) {
          await setDoc(cupRef, {
            id: cupId, season: sNum, leagueId: lId,
            version: 48,
            updatedAt: serverTimestamp()
          });
        }

        setWorldReady(true);
      } catch (e) {
        console.error("[WORLD-SYNC ERROR v48]", e);
        setWorldReady(true); // Fail-safe
      }
    };

    syncSharedWorld();
  }, [isLoaded, userId, displayName, selectedLeagueId, leagueLevel, groupId, isUserLoading, user, db, setWorldReady, rank]);

  return null;
}
