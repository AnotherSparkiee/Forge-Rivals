'use client';

import { useEffect, useRef } from 'react';
import { useGameState } from '@/app/lib/store';
import { getGlobalSeasonInfo, getMoscowTime } from '@/app/lib/time-utils';
import { 
  getStableGroupTeams, 
  generateSeasonCalendar, 
  getMatchResult,
  getPromotionTarget,
  getRelegationTarget
} from '@/app/lib/leagues-data';
import { useToast } from '@/hooks/use-toast';

/**
 * ЛОКАЛЬНЫЙ МЕНЕДЖЕР МАТЧЕЙ v4.0 (Generation Window Aware)
 * Генерирует календарь строго в 16:00 MSK на 15-й день сезона.
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

    // 1. ЛОГИКА МЕЖСЕЗОНЬЯ (Переход между уровнями и генерация)
    if (info.isOffseason && lastProcessedSeason < currentSeason) {
      
      // Если еще нет 16:00, просто убеждаемся, что старые матчи не мешают
      if (!info.isGenerationReady) {
        if (allSeasonMatches && allSeasonMatches.length > 0) {
          console.log("[LEAGUE] Entering Offseason. Clearing old calendar...");
          saveToLocal({ allSeasonMatches: [] });
        }
        return;
      }

      // Наступило 16:00 MSK - Время генерации!
      console.log("[LEAGUE ENGINE] Generation window open. Initializing new season...");
      
      // Сначала рассчитываем итоги прошлого сезона для повышения/понижения
      const teamData = getStableGroupTeams(leagueLevel, groupId, selectedLeagueId, [{
        id: 'local-manager', name: clubName || "Local Club", rank: rank || 1, logo: clubLogo || null, isBot: false
      }]);

      const finalStandings = teamData.map(t => {
        let pts = 0;
        for (let tour = 1; tour <= 14; tour++) {
          const [scoreA, scoreB] = getMatchResult(t.id, "opp", lastProcessedSeason, tour);
          pts += (scoreA > scoreB ? 3 : (scoreA === scoreB ? 1 : 0));
        }
        return { id: t.id, pts };
      }).sort((a, b) => b.pts - a.pts);

      const playerPos = finalStandings.findIndex(s => s.id === 'local-manager') + 1;
      
      let nextLevel = leagueLevel;
      let nextGroup = groupId;
      let message = "";

      if (playerPos === 1) {
        const target = getPromotionTarget(leagueLevel, groupId);
        nextLevel = target.level;
        nextGroup = target.group;
        message = language === 'ru' ? "ПОЗДРАВЛЯЕМ! ВЫ ВЫШЛИ В ДИВИЗИОН ВЫШЕ!" : "CONGRATULATIONS! PROMOTED TO HIGHER DIVISION!";
      } else if (playerPos >= 7) {
        const target = getRelegationTarget(leagueLevel, groupId, playerPos);
        nextLevel = target.level;
        nextGroup = target.group;
        message = language === 'ru' ? "ВНИМАНИЕ: Клуб понижен в классе." : "ATTENTION: Club relegated to lower division.";
      } else {
        message = language === 'ru' ? "Сезон завершен. Вы сохранили место в лиге." : "Season ended. You maintained your league position.";
      }

      toast({ title: message, duration: 8000 });

      // Генерируем новый состав группы и новый календарь
      const newTeamData = getStableGroupTeams(nextLevel, nextGroup, selectedLeagueId, [{
        id: 'local-manager', name: clubName || "Local Club", rank: 1, logo: clubLogo || null, isBot: false
      }]);

      const newCalendar = generateSeasonCalendar(newTeamData, currentSeason, selectedLeagueId);

      saveToLocal({
        leagueLevel: nextLevel,
        groupId: nextGroup,
        lastProcessedSeason: currentSeason,
        allSeasonMatches: newCalendar.map(m => ({ ...m, status: 'scheduled', isFinished: false }))
      });
      return;
    }

    // 2. ИНИЦИАЛИЗАЦИЯ МИРА (для первого запуска)
    if (!initRef.current) {
      initRef.current = true;
      
      if (!allSeasonMatches || allSeasonMatches.length === 0) {
        // Если мы не в межсезонье, значит сезон идет, генерируем базу
        if (!info.isOffseason) {
          const teamData = getStableGroupTeams(leagueLevel, groupId, selectedLeagueId, [{
            id: 'local-manager', name: clubName || "Local Club", rank: rank || 1, logo: clubLogo || null, isBot: false
          }]);
          const calendar = generateSeasonCalendar(teamData, currentSeason, selectedLeagueId);
          saveToLocal({ 
            allSeasonMatches: calendar.map(m => ({ ...m, status: 'scheduled', isFinished: false }))
          });
        }
      }

      setWorldReady(true);
    }
  }, [isLoaded, selectedLeagueId, leagueLevel, groupId, rank, clubLogo, clubName, allSeasonMatches, saveToLocal, setWorldReady, lastProcessedSeason, language, toast]);

  return null;
}
