'use client';

/**
 * @fileOverview Ядро синхронизации игрового мира v40.
 * Атомарно создает Таблицу, Календарь и Кубок при первом входе игрока.
 */

import { useEffect, useRef } from 'react';
import { useGameState } from '@/app/lib/store';
import { useUser, useFirestore } from '@/firebase';
import { 
  doc, getDoc, writeBatch, serverTimestamp
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

    const initializeWorld = async () => {
      if (processingRef.current) return;
      processingRef.current = true;

      try {
        const info = getGlobalSeasonInfo();
        const sNum = Number(info.seasonNumber);
        const lId = String(selectedLeagueId);
        const tier = Number(leagueLevel);
        const grp = Number(groupId);
        
        const tableId = `s${sNum}_l${lId}_t${tier}_g${grp}`;
        const tableRef = doc(db, 'league_tables_v1', tableId);
        const tableSnap = await getDoc(tableRef);

        // Если таблицы v40 нет — создаем весь мир атомарно
        if (!tableSnap.exists() || tableSnap.data()?.version !== 40) {
          console.log(`[WORLD-SYNC v40] Deploying Season Infrastructure: ${tableId}`);
          const batch = writeBatch(db);

          // 1. Формируем участников (Вы + 7 Классических Ботов)
          const teams = [{ id: userId, name: displayName || "Manager", isBot: false }];
          for (let i = 1; i <= 7; i++) {
            const botNum = 1000 + (tier * 100) + (grp * 10) + i;
            const botId = `bot${botNum}`;
            teams.push({ id: botId, name: botId, isBot: true });
          }

          const stats: any = {};
          teams.forEach(t => {
            stats[t.id] = { points: 0, matchesPlayed: 0, wins: 0, draws: 0, losses: 0, diff: 0 };
          });

          // 2. Создаем Таблицу
          batch.set(tableRef, {
            id: tableId, season: sNum, leagueId: lId, tier, group: grp,
            teams: teams.map(t => t.id),
            teamData: teams,
            stats,
            version: 40,
            updatedAt: serverTimestamp()
          });

          // 3. Создаем Кубок Лиги (если нет)
          const cupId = `cup_s${sNum}_l${lId}`;
          const cupRef = doc(db, 'cup_pyramid_v1', cupId);
          const cupSnap = await getDoc(cupRef);

          if (!cupSnap.exists() || cupSnap.data()?.version !== 40) {
            const cupParticipants = [...teams];
            // Дополняем до 32 участников для сетки
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

          // 4. Генерируем 14 туров календаря (Round-robin)
          const leagueInfo = LEAGUES.find(l => l.id === lId) || LEAGUES[0];
          const [hh, mm] = leagueInfo.startTime.split(':').map(Number);
          // Эпоха v40: 22.06.2026
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

              createMatch(r + 1, hId, aId); // Круг 1
              createMatch(r + 1 + rounds, aId, hId); // Круг 2
            }
            // Циклический сдвиг для Round-robin
            const last = tempIds.pop()!;
            tempIds.splice(1, 0, last);
          }

          await batch.commit();
          console.log("[WORLD-SYNC v40] Deployment complete.");
        }
      } catch (e) {
        console.error("[WORLD-SYNC ERROR]", e);
      } finally {
        processingRef.current = false;
      }
    };

    initializeWorld();
    const interval = setInterval(initializeWorld, 60000);
    return () => clearInterval(interval);
  }, [isLoaded, userId, displayName, selectedLeagueId, leagueLevel, groupId, isUserLoading, user, db]);

  return null;
}
