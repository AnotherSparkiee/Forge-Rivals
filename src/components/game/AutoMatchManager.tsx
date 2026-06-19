'use client';

/**
 * @fileOverview Автономный менеджер синхронизации v33 (Phase 2 Start).
 * Реализован мониторинг фаз Межсезонья, Генерации и Экономического цикла.
 */

import { useEffect, useRef } from 'react';
import { useGameState } from '@/app/lib/store';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { doc, getDoc, writeBatch, collection, query, where, serverTimestamp, Timestamp, updateDoc, setDoc } from 'firebase/firestore';
import { 
  getStableGroupTeams, generateSeasonCalendar, 
  LEAGUES 
} from '@/app/lib/leagues-data';
import { getGlobalSeasonInfo, isMatchOverdue, getMoscowTime, getMoscowDateString } from '@/app/lib/time-utils';
import { forceResolveGroupMatches } from '@/app/actions/mmo-engine';
import { generatePyramidCup } from '@/app/actions/cup-engine';

export function AutoMatchManager() {
  const { user, isUserLoading } = useUser();
  const { isLoaded, id: userId, selectedLeagueId, leagueLevel, groupId, allSeasonMatches, addCredits, language } = useGameState();
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
        
        const nextSN = info.activeSeasonNumber; 
        const nextSeasonId = `season_${nextSN}`;
        
        const league = LEAGUES.find(l => l.id === selectedLeagueId) || LEAGUES[0];
        const nextPrefixedGroupId = `${nextSeasonId}_league_${selectedLeagueId}_group_${groupId}`;
        
        const sysStatusRef = doc(db, 'system_v1', 'status');
        const sysStatusSnap = await getDoc(sysStatusRef);
        const sysData = sysStatusSnap.exists() ? sysStatusSnap.data() : {};

        // === ЭКОНОМИЧЕСКИЙ ЦИКЛ (Phase 2) ===
        if (lastEconomicCheckRef.current !== todayStr) {
          const seasonId = `season_${info.seasonNumber}`;
          const currentPrefixedGroupId = `${seasonId}_league_${selectedLeagueId}_group_${groupId}`;
          const teamRef = doc(db, 'leagues_v2', selectedLeagueId, 'divisions', String(leagueLevel), 'groups', currentPrefixedGroupId, 'teams', userId);
          const teamSnap = await getDoc(teamRef);
          
          if (teamSnap.exists()) {
            const teamData = teamSnap.data();
            if (teamData.lastSponsorPayoutDate !== todayStr) {
              const basePayout = 250000;
              const bonusMult = 1 + ((teamData.managerSkills?.sponsors || 0) * 0.1);
              const finalPayout = Math.round(basePayout * bonusMult);
              
              await updateDoc(teamRef, {
                credits: (teamData.credits || 0) + finalPayout,
                lastSponsorPayoutDate: todayStr,
                updatedAt: serverTimestamp()
              });
              
              const notifId = `sponsor_${userId}_${todayStr}`;
              await setDoc(doc(db, 'notifications_v7', notifId), {
                userId,
                title: language === 'ru' ? "Спонсорская выплата" : "Sponsor Payout",
                description: language === 'ru' ? `Получено €${finalPayout.toLocaleString()} от спонсоров лиги.` : `Received €${finalPayout.toLocaleString()} from league sponsors.`,
                type: 'league',
                read: false,
                createdAt: new Date().toISOString()
              });

              console.log(`[ECONOMY] Granted sponsor payout to ${userId}: ${finalPayout}`);
            }
          }
          lastEconomicCheckRef.current = todayStr;
        }

        // === ГЕНЕРАЦИЯ (Phase 1 Final) ===
        const isGenTime = info.dayOfCycle === 15 && mskNow.getHours() >= 16;
        
        if (isGenTime) {
          const lastGenSeason = sysData.lastGeneratedSeason || 0;
          
          if (lastGenSeason < nextSN) {
            console.log(`[AUTO-GEN] Global Cup for Season ${nextSN}`);
            await generatePyramidCup(nextSN);
            await updateDoc(sysStatusRef, { 
              lastGeneratedSeason: nextSN,
              lastGenTimestamp: serverTimestamp() 
            });
          }

          const groupRef = doc(db, 'leagues_v2', selectedLeagueId, 'divisions', String(leagueLevel), 'groups', nextPrefixedGroupId);
          const groupSnap = await getDoc(groupRef);
          const groupData = groupSnap.exists() ? groupSnap.data() : {};

          if (groupData.status !== 'ready_for_battle' && groupData.status !== 'generating') {
            await new Promise(resolve => setTimeout(resolve, Math.random() * 5000));
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
          }
        }

        // === РЕЗОЛВЕР МАТЧЕЙ ===
        if (!info.isOffseason) {
          const overdue = allSeasonMatches.filter(m => isMatchOverdue(m.startTime) && !m.isFinished);
          if (overdue.length > 0) {
            const seasonId = `season_${info.seasonNumber}`;
            const currentPrefixedGroupId = `${seasonId}_league_${selectedLeagueId}_group_${groupId}`;
            await forceResolveGroupMatches(selectedLeagueId, Number(leagueLevel), currentPrefixedGroupId);
          }
        }

      } catch (e: any) {
        console.error("[AUTO-MANAGER ERROR]", e);
      } finally {
        processingRef.current = false;
      }
    };

    const interval = setInterval(heartbeat, 60000);
    heartbeat();
    return () => clearInterval(interval);
  }, [isLoaded, userId, selectedLeagueId, leagueLevel, groupId, allGroupPlayers, db, allSeasonMatches, isUserLoading, user?.uid, language]);

  return null;
}
