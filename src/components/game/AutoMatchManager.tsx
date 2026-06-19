
'use client';

/**
 * @fileOverview Автономный менеджер синхронизации v32.4 (Phase 1 Roadmap).
 * Реализован детальный мониторинг фаз Межсезонья и Генерации.
 */

import { useEffect, useRef } from 'react';
import { useGameState } from '@/app/lib/store';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { doc, getDoc, writeBatch, collection, query, where, serverTimestamp, Timestamp, updateDoc } from 'firebase/firestore';
import { 
  getStableGroupTeams, generateSeasonCalendar, 
  LEAGUES 
} from '@/app/lib/leagues-data';
import { getGlobalSeasonInfo, isMatchOverdue, getMoscowTime } from '@/app/lib/time-utils';
import { forceResolveGroupMatches } from '@/app/actions/mmo-engine';
import { generatePyramidCup } from '@/app/actions/cup-engine';

export function AutoMatchManager() {
  const { user, isUserLoading } = useUser();
  const { isLoaded, id: userId, selectedLeagueId, leagueLevel, groupId, allSeasonMatches } = useGameState();
  const db = useFirestore();
  const processingRef = useRef(false);

  const playersInGroupQuery = useMemoFirebase(() => {
    if (isUserLoading || !user?.uid || !selectedLeagueId) return null;
    return query(
      collection(db, 'players_v10'), 
      where('selectedLeagueId', '==', String(selectedLeagueId)),
      where('leagueLevel', '==', Number(leagueLevel)),
      where('groupId', '==', Number(groupId))
    );
  }, [db, selectedLeagueId, leagueLevel, groupId, isUserLoading, user?.uid]);

  const { data: allGroupPlayers } = useCollection(playersInGroupQuery);

  useEffect(() => {
    if (isUserLoading || !user?.uid || !isLoaded || !userId || !selectedLeagueId || !allGroupPlayers) return;

    const heartbeat = async () => {
      if (processingRef.current) return;
      processingRef.current = true;

      try {
        const info = getGlobalSeasonInfo();
        const mskNow = getMoscowTime();
        
        const nextSN = info.activeSeasonNumber; 
        const nextSeasonId = `season_${nextSN}`;
        
        const league = LEAGUES.find(l => l.id === selectedLeagueId) || LEAGUES[0];
        const nextPrefixedGroupId = `${nextSeasonId}_league_${selectedLeagueId}_group_${groupId}`;
        
        const sysStatusRef = doc(db, 'system_v1', 'status');
        const sysStatusSnap = await getDoc(sysStatusRef);
        const sysData = sysStatusSnap.exists() ? sysStatusSnap.data() : {};

        // ГЕНЕРАЦИЯ: День 15 цикла, после 16:00
        const isGenTime = info.dayOfCycle === 15 && mskNow.getHours() >= 16;
        
        if (isGenTime) {
          console.log(`[ROADMAP-PHASE] Generation Day Detected. Target Season: ${nextSN}`);
          
          const lastGenSeason = sysData.lastGeneratedSeason || 0;
          
          // 1. Глобальная генерация Кубка (один раз на сезон)
          if (lastGenSeason < nextSN) {
            console.log(`[AUTO-GEN] Initiating Global Cup Bracket for Season ${nextSN}`);
            await generatePyramidCup(nextSN);
            await updateDoc(sysStatusRef, { 
              lastGeneratedSeason: nextSN,
              lastGenTimestamp: serverTimestamp() 
            });
          }

          // 2. Локальная генерация календаря группы
          const groupRef = doc(db, 'leagues_v2', selectedLeagueId, 'divisions', String(leagueLevel), 'groups', nextPrefixedGroupId);
          const groupSnap = await getDoc(groupRef);
          const groupData = groupSnap.exists() ? groupSnap.data() : {};

          if (groupData.status !== 'ready_for_battle' && groupData.status !== 'generating') {
            await new Promise(resolve => setTimeout(resolve, Math.random() * 5000)); // Jitter
            
            await updateDoc(groupRef, { status: 'generating', updatedAt: serverTimestamp() });

            const currentTeams = getStableGroupTeams(Number(leagueLevel), Number(groupId), selectedLeagueId, allGroupPlayers);
            const calendar = generateSeasonCalendar(currentTeams);
            const nextSeasonEpochMs = info.nextSeasonStart.getTime();
            const dayMs = 24 * 60 * 60 * 1000;

            let batch = writeBatch(db);
            
            batch.set(groupRef, {
              id: nextPrefixedGroupId, seasonId: nextSeasonId, seasonNumber: nextSN,
              status: 'ready_for_battle', updatedAt: serverTimestamp()
            }, { merge: true });

            calendar.forEach((m) => {
              const matchId = `m_${nextPrefixedGroupId}_d${m.day}_${m.pairKey}`;
              const [hh, mm] = league.startTime.split(':').map(Number);
              const offset = (m.day - 1) * dayMs + (hh * 60 * 60 * 1000) + (mm * 60 * 1000);
              const finalDate = new Date(nextSeasonEpochMs + offset);

              batch.set(doc(db, 'matches_v1', matchId), {
                ...m, id: matchId, day: Number(m.day), seasonId: nextSeasonId, seasonNumber: nextSN,
                groupId: String(nextPrefixedGroupId), leagueId: String(selectedLeagueId),
                divisionId: Number(leagueLevel), status: 'scheduled', isFinished: false,
                startTime: finalDate.toISOString(), scheduledAt: Timestamp.fromDate(finalDate),
                version: 32 
              }, { merge: true });
            });

            currentTeams.forEach(team => {
              const teamRef = doc(db, 'leagues_v2', selectedLeagueId, 'divisions', String(leagueLevel), 'groups', nextPrefixedGroupId, 'teams', team.id);
              batch.set(teamRef, {
                id: team.id, name: team.name, wins: 0, draws: 0, losses: 0, points: 0,
                updatedAt: serverTimestamp()
              }, { merge: true });
            });

            await batch.commit();
            console.log(`[AUTO-GEN] Group Calendar established for Season ${nextSN}`);
          }
        }

        // ПРОВЕРКА ПРОСРОЧЕННЫХ МАТЧЕЙ (в активной фазе)
        if (!info.isOffseason) {
          const seasonId = `season_${info.seasonNumber}`;
          const currentPrefixedGroupId = `${seasonId}_league_${selectedLeagueId}_group_${groupId}`;
          const overdue = allSeasonMatches.filter(m => isMatchOverdue(m.startTime) && !m.isFinished);
          
          if (overdue.length > 0) {
            console.log(`[ROADMAP-PHASE] Active Season. Resolving ${overdue.length} overdue matches.`);
            await forceResolveGroupMatches(selectedLeagueId, Number(leagueLevel), currentPrefixedGroupId);
          }
        }

      } catch (e: any) {
        console.error("[AUTO-MANAGER ERROR]", e);
      } finally {
        processingRef.current = false;
      }
    };

    const interval = setInterval(heartbeat, 120000);
    heartbeat();
    return () => clearInterval(interval);
  }, [isLoaded, userId, selectedLeagueId, leagueLevel, groupId, allGroupPlayers, db, allSeasonMatches, isUserLoading, user?.uid]);

  return null;
}
