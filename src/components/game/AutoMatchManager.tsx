/**
 * @fileOverview Автономный движок сезонов. 
 * Использует детерминированные ID и атомарные батчи.
 * Исправлен расчет времени матчей (scheduledAt) с использованием иммутабельных таймстампов.
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

        const matchesQ = query(
          collection(db, 'matches_v1'),
          where('leagueId', '==', selectedLeagueId),
          where('divisionId', '==', Number(leagueLevel)),
          where('groupId', '==', Number(groupId))
        );
        const existingSnap = await getDocs(matchesQ);
        
        const dirtyMatches = existingSnap.docs.filter(d => {
          const m = d.data();
          const name = (m.homeName || "") + (m.awayName || "");
          return name.includes('Elite Bot') || 
                 name.includes('9.1.1') || 
                 name.includes('Bot 10') ||
                 m.seasonNumber !== activeSeason;
        });

        const needsInitialization = !groupSnap.exists() || groupData?.seasonId !== activeSeason || dirtyMatches.length > 0;

        if (needsInitialization) {
          console.log("[Engine] ATOMIC SEASON INITIALIZATION: Season " + activeSeason);
          
          const batch = writeBatch(db);
          existingSnap.docs.forEach(d => batch.delete(d.ref));
          
          const teams = getStableGroupTeams(Number(leagueLevel), Number(groupId), selectedLeagueId, allGroupPlayers);
          const calendar = generateSeasonCalendar(teams);
          
          // ИММУТАБЕЛЬНЫЙ РАСЧЕТ ВРЕМЕНИ
          const epochMs = new Date('2026-06-17T00:00:00+03:00').getTime();
          const dayMs = 24 * 60 * 60 * 1000;
          const seasonStartMs = epochMs + (activeSeason - 1) * 16 * dayMs;

          batch.set(groupRef, {
            seasonId: activeSeason,
            teams,
            lastProcessedDate: getMoscowDateString(),
            updatedAt: serverTimestamp()
          }, { merge: true });

          const systemStatusRef = doc(db, 'system_v1', 'status');
          batch.set(systemStatusRef, {
            currentSeasonNumber: activeSeason,
            updatedAt: serverTimestamp()
          }, { merge: true });

          calendar.forEach((m) => {
            const matchId = `m_${selectedLeagueId}_${leagueLevel}_${groupId}_s${activeSeason}_d${m.day}_h${m.homeId}`;
            
            // Расчет времени без мутации Date
            const [hh, mm] = league.startTime.split(':').map(Number);
            const matchTimeOffset = (m.day - 1) * dayMs + (hh * 60 * 60 * 1000) + (mm * 60 * 1000);
            const finalStartTime = new Date(seasonStartMs + matchTimeOffset).toISOString();

            batch.set(doc(db, 'matches_v1', matchId), {
              ...m,
              id: matchId,
              leagueId: selectedLeagueId,
              divisionId: Number(leagueLevel),
              groupId: Number(groupId),
              seasonNumber: activeSeason,
              status: 'pending',
              startTime: finalStartTime
            });
          });

          await batch.commit();
          processingRef.current = false;
          return;
        }

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
                  matchSummary: "Elite match sequence finalized." 
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
