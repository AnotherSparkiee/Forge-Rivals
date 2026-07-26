'use client';

import { useEffect, useRef } from 'react';
import { useGameState } from '@/app/lib/store';
import { getGlobalSeasonInfo } from '@/app/lib/time-utils';
import { getStableGroupTeams, generateSeasonCalendar } from '@/app/lib/leagues-data';

/**
 * ЛОКАЛЬНЫЙ МЕНЕДЖЕР МАТЧЕЙ v2.0
 * Теперь работает полностью автономно, эмулируя среду лиги локально.
 */
export function AutoMatchManager() {
  const { 
    isLoaded, isDataReady, selectedLeagueId, 
    leagueLevel, groupId, setWorldReady, rank, clubLogo, clubName,
    allSeasonMatches, saveToLocal
  } = useGameState();
  
  const initRef = useRef(false);

  useEffect(() => {
    if (!isLoaded || !selectedLeagueId || initRef.current) return;
    initRef.current = true;

    const syncLocalWorld = () => {
      const info = getGlobalSeasonInfo();
      const currentSeason = info.activeSeasonNumber;
      
      // Генерируем локальную таблицу
      const teamData = getStableGroupTeams(leagueLevel, groupId, selectedLeagueId, [{
        id: 'local-manager', name: clubName || "Local Club", rank: rank || 1, logo: clubLogo || null, isBot: false
      }]);

      // Генерируем локальный календарь, если его нет
      if (!allSeasonMatches || allSeasonMatches.length === 0) {
        const calendar = generateSeasonCalendar(teamData, currentSeason, selectedLeagueId);
        saveToLocal({ 
          allSeasonMatches: calendar.map(m => ({ ...m, status: 'scheduled', isFinished: false }))
        });
      }

      setWorldReady(true);
    };

    syncLocalWorld();
  }, [isLoaded, selectedLeagueId, leagueLevel, groupId, rank, clubLogo, clubName, allSeasonMatches, saveToLocal, setWorldReady]);

  return null;
}
