'use client';

import { useEffect, useRef } from 'react';
import { useGameState } from '@/app/lib/store';
import { getGlobalSeasonInfo, isMatchOverdue } from '@/app/lib/time-utils';
import { 
  getStableGroupTeams, 
  generateSeasonCalendar, 
  getMatchResult,
  getPromotionTarget,
  getRelegationTarget
} from '@/app/lib/leagues-data';
import { useFirestore, setDocumentNonBlocking } from '@/firebase';
import { doc, getDoc } from 'firebase/firestore';

/**
 * ГЛОБАЛЬНЫЙ МЕНЕДЖЕР МАТЧЕЙ v6.7 (Stability Fix)
 * Генерирует календарь и ФИКСИРУЕТ результаты на основе рангов слотов в группе.
 * Добавлена защита от устаревших данных без рангов.
 */
export function AutoMatchManager() {
  const { 
    isLoaded, isDataReady, selectedLeagueId, 
    leagueLevel, groupId, setWorldReady, rank, clubLogo, clubName,
    allSeasonMatches, saveToLocal, lastProcessedSeason, id: userId
  } = useGameState();
  
  const db = useFirestore();
  const initRef = useRef(false);

  useEffect(() => {
    if (!isLoaded || !selectedLeagueId) return;

    const info = getGlobalSeasonInfo();
    const currentSeason = info.activeSeasonNumber;

    // Проверка целостности данных календаря (наличие рангов для фиксации)
    const isCalendarStale = allSeasonMatches && allSeasonMatches.length > 0 && 
                           (allSeasonMatches[0].homeRank === undefined || allSeasonMatches[0].awayRank === undefined);

    // 1. СИНХРОНИЗАЦИЯ ЭПОХИ / HARD RESET / STALE DATA RECOVERY
    if (isCalendarStale || lastProcessedSeason < currentSeason || (lastProcessedSeason > currentSeason && currentSeason === 1)) {
      let nextLevel = leagueLevel;
      let nextGroup = groupId;
      
      if (!isCalendarStale && lastProcessedSeason > 0 && lastProcessedSeason < currentSeason) {
        const teamData = getStableGroupTeams(leagueLevel, groupId, selectedLeagueId, [{
          id: userId, name: clubName || "Local Club", rank: rank || 1, logo: clubLogo || null, isBot: false
        }]);

        const finalStandings = teamData.map(t => {
          let pts = 0;
          for (let tour = 1; tour <= 14; tour++) {
            const [scoreA, scoreB] = getMatchResult(t.id, "opp", lastProcessedSeason, tour);
            pts += (scoreA > scoreB ? 3 : (scoreA === scoreB ? 1 : 0));
          }
          return { id: t.id, pts };
        }).sort((a, b) => b.pts - a.pts);

        const playerPos = finalStandings.findIndex(s => s.id === userId) + 1;
        if (playerPos === 1) {
          const target = getPromotionTarget(leagueLevel, groupId);
          nextLevel = target.level; nextGroup = target.group;
        } else if (playerPos >= 7) {
          const target = getRelegationTarget(leagueLevel, groupId, playerPos);
          nextLevel = target.level; nextGroup = target.group;
        }
      }

      const newTeamData = getStableGroupTeams(nextLevel, nextGroup, selectedLeagueId, [{
        id: userId, name: clubName || "Local Club", rank: 1, logo: clubLogo || null, isBot: false
      }]);

      const newCalendar = generateSeasonCalendar(newTeamData, currentSeason, selectedLeagueId);

      saveToLocal({
        leagueLevel: nextLevel,
        groupId: nextGroup,
        lastProcessedSeason: currentSeason,
        allSeasonMatches: newCalendar,
        lastSeenMatchDay: 0
      });
      
      return;
    }

    // 2. ПЕРВИЧНАЯ ИНИЦИАЛИЗАЦИЯ
    if (!initRef.current) {
      initRef.current = true;
      if (!allSeasonMatches || allSeasonMatches.length === 0) {
        const teamData = getStableGroupTeams(leagueLevel, groupId, selectedLeagueId, [{
          id: userId, name: clubName || "Local Club", rank: rank || 1, logo: clubLogo || null, isBot: false
        }]);
        const calendar = generateSeasonCalendar(teamData, currentSeason, selectedLeagueId);
        saveToLocal({ allSeasonMatches: calendar });
      }
      setWorldReady(true);
    }

    // 3. ГЛОБАЛЬНЫЙ РЕЗОЛВЕР (Slot-Based)
    const resolveTimer = setInterval(async () => {
      if (!db || !allSeasonMatches || allSeasonMatches.length === 0) return;

      const overdueMatches = allSeasonMatches.filter(m => !m.isFinished && isMatchOverdue(m.startTime));
      if (overdueMatches.length === 0) return;

      let hasLocalChanges = false;
      const updatedMatches = [...allSeasonMatches];

      for (let i = 0; i < updatedMatches.length; i++) {
        const m = updatedMatches[i];
        if (m.isFinished || !isMatchOverdue(m.startTime)) continue;
        
        // Защита от отсутствующих данных рангов
        if (m.homeRank === undefined || m.awayRank === undefined) continue;

        // ID привязан к СЛОТАМ (Рангам), а не к ID команд. Это решает проблему наложений.
        const globalMatchId = `v11_s${currentSeason}_l${selectedLeagueId}_lv${leagueLevel}_g${groupId}_t${m.tour}_hR${m.homeRank}_aR${m.awayRank}`;
        const matchRef = doc(db, 'matches_v11', globalMatchId);
        
        try {
          const snap = await getDoc(matchRef);
          let finalScoreA, finalScoreB;

          if (!snap.exists()) {
            const [sA, sB] = getMatchResult(m.homeId, m.awayId, currentSeason, m.tour);
            finalScoreA = sA;
            finalScoreB = sB;

            setDocumentNonBlocking(matchRef, {
              id: globalMatchId,
              leagueId: selectedLeagueId,
              level: leagueLevel,
              groupId: groupId,
              season: currentSeason,
              tour: m.tour,
              homeRank: m.homeRank,
              awayRank: m.awayRank,
              homeId: m.homeId,
              awayId: m.awayId,
              scoreA: sA,
              scoreB: sB,
              winnerId: sA > sB ? m.homeId : (sB > sA ? m.awayId : null),
              resolvedAt: new Date().toISOString(),
              version: 11
            });
          } else {
            const data = snap.data();
            finalScoreA = data?.scoreA ?? 0;
            finalScoreB = data?.scoreB ?? 0;
          }

          updatedMatches[i] = { 
            ...m, 
            isFinished: true, 
            scoreA: finalScoreA, 
            scoreB: finalScoreB, 
            status: 'finished' 
          };
          hasLocalChanges = true;

        } catch (e) {
          console.error("[AUTO-RESOLVE ERROR]", e);
        }
      }

      if (hasLocalChanges) {
        saveToLocal({ allSeasonMatches: updatedMatches });
      }
    }, 10000);

    return () => clearInterval(resolveTimer);
  }, [isLoaded, selectedLeagueId, leagueLevel, groupId, rank, clubLogo, clubName, allSeasonMatches, saveToLocal, setWorldReady, lastProcessedSeason, userId, db]);

  return null;
}
