
'use client';

import { useState, useEffect } from 'react';
import { Hero, INITIAL_HEROES } from './moba-data';

interface ArenaState {
  capacity: number;
  pressCenterLevel: number;
  cafeLevel: number;
  shopLevel: number;
  screensLevel: number;
  roofLevel: number;
  lightingLevel: number;
}

interface GameState {
  credits: number;
  ownedHeroes: Hero[];
  team: Hero[];
  strategy: string;
  rank: number;
  matchHistory: any[];
  language: 'en' | 'ru';
  // Season Statistics
  wins: number;
  draws: number;
  losses: number;
  points: number;
  // League Pyramid State
  leagueLevel: number; // 1-9 (1 is top)
  divisionSubId: number; // 1 to 2^(level-1)
  groupId: number; // 1-8
  lastLeagueMatchDate: string | null; // Format: YYYY-MM-DD
  seasonDay: number; // 0 = Pre-season, 1-14 = Active season
  seasonStartDate: string | null; // Format: YYYY-MM-DD (This is Day 1)
  // Arena State
  arena: ArenaState;
}

const getTodayDateString = () => {
  const msk = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Moscow' }));
  const year = msk.getFullYear();
  const month = String(msk.getMonth() + 1).padStart(2, '0');
  const day = String(msk.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const DEFAULT_ARENA: ArenaState = {
  capacity: 5000,
  pressCenterLevel: 0,
  cafeLevel: 0,
  shopLevel: 0,
  screensLevel: 0,
  roofLevel: 0,
  lightingLevel: 0,
};

const DEFAULT_STATE: GameState = {
  credits: 50000, // Increased for better prototyping of arena upgrades
  ownedHeroes: INITIAL_HEROES,
  team: INITIAL_HEROES,
  strategy: 'Balanced Play',
  rank: 1000,
  matchHistory: [],
  language: 'ru',
  wins: 0,
  draws: 0,
  losses: 0,
  points: 0,
  leagueLevel: 8,
  divisionSubId: 1,
  groupId: 1,
  lastLeagueMatchDate: null,
  seasonDay: 1,
  seasonStartDate: getTodayDateString(),
  arena: DEFAULT_ARENA,
};

export function useGameState() {
  const [state, setState] = useState<GameState>(DEFAULT_STATE);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('moba_tactics_state');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        // Use Moscow Time for current date calculation
        const mskNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Moscow' }));
        mskNow.setHours(0, 0, 0, 0);

        const startDateStr = parsed.seasonStartDate || getTodayDateString();
        const start = new Date(startDateStr);
        start.setHours(0, 0, 0, 0);

        let currentDay = 1;
        if (mskNow >= start) {
          const diffTime = mskNow.getTime() - start.getTime();
          const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;
          currentDay = ((diffDays - 1) % 14) + 1;
        } else {
          currentDay = 1; 
        }

        const isNewSeason = parsed.seasonDay && currentDay > 0 && currentDay < parsed.seasonDay;

        setState(prev => ({ 
          ...prev, 
          ...parsed,
          seasonStartDate: startDateStr,
          seasonDay: currentDay,
          language: parsed.language || prev.language,
          wins: isNewSeason ? 0 : (parsed.wins || 0),
          draws: isNewSeason ? 0 : (parsed.draws || 0),
          losses: isNewSeason ? 0 : (parsed.losses || 0),
          points: isNewSeason ? 0 : (parsed.points || 0),
          arena: parsed.arena || DEFAULT_ARENA,
        }));
      } catch (e) {
        console.error("Failed to load game state", e);
      }
    }
    setIsLoaded(true);
  }, []);

  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem('moba_tactics_state', JSON.stringify(state));
    }
  }, [state, isLoaded]);

  const addCredits = (amount: number) => {
    setState(s => ({ ...s, credits: s.credits + amount }));
  };

  const buyHero = (hero: Hero) => {
    if (state.credits >= hero.price && !state.ownedHeroes.find(h => h.id === hero.id)) {
      setState(s => ({
        ...s,
        credits: s.credits - hero.price,
        ownedHeroes: [...s.ownedHeroes, hero]
      }));
      return true;
    }
    return false;
  };

  const upgradeHero = (heroId: string, stat: keyof Hero['baseStats'], amount: number, cost: number) => {
    if (state.credits >= cost) {
      setState(s => {
        const updatedOwned = s.ownedHeroes.map(h => 
          h.id === heroId 
            ? { ...h, baseStats: { ...h.baseStats, [stat]: h.baseStats[stat] + amount } }
            : h
        );
        const updatedTeam = s.team.map(h => 
          h.id === heroId 
            ? { ...h, baseStats: { ...h.baseStats, [stat]: h.baseStats[stat] + amount } }
            : h
        );

        return {
          ...s,
          credits: s.credits - cost,
          ownedHeroes: updatedOwned,
          team: updatedTeam
        };
      });
      return true;
    }
    return false;
  };

  const upgradeArenaCapacity = (cost: number) => {
    if (state.credits >= cost) {
      setState(s => ({
        ...s,
        credits: s.credits - cost,
        arena: { ...s.arena, capacity: s.arena.capacity + 500 }
      }));
      return true;
    }
    return false;
  };

  const upgradeArenaFacility = (facility: keyof Omit<ArenaState, 'capacity'>, cost: number) => {
    if (state.credits >= cost) {
      setState(s => ({
        ...s,
        credits: s.credits - cost,
        arena: { ...s.arena, [facility]: s.arena[facility] + 1 }
      }));
      return true;
    }
    return false;
  };

  const setTeam = (newTeam: Hero[]) => {
    setState(s => ({ ...s, team: newTeam }));
  };

  const setStrategy = (strategy: string) => {
    setState(s => ({ ...s, strategy }));
  };

  const setLanguage = (lang: 'en' | 'ru') => {
    setState(s => ({ ...s, language: lang }));
  };

  const promoteLeague = () => {
    if (state.leagueLevel > 1) {
      setState(s => ({
        ...s,
        leagueLevel: s.leagueLevel - 1,
        divisionSubId: Math.max(1, Math.ceil(s.divisionSubId / 2)),
        groupId: 1,
        lastLeagueMatchDate: null,
        seasonStartDate: getTodayDateString(),
        wins: 0,
        draws: 0,
        losses: 0,
        points: 0,
        seasonDay: 1
      }));
      return true;
    }
    return false;
  };

  const recordMatch = (winner: string, result: any, isAutomated = false) => {
    const scoreA = result.scoreA || 0;
    const scoreB = result.scoreB || 0;
    
    let creditsEarned = 50;
    let rankChange = -15;
    let matchWins = 0;
    let matchDraws = 0;
    let matchLosses = 0;
    let matchPoints = 0;

    if (scoreA === 2) {
      creditsEarned = 200;
      rankChange = 25;
      matchWins = 1;
      matchPoints = 3;
    } else if (scoreA === 1) {
      creditsEarned = 100;
      rankChange = 5;
      matchDraws = 1;
      matchPoints = 1;
    } else {
      matchLosses = 1;
    }

    const mskNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Moscow' }));
    const year = mskNow.getFullYear();
    const month = String(mskNow.getMonth() + 1).padStart(2, '0');
    const day = String(mskNow.getDate()).padStart(2, '0');
    const today = `${year}-${month}-${day}`;
    
    setState(s => ({
      ...s,
      credits: s.credits + creditsEarned,
      rank: s.rank + rankChange,
      wins: s.wins + matchWins,
      draws: s.draws + matchDraws,
      losses: s.losses + matchLosses,
      points: s.points + matchPoints,
      matchHistory: [result, ...s.matchHistory].slice(0, 10),
      lastLeagueMatchDate: isAutomated ? today : s.lastLeagueMatchDate
    }));
  };

  return {
    ...state,
    isLoaded,
    addCredits,
    buyHero,
    upgradeHero,
    upgradeArenaCapacity,
    upgradeArenaFacility,
    setTeam,
    setStrategy,
    setLanguage,
    recordMatch,
    promoteLeague
  };
}
