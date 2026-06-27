'use client';

/**
 * @fileOverview Ядро MMO-синхронизации v46.3.
 * ГАРАНТИРУЕТ:
 * 1. В группе лиги ровно 8 команд (1 игрок + 7 ботов).
 * 2. Кубок лиги имеет раундовую систему (1/16, 1/8, 1/4, 1/2, Финал).
 * 3. Атомарная инициализация после 28.06 16:00.
 */

import { useEffect, useRef } from 'react';
import { useGameState } from '@/app/lib/store';
import { useUser, useFirestore } from '@/firebase';
import { 
  doc, getDoc, writeBatch, serverTimestamp, updateDoc, runTransaction
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

      // Если генерация еще не наступила (до 28.06 16:00)
      if (!info.isGenerationDay && info.isPreSeason) {
        setWorldReady(true);
        return;
      }

      try {
        const tableRef = doc(db, 'league_tables_v1', tableId);
        const tableSnap = await getDoc(tableRef);
        const myName = String(displayName);

        // 1. ЛИГА: 8 КОМАНД И КАЛЕНДАРЬ
        if (!tableSnap.exists() || (tableSnap.data()?.version || 0) < 46) {
          const batch = writeBatch(db);
          
          // Ровно 8 команд
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
            version: 46,
            updatedAt: serverTimestamp()
          });

          const leagueInfo = LEAGUES.find(l => l.id === lId) || LEAGUES[0];
          const [hh, mm] = leagueInfo.startTime.split(':').map(Number);
          const seasonStartMs = new Date(GLOBAL_EPOCH_ISO).getTime() + (sNum - 1) * 15 * 24 * 3600000;

          // Календарь на 8 команд (56 матчей)
          const n = 8;
          const teamIds = teams.map(t => t.id);

          for (let r = 0; r < n - 1; r++) {
            for (let i = 0; i < n / 2; i++) {
              let hIdx = i;
              let aIdx = n - 1 - i;
              if (r % 2 === 1) [hIdx, aIdx] = [aIdx, hIdx];
              
              const hId = teamIds[hIdx];
              const aId = teamIds[aIdx];
              
              const createMatch = (day: number, h: string, a: string) => {
                const startTime = new Date(seasonStartMs + (day - 1) * 24 * 3600000 + hh * 3600000 + mm * 60000);
                const matchId = `m_v46_${tableId}_d${day}_h${h}`;
                const mRef = doc(db, 'matches_v1', matchId);
                batch.set(mRef, {
                  id: matchId, tableId, season: sNum, tour: day, day,
                  homeId: h, homeName: teams.find(t => t.id === h)?.name || h,
                  awayId: a, awayName: teams.find(t => t.id === a)?.name || a,
                  startTime: startTime.toISOString(),
                  isFinished: false, version: 46, createdAt: serverTimestamp()
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
              await updateDoc(tableRef, { teams: newTeams, teamData: teamData, stats: newStats, updatedAt: serverTimestamp() });
            }
          }
        }

        // 2. КУБОК: РАУНДОВАЯ СИСТЕМА
        const cupId = `cup_s${sNum}_l${lId}`;
        const cupRef = doc(db, 'cup_pyramid_v1', cupId);

        await runTransaction(db, async (transaction) => {
          const cupSnap = await transaction.get(cupRef);
          
          if (!cupSnap.exists() || (cupSnap.data()?.version || 0) < 46) {
            const cupR1 = [];
            for (let i = 1; i <= 16; i++) {
              const isFirst = i === 1;
              cupR1.push({
                matchId: `cup_s${sNum}_l${lId}_r1_m${i}`,
                home: isFirst ? { id: userId, name: myName } : { id: `bot_cup_${lId}_${i}_1`, name: `🤖 bot_${lId}_${i}_1` },
                away: { id: `bot_cup_${lId}_${i}_2`, name: `🤖 bot_${lId}_${i}_2` },
                scoreA: null, scoreB: null, isFinished: false
              });
            }
            transaction.set(cupRef, {
              id: cupId, season: sNum, leagueId: lId,
              rounds: { r1: cupR1, r2: [], r3: [], r4: [], r5: [] },
              version: 46,
              updatedAt: serverTimestamp()
            });
          } else {
            const cupData = cupSnap.data();
            const r1 = [...(cupData.rounds?.r1 || [])];
            const alreadyIn = r1.some(m => m.home?.id === userId || m.away?.id === userId);
            
            if (!alreadyIn) {
              let replaced = false;
              for (let i = 0; i < r1.length; i++) {
                if (r1[i].home?.id?.startsWith('bot')) {
                  r1[i].home = { id: userId, name: myName };
                  replaced = true;
                  break;
                }
                if (r1[i].away?.id?.startsWith('bot')) {
                  r1[i].away = { id: userId, name: myName };
                  replaced = true;
                  break;
                }
              }
              if (replaced) {
                transaction.update(cupRef, { 'rounds.r1': r1, updatedAt: serverTimestamp() });
              }
            }
          }
        });

        setWorldReady(true);
      } catch (e) {
        console.error("[WORLD-SYNC ERROR]", e);
        setWorldReady(true);
      }
    };

    syncSharedWorld();
  }, [isLoaded, userId, displayName, selectedLeagueId, leagueLevel, groupId, isUserLoading, user, db, setWorldReady]);

  return null;
}
