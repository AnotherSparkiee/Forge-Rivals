'use client';

/**
 * @fileOverview Ядро MMO-синхронизации v44 (Global Epoch & Atomic Calendar).
 * Гарантирует создание всех 56 матчей сезона при инициализации группы.
 */

import { useEffect, useRef } from 'react';
import { useGameState } from '@/app/lib/store';
import { useUser, useFirestore } from '@/firebase';
import { 
  doc, getDoc, writeBatch, serverTimestamp, updateDoc, onSnapshot
} from 'firebase/firestore';
import { getGlobalSeasonInfo, GLOBAL_EPOCH_ISO } from '@/app/lib/time-utils';
import { LEAGUES } from '@/app/lib/leagues-data';

export function AutoMatchManager() {
  const { user, isUserLoading } = useUser();
  const { isLoaded, id: userId, displayName, selectedLeagueId, leagueLevel, groupId, setWorldReady } = useGameState();
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

      console.log(`[WORLD-SYNC v44] Synchronizing ${tableId}...`);
      
      try {
        const tableRef = doc(db, 'league_tables_v1', tableId);
        const tableSnap = await getDoc(tableRef);
        const myName = String(displayName);

        // Если таблицы нет или старая версия - создаем заново (v44)
        if (!tableSnap.exists() || (tableSnap.data()?.version || 0) < 44) {
          console.log(`[WORLD-SYNC] Initializing world v44: ${tableId}`);
          const batch = writeBatch(db);
          
          const teams = [{ id: userId, name: myName, isBot: false }];
          for (let i = 1; i <= 7; i++) {
            const botId = `bot${tier}${grp}${i}${sNum}`;
            teams.push({ id: botId, name: `🤖 ${botId}`, isBot: true });
          }

          const stats: any = {};
          teams.forEach(t => {
            stats[t.id] = { points: 0, matchesPlayed: 0, wins: 0, draws: 0, losses: 0, diff: 0 };
          });

          batch.set(tableRef, {
            id: tableId, season: sNum, leagueId: lId, tier: tier, group: grp,
            teams: teams.map(t => t.id),
            teamData: teams,
            stats,
            version: 44,
            updatedAt: serverTimestamp()
          });

          // Календарь на 14 туров (в два круга)
          const leagueInfo = LEAGUES.find(l => l.id === lId) || LEAGUES[0];
          const [hh, mm] = leagueInfo.startTime.split(':').map(Number);
          const seasonStartMs = new Date(GLOBAL_EPOCH_ISO).getTime() + (sNum - 1) * 15 * 24 * 3600000;

          const n = 8;
          const roundsPerHalf = n - 1;
          const teamIds = teams.map(t => t.id);

          for (let r = 0; r < roundsPerHalf; r++) {
            for (let i = 0; i < n / 2; i++) {
              let hIdx = i;
              let aIdx = n - 1 - i;
              
              // Ротация для первого круга
              if (r % 2 === 1) [hIdx, aIdx] = [aIdx, hIdx];
              
              const hId = teamIds[hIdx];
              const aId = teamIds[aIdx];
              
              // Функция создания матча
              const createMatch = (day: number, h: string, a: string) => {
                const startTime = new Date(seasonStartMs + (day - 1) * 24 * 3600000 + hh * 3600000 + mm * 60000);
                const matchId = `m_v44_${tableId}_d${day}_h${h}`;
                const mRef = doc(db, 'matches_v1', matchId);
                batch.set(mRef, {
                  id: matchId, tableId, season: sNum, tour: day, day,
                  homeId: h, homeName: teams.find(t => t.id === h)?.name || h,
                  awayId: a, awayName: teams.find(t => t.id === a)?.name || a,
                  startTime: startTime.toISOString(),
                  isFinished: false, version: 44, createdAt: serverTimestamp()
                });
              };

              createMatch(r + 1, hId, aId); // Круг 1
              createMatch(r + 1 + roundsPerHalf, aId, hId); // Круг 2
            }
            // Ротация индексов (кроме первого)
            const last = teamIds.pop()!;
            teamIds.splice(1, 0, last);
          }

          // Инициализация Кубка Лиги
          const cupId = `cup_s${sNum}_l${lId}`;
          const cupRef = doc(db, 'cup_pyramid_v1', cupId);
          batch.set(cupRef, {
            id: cupId, season: sNum, leagueId: lId,
            rounds: { r1: [], r2: [], r3: [], r4: [], r5: [] },
            version: 44,
            updatedAt: serverTimestamp()
          }, { merge: true });

          await batch.commit();
        } else {
          // Если таблица уже есть, проверяем на замену ботов
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

              await updateDoc(tableRef, {
                teams: newTeams, teamData: teamData, stats: newStats, updatedAt: serverTimestamp()
              });
            }
          }
        }
        
        // Финальная проверка наличия данных v44 в кэше
        const unsub = onSnapshot(tableRef, (snap) => {
          if (snap.exists() && snap.data()?.version === 44 && snap.data()?.teams?.includes(userId)) {
            console.log("[WORLD-SYNC] Data v44 verified.");
            setWorldReady(true);
            unsub();
          }
        });

      } catch (e) {
        console.error("[WORLD-SYNC ERROR]", e);
        setTimeout(() => setWorldReady(true), 5000);
      }
    };

    syncSharedWorld();
  }, [isLoaded, userId, displayName, selectedLeagueId, leagueLevel, groupId, isUserLoading, user, db, setWorldReady]);

  return null;
}