/**
 * @fileOverview Автономный движок сезонов. 
 * Использует детерминированные ID для предотвращения дубликатов и конфликтов.
 */

'use client';

import { useEffect, useRef } from 'react';
import { useGameState } from '@/app/lib/store';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { doc, getDoc, writeBatch, collection, query, where, serverTimestamp, getDocs } from 'firebase/firestore';
import { 
  getStableGroupTeams, generateSeasonCalendar, getMatchResult, 
  LEAGUES 
} from '@/app/lib/leagues-data';
import { getMoscowTime, getGlobalSeasonInfo, getMoscowDateString } from '@/app/lib/time-utils';

export function AutoMatchManager() {
  const { isLoaded, id: userId, selectedLeagueId, leagueLevel, groupId, recordMatch } = useGameState();
  const db = useFirestore();
  const processingRef = useRef(false);

  // Запрос всех игроков текущей группы
  const groupPlayersQuery = useMemoFirebase(() => {
    if (!selectedLeagueId) return null;
    return query(
      collection(db, 'players_v10'), 
      where('selectedLeagueId', '==', selectedLeagueId),
      where('leagueLevel', '==', Number(leagueLevel)),
      where('groupId', '==', Number(groupId))
    );
  }, [db, selectedLeagueId, leagueLevel, groupId]);

  const { data: allGroupPlayers } = useCollection(groupPlayersQuery);

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

        // 1. ПРОВЕРКА НА КОНФЛИКТЫ И СТАРЫХ БОТОВ (9.1.1, Elite Bot)
        const matchesQ = query(
          collection(db, 'matches_v1'),
          where('leagueId', '==', selectedLeagueId),
          where('divisionId', '==', Number(leagueLevel)),
          where('groupId', '==', Number(groupId))
        );
        const existingSnap = await getDocs(matchesQ);
        
        // AGGRESSIVE PURGE: Проверяем наличие имен старых ботов или неверного сезона
        const hasLegacy = existingSnap.docs.some(d => {
          const m = d.data();
          const name = (m.homeName || "") + (m.awayName || "");
          // Удаляем всё, что содержит 9.1.1, Elite Bot или не совпадает с активным сезоном
          return name.includes('Elite Bot') || 
                 name.includes('9.1.1') || 
                 name.includes('Bot 10') ||
                 m.seasonNumber !== activeSeason;
        });

        const needsInitialization = !groupSnap.exists() || groupData?.seasonId !== activeSeason || hasLegacy;

        if (needsInitialization) {
          console.log("[Engine] Purging legacy and generating Season " + activeSeason);
          
          const batch = writeBatch(db);
          // Удаляем АБСОЛЮТНО ВСЕ матчи этой группы, чтобы избежать наслоения
          existingSnap.docs.forEach(d => batch.delete(d.ref));
          
          const teams = getStableGroupTeams(Number(leagueLevel), Number(groupId), selectedLeagueId, allGroupPlayers);
          const calendar = generateSeasonCalendar(teams);
          
          // Рассчитываем дату начала сезона (каждый цикл 16 дней)
          const epochBase = new Date('2026-06-17T00:00:00+03:00');
          const seasonStart = new Date(epochBase);
          seasonStart.setDate(seasonStart.getDate() + (activeSeason - 1) * 16);

          // Обновляем метаданные группы
          batch.set(groupRef, {
            seasonId: activeSeason,
            teams,
            lastProcessedDate: getMoscowDateString(),
            updatedAt: serverTimestamp()
          }, { merge: true });

          calendar.forEach((m) => {
            // ДЕТЕРМИНИРОВАННЫЙ ID: Гарантирует уникальность и перезапись старых данных
            const matchId = `m_${selectedLeagueId}_${leagueLevel}_${groupId}_s${activeSeason}_d${m.day}_h${m.homeId}`;
            
            const matchDate = new Date(seasonStart);
            matchDate.setDate(matchDate.getDate() + (m.day - 1));
            const [hh, mm] = league.startTime.split(':').map(Number);
            matchDate.setHours(hh, mm, 0, 0);

            batch.set(doc(db, 'matches_v1', matchId), {
              ...m,
              id: matchId,
              leagueId: selectedLeagueId,
              divisionId: Number(leagueLevel),
              groupId: Number(groupId),
              seasonNumber: activeSeason,
              status: 'pending',
              startTime: matchDate.toISOString()
            });
          });

          await batch.commit();
          processingRef.current = false;
          return;
        }

        // 2. СИМУЛЯЦИЯ ЗАВЕРШЕННЫХ МАТЧЕЙ
        const mskNow = getMoscowTime();
        const simBatch = writeBatch(db);
        let simCount = 0;

        existingSnap.docs.forEach(docSnap => {
          const m = docSnap.data();
          // Процессим только матчи текущего сезона
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
                  duration: "40:00", 
                  matchSummary: "Competitive series finalized." 
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
