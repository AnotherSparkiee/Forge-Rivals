
'use client';

import { useState, useEffect } from 'react';
import { Hero, INITIAL_HEROES } from './moba-data';
import { getMoscowTime, getMoscowDateString } from './time-utils';

interface ArenaState {
  capacity: number;
  pressCenterLevel: number;
  cafeLevel: number;
  shopLevel: number;
  screensLevel: number;
  roofLevel: number;
  lightingLevel: number;
  constructionFinishes: Record<string, string | null>; // facilityId -> ISO string timestamp
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
  const msk = getMoscowTime();
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
  constructionFinishes: {},
};

const TEST_CREDITS = 99000000;

const DEFAULT_STATE: GameState = {
  credits: TEST_CREDITS,
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
        
        const mskNow = getMoscowTime();
        const mskNowTime = mskNow.getTime();

        const startDateStr = parsed.seasonStartDate || getTodayDateString();
        const start = new Date(startDateStr);
        start.setHours(0, 0, 0, 0);

        let currentDay = 1;
        if (mskNow.getTime() >= start.getTime()) {
          const diffTime = mskNow.getTime() - start.getTime();
          const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;
          currentDay = ((diffDays - 1) % 14) + 1;
        }

        const isNewSeason = parsed.seasonDay && currentDay > 0 && currentDay < parsed.seasonDay;

        // Check for finished constructions
        const updatedArena = parsed.arena || DEFAULT_ARENA;
        const constructionFinishes = updatedArena.constructionFinishes || {};
        const newArenaLevels = { ...updatedArena };
        const newConstructionFinishes = { ...constructionFinishes };
        let hasChanges = false;

        Object.entries(constructionFinishes).forEach(([facility, finishTime]) => {
          if (finishTime && mskNowTime >= new Date(finishTime as string).getTime()) {
            (newArenaLevels as any)[facility] = ((newArenaLevels as any)[facility] || 0) + 1;
            newConstructionFinishes[facility] = null;
            hasChanges = true;
          }
        });

        if (hasChanges) {
          newArenaLevels.constructionFinishes = newConstructionFinishes;
        }

        setState(prev => {
          const newState = { 
            ...prev, 
            ...parsed,
            seasonStartDate: startDateStr,
            seasonDay: currentDay,
            language: parsed.language || prev.language,
            wins: isNewSeason ? 0 : (parsed.wins || 0),
            draws: isNewSeason ? 0 : (parsed.draws || 0),
            losses: isNewSeason ? 0 : (parsed.losses || 0),
            points: isNewSeason ? 0 : (parsed.points || 0),
            arena: hasChanges ? newArenaLevels : updatedArena,
          };
          
          if (newState.credits < TEST_CREDITS) {
            newState.credits = TEST_CREDITS;
          }
          
          return newState;
        });
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

  const startArenaConstruction = (facility: keyof Omit<ArenaState, 'capacity' | 'constructionFinishes'>, cost: number) => {
    if (state.credits >= cost && !state.arena.constructionFinishes[facility]) {
      const currentLevel = (state.arena as any)[facility];
      const hours = 4 * (currentLevel + 1);
      
      const finishTime = getMoscowTime();
      finishTime.setHours(finishTime.getHours() + hours);

      setState(s => ({
        ...s,
        credits: s.credits - cost,
        arena: {
          ...s.arena,
          constructionFinishes: {
            ...s.arena.constructionFinishes,
            [facility]: finishTime.toISOString()
          }
        }
      }));
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

  // Helper to force check constructions (can be called manually or by a timer)
  const checkConstructions = () => {
    const mskNow = getMoscowTime().getTime();
    let hasChanges = false;
    const newArena = { ...state.arena };
    const newFinishes = { ...newArena.constructionFinishes };

    Object.entries(newFinishes).forEach(([facility, finishTime]) => {
      if (finishTime && mskNow >= new Date(finishTime as string).getTime()) {
        (newArena as any)[facility] = ((newArena as any)[facility] || 0) + 1;
        newFinishes[facility] = null;
        hasChanges = true;
      }
    });

    if (hasChanges) {
      newArena.constructionFinishes = newFinishes;
      setState(s => ({ ...s, arena: newArena }));
    }
  };

  const setLanguage = (lang: 'en' | 'ru') => {
    setState(s => ({ ...s, language: lang }));
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

    const today = getTodayDateString();
    
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
    startArenaConstruction,
    upgradeArenaCapacity,
    checkConstructions,
    setLanguage,
    recordMatch
  };
}
