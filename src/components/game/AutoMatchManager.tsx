'use client';

import { useEffect, useRef } from 'react';
import { useGameState } from '@/app/lib/store';
import { getGlobalSeasonInfo } from '@/app/lib/time-utils';
import { 
  getStableGroupTeams, 
  generateSeasonCalendar, 
  getMatchResult,
  getPromotionTarget,
  getRelegationTarget
} from '@/app/lib/leagues-data';
import { useToast } from '@/hooks/use-toast';

/**
 * ЛОКАЛЬНЫЙ МЕНЕДЖЕР МАТЧЕЙ v3.0
 * Обрабатывает межсезонье, повышения и понижения в классе.
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

    // 1. ЛОГИКА МЕЖСЕЗОНЬЯ (Переход между уровнями)
    if (info.isOffseason && lastProcessedSeason < currentSeason) {
      console.log("[LEAGUE ENGINE] Season ended. Calculating final standings...");
      
      // Генерируем финальную таблицу группы на основе детерминированных результатов
      const teamData = getStableGroupTeams(leagueLevel, groupId, selectedLeagueId, [{
        id: 'local-manager', name: clubName || "Local Club", rank: rank || 1, logo: clubLogo || null, isBot: false
      }]);

      const finalStandings = teamData.map(t => {
        let pts = 0;
        // Симулируем 14 туров для каждого бота
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

      // Обновляем статус игрока для нового сезона
      saveToLocal({
        leagueLevel: nextLevel,
        groupId: nextGroup,
        lastProcessedSeason: currentSeason,
        allSeasonMatches: [] // Сброс календаря для перегенерации
      });
      return;
    }

    // 2. ИНИЦИАЛИЗАЦИЯ МИРА И КАЛЕНДАРЯ
    if (!initRef.current) {
      initRef.current = true;
      
      const teamData = getStableGroupTeams(leagueLevel, groupId, selectedLeagueId, [{
        id: 'local-manager', name: clubName || "Local Club", rank: rank || 1, logo: clubLogo || null, isBot: false
      }]);

      if (!allSeasonMatches || allSeasonMatches.length === 0) {
        const calendar = generateSeasonCalendar(teamData, currentSeason, selectedLeagueId);
        saveToLocal({ 
          allSeasonMatches: calendar.map(m => ({ ...m, status: 'scheduled', isFinished: false }))
        });
      }

      setWorldReady(true);
    }
  }, [isLoaded, selectedLeagueId, leagueLevel, groupId, rank, clubLogo, clubName, allSeasonMatches, saveToLocal, setWorldReady, lastProcessedSeason, language, toast]);

  return null;
}
