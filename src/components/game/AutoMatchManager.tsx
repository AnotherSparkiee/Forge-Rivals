
'use client';

/**
 * @fileOverview Ядро MMO-синхронизации v41 (Strict Atomic Initialization).
 * Унифицирует ID и гарантирует фиксацию данных в БД до завершения прелоадера.
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
  
  const syncInProgressRef = useRef<string | null>(null);

  useEffect(() => {
    // Ждем полной загрузки профиля игрока
    if (isUserLoading || !user?.uid || !isLoaded || !selectedLeagueId || !displayName) return;

    const syncSharedWorld = async () => {
      const info = getGlobalSeasonInfo();
      const sNum = String(info.seasonNumber);
      const lId = String(selectedLeagueId);
      const tier = String(leagueLevel);
      const grp = String(groupId);
      
      // СТРОГИЙ ID v41 (Унифицирован для всех компонентов)
      const tableId = `s${sNum}_l${lId}_t${tier}_g${grp}`;
      
      if (syncInProgressRef.current === tableId) return;
      syncInProgressRef.current = tableId;

      console.log(`[WORLD-SYNC v41] Critical Sync for ${tableId}...`);
      
      try {
        const tableRef = doc(db, 'league_tables_v1', tableId);
        const tableSnap = await getDoc(tableRef);
        const myName = String(displayName);

        if (!tableSnap.exists() || (tableSnap.data()?.version || 0) < 41) {
          console.log(`[WORLD-SYNC] Rebuilding world v41: ${tableId}`);
          const batch = writeBatch(db);
          
          const teams = [{ id: userId, name: myName, isBot: false }];
          for (let i = 1; i <= 7; i++) {
            const botNum = (Number(tier) * 1000) + (Number(grp) * 10) + i;
            const botId = `bot${botNum}`;
            teams.push({ id: botId, name: botId, isBot: true });
          }

          const stats: any = {};
          teams.forEach(t => {
            stats[t.id] = { points: 0, matchesPlayed: 0, wins: 0, draws: 0, losses: 0, diff: 0 };
          });

          // 1. Создаем таблицу (v41)
          batch.set(tableRef, {
            id: tableId, season: Number(sNum), leagueId: lId, tier: Number(tier), group: Number(grp),
            teams: teams.map(t => t.id),
            teamData: teams,
            stats,
            version: 41,
            updatedAt: serverTimestamp()
          });

          // 2. Инициализируем Кубок Лиги
          const cupId = `cup_s${sNum}_l${lId}`;
          const cupRef = doc(db, 'cup_pyramid_v1', cupId);
          const cupSnap = await getDoc(cupRef);
          
          if (!cupSnap.exists() || (cupSnap.data()?.version || 0) < 41) {
            const r1 = [];
            for (let i = 0; i < 32; i += 2) {
              const botH = 5000 + i;
              const botA = 5001 + i;
              r1.push({
                home: { id: `bot${botH}`, name: `bot${botH}` },
                away: { id: `bot${botA}`, name: `bot${botA}` },
                scoreA: null, scoreB: null
              });
            }
            batch.set(cupRef, {
              id: cupId, season: Number(sNum), leagueId: lId,
              rounds: { r1, r2: [], r3: [], r4: [], r5: [] },
              version: 41,
              updatedAt: serverTimestamp()
            });
          }

          // 3. Генерируем Календарь v41
          const leagueInfo = LEAGUES.find(l => l.id === lId) || LEAGUES[0];
          const [hh, mm] = leagueInfo.startTime.split(':').map(Number);
          const seasonStartMs = new Date('2026-06-21T21:00:00Z').getTime() + (Number(sNum) - 1) * 15 * 24 * 3600000;

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
              const day1 = r + 1;
              const day2 = r + 1 + rounds;

              const createMatch = (day: number, h: string, a: string) => {
                const startTime = new Date(seasonStartMs + (day - 1) * 24 * 3600000 + hh * 3600000 + mm * 60000);
                const mId = `m_${tableId}_d${day}_h${h}`;
                batch.set(doc(db, 'matches_v1', mId), {
                  id: mId, tableId, season: Number(sNum), tour: day, day,
                  homeId: h, homeName: teams.find(t => t.id === h)?.name || h,
                  awayId: a, awayName: teams.find(t => t.id === a)?.name || a,
                  startTime: startTime.toISOString(),
                  isFinished: false, version: 41, createdAt: serverTimestamp()
                });
              };
              createMatch(day1, hId, aId);
              createMatch(day2, aId, hId);
            }
            const last = tempIds.pop()!;
            tempIds.splice(1, 0, last);
          }

          await batch.commit();
        } else {
          // Если мир уже есть v41, проверяем, вписан ли в него текущий игрок
          const data = tableSnap.data();
          if (data && !data.teams.includes(userId)) {
            console.log("[WORLD-SYNC] Joining v41 group, replacing bot...");
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

              // Обновляем матчи в фоне
              const matchesQuery = query(collection(db, 'matches_v1'), where('tableId', '==', tableId), where('version', '==', 41));
              const matchesSnap = await getDocs(matchesQuery);
              const matchBatch = writeBatch(db);
              matchesSnap.docs.forEach(mDoc => {
                const m = mDoc.data();
                if (m.homeId === botIdToRemove) matchBatch.update(mDoc.ref, { homeId: userId, homeName: myName });
                if (m.awayId === botIdToRemove) matchBatch.update(mDoc.ref, { awayId: userId, awayName: myName });
              });
              await matchBatch.commit();
            }
          }
        }
        
        // Сигнал готовности устанавливается только после всех операций с БД
        setWorldReady(true);
      } catch (e) {
        console.error("[WORLD-SYNC ERROR]", e);
        // Резервный выход из прелоадера через 5 секунд в случае сетевой ошибки
        setTimeout(() => setWorldReady(true), 5000);
      }
    };

    syncSharedWorld();
  }, [isLoaded, userId, displayName, selectedLeagueId, leagueLevel, groupId, isUserLoading, user, db, setWorldReady]);

  return null;
}
