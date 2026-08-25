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
 * ГЛОБАЛЬНЫЙ МЕНЕДЖЕР МАТЧЕЙ v7.0 (Season Cycle & DB Persistence)
 * Управляет жизненным циклом лиги: расчет матчей, фиксация в БД и переход между сезонами.
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

    // 1. СИНХРОНИЗАЦИЯ СЕЗОНОВ И ПЕРЕХОД (Promotion/Relegation)
    if (lastProcessedSeason < currentSeason && lastProcessedSeason > 0) {
      console.log(`[SEASON ENGINE] Transitioning from S${lastProcessedSeason} to S${currentSeason}...`);
      
      // Рассчитываем итоги старого сезона для определения перемещения
      const oldTeams = getStableGroupTeams(leagueLevel, groupId, selectedLeagueId, [{
        id: userId, name: clubName || "Local Club", rank: rank || 1, logo: clubLogo || null, isBot: false
      }]);

      const finalStandings = oldTeams.map(t => {
        let pts = 0;
        let wins = 0;
        for (let tour = 1; tour <= 14; tour++) {
          const [sA, sB] = getMatchResult(t.rank, 99, leagueLevel, groupId, lastProcessedSeason, tour);
          pts += (sA > sB ? 3 : (sA === sB ? 1 : 0));
          if (sA > sB) wins++;
        }
        return { id: t.id, pts, wins };
      }).sort((a, b) => b.pts - a.pts || b.wins - a.wins);

      const playerPos = finalStandings.findIndex(s => s.id === userId) + 1;
      let nextLevel = leagueLevel;
      let nextGroup = groupId;

      if (playerPos === 1 && leagueLevel > 1) {
        const target = getPromotionTarget(leagueLevel, groupId);
        nextLevel = target.level; nextGroup = target.group;
        console.log(`[SEASON ENGINE] PROMOTED to Div ${nextLevel}.${nextGroup}`);
      } else if (playerPos >= 7 && leagueLevel < 9) {
        const target = getRelegationTarget(leagueLevel, groupId, playerPos);
        nextLevel = target.level; nextGroup = target.group;
        console.log(`[SEASON ENGINE] RELEGATED to Div ${nextLevel}.${nextGroup}`);
      }

      // Генерация нового календаря для нового сезона
      const newTeamData = getStableGroupTeams(nextLevel, nextGroup, selectedLeagueId, [{
        id: userId, name: clubName || "Local Club", rank: 1, logo: clubLogo || null, isBot: false
      }]);

      const newCalendar = generateSeasonCalendar(newTeamData, currentSeason, selectedLeagueId);

      saveToLocal({
        leagueLevel: nextLevel,
        groupId: nextGroup,
        lastProcessedSeason: currentSeason,
        allSeasonMatches: newCalendar,
        lastSeenMatchDay: 0 // Сбрасываем просмотренные матчи для нового сезона
      });
      return;
    }

    // 2. ПЕРВИЧНАЯ ИНИЦИАЛИЗАЦИЯ (Если данных еще нет)
    if (!initRef.current) {
      initRef.current = true;
      if (!allSeasonMatches || allSeasonMatches.length === 0 || lastProcessedSeason === 0) {
        const teamData = getStableGroupTeams(leagueLevel, groupId, selectedLeagueId, [{
          id: userId, name: clubName || "Local Club", rank: rank || 1, logo: clubLogo || null, isBot: false
        }]);
        const calendar = generateSeasonCalendar(teamData, currentSeason, selectedLeagueId);
        saveToLocal({ 
          allSeasonMatches: calendar,
          lastProcessedSeason: currentSeason
        });
      }
      setWorldReady(true);
    }

    // 3. ГЛОБАЛЬНЫЙ РЕЗОЛВЕР (Фиксация всех 14 туров в БД)
    const resolveTimer = setInterval(async () => {
      if (!db || !allSeasonMatches || allSeasonMatches.length === 0) return;

      const overdueMatches = allSeasonMatches.filter(m => !m.isFinished && isMatchOverdue(m.startTime));
      if (overdueMatches.length === 0) return;

      let hasLocalChanges = false;
      const updatedMatches = [...allSeasonMatches];

      for (let i = 0; i < updatedMatches.length; i++) {
        const m = updatedMatches[i];
        if (m.isFinished || !isMatchOverdue(m.startTime)) continue;

        // Формируем уникальный глобальный ID для фиксации в облаке
        const globalMatchId = `v11_s${currentSeason}_l${selectedLeagueId}_lv${leagueLevel}_g${groupId}_t${m.tour}_hR${m.homeRank}_aR${m.awayRank}`;
        const matchRef = doc(db, 'matches_v11', globalMatchId);
        
        try {
          const snap = await getDoc(matchRef);
          let finalScoreA, finalScoreB;

          if (!snap.exists()) {
            // Если в базе нет результата, рассчитываем его (детерминировано по слотам)
            const [sA, sB] = getMatchResult(m.homeRank, m.awayRank, leagueLevel, groupId, currentSeason, m.tour);
            finalScoreA = sA;
            finalScoreB = sB;

            // Сохраняем в Firestore для всех игроков группы
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
            // Если в базе уже есть результат, берем его
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
    }, 15000);

    return () => clearInterval(resolveTimer);
  }, [isLoaded, selectedLeagueId, leagueLevel, groupId, rank, clubLogo, clubName, allSeasonMatches, saveToLocal, setWorldReady, lastProcessedSeason, userId, db]);

  return null;
}
