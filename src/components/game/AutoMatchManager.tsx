'use client';

/**
 * @fileOverview Ядро MMO-синхронизации v47 (Living Ecosystem).
 * ГАРАНТИРУЕТ:
 * 1. В любой группе любого дивизиона всегда 8 команд (Живая замена ботов).
 * 2. Кубок Пирамиды на 4096 участников для каждой лиги.
 * 3. Атомарная генерация мира под прелоадером.
 */

import { useEffect, useRef } from 'react';
import { useGameState } from '@/app/lib/store';
import { useUser, useFirestore } from '@/firebase';
import { 
  doc, getDoc, writeBatch, serverTimestamp, updateDoc, runTransaction,
  collection, query, where, getDocs
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
        if (!tableSnap.exists() || (tableSnap.data()?.version || 0) < 47) {
          const batch = writeBatch(db);
          
          // Получаем стабильный список из 8 команд (user + 7 bots)
          const teams = getStableGroupTeams(tier, grp, lId, [{
            id: userId,
            displayName: myName,
            selectedLeagueId: lId,
            leagueLevel: tier,
            groupId: grp,
            rank: rank || 1
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
            version: 47,
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
                const matchId = `m_v47_${tableId}_d${day}_h${h}`;
                const mRef = doc(db, 'matches_v1', matchId);
                batch.set(mRef, {
                  id: matchId, tableId, season: sNum, tour: day, day,
                  homeId: h, homeName: teams.find(t => t.id === h)?.name || h,
                  awayId: a, awayName: teams.find(t => t.id === a)?.name || a,
                  startTime: startTime.toISOString(),
                  isFinished: false, version: 47, createdAt: serverTimestamp()
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
          // Если группа уже есть, проверяем, не нужно ли заменить бота игроком
          const data = tableSnap.data();
          if (data && !data.teams.includes(userId)) {
            const teamData = [...(data.teamData || [])];
            const botIdx = teamData.findIndex((t: any) => t.isBot || t.id.startsWith('bot'));
            if (botIdx !== -1) {
              const botIdToRemove = teamData[botIdx].id;
              teamData[botIdx] = { id: userId, name: myName, isBot: false };
              const newTeams = teamData.map((t: any) => t.id);
              const newStats = { ...(data.stats || {}) };
              delete newStats[botIdToRemove];
              newStats[userId] = { points: 0, matchesPlayed: 0, wins: 0, draws: 0, losses: 0, diff: 0 };
              await updateDoc(tableRef, { teams: newTeams, teamData: teamData, stats: newStats, updatedAt: serverTimestamp(), version: 47 });
            }
          }
        }

        // 2. СИНХРОНИЗАЦИЯ КУБКА ПИРАМИДЫ (v47)
        const cupId = `cup_s${sNum}_l${lId}`;
        const cupRef = doc(db, 'cup_pyramid_v1', cupId);
        const cupSnap = await getDoc(cupRef);

        if (!cupSnap.exists() || (cupSnap.data()?.version || 0) < 47) {
          // Первичная инициализация документа Кубка (без записи всех 4096 матчей для экономии)
          // Мы храним только мета-данные, результаты рассчитываются детерминировано в cup-utils
          await setDoc(cupRef, {
            id: cupId, season: sNum, leagueId: lId,
            version: 47,
            updatedAt: serverTimestamp()
          });
        }

        setWorldReady(true);
      } catch (e) {
        console.error("[WORLD-SYNC ERROR v47]", e);
        setWorldReady(true); // Fail-safe
      }
    };

    syncSharedWorld();
  }, [isLoaded, userId, displayName, selectedLeagueId, leagueLevel, groupId, isUserLoading, user, db, setWorldReady, rank]);

  return null;
}
