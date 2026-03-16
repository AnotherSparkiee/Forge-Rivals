'use client';

import { useState, useEffect, useCallback } from 'react';
import { Hero, INITIAL_HEROES } from './moba-data';
import { getMoscowTime } from './time-utils';

interface ArenaState {
  capacity: number;
  pressCenterLevel: number;
  cafeLevel: number;
  shopLevel: number;
  screensLevel: number;
  roofLevel: number;
  lightingLevel: number;
  pendingCapacitySeats: number | null;
  constructionFinishes: Record<string, string | null>; // facilityId or 'capacity' -> ISO string (UTC)
  constructionStarts: Record<string, string | null>; // facilityId or 'capacity' -> ISO string (UTC)
}

interface HQState {
  hrLevel: number;
  financeLevel: number;
  scoutsLevel: number;
  pressOfficeLevel: number;
  adminLevel: number;
  constructionFinishes: Record<string, string | null>;
  constructionStarts: Record<string, string | null>;
}

interface BootcampState {
  bootcampLevel: number;
  tacticsHallLevel: number;
  poolLevel: number;
  researchLevel: number;
  constructionFinishes: Record<string, string | null>;
  constructionStarts: Record<string, string | null>;
}

interface AcademyState {
  youthBootcampLevel: number;
  streamingLevel: number;
  scoutsLevel: number;
  discoLevel: number;
  constructionFinishes: Record<string, string | null>;
  constructionStarts: Record<string, string | null>;
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
  // Infrastructure State
  arena: ArenaState;
  hq: HQState;
  bootcamp: BootcampState;
  academy: AcademyState;
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
  pendingCapacitySeats: null,
  constructionFinishes: {},
  constructionStarts: {},
};

const DEFAULT_HQ: HQState = {
  hrLevel: 0,
  financeLevel: 0,
  scoutsLevel: 0,
  pressOfficeLevel: 0,
  adminLevel: 0,
  constructionFinishes: {},
  constructionStarts: {},
};

const DEFAULT_BOOTCAMP: BootcampState = {
  bootcampLevel: 0,
  tacticsHallLevel: 0,
  poolLevel: 0,
  researchLevel: 0,
  constructionFinishes: {},
  constructionStarts: {},
};

const DEFAULT_ACADEMY: AcademyState = {
  youthBootcampLevel: 0,
  streamingLevel: 0,
  scoutsLevel: 0,
  discoLevel: 0,
  constructionFinishes: {},
  constructionStarts: {},
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
  hq: DEFAULT_HQ,
  bootcamp: DEFAULT_BOOTCAMP,
  academy: DEFAULT_ACADEMY,
};

