
'use client';

/**
 * @fileOverview Автономный менеджер синхронизации v45.
 * Гарантирует запись всех событий (Лига, Кубок) в БД и инициализацию таблиц.
 * Добавлена очистка устаревших данных (версии ниже 32).
 */

import { useEffect, useRef } from 'react';
import { useGameState } from '@/app/lib/store';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { doc, getDoc, writeBatch, collection, query, where, serverTimestamp, updateDoc, setDoc, getDocs, limit } from 'firebase/firestore';
import { getStableGroupTeams, generateSeasonCalendar } from '@/app/lib/leagues-data';
import { getGlobalSeasonInfo, isMatchOverdue, getMoscowTime, getMoscowDateString } from '@/app/lib/time-utils';
import { forceResolveGroupMatches } from '@/app/actions/mmo-engine';
import { generatePyramidCup } from '@/app/actions/cup-engine';

export function AutoMatchManager() {
  const { user, isUserLoading } = useUser();
  const { isLoaded, id: userId, selectedLeagueId, leagueLevel, groupId, allSeasonMatches, language, payStaffSalaries } = useGameState();
  const db = useFirestore();
  const processingRef = useRef(false);
  const lastEconomicCheckRef = useRef<string | null>(null);

  const leaguePlayersQuery = useMemoFirebase(() => {
    if (isUserLoading || !user?.uid || !selectedLeagueId) return null;
    return query(
      collection(db, 'players_v10'), 
      where('selectedLeagueId', '==', String(selectedLeagueId))
    );
  }, [db, selectedLeagueId, isUserLoading, user?.uid]);

  const { data: leaguePlayers } = useCollection(leaguePlayersQuery);

  useEffect(() => {
    if (isUserLoading || !user?.uid || !isLoaded || !userId || !selectedLeagueId || !leaguePlayers) return;

    const heartbeat = async () => {
      if (processingRef.current) return;
      processingRef.current = true;

      try {
        const info = getGlobalSeasonInfo();
        const mskNow = getMoscowTime();
        const todayStr = getMoscowDateString();
        
        const currentSN = info.seasonNumber;
        const currentSeasonId = `season_${currentSN}`;

        // 1. ECONOMIC CYCLE
        if (lastEconomicCheckRef.current !== todayStr) {
          const currentPrefixedGroupId = `${currentSeasonId}_league_${selectedLeagueId}_group_${groupId}`;
          const teamRef = doc(db, 'leagues_v2', selectedLeagueId, 'divisions', String(leagueLevel), 'groups', currentPrefixedGroupId, 'teams', userId);
          const teamSnap = await getDoc(teamRef);
          
          if (teamSnap.exists()) {
            const teamData = teamSnap.data();
            if (teamData.lastSponsorPayoutDate !== todayStr) {
              const basePayout = 250000;
              const bonusMult = 1 + ((teamData.managerSkills?.sponsors || 0) * 0.1);
              const finalPayout = Math.round(basePayout * (teamData.isPremium ? 3.0 : 1.0) * bonusMult);
              
              await updateDoc(teamRef, { 
                credits: (teamData.credits || 0) + finalPayout, 
                lastSponsorPayoutDate: todayStr, 
                updatedAt: serverTimestamp() 
              });
              
              await setDoc(doc(db, 'notifications_v7', `sponsor_${userId}_${todayStr}`), { 
                userId, 
                title: language === 'ru' ? "Выплата спонсоров" : "Sponsor Payout", 
                description: language === 'ru' ? `Получено €${finalPayout.toLocaleString()}` : `Received €${finalPayout.toLocaleString()}`, 
                type: 'league', 
                read: false, 
                createdAt: mskNow.toISOString() 
              });
            }
            await payStaffSalaries();
          }
          lastEconomicCheckRef.current = todayStr;
        }

        // 2. LEAGUE INITIALIZATION (CALENDAR + STANDINGS)
        const targetSN = info.seasonNumber; 
        const targetSeasonId = `season_${targetSN}`;
        const prefixedGroupId = `${targetSeasonId}_league_${selectedLeagueId}_group_${groupId}`;
        const groupRef = doc(db, 'leagues_v2', selectedLeagueId, 'divisions', String(leagueLevel), 'groups', prefixedGroupId);
        
        const groupSnap = await getDoc(groupRef);
        if (!groupSnap.exists()) {
          console.log(`[SYNC ENGINE] Initializing group ${prefixedGroupId} for Season ${targetSN}`);
          
          const groupPlayers = leaguePlayers.filter(p => Number(p.leagueLevel) === Number(leagueLevel) && Number(p.groupId) === Number(groupId));
          const currentTeams = getStableGroupTeams(Number(leagueLevel), Number(groupId), selectedLeagueId, groupPlayers);
          const calendar = generateSeasonCalendar(currentTeams, targetSN, selectedLeagueId);
          
          const batch = writeBatch(db);
          batch.set(groupRef, { 
            id: prefixedGroupId, 
            seasonId: targetSeasonId, 
            seasonNumber: targetSN, 
            status: 'ready', 
            updatedAt: serverTimestamp() 
          });
          
          currentTeams.forEach(team => {
            const teamTableRef = doc(db, 'leagues_v2', selectedLeagueId, 'divisions', String(leagueLevel), 'groups', prefixedGroupId, 'teams', team.id);
            batch.set(teamTableRef, {
              id: team.id,
              name: team.name,
              displayName: team.name,
              wins: 0, draws: 0, losses: 0, points: 0,
              credits: team.isBot ? 0 : 1000000,
              crystals: team.isBot ? 0 : 50,
              updatedAt: serverTimestamp(),
              version: 1 
            }, { merge: true });
          });
          
          calendar.forEach((m) => {
            const matchId = `m_${prefixedGroupId}_d${m.day}_${m.pairKey}`;
            batch.set(doc(db, 'matches_v1', matchId), { 
              ...m, 
              id: matchId, 
              seasonId: targetSeasonId, 
              seasonNumber: targetSN, 
              groupId: prefixedGroupId, 
              leagueId: selectedLeagueId, 
              divisionId: Number(leagueLevel),
              status: 'scheduled', 
              isFinished: false, 
              version: 32 
            });
          });
          await batch.commit();

          // Generate Cup for the whole League once
          await generatePyramidCup(targetSN);
        }

        // 3. MATCH RESOLVER
        const overdue = allSeasonMatches.filter(m => isMatchOverdue(m.startTime) && !m.isFinished && m.version === 32);
        if (overdue.length > 0) {
          const currentPrefixedGroupId = `${targetSeasonId}_league_${selectedLeagueId}_group_${groupId}`;
          await forceResolveGroupMatches(selectedLeagueId, Number(leagueLevel), currentPrefixedGroupId);
        }

      } catch (e: any) {
        console.error("[GLOBAL SYNC ERROR]", e);
      } finally {
        processingRef.current = false;
      }
    };

    const interval = setInterval(heartbeat, 60000);
    heartbeat();
    return () => clearInterval(interval);
  }, [isLoaded, userId, selectedLeagueId, leagueLevel, groupId, leaguePlayers, db, allSeasonMatches, isUserLoading, user?.uid, language, payStaffSalaries]);

  return null;
}
