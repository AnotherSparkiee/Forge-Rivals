/**
 * @fileOverview Автономный движок сезонов с архитектурой "Изолированных Сезонов".
 * Гарантирует уникальные ID групп и матчей с привязкой к номеру сезона.
 * Внедрена версия календаря v4 для АГРЕССИВНОЙ ОЧИСТКИ дублей и ритма 1-1-1-1.
 */

'use client';

import { useEffect, useRef } from 'react';
import { useGameState } from '@/app/lib/store';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { doc, getDoc, writeBatch, collection, query, where, serverTimestamp, getDocs, Timestamp, limit } from 'firebase/firestore';
import { 
  getStableGroupTeams, generateSeasonCalendar, getMatchResult, 
  LEAGUES 
} from '@/app/lib/leagues-data';
import { getMoscowTime, getGlobalSeasonInfo, getMoscowDateString } from '@/app/lib/time-utils';

export function AutoMatchManager() {
  const { isLoaded, id: userId, selectedLeagueId, leagueLevel, groupId, recordMatch } = useGameState();
  const db = useFirestore();
  const processingRef = useRef(false);

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
        const seasonId = "season_1";
        const calendarVersion = 4; // ВЕРСИЯ 4: ПОЛНАЯ ЗАЧИСТКА ДУБЛЕЙ
        const seasonInfo = getGlobalSeasonInfo();
        const activeSeason = Math.max(1, seasonInfo.activeSeasonNumber);
        const league = LEAGUES.find(l => l.id === selectedLeagueId) || LEAGUES[0];
        
        const prefixedGroupId = `season_1_league_${selectedLeagueId}_group_${groupId}`;
        const groupRef = doc(db, 'leagues_v2', selectedLeagueId, 'divisions', String(leagueLevel), 'groups', prefixedGroupId);
        
        const groupSnap = await getDoc(groupRef);
        const currentData = groupSnap.data();

        // Если версия календаря устарела — проводим ПОЛНУЮ ОЧИСТКУ всех матчей группы
        const needsUpgrade = !groupSnap.exists() || (currentData?.calendarVersion || 0) < calendarVersion;

        if (needsUpgrade) {
          console.log(`[Engine] PURGING OLD MATCHES FOR V${calendarVersion} UPGRADE...`);
          
          let batch = writeBatch(db);
          
          // 1. Находим ВООБЩЕ ВСЕ матчи этой группы и удаляем их
          const oldMatchesSnap = await getDocs(query(
            collection(db, 'matches_v1'), 
            where('groupId', '==', prefixedGroupId)
          ));
          
          oldMatchesSnap.docs.forEach(d => {
            batch.delete(d.ref);
          });

          // 2. Генерируем новый чистый календарь
          const teams = getStableGroupTeams(Number(leagueLevel), Number(groupId), selectedLeagueId, allGroupPlayers);
          const calendar = generateSeasonCalendar(teams);
          
          const epochMs = new Date('2026-06-17T00:00:00+03:00').getTime();
          const dayMs = 24 * 60 * 60 * 1000;

          // 3. Обновляем заголовок группы
          batch.set(groupRef, {
            id: prefixedGroupId,
            seasonId,
            seasonNumber: activeSeason,
            teams,
            calendarVersion,
            lastProcessedDate: getMoscowDateString(),
            updatedAt: serverTimestamp()
          }, { merge: true });

          // 4. Записываем новые детерминированные матчи
          calendar.forEach((m) => {
            const matchId = `m_${prefixedGroupId}_d${m.day}_${m.pairKey}`;
            
            const [hh, mm] = league.startTime.split(':').map(Number);
            const matchTimeOffset = (m.day - 1) * dayMs + (hh * 60 * 60 * 1000) + (mm * 60 * 1000);
            const finalDate = new Date(epochMs + matchTimeOffset);

            batch.set(doc(db, 'matches_v1', matchId), {
              ...m,
              id: matchId,
              seasonId,
              seasonNumber: activeSeason,
              groupId: prefixedGroupId,
              leagueId: selectedLeagueId,
              divisionId: Number(leagueLevel),
              status: 'pending',
              startTime: finalDate.toISOString(),
              scheduledAt: Timestamp.fromDate(finalDate)
            });
          });

          await batch.commit();
          console.log(`[Engine] UPGRADE TO V${calendarVersion} COMPLETE.`);
        }

        // Auto-simulation check
        const mskNow = getMoscowTime();
        const pendingQ = query(
          collection(db, 'matches_v1'),
          where('groupId', '==', prefixedGroupId),
          where('status', '==', 'pending')
        );
        const pendingSnap = await getDocs(pendingQ);
        
        const simBatch = writeBatch(db);
        let simCount = 0;

        pendingSnap.docs.forEach(docSnap => {
          const m = docSnap.data();
          if (mskNow.getTime() > new Date(m.startTime).getTime() + 60000) {
            const [sA, sB] = getMatchResult(m.homeId, m.awayId, m.day, activeSeason);
            const winner = sA > sB ? m.homeName : (sA === sB ? "Draw" : m.awayName);
            
            const finishedData = {
              status: 'finished',
              scoreA: sA,
              scoreB: sB,
              finishedAt: serverTimestamp(),
              simulation: {
                winner,
                seriesScore: `${sA}-${sB}`,
                games: [{ 
                  scoreA: sA > 0 ? 1 : 0, 
                  scoreB: sB > 0 ? (sB > 1 ? 1 : 0) : 0, 
                  duration: "38:00", 
                  matchSummary: "Standard engagement protocol complete." 
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
