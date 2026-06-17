/**
 * @fileOverview Автономный движок сезонов. 
 * Внедрена версия v7: Агрессивная симуляция и восстановление потерянных отчетов.
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
import { getMoscowTime, getGlobalSeasonInfo } from '@/app/lib/time-utils';

export function AutoMatchManager() {
  const { isLoaded, id: userId, selectedLeagueId, leagueLevel, groupId, recordMatch, matchHistory } = useGameState();
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
    if (!isLoaded || !userId || !selectedLeagueId || processingRef.current) return;

    const heartbeat = async () => {
      if (processingRef.current) return;
      processingRef.current = true;

      try {
        const seasonInfo = getGlobalSeasonInfo();
        const activeSeason = seasonInfo.activeSeasonNumber;
        const seasonId = `season_${activeSeason}`;
        const league = LEAGUES.find(l => l.id === selectedLeagueId) || LEAGUES[0];
        
        const prefixedGroupId = `${seasonId}_league_${selectedLeagueId}_group_${groupId}`;
        const groupRef = doc(db, 'leagues_v2', selectedLeagueId, 'divisions', String(leagueLevel), 'groups', prefixedGroupId);
        
        const groupSnap = await getDoc(groupRef);
        const currentData = groupSnap.data();

        // 1. CALENDAR GENERATION (If needed)
        if (allGroupPlayers && allGroupPlayers.length > 0) {
          const currentTeams = getStableGroupTeams(Number(leagueLevel), Number(groupId), selectedLeagueId, allGroupPlayers);
          const teamsHash = currentTeams.map(t => t.id).join('|');

          const needsUpgrade = !groupSnap.exists() || 
                              (currentData?.calendarVersion || 0) < 7 ||
                              currentData?.teamsHash !== teamsHash;

          if (needsUpgrade) {
            console.log(`[Engine] REGENERATING CALENDAR FOR ${prefixedGroupId}`);
            let batch = writeBatch(db);
            
            const oldMatchesSnap = await getDocs(query(
              collection(db, 'matches_v1'), 
              where('groupId', '==', prefixedGroupId)
            ));
            oldMatchesSnap.docs.forEach(d => batch.delete(d.ref));

            const calendar = generateSeasonCalendar(currentTeams);
            const epochMs = new Date('2026-06-17T00:00:00+03:00').getTime();
            const dayMs = 24 * 60 * 60 * 1000;

            batch.set(groupRef, {
              id: prefixedGroupId,
              seasonId,
              seasonNumber: activeSeason,
              teams: currentTeams,
              teamsHash,
              calendarVersion: 7,
              updatedAt: serverTimestamp()
            }, { merge: true });

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
          }
        }

        // 2. SIMULATION ENGINE & RECOVERY
        const mskNow = getMoscowTime();
        
        // Поиск всех матчей группы (и завершенных, и ожидающих)
        const matchesQ = query(
          collection(db, 'matches_v1'),
          where('groupId', '==', prefixedGroupId)
        );
        const matchesSnap = await getDocs(matchesQ);
        
        if (!matchesSnap.empty) {
          const simBatch = writeBatch(db);
          let changeCount = 0;

          for (const docSnap of matchesSnap.docs) {
            const m = docSnap.data();
            const startTime = new Date(m.startTime).getTime();
            const isTimePassed = mskNow.getTime() > startTime + 30000; // 30s buffer
            
            // СЛУЧАЙ А: Матч прошел, но статус всё еще pending
            if (m.status === 'pending' && isTimePassed) {
              const [sA, sB] = getMatchResult(m.homeId, m.awayId, m.day, activeSeason);
              const winner = sA > sB ? m.homeName : (sA === sB ? "Draw" : m.awayName);
              const winnerId = sA > sB ? m.homeId : (sA === sB ? null : m.awayId);
              
              const finishedData = {
                status: 'finished',
                scoreA: sA,
                scoreB: sB,
                winnerId: winnerId,
                finishedAt: serverTimestamp(),
                simulation: {
                  winner,
                  seriesScore: `${sA}-${sB}`,
                  games: [{ 
                    scoreA: sA > 0 ? 1 : 0, 
                    scoreB: sB > 0 ? (sB > 1 ? 1 : 0) : 0, 
                    duration: "38:00", 
                    matchSummary: "Battle concluded after heavy engagements." 
                  }]
                }
              };

              simBatch.update(docSnap.ref, finishedData);
              changeCount++;

              // Записываем в историю если мой матч
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
            
            // СЛУЧАЙ Б: Матч уже finished в базе, но по какой-то причине отсутствует в matchHistory игрока
            else if (m.status === 'finished' && (m.homeId === userId || m.awayId === userId)) {
              const alreadyInHistory = matchHistory.some(hist => hist.id === m.id);
              if (!alreadyInHistory) {
                console.log(`[Engine] RECOVERING match report for ${m.id}`);
                const isHome = m.homeId === userId;
                recordMatch(
                  m.simulation?.winner || "Draw",
                  { 
                    scoreA: isHome ? m.scoreA : m.scoreB, 
                    scoreB: isHome ? m.scoreB : m.scoreA, 
                    ...m.simulation 
                  },
                  30000,
                  isHome ? m.awayName : m.homeName,
                  'league',
                  m.finishedAt?.toDate?.().toISOString() || mskNow.toISOString(),
                  m.id
                );
              }
            }
          }

          if (changeCount > 0) {
            await simBatch.commit();
            console.log(`[Engine] Simulated ${changeCount} stuck matches.`);
          }
        }

      } catch (e: any) {
        console.warn("[Engine] Sync Error:", e.message);
      } finally {
        processingRef.current = false;
      }
    };

    heartbeat();
    const interval = setInterval(heartbeat, 15000); // Check every 15s for better responsiveness
    return () => clearInterval(interval);
  }, [isLoaded, userId, selectedLeagueId, leagueLevel, groupId, allGroupPlayers, db, recordMatch, matchHistory]);

  return null;
}
