'use client';

/**
 * @fileOverview Автономный менеджер синхронизации v39.
 * Исправлена генерация первого сезона и Кубка Пирамиды.
 */

import { useEffect, useRef } from 'react';
import { useGameState } from '@/app/lib/store';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { doc, getDoc, writeBatch, collection, query, where, serverTimestamp, updateDoc, setDoc } from 'firebase/firestore';
import { getStableGroupTeams, generateSeasonCalendar, LEAGUES } from '@/app/lib/leagues-data';
import { getGlobalSeasonInfo, isMatchOverdue, getMoscowTime, getMoscowDateString, toMskDate } from '@/app/lib/time-utils';
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
        const utcNow = getMoscowTime();
        const mskNow = toMskDate(utcNow);
        const todayStr = getMoscowDateString();
        
        const currentSN = info.seasonNumber;
        const currentSeasonId = `season_${currentSN}`;
        const nextSN = currentSN + 1;
        const nextSeasonId = `season_${nextSN}`;

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
                createdAt: utcNow.toISOString() 
              });
            }
            await payStaffSalaries();
          }
          lastEconomicCheckRef.current = todayStr;
        }

        // 2. ГЕНЕРАЦИЯ КАЛЕНДАРЯ (Для текущего или следующего сезона)
        const targetSN = info.isGenerationDay ? nextSN : currentSN;
        const targetSeasonId = `season_${targetSN}`;
        const prefixedGroupId = `${targetSeasonId}_league_${selectedLeagueId}_group_${groupId}`;
        const groupRef = doc(db, 'leagues_v2', selectedLeagueId, 'divisions', String(leagueLevel), 'groups', prefixedGroupId);
        
        // Проверка готовности сезона (если мы в предсезонье или в день генерации)
        if (info.isPreSeason || (info.dayOfCycle === 15 && mskNow.getUTCHours() >= 16)) {
          const groupSnap = await getDoc(groupRef);
          if (!groupSnap.exists()) {
            console.log(`[SYNC] Generating matches for ${targetSeasonId} Group ${groupId}...`);
            const currentTeams = getStableGroupTeams(Number(leagueLevel), Number(groupId), selectedLeagueId, allGroupPlayers);
            const calendar = generateSeasonCalendar(currentTeams, targetSN, selectedLeagueId);
            
            let batch = writeBatch(db);
            batch.set(groupRef, { 
              id: prefixedGroupId, 
              seasonId: targetSeasonId, 
              seasonNumber: targetSN, 
              status: 'ready', 
              updatedAt: serverTimestamp() 
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
                status: 'scheduled', 
                isFinished: false, 
                version: 32 
              });
            });
            await batch.commit();

            // Также пытаемся инициировать Кубок если это Сезон 1
            if (targetSN === 1) {
              await generatePyramidCup(1);
            }
          }
        }

        // 3. РЕЗОЛВЕР ПРОСРОЧЕННЫХ МАТЧЕЙ
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
