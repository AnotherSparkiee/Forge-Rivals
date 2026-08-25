
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
import { useToast } from '@/hooks/use-toast';
import { useFirestore, setDocumentNonBlocking } from '@/firebase';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';

/**
 * ЛОКАЛЬНЫЙ МЕНЕДЖЕР МАТЧЕЙ v6.0 (Global Sync)
 * Генерирует календарь и ФИКСИРУЕТ результаты в Firestore v11.
 */
export function AutoMatchManager() {
  const { 
    isLoaded, isDataReady, selectedLeagueId, 
    leagueLevel, groupId, setWorldReady, rank, clubLogo, clubName,
    allSeasonMatches, saveToLocal, lastProcessedSeason, language, id: userId
  } = useGameState();
  
  const db = useFirestore();
  const { toast } = useToast();
  const initRef = useRef(false);

  useEffect(() => {
    if (!isLoaded || !selectedLeagueId) return;

    const info = getGlobalSeasonInfo();
    const currentSeason = info.activeSeasonNumber;

    // 1. СИНХРОНИЗАЦИЯ ЭПОХИ / HARD RESET
    if (lastProcessedSeason < currentSeason || (lastProcessedSeason > currentSeason && currentSeason === 1)) {
      const teamData = getStableGroupTeams(leagueLevel, groupId, selectedLeagueId, [{
        id: userId, name: clubName || "Local Club", rank: rank || 1, logo: clubLogo || null, isBot: false
      }]);

      let nextLevel = leagueLevel;
      let nextGroup = groupId;
      
      if (lastProcessedSeason > 0 && lastProcessedSeason < currentSeason) {
        // Логика перехода между сезонами
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

    // 3. ГЛОБАЛЬНЫЙ РЕЗОЛВЕР (Фиксация в Firestore)
    const resolveTimer = setInterval(async () => {
      if (!db || !allSeasonMatches || allSeasonMatches.length === 0) return;

      const overdueMatches = allSeasonMatches.filter(m => !m.isFinished && isMatchOverdue(m.startTime));
      if (overdueMatches.length === 0) return;

      for (const m of overdueMatches) {
        const globalMatchId = `v11_s${currentSeason}_l${selectedLeagueId}_t${m.tour}_h${m.homeId}_a${m.awayId}`;
        const matchRef = doc(db, 'matches_v11', globalMatchId);
        
        try {
          const snap = await getDoc(matchRef);
          let finalScoreA, finalScoreB;

          if (!snap.exists()) {
            // Если результата еще нет в базе - фиксируем его
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
              homeId: m.homeId,
              awayId: m.awayId,
              scoreA: sA,
              scoreB: sB,
              winnerId: sA > sB ? m.homeId : (sB > sA ? m.awayId : null),
              resolvedAt: new Date().toISOString()
            });
          } else {
            // Если уже зафиксирован другим игроком - берем из базы
            const data = snap.data();
            finalScoreA = data.scoreA;
            finalScoreB = data.scoreB;
          }

          // Обновляем локальный календарь
          saveToLocal({
            allSeasonMatches: allSeasonMatches.map(sm => 
              sm.id === m.id ? { ...sm, isFinished: true, scoreA: finalScoreA, scoreB: finalScoreB, status: 'finished' } : sm
            )
          });

        } catch (e) {
          console.error("[AUTO-RESOLVE ERROR]", e);
        }
      }
    }, 15000); // Проверка каждые 15 сек

    return () => clearInterval(resolveTimer);
  }, [isLoaded, selectedLeagueId, leagueLevel, groupId, rank, clubLogo, clubName, allSeasonMatches, saveToLocal, setWorldReady, lastProcessedSeason, userId, db]);

  return null;
}
