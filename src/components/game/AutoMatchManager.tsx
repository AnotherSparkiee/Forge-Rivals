
'use client';

/**
 * @fileOverview Ядро MMO-синхронизации v49 (Promotion & Relegation).
 * ГАРАНТИРУЕТ:
 * 1. Транзит игрока между дивизионами по окончании сезона (1-е место вверх, 7-8 вниз).
 * 2. Генерацию 56 матчей сезона при первом создании группы.
 * 3. Атомарное создание таблиц версии 49.
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
  const { 
    isLoaded, id: userId, displayName, selectedLeagueId, 
    leagueLevel, groupId, setWorldReady, rank, 
    activeSeasonNumber, lastProcessedSeason 
  } = useGameState();
  const db = useFirestore();
  
  const syncInProgressRef = useRef<string | null>(null);

  useEffect(() => {
    if (isUserLoading || !user?.uid || !isLoaded || !selectedLeagueId || !displayName) return;

    const syncSharedWorld = async () => {
      const info = getGlobalSeasonInfo();
      const currentSeason = Number(info.activeSeasonNumber);
      const lId = String(selectedLeagueId);
      
      const syncKey = `${userId}_s${currentSeason}_sync`;
      if (syncInProgressRef.current === syncKey) return;
      syncInProgressRef.current = syncKey;

      try {
        const rootRef = doc(db, 'players_v10', userId);
        let activeLevel = Number(leagueLevel);
        let activeGroup = Number(groupId);
        let activeRank = Number(rank || 1);

        // 1. ПРОВЕРКА ЗАВЕРШЕНИЯ ПРЕДЫДУЩЕГО СЕЗОНА (PROMOTION / RELEGATION)
        const lastProcessed = Number(lastProcessedSeason || 0);
        if (lastProcessed > 0 && currentSeason > lastProcessed) {
          console.log(`[SEASON RESOLUTION] Transitioning from Season ${lastProcessed} to ${currentSeason}...`);
          
          const prevTableId = `s${lastProcessed}_l${lId}_t${activeLevel}_g${activeGroup}`;
          const prevTableSnap = await getDoc(doc(db, 'league_tables_v1', prevTableId));
          
          if (prevTableSnap.exists()) {
            const tableData = prevTableSnap.data();
            const stats = tableData.stats || {};
            
            // Сортируем участников для определения мест
            const standings = tableData.teamData.map((t: any) => ({
              id: t.id,
              ...stats[t.id]
            })).sort((a: any, b: any) => b.points - a.points || b.diff - a.diff);

            const myPosition = standings.findIndex((s: any) => s.id === userId) + 1;

            if (myPosition === 1 && activeLevel > 1) {
              // ПОВЫШЕНИЕ
              activeLevel -= 1;
              activeGroup = Math.ceil(activeGroup / 2);
              // Занимаем слот на основе старой группы (1 -> 7, 2 -> 8)
              activeRank = activeGroup % 2 === 1 ? 7 : 8; 
              console.log(`[PROMOTION] Player promoted to Tier ${activeLevel}`);
            } else if (myPosition >= 7 && activeLevel < 9) {
              // ПОНИЖЕНИЕ
              activeLevel += 1;
              activeGroup = (activeGroup * 2) - (myPosition === 7 ? 1 : 0);
              activeRank = 1; // Новички внизу обычно в начале списка
              console.log(`[RELEGATION] Player relegated to Tier ${activeLevel}`);
            }

            // Обновляем профиль игрока новыми координатами
            await updateDoc(rootRef, {
              leagueLevel: activeLevel,
              groupId: activeGroup,
              rank: activeRank,
              lastProcessedSeason: currentSeason
            });
          } else {
            // Если таблицы нет (игрок пропустил сезон) - просто обновляем счетчик
            await updateDoc(rootRef, { lastProcessedSeason: currentSeason });
          }
        }

        // 2. СИНХРОНИЗАЦИЯ ГРУППЫ ТЕКУЩЕГО СЕЗОНА
        const tableId = `s${currentSeason}_l${lId}_t${activeLevel}_g${activeGroup}`;
        const tableRef = doc(db, 'league_tables_v1', tableId);
        const tableSnap = await getDoc(tableRef);

        if (!tableSnap.exists() || (tableSnap.data()?.version || 0) < 49) {
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
            version: 49,
            updatedAt: serverTimestamp()
          });

          // Генерация календаря (56 матчей)
          const leagueInfo = LEAGUES.find(l => l.id === lId) || LEAGUES[0];
          const [hh, mm] = leagueInfo.startTime.split(':').map(Number);
          const seasonStartMs = new Date(GLOBAL_EPOCH_ISO).getTime() + (currentSeason - 1) * 15 * 24 * 3600000;

          const teamIds = teams.map(t => t.id);
          for (let r = 0; r < 7; r++) {
            for (let i = 0; i < 4; i++) {
              let hIdx = i;
              let aIdx = 7 - i;
              if (r % 2 === 1) [hIdx, aIdx] = [aIdx, hIdx];
              
              const hId = teamIds[hIdx];
              const aId = teamIds[aIdx];
              
              const createMatch = (day: number, h: string, a: string) => {
                const startTime = new Date(seasonStartMs + (day - 1) * 24 * 3600000 + hh * 3600000 + mm * 60000);
                const matchId = `m_v49_${tableId}_d${day}_h${h}`;
                batch.set(doc(db, 'matches_v1', matchId), {
                  id: matchId, tableId, season: currentSeason, tour: day, day,
                  homeId: h, homeName: teams.find(t => t.id === h)?.name || h,
                  awayId: a, awayName: teams.find(t => t.id === a)?.name || a,
                  startTime: startTime.toISOString(),
                  isFinished: false, version: 49, createdAt: serverTimestamp()
                });
              };

              createMatch(r + 1, hId, aId);
              createMatch(r + 8, aId, hId);
            }
            const last = teamIds.pop()!;
            teamIds.splice(1, 0, last);
          }
          await batch.commit();
        } else {
          // Если группа есть - проверяем замещение в своем Rank
          const data = tableSnap.data();
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
              
              await updateDoc(tableRef, { 
                teams: newTeams, teamData: teamData, stats: newStats, 
                updatedAt: serverTimestamp(), version: 49 
              });
            }
          }
        }

        // 3. ПРОВЕРКА КУБКА ПИРАМИДЫ
        const cupId = `cup_s${currentSeason}_l${lId}`;
        const cupRef = doc(db, 'cup_pyramid_v1', cupId);
        const cupSnap = await getDoc(cupRef);

        if (!cupSnap.exists() || (cupSnap.data()?.version || 0) < 49) {
          await setDoc(cupRef, { id: cupId, season: currentSeason, leagueId: lId, version: 49, updatedAt: serverTimestamp() });
        }

        setWorldReady(true);
      } catch (e) {
        console.error("[WORLD-SYNC ERROR v49]", e);
        setWorldReady(true);
      }
    };

    syncSharedWorld();
  }, [isLoaded, userId, displayName, selectedLeagueId, leagueLevel, groupId, isUserLoading, user, db, setWorldReady, rank, activeSeasonNumber, lastProcessedSeason]);

  return null;
}