export function useGameState() {
  const [state, setState] = useState<GameState>(DEFAULT_STATE);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('moba_tactics_state');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        
        const startDateStr = parsed.seasonStartDate || getTodayDateString();
        const start = new Date(startDateStr);
        start.setHours(0, 0, 0, 0);

        let currentDay = 1;
        const mskNow = getMoscowTime();
        if (mskNow.getTime() >= start.getTime()) {
          const diffTime = mskNow.getTime() - start.getTime();
          const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;
          currentDay = ((diffDays - 1) % 14) + 1;
        }

        const isNewSeason = parsed.seasonDay && currentDay > 0 && currentDay < parsed.seasonDay;

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
            arena: { ...DEFAULT_ARENA, ...(parsed.arena || {}) },
            hq: { ...DEFAULT_HQ, ...(parsed.hq || {}) },
            bootcamp: { ...DEFAULT_BOOTCAMP, ...(parsed.bootcamp || {}) },
            academy: { ...DEFAULT_ACADEMY, ...(parsed.academy || {}) },
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

  const addCredits = useCallback((amount: number) => {
    setState(s => ({ ...s, credits: s.credits + amount }));
  }, []);

  const isArenaBusy = useCallback((s: GameState) => {
    return Object.values(s.arena.constructionFinishes).some(v => v !== null && v !== undefined);
  }, []);

  const isHQBusy = useCallback((s: GameState) => {
    return Object.values(s.hq.constructionFinishes).some(v => v !== null && v !== undefined);
  }, []);

  const isBootcampBusy = useCallback((s: GameState) => {
    return Object.values(s.bootcamp.constructionFinishes).some(v => v !== null && v !== undefined);
  }, []);

  const isAcademyBusy = useCallback((s: GameState) => {
    return Object.values(s.academy.constructionFinishes).some(v => v !== null && v !== undefined);
  }, []);

  const startArenaConstruction = useCallback((facility: keyof Omit<ArenaState, 'capacity' | 'constructionFinishes' | 'constructionStarts' | 'pendingCapacitySeats'>, cost: number) => {
    let result = false;
    setState(s => {
      if (s.credits >= cost && !isArenaBusy(s)) {
        const currentLevel = (s.arena as any)[facility];
        const hours = 4 * (currentLevel + 1);
        const startTime = new Date();
        const finishTime = new Date(startTime.getTime() + hours * 3600000);
        result = true;
        return {
          ...s,
          credits: s.credits - cost,
          arena: {
            ...s.arena,
            constructionStarts: { ...s.arena.constructionStarts, [facility]: startTime.toISOString() },
            constructionFinishes: { ...s.arena.constructionFinishes, [facility]: finishTime.toISOString() }
          }
        };
      }
      return s;
    });
    return result;
  }, [isArenaBusy]);

  const startHQConstruction = useCallback((facility: keyof Omit<HQState, 'constructionFinishes' | 'constructionStarts'>, cost: number) => {
    let result = false;
    setState(s => {
      if (s.credits >= cost && !isHQBusy(s)) {
        const currentLevel = (s.hq as any)[facility];
        const hours = 8 * (currentLevel + 1);
        const startTime = new Date();
        const finishTime = new Date(startTime.getTime() + hours * 3600000);
        result = true;
        return {
          ...s,
          credits: s.credits - cost,
          hq: {
            ...s.hq,
            constructionStarts: { ...s.hq.constructionStarts, [facility]: startTime.toISOString() },
            constructionFinishes: { ...s.hq.constructionFinishes, [facility]: finishTime.toISOString() }
          }
        };
      }
      return s;
    });
    return result;
  }, [isHQBusy]);

  const startBootcampConstruction = useCallback((facility: keyof Omit<BootcampState, 'constructionFinishes' | 'constructionStarts'>, cost: number) => {
    let result = false;
    setState(s => {
      if (s.credits >= cost && !isBootcampBusy(s)) {
        const currentLevel = (s.bootcamp as any)[facility];
        const hours = 8 * (currentLevel + 1);
        const startTime = new Date();
        const finishTime = new Date(startTime.getTime() + hours * 3600000);
        result = true;
        return {
          ...s,
          credits: s.credits - cost,
          bootcamp: {
            ...s.bootcamp,
            constructionStarts: { ...s.bootcamp.constructionStarts, [facility]: startTime.toISOString() },
            constructionFinishes: { ...s.bootcamp.constructionFinishes, [facility]: finishTime.toISOString() }
          }
        };
      }
      return s;
    });
    return result;
  }, [isBootcampBusy]);

  const startAcademyConstruction = useCallback((facility: keyof Omit<AcademyState, 'constructionFinishes' | 'constructionStarts'>, cost: number) => {
    let result = false;
    setState(s => {
      if (s.credits >= cost && !isAcademyBusy(s)) {
        const currentLevel = (s.academy as any)[facility];
        const hours = 10 * (currentLevel + 1);
        const startTime = new Date();
        const finishTime = new Date(startTime.getTime() + hours * 3600000);
        result = true;
        return {
          ...s,
          credits: s.credits - cost,
          academy: {
            ...s.academy,
            constructionStarts: { ...s.academy.constructionStarts, [facility]: startTime.toISOString() },
            constructionFinishes: { ...s.academy.constructionFinishes, [facility]: finishTime.toISOString() }
          }
        };
      }
      return s;
    });
    return result;
  }, [isAcademyBusy]);

  const startCapacityExpansion = useCallback((seats: number, cost: number, hours: number) => {
    let result = false;
    setState(s => {
      if (s.credits >= cost && !isArenaBusy(s)) {
        const startTime = new Date();
        const finishTime = new Date(startTime.getTime() + hours * 3600000);
        result = true;
        return {
          ...s,
          credits: s.credits - cost,
          arena: {
            ...s.arena,
            pendingCapacitySeats: seats,
            constructionStarts: { ...s.arena.constructionStarts, capacity: startTime.toISOString() },
            constructionFinishes: { ...s.arena.constructionFinishes, capacity: finishTime.toISOString() }
          }
        };
      }
      return s;
    });
    return result;
  }, [isArenaBusy]);

  const checkConstructions = useCallback(() => {
    setState(s => {
      const nowTime = Date.now();
      let hasChanges = false;
      
      const newArena = { ...s.arena };
      const arenaFinishes = { ...(newArena.constructionFinishes || {}) };
      const arenaStarts = { ...(newArena.constructionStarts || {}) };

      Object.entries(arenaFinishes).forEach(([id, finishTime]) => {
        if (finishTime && nowTime >= new Date(finishTime as string).getTime()) {
          if (id === 'capacity') {
            newArena.capacity += (newArena.pendingCapacitySeats || 0);
            newArena.pendingCapacitySeats = null;
          } else {
            (newArena as any)[id] = ((newArena as any)[id] || 0) + 1;
          }
          arenaFinishes[id] = null;
          arenaStarts[id] = null;
          hasChanges = true;
        }
      });

      const newHq = { ...s.hq };
      const hqFinishes = { ...(newHq.constructionFinishes || {}) };
      const hqStarts = { ...(newHq.constructionStarts || {}) };

      Object.entries(hqFinishes).forEach(([id, finishTime]) => {
        if (finishTime && nowTime >= new Date(finishTime as string).getTime()) {
          (newHq as any)[id] = ((newHq as any)[id] || 0) + 1;
          hqFinishes[id] = null;
          hqStarts[id] = null;
          hasChanges = true;
        }
      });

      const newBootcamp = { ...s.bootcamp };
      const bcFinishes = { ...(newBootcamp.constructionFinishes || {}) };
      const bcStarts = { ...(newBootcamp.constructionStarts || {}) };

      Object.entries(bcFinishes).forEach(([id, finishTime]) => {
        if (finishTime && nowTime >= new Date(finishTime as string).getTime()) {
          (newBootcamp as any)[id] = ((newBootcamp as any)[id] || 0) + 1;
          bcFinishes[id] = null;
          bcStarts[id] = null;
          hasChanges = true;
        }
      });

      const newAcademy = { ...s.academy };
      const acFinishes = { ...(newAcademy.constructionFinishes || {}) };
      const acStarts = { ...(newAcademy.constructionStarts || {}) };

      Object.entries(acFinishes).forEach(([id, finishTime]) => {
        if (finishTime && nowTime >= new Date(finishTime as string).getTime()) {
          (newAcademy as any)[id] = ((newAcademy as any)[id] || 0) + 1;
          acFinishes[id] = null;
          acStarts[id] = null;
          hasChanges = true;
        }
      });

      if (hasChanges) {
        newArena.constructionFinishes = arenaFinishes;
        newArena.constructionStarts = arenaStarts;
        newHq.constructionFinishes = hqFinishes;
        newHq.constructionStarts = hqStarts;
        newBootcamp.constructionFinishes = bcFinishes;
        newBootcamp.constructionStarts = bcStarts;
        newAcademy.constructionFinishes = acFinishes;
        newAcademy.constructionStarts = acStarts;
        return { ...s, arena: newArena, hq: newHq, bootcamp: newBootcamp, academy: newAcademy };
      }
      return s;
    });
  }, []);

  const setLanguage = useCallback((lang: 'en' | 'ru') => {
    setState(s => ({ ...s, language: lang }));
  }, []);

  const setTeam = useCallback((newTeam: any[]) => {
    setState(s => ({ ...s, team: newTeam }));
  }, []);

  const recordMatch = useCallback((winner: string, result: any, isAutomated = false) => {
    setState(s => {
      const scoreA = result.scoreA || 0;
      const scoreB = result.scoreB || 0;
      
      let creditsEarned = 50;
      let rankChange = -15;
      let matchWins = 0;
      let matchDraws = 0;
      let matchLosses = 0;
      let matchPoints = 0;

      // Based on Bo2 format: 2:0, 1:1, or 0:2
      if (scoreA === 2 && scoreB === 0) {
        creditsEarned = 200;
        rankChange = 25;
        matchWins = 1;
        matchPoints = 3;
      } else if (scoreA === 1 && scoreB === 1) {
        creditsEarned = 100;
        rankChange = 5;
        matchDraws = 1;
        matchPoints = 1;
      } else {
        matchLosses = 1;
      }

      const today = getTodayDateString();
      
      return {
        ...s,
        credits: s.credits + creditsEarned,
        rank: s.rank + rankChange,
        wins: s.wins + matchWins,
        draws: s.draws + matchDraws,
        losses: s.losses + matchLosses,
        points: s.points + matchPoints,
        matchHistory: [result, ...s.matchHistory].slice(0, 10),
        lastLeagueMatchDate: isAutomated ? today : s.lastLeagueMatchDate
      };
    });
  }, []);

  return {
    ...state,
    isLoaded,
    addCredits,
    setTeam,
    startArenaConstruction,
    startHQConstruction,
    startBootcampConstruction,
    startAcademyConstruction,
    startCapacityExpansion,
    checkConstructions,
    setLanguage,
    recordMatch
  };
}
