
'use client';

/**
 * @fileOverview Автономный менеджер синхронизации v70.
 * Выполняет инициализацию игрового мира НА КЛИЕНТЕ для прохождения правил безопасности.
 */

import { useEffect, useRef } from 'react';
import { useGameState } from '@/app/lib/store';
import { useUser, useFirestore } from '@/firebase';
import { 
  doc, getDoc, writeBatch, collection, 
  serverTimestamp, query, where, getDocs, limit 
} from 'firebase/firestore';
import { getGlobalSeasonInfo } from '@/app/lib/time-utils';
import { LEAGUES } from '@/app/lib/leagues-data';

export function AutoMatchManager() {
  const { user, isUserLoading } = useUser();
  const { isLoaded, id: userId, displayName, selectedLeagueId, leagueLevel, groupId } = useGameState();
  const db = useFirestore();
  const processingRef = useRef(false);

  useEffect(() => {
    if (isUserLoading || !user?.uid || !isLoaded || !userId || !selectedLeagueId) return;

    const checkAndInit = async () => {
      if (processingRef.current) return;
      processingRef.current = true;

      try {
        const info = getGlobalSeasonInfo();
        const currentSN = Number(info.seasonNumber);
        const sStr = String(currentSN);
        const lStr = String(selectedLeagueId);
        
        const tableId = `season_${sStr}_tier_${leagueLevel}_group_${groupId}_league_${lStr}`;
        const tableRef = doc(db, 'league_tables_v1', tableId);
        
        const tableSnap = await getDoc(tableRef);
        
        if (!tableSnap.exists()) {
          console.log(`[WORLD-SYNC v70] Initializing World Node: ${tableId}`);
          const batch = writeBatch(db);

          // 1. Формируем список участников (Вы + 7 Ботов)
          const teams = [{ id: userId, name: displayName || "Manager", isBot: false }];
          const leagueIdx = LEAGUES.findIndex(l => l.id === lStr);
          const lPref = (leagueIdx + 1).toString().padStart(2, '0');

          for (let i = 1; i <= 7; i++) {
            const botId = `bot${lPref}${leagueLevel}${groupId}${i}`;
            teams.push({ id: botId, name: botId, isBot: true });
          }

          const teamIds = teams.map(t => t.id);
          const stats: any = {};
          teams.forEach(t => {
            stats[t.id] = { points: 0, matchesPlayed: 0, wins: 0, draws: 0, losses: 0, diff: 0, goalsScored: 0, goalsConceded: 0 };
          });

          // 2. Создаем таблицу
          batch.set(tableRef, {
            id: tableId, season: currentSN, tier: Number(leagueLevel), group: Number(groupId), leagueId: lStr,
            teams: teamIds, teamData: teams, stats, updatedAt: serverTimestamp(), version: 35
          });

          // 3. Создаем Кубок (если его нет)
          const cupDocId = `season_${sStr}_league_${lStr}`;
          const cupRef = doc(db, 'cup_pyramid_v1', cupDocId);
          const cupSnap = await getDoc(cupRef);

          if (!cupSnap.exists()) {
            const participants = [...teams];
            while (participants.length < 32) {
              const bid = `bot_cup_${lStr}_${participants.length + 1}`;
              participants.push({ id: bid, name: bid, isBot: true });
            }
            const r1 = [];
            for (let i = 0; i < 32; i += 2) {
              r1.push({
                home: { id: participants[i].id, name: participants[i].name },
                away: { id: participants[i+1].id, name: participants[i+1].name },
                scoreA: null, scoreB: null, winnerId: null
              });
            }
            batch.set(cupRef, {
              season: currentSN, leagueId: lStr,
              rounds: { r1, r2: [], r3: [], r4: [], r5: [] },
              updatedAt: serverTimestamp(), version: 35
            });
          }

          // 4. Генерируем 14 туров календаря
          const n = teamIds.length;
          const rounds = n - 1;
          const players = [...teamIds];
          const leagueInfo = LEAGUES.find(l => l.id === lStr) || LEAGUES[0];
          const [hh, mm] = leagueInfo.startTime.split(':').map(Number);
          const seasonStart = new Date('2026-06-22T00:00:00+03:00');
          const startMs = seasonStart.getTime() + (currentSN - 1) * 15 * 24 * 60 * 60 * 1000;

          for (let r = 0; r < rounds; r++) {
            for (let i = 0; i < n / 2; i++) {
              const hId = players[i];
              const aId = players[n - 1 - i];
              
              const createMatch = (day: number, home: string, away: string) => {
                const matchTime = new Date(startMs + (day - 1) * 24 * 60 * 60 * 1000 + hh * 3600000 + mm * 60000);
                const matchId = `m_${tableId}_d${day}_h${home}`;
                const hName = teams.find(t => t.id === home)?.name || home;
                const aName = teams.find(t => t.id === away)?.name || away;
                
                batch.set(doc(db, 'matches_v1', matchId), {
                  id: matchId, tableId, season: currentSN, tour: day, day, leagueId: lStr, tier: Number(leagueLevel), groupId: String(groupId),
                  homeId: home, homeName: hName, awayId: away, awayName: aName,
                  startTime: matchTime.toISOString(), status: "scheduled", isFinished: false,
                  createdAt: serverTimestamp(), version: 35
                });
              };

              createMatch(r + 1, hId, aId);
              createMatch(r + 1 + rounds, aId, hId);
            }
            players.splice(1, 0, players.pop()!);
          }

          await batch.commit();
          console.log("[WORLD-SYNC] Successfully deployed Group and Cup nodes.");
        }
      } catch (e: any) {
        console.error("[WORLD-SYNC ERROR]", e);
      } finally {
        processingRef.current = false;
      }
    };

    const interval = setInterval(checkAndInit, 30000);
    checkAndInit();
    return () => clearInterval(interval);
  }, [isLoaded, userId, displayName, selectedLeagueId, leagueLevel, groupId, isUserLoading, user?.uid, db]);

  return null;
}
