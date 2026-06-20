'use client';

/**
 * @fileOverview Автономный менеджер синхронизации v36.
 * Точное соблюдение временных окон Лиги и Кубка.
 */

import { useEffect, useRef } from 'react';
import { useGameState } from '@/app/lib/store';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { doc, getDoc, writeBatch, collection, query, where, serverTimestamp, updateDoc, setDoc } from 'firebase/firestore';
import { getStableGroupTeams, generateSeasonCalendar, LEAGUES } from '@/app/lib/leagues-data';
import { getGlobalSeasonInfo, isMatchOverdue, getMoscowTime, getMoscowDateString } from '@/app/lib/time-utils';
import { forceResolveGroupMatches } from '@/app/actions/mmo-engine';
import { generatePyramidCup } from '@/app/actions/cup-engine';

export function AutoMatchManager() {
  const { user, isUserLoading } = useUser();
  const { isLoaded, id: userId, selectedLeagueId, leagueLevel, groupId, allSeasonMatches, language, payStaffSalaries } = useGameState();
  const db = useFirestore();
  const processingRef = useRef(false);
  const lastEconomicCheckRef = useRef<string | null>(null);

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
        const todayStr = getMoscowDateString();
        
        const currentSN = info.seasonNumber;
        const currentSeasonId = `season_${currentSN}`;
        const nextSN = currentSN + 1;
        const nextSeasonId = `season_${nextSN}`;
        
        const sysStatusRef = doc(db, 'system_v1', 'status');

        // 1. ЭКОНОМИЧЕСКИЙ ЦИКЛ (Ежедневно в 00:00 MSK)
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
              await updateDoc(teamRef, { credits: (teamData.credits || 0) + finalPayout, lastSponsorPayoutDate: todayStr, updatedAt: serverTimestamp() });
              await setDoc(doc(db, 'notifications_v7', `sponsor_${userId}_${todayStr}`), { userId, title: language === 'ru' ? "Выплата спонсоров" : "Sponsor Payout", description: language === 'ru' ? `Получено €${finalPayout.toLocaleString()}` : `Received €${finalPayout.toLocaleString()}`, type: 'league', read: false, createdAt: new Date().toISOString() });
            }
            await payStaffSalaries();
          }
          lastEconomicCheckRef.current = todayStr;
        }

        // 2. ГЕНЕРАЦИЯ СЛЕДУЮЩЕГО СЕЗОНА (В День 15 после 16:00 MSK)
        if (info.dayOfCycle === 15 && mskNow.getHours() >= 16) {
          const nextPrefixedGroupId = `${nextSeasonId}_league_${selectedLeagueId}_group_${groupId}`;
          const groupRef = doc(db, 'leagues_v2', selectedLeagueId, 'divisions', String(leagueLevel), 'groups', nextPrefixedGroupId);
          const groupSnap = await getDoc(groupRef);

          if (!groupSnap.exists()) {
            console.log(`[SYNC] Generating matches for ${nextSeasonId}...`);
            const currentTeams = getStableGroupTeams(Number(leagueLevel), Number(groupId), selectedLeagueId, allGroupPlayers);
            const calendar = generateSeasonCalendar(currentTeams, nextSN, selectedLeagueId);
            
            let batch = writeBatch(db);
            batch.set(groupRef, { id: nextPrefixedGroupId, seasonId: nextSeasonId, seasonNumber: nextSN, status: 'ready', updatedAt: serverTimestamp() });
            
            calendar.forEach((m) => {
              const matchId = `m_${nextPrefixedGroupId}_d${m.day}_${m.pairKey}`;
              batch.set(doc(db, 'matches_v1', matchId), { ...m, id: matchId, seasonId: nextSeasonId, seasonNumber: nextSN, groupId: nextPrefixedGroupId, leagueId: selectedLeagueId, status: 'scheduled', isFinished: false, version: 32 });
            });
            await batch.commit();
          }
        }

        // 3. РЕЗОЛВЕР ПРОСРОЧЕННЫХ МАТЧЕЙ (Проверка каждые 60 сек)
        const overdue = allSeasonMatches.filter(m => isMatchOverdue(m.startTime) && !m.isFinished);
        if (overdue.length > 0) {
          const currentPrefixedGroupId = `${currentSeasonId}_league_${selectedLeagueId}_group_${groupId}`;
          await forceResolveGroupMatches(selectedLeagueId, Number(leagueLevel), currentPrefixedGroupId);
        }

      } catch (e: any) {
        console.error("[AUTO-MANAGER SYNC ERROR]", e);
      } finally {
        processingRef.current = false;
      }
    };

    const interval = setInterval(heartbeat, 60000);
    heartbeat();
    return () => clearInterval(interval);
  }, [isLoaded, userId, selectedLeagueId, leagueLevel, groupId, allGroupPlayers, db, allSeasonMatches, isUserLoading, user?.uid, language, payStaffSalaries]);

  return null;
}
