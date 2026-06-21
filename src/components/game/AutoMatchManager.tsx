'use client';

/**
 * @fileOverview Ядро MMO-синхронизации v40.5 (Atomic Preload Edition).
 * Интегрировано с экраном загрузки для гарантированной готовности мира.
 */

import { useEffect, useRef } from 'react';
import { useGameState } from '@/app/lib/store';
import { useUser, useFirestore } from '@/firebase';
import { 
  doc, getDoc, writeBatch, serverTimestamp, collection, query, where, getDocs, updateDoc
} from 'firebase/firestore';
import { getGlobalSeasonInfo } from '@/app/lib/time-utils';
import { LEAGUES } from '@/app/lib/leagues-data';

export function AutoMatchManager() {
  const { user, isUserLoading } = useUser();
  const { isLoaded, id: userId, displayName, selectedLeagueId, leagueLevel, groupId, setWorldReady } = useGameState();
  const db = useFirestore();
  
  const initializedRef = useRef<Set<string>>(new Set());
  const checkingRef = useRef<string | null>(null);

  useEffect(() => {
    // Ждем полной загрузки профиля
    if (isUserLoading || !user?.uid || !isLoaded || !userId || !selectedLeagueId || !displayName || displayName === 'Manager') return;

    const syncSharedWorld = async () => {
      const info = getGlobalSeasonInfo();
      const sNum = Number(info.seasonNumber);
      const lId = String(selectedLeagueId);
      const tier = Number(leagueLevel);
      const grp = Number(groupId);
      
      const tableId = `s${sNum}_l${lId}_t${tier}_g${grp}`;
      
      if (initializedRef.current.has(tableId) || checkingRef.current === tableId) {
        setWorldReady(true);
        return;
      }
      
      checkingRef.current = tableId;
      const tableRef = doc(db, 'league_tables_v1', tableId);
      
      try {
        const tableSnap = await getDoc(tableRef);
        const myName = displayName;

        // 1. Инициализация абсолютно новой группы
        if (!tableSnap.exists()) {
          console.log(`[WORLD-SYNC v40.5] Initializing NEW Shared Group: ${tableId}`);
          const batch = writeBatch(db);

          const teams = [{ id: userId, name: myName, isBot: false }];
          for (let i = 1; i <= 7; i++) {
            const botNum = 1000 + (tier * 100) + (grp * 10) + i;
            const botId = `bot${botNum}`;
            teams.push({ id: botId, name: botId, isBot: true });
          }

          const stats: any = {};
          teams.forEach(t => {
            stats[t.id] = { points: 0, matchesPlayed: 0, wins: 0, draws: 0, losses: 0, diff: 0 };
          });

          batch.set(tableRef, {
            id: tableId, season: sNum, leagueId: lId, tier, group: grp,
            teams: teams.map(t => t.id),
            teamData: teams,
            stats,
            version: 40,
            updatedAt: serverTimestamp()
          });

          // Кубок лиги (на 32 команды)
          const cupId = `cup_s${sNum}_l${lId}`;
          const cupRef = doc(db, 'cup_pyramid_v1', cupId);
          const cupSnap = await getDoc(cupRef);
          
          if (!cupSnap.exists()) {
            const cupParticipants = [...teams];
            while (cupParticipants.length < 32) {
              const bNum = 5000 + cupParticipants.length;
              const bId = `bot${bNum}`;
              cupParticipants.push({ id: bId, name: bId, isBot: true });
            }
            const r1 = [];
            for (let i = 0; i < 32; i += 2) {
              r1.push({
                home: { id: cupParticipants[i].id, name: cupParticipants[i].name },
                away: { id: cupParticipants[i+1].id, name: cupParticipants[i+1].name },
                scoreA: null, scoreB: null
              });
            }
            batch.set(cupRef, {
              id: cupId, season: sNum, leagueId: lId,
              rounds: { r1, r2: [], r3: [], r4: [], r5: [] },
              version: 40,
              updatedAt: serverTimestamp()
            });
          }

          // Календарь на 14 туров
          const leagueInfo = LEAGUES.find(l => l.id === lId) || LEAGUES[0];
          const [hh, mm] = leagueInfo.startTime.split(':').map(Number);
          const seasonStartMs = new Date('2026-06-21T21:00:00Z').getTime() + (sNum - 1) * 15 * 24 * 3600000;

          const n = 8;
          const rounds = n - 1;
          const tempIds = teams.map(t => t.id);

          for (let r = 0; r < rounds; r++) {
            for (let i = 0; i < n / 2; i++) {
              let hIdx = i;
              let aIdx = n - 1 - i;
              if (r % 2 === 1) [hIdx, aIdx] = [aIdx, hIdx];
              
              const hId = tempIds[hIdx];
              const aId = tempIds[aIdx];

              const createMatch = (day: number, h: string, a: string) => {
                const startTime = new Date(seasonStartMs + (day - 1) * 24 * 3600000 + hh * 3600000 + mm * 60000);
                const mId = `m_${tableId}_d${day}_h${h}`;
                batch.set(doc(db, 'matches_v1', mId), {
                  id: mId, tableId, season: sNum, tour: day, day,
                  homeId: h, homeName: teams.find(t => t.id === h)?.name || h,
                  awayId: a, awayName: teams.find(t => t.id === a)?.name || a,
                  startTime: startTime.toISOString(),
                  isFinished: false, version: 40, createdAt: serverTimestamp()
                });
              };
              createMatch(r + 1, hId, aId);
              createMatch(r + 1 + rounds, aId, hId);
            }
            const last = tempIds.pop()!;
            tempIds.splice(1, 0, last);
          }
          
          await batch.commit();
          console.log(`[WORLD-SYNC v40.5] Group ${tableId} created.`);
        } 
        
        // 2. MMO-Замена бота
        else {
          const tableData = tableSnap.data();
          if (tableData && tableData.version === 40 && !tableData.teams.includes(userId)) {
            console.log(`[WORLD-SYNC v40.5] Replacing bot with player ${userId}`);
            
            const teamData = [...(tableData.teamData || [])];
            const botIdx = teamData.findIndex((t: any) => t.isBot || t.id.startsWith('bot'));
            
            if (botIdx !== -1) {
              const botIdToRemove = teamData[botIdx].id;
              teamData[botIdx] = { id: userId, name: myName, isBot: false };
              
              const newTeams = teamData.map((t: any) => t.id);
              const newStats = { ...(tableData.stats || {}) };
              delete newStats[botIdToRemove];
              newStats[userId] = { points: 0, matchesPlayed: 0, wins: 0, draws: 0, losses: 0, diff: 0 };

              await updateDoc(tableRef, {
                teams: newTeams,
                teamData: teamData,
                stats: newStats,
                updatedAt: serverTimestamp()
              });

              // Обновляем матчи
              const matchesQuery = query(
                collection(db, 'matches_v1'),
                where('tableId', '==', tableId),
                where('version', '==', 40)
              );
              const matchesSnap = await getDocs(matchesQuery);
              const matchBatch = writeBatch(db);

              matchesSnap.docs.forEach(mDoc => {
                const m = mDoc.data();
                const update: any = {};
                if (m.homeId === botIdToRemove) {
                  update.homeId = userId;
                  update.homeName = myName;
                }
                if (m.awayId === botIdToRemove) {
                  update.awayId = userId;
                  update.awayName = myName;
                }
                if (Object.keys(update).length > 0) {
                  matchBatch.update(mDoc.ref, update);
                }
              });

              await matchBatch.commit();
            }
          }
        }
        
        // Мир готов!
        initializedRef.current.add(tableId);
        setWorldReady(true);
      } catch (e) {
        console.error("[WORLD-SYNC ERROR]", e);
      } finally {
        checkingRef.current = null;
      }
    };

    syncSharedWorld();
  }, [isLoaded, userId, displayName, selectedLeagueId, leagueLevel, groupId, isUserLoading, user, db, setWorldReady]);

  return null;
}
