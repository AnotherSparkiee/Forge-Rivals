/**
 * @fileOverview Автономный движок сезонов с Протоколом Санитарной Очистки.
 * Обеспечивает атомарную смену сезона и удаление старых данных (Elite Bot, 9.1.1).
 */

'use client';

import { useEffect, useRef } from 'react';
import { useGameState } from '@/app/lib/store';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { doc, getDoc, writeBatch, collection, query, where, serverTimestamp, getDocs, Timestamp } from 'firebase/firestore';
import { 
  getStableGroupTeams, generateSeasonCalendar, getMatchResult, 
  LEAGUES 
} from '@/app/lib/leagues-data';
import { getMoscowTime, getGlobalSeasonInfo, getMoscowDateString } from '@/app/lib/time-utils';

export function AutoMatchManager() {
  const { isLoaded, id: userId, selectedLeagueId, leagueLevel, groupId, recordMatch } = useGameState();
  const db = useFirestore();
  const processingRef = useRef(false);

  // Исправлено: переменная для запроса игроков группы
  const playersInGroupQuery = useMemoFirebase(() => {
    if (!selectedLeagueId) return null;
    return query(
      collection(db, 'players_v10'), 
      where('selectedLeagueId', '==', selectedLeagueId),
      where('leagueLevel', '==', Number(leagueLevel)),
      where('groupId', '==', Number(groupId))
    );
  }, [db, selectedLeagueId, leagueLevel, groupId]);

  const { data: allGroupPlayers } = useCollection(playersInGroupQuery);

  useEffect(() => {
    if (!isLoaded || !userId || !selectedLeagueId || processingRef.current || !allGroupPlayers) return;

    const heartbeat = async () => {
      if (processingRef.current) return;
      processingRef.current = true;

      try {
        const seasonInfo = getGlobalSeasonInfo();
        const activeSeason = seasonInfo.activeSeasonNumber;
        const league = LEAGUES.find(l => l.id === selectedLeagueId) || LEAGUES[0];
        
        const groupRef = doc(db, `leagues_v2/${selectedLeagueId}/divisions/${leagueLevel}/groups/${groupId}`);
        const groupSnap = await getDoc(groupRef);
        const groupData = groupSnap.data();

        // --- ТОТАЛЬНАЯ САНИТАРНАЯ ПРОВЕРКА ---
        // Получаем ВООБЩЕ ВСЕ матчи этой группы, не фильтруя по сезону
        const matchesQ = query(
          collection(db, 'matches_v1'),
          where('leagueId', '==', selectedLeagueId),
          where('divisionId', '==', Number(leagueLevel)),
          where('groupId', '==', Number(groupId))
        );
        const existingSnap = await getDocs(matchesQ);
        
        // Ищем признаки мусора: старые боты, неверный сезон или некорректная дата старта
        const dirtyMatches = existingSnap.docs.filter(d => {
          const m = d.data();
          const namePool = (m.homeName || "") + (m.awayName || "");
          const isOldBot = namePool.includes('Elite Bot') || namePool.includes('9.1.1') || namePool.includes('Bot 10');
          const isWrongSeason = m.seasonNumber !== activeSeason;
          
          // Проверка даты старта (должна быть 17.06.2026 для 1-го сезона)
          let isWrongDate = false;
          if (activeSeason === 1 && m.day === 1) {
             const startDateStr = String(m.startTime || m.scheduledAt || "");
             if (startDateStr && !startDateStr.includes('2026-06-17')) isWrongDate = true;
          }
          
          return isOldBot || isWrongSeason || isWrongDate;
        });

        const needsInitialization = !groupSnap.exists() || groupData?.seasonId !== activeSeason || dirtyMatches.length > 0;

        if (needsInitialization) {
          console.log(`[Engine] CLEANING & INITIALIZING SEASON ${activeSeason}...`);
          
          const batch = writeBatch(db);
          
          // АТОМАРНОЕ УДАЛЕНИЕ ВСЕГО МУСОРА ПЕРЕД ГЕНЕРАЦИЕЙ
          existingSnap.docs.forEach(d => batch.delete(d.ref));
          
          const teams = getStableGroupTeams(Number(leagueLevel), Number(groupId), selectedLeagueId, allGroupPlayers);
          const calendar = generateSeasonCalendar(teams);
          
          // ИММУТАБЕЛЬНЫЙ РАСЧЕТ ВРЕМЕНИ (Старт строго 17.06.2026)
          const epochMs = new Date('2026-06-17T00:00:00+03:00').getTime();
          const dayMs = 24 * 60 * 60 * 1000;
          const seasonStartMs = epochMs + (activeSeason - 1) * 16 * dayMs;

          // Обновляем статус группы
          batch.set(groupRef, {
            seasonId: activeSeason,
            teams,
            lastProcessedDate: getMoscowDateString(),
            updatedAt: serverTimestamp()
          }, { merge: true });

          // Обновляем Глобальный Указатель для мгновенного переключения клиентов
          batch.set(doc(db, 'system_v1', 'status'), {
            currentSeasonNumber: activeSeason,
            updatedAt: serverTimestamp()
          }, { merge: true });

          // Генерируем 56 новых чистых матчей с детерминированными ID
          calendar.forEach((m) => {
            const matchId = `m_${selectedLeagueId}_${leagueLevel}_${groupId}_s${activeSeason}_d${m.day}_h${m.homeId}`;
            
            const [hh, mm] = league.startTime.split(':').map(Number);
            // Точный расчет: База + День + Часы лиги
            const matchTimeOffset = (m.day - 1) * dayMs + (hh * 60 * 60 * 1000) + (mm * 60 * 1000);
            const finalDate = new Date(seasonStartMs + matchTimeOffset);
            const finalStartTime = finalDate.toISOString();

            batch.set(doc(db, 'matches_v1', matchId), {
              ...m,
              id: matchId,
              leagueId: selectedLeagueId,
              divisionId: Number(leagueLevel),
              groupId: Number(groupId),
              seasonNumber: activeSeason,
              status: 'pending',
              startTime: finalStartTime,
              scheduledAt: Timestamp.fromDate(finalDate) // Сохраняем и как Timestamp для бэкенда
            });
          });

          await batch.commit();
          console.log("[Engine] Season Initialized Atomically.");
          processingRef.current = false;
          return;
        }

        // Логика авто-симуляции матчей (проверка раз в минуту)
        const mskNow = getMoscowTime();
        const simBatch = writeBatch(db);
        let simCount = 0;

        existingSnap.docs.forEach(docSnap => {
          const m = docSnap.data();
          if (m.seasonNumber === activeSeason && m.status === 'pending' && mskNow.getTime() > new Date(m.startTime).getTime() + 60000) {
            const [sA, sB] = getMatchResult(m.homeId, m.awayId, m.day, activeSeason);
            const winner = sA > sB ? m.homeName : (sA === sB ? "Draw" : m.awayName);
            
            const finishedData = {
              status: 'finished',
              scoreA: sA, scoreB: sB,
              finishedAt: serverTimestamp(),
              simulation: {
                winner,
                seriesScore: `${sA}-${sB}`,
                games: [{ 
                  scoreA: sA > 0 ? 1 : 0, 
                  scoreB: sB > 0 ? (sB > 1 ? 1 : 0) : 0, 
                  duration: "38:00", 
                  matchSummary: "Battle sequence completed." 
                }]
              }
            };

            simBatch.update(docSnap.ref, finishedData);
            simCount++;

            if (m.homeId === userId || m.awayId === userId) {
              const isHome = m.homeId === userId;
              recordMatch(
                winner, 
                { scoreA: isHome ? sA : sB, scoreB: isHome ? sB : sA, ...finishedData.simulation }, 
                30000, 
                isHome ? m.awayName : m.homeName, 
                'league', 
                mskNow.toISOString(), 
                m.id
              );
            }
          }
        });

        if (simCount > 0) await simBatch.commit();

      } catch (e: any) {
        console.warn("[Engine] Sync Error:", e.message);
      } finally {
        processingRef.current = false;
      }
    };

    heartbeat();
    const interval = setInterval(heartbeat, 60000);
    return () => clearInterval(interval);
  }, [isLoaded, userId, selectedLeagueId, leagueLevel, groupId, allGroupPlayers, db, recordMatch]);

  return null;
}
