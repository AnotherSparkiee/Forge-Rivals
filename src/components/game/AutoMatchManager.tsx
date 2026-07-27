'use client';

import { useEffect, useRef } from 'react';
import { useGameState } from '@/app/lib/store';
import { getGlobalSeasonInfo, getMoscowTime, isMatchOverdue } from '@/app/lib/time-utils';
import { 
  getStableGroupTeams, 
  generateSeasonCalendar, 
  getMatchResult,
  getPromotionTarget,
  getRelegationTarget
} from '@/app/lib/leagues-data';
import { useToast } from '@/hooks/use-toast';

/**
 * ЛОКАЛЬНЫЙ МЕНЕДЖЕР МАТЧЕЙ v5.3 (Hard Reset Support)
 * Генерирует календарь и автоматически завершает прошедшие матчи.
 * Добавлена логика сброса при изменении эпохи.
 */
export function AutoMatchManager() {
  const { 
    isLoaded, isDataReady, selectedLeagueId, 
    leagueLevel, groupId, setWorldReady, rank, clubLogo, clubName,
    allSeasonMatches, saveToLocal, lastProcessedSeason, language
  } = useGameState();
  
  const { toast } = useToast();
  const initRef = useRef(false);

  useEffect(() => {
    if (!isLoaded || !selectedLeagueId) return;

    const info = getGlobalSeasonInfo();
    const currentSeason = info.activeSeasonNumber;

    // 1. ПЕРЕХОД СЕЗОНА ИЛИ ПРИНУДИТЕЛЬНЫЙ СБРОС (Если сохраненный сезон больше расчетного - значит эпоха сменилась)
    if (lastProcessedSeason < currentSeason || (lastProcessedSeason > currentSeason && currentSeason === 1)) {
      console.log(`[LEAGUE] Resetting world for Season ${currentSeason}...`);
      
      const teamData = getStableGroupTeams(leagueLevel, groupId, selectedLeagueId, [{
        id: 'local-manager', name: clubName || "Local Club", rank: rank || 1, logo: clubLogo || null, isBot: false
      }]);

      let nextLevel = leagueLevel;
      let nextGroup = groupId;
      
      // Повышение/понижение считаем только если это реальный переход (не сброс в 1 сезон)
      if (lastProcessedSeason > 0 && lastProcessedSeason < currentSeason) {
        const finalStandings = teamData.map(t => {
          let pts = 0;
          for (let tour = 1; tour <= 14; tour++) {
            const [scoreA, scoreB] = getMatchResult(t.id, "opp", lastProcessedSeason, tour);
            pts += (scoreA > scoreB ? 3 : (scoreA === scoreB ? 1 : 0));
          }
          return { id: t.id, pts };
        }).sort((a, b) => b.pts - a.pts);

        const playerPos = finalStandings.findIndex(s => s.id === 'local-manager') + 1;
        if (playerPos === 1) {
          const target = getPromotionTarget(leagueLevel, groupId);
          nextLevel = target.level; nextGroup = target.group;
        } else if (playerPos >= 7) {
          const target = getRelegationTarget(leagueLevel, groupId, playerPos);
          nextLevel = target.level; nextGroup = target.group;
        }
      } else {
        // Если это хард-ресет в 1 сезон
        nextLevel = leagueLevel;
        nextGroup = groupId;
      }

      const newTeamData = getStableGroupTeams(nextLevel, nextGroup, selectedLeagueId, [{
        id: 'local-manager', name: clubName || "Local Club", rank: 1, logo: clubLogo || null, isBot: false
      }]);

      const newCalendar = generateSeasonCalendar(newTeamData, currentSeason, selectedLeagueId);

      saveToLocal({
        leagueLevel: nextLevel,
        groupId: nextGroup,
        lastProcessedSeason: currentSeason,
        allSeasonMatches: newCalendar,
        lastSeenMatchDay: 0
      });
      
      if (currentSeason === 1) {
        toast({ title: language === 'ru' ? "МИР ОБНУЛЕН. СТАРТ СЕЗОНА ЗАВТРА." : "WORLD RESET. SEASON STARTS TOMORROW." });
      }
      
      return;
    }

    // 2. ИНИЦИАЛИЗАЦИЯ (Первый запуск)
    if (!initRef.current) {
      initRef.current = true;
      if (!allSeasonMatches || allSeasonMatches.length === 0) {
        const teamData = getStableGroupTeams(leagueLevel, groupId, selectedLeagueId, [{
          id: 'local-manager', name: clubName || "Local Club", rank: rank || 1, logo: clubLogo || null, isBot: false
        }]);
        const calendar = generateSeasonCalendar(teamData, currentSeason, selectedLeagueId);
        saveToLocal({ allSeasonMatches: calendar });
      }
      setWorldReady(true);
    }

    // 3. АВТО-РЕЗОЛВЕР (Каждые 60 сек)
    const resolveTimer = setInterval(() => {
      if (!allSeasonMatches || allSeasonMatches.length === 0) return;

      let changed = false;
      const updatedMatches = allSeasonMatches.map(m => {
        if (!m.isFinished && isMatchOverdue(m.startTime)) {
          const [sA, sB] = getMatchResult(m.homeId, m.awayId, currentSeason, m.tour);
          changed = true;
          
          const simulation = {
            winner: sA > sB ? m.homeName : (sB > sA ? m.awayName : "Draw"),
            seriesScore: `${sA}-${sB}`,
            games: [{
              scoreA: sA, scoreB: sB,
              duration: "35:00",
              mvp: sA >= sB ? m.homeName : m.awayName,
              matchSummary: "Battle concluded at scheduled time.",
              towersA: sA > sB ? 11 : (sA === sB ? 7 : 4),
              towersB: sB > sA ? 11 : (sA === sB ? 7 : 4),
              objectivesA: sA >= sB ? 4 : 1,
              objectivesB: sB >= sA ? 4 : 1,
              teamAOvr: 30, teamBOvr: 30,
              timeline: [{ time: "35:00", type: "objective", event: "Final ancient destroyed!", score: `${sA}:${sB}` }],
              scoreboard: [],
              teamComparison: { farm: [50, 50], tactics: [50, 50], teamwork: [50, 50], reflexes: [50, 50] }
            }]
          };

          return { ...m, isFinished: true, scoreA: sA, scoreB: sB, simulation, status: 'finished' };
        }
        return m;
      });

      if (changed) {
        saveToLocal({ allSeasonMatches: updatedMatches });
      }
    }, 60000);

    return () => clearInterval(resolveTimer);
  }, [isLoaded, selectedLeagueId, leagueLevel, groupId, rank, clubLogo, clubName, allSeasonMatches, saveToLocal, setWorldReady, lastProcessedSeason, language, toast]);

  return null;
}
