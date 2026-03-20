
'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { Hero, INITIAL_HEROES } from './moba-data';
import { getMoscowTime, getMoscowDateString } from './time-utils';
import { useUser, useFirestore } from '@/firebase';
import { doc, setDoc, onSnapshot } from 'firebase/firestore';

export type LineupSlot = 'carry' | 'mid' | 'offlane' | 'support' | 'full_support' | 'sub1' | 'sub2';

interface ArenaState {
  capacity: number;
  pressCenterLevel: number;
  cafeLevel: number;
  shopLevel: number;
  screensLevel: number;
  roofLevel: number;
  lightingLevel: number;
  pendingCapacitySeats: number | null;
  constructionFinishes: Record<string, string | null>;
  constructionStarts: Record<string, string | null>;
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

interface MedicalState {
  physiotherapyLevel: number;
  massageLevel: number;
  psychiatristLevel: number;
  labLevel: number;
  psychologistLevel: number;
  constructionFinishes: Record<string, string | null>;
  constructionStarts: Record<string, string | null>;
}

export interface MatchResultEntry {
  id: string; // Unique ID for viewing the match report
  day: number; // 0 for friendlies
  type: 'league' | 'friendly';
  opponentName: string;
  winner: string;
  scoreA: number;
  scoreB: number;
  matchSummary: string;
  teamStats: any;
  heroPerformance: any[];
  playedAt: string;
}

interface GameState {
  credits: number;
  crystals: number;
  ownedHeroes: Hero[];
  team: Hero[];
  lineup: Record<LineupSlot, string | null>;
  strategy: string;
  rank: number;
  matchHistory: MatchResultEntry[];
  language: 'en' | 'ru';
  wins: number;
  draws: number;
  losses: number;
  points: number;
  leagueLevel: number;
  divisionSubId: number;
  groupId: number;
  selectedLeagueId: string | null;
  country: string | null;
  lastLeagueMatchDate: string | null;
  lastSeenMatchDay: number;
  seasonDay: number;
  seasonStartDate: string | null;
  lastRewardClaimDate: string | null;
  arena: ArenaState;
  hq: HQState;
  bootcamp: BootcampState;
  academy: AcademyState;
  medical: MedicalState;
}

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

const DEFAULT_MEDICAL: MedicalState = {
  physiotherapyLevel: 0,
  massageLevel: 0,
  psychiatristLevel: 0,
  labLevel: 0,
  psychologistLevel: 0,
  constructionFinishes: {},
  constructionStarts: {},
};

const START_CREDITS = 10000000;

const DEFAULT_STATE: GameState = {
  credits: START_CREDITS,
  crystals: 0,
  ownedHeroes: INITIAL_HEROES,
  team: INITIAL_HEROES.slice(0, 5),
  lineup: {
    carry: INITIAL_HEROES[0]?.id || null,
    mid: INITIAL_HEROES[1]?.id || null,
    offlane: INITIAL_HEROES[2]?.id || null,
    support: INITIAL_HEROES[3]?.id || null,
    full_support: INITIAL_HEROES[4]?.id || null,
    sub1: INITIAL_HEROES[5]?.id || null,
    sub2: INITIAL_HEROES[6]?.id || null,
  },
  strategy: 'Balanced Play',
  rank: 1000,
  matchHistory: [],
  language: 'ru',
  wins: 0,
  draws: 0,
  losses: 0,
  points: 0,
  leagueLevel: 0,
  divisionSubId: 0,
  groupId: 0,
  selectedLeagueId: null,
  country: null,
  lastLeagueMatchDate: null,
  lastSeenMatchDay: 0,
  seasonDay: 0,
  seasonStartDate: null,
  lastRewardClaimDate: null,
  arena: DEFAULT_ARENA,
  hq: DEFAULT_HQ,
  bootcamp: DEFAULT_BOOTCAMP,
  academy: DEFAULT_ACADEMY,
  medical: DEFAULT_MEDICAL,
};

interface GameStateContextType extends GameState {
  isLoaded: boolean;
  addCredits: (amount: number) => void;
  addCrystals: (amount: number) => void;
  assignToRole: (slot: LineupSlot, heroId: string | null) => void;
  startArenaConstruction: (facility: any, cost: number) => boolean;
  startHQConstruction: (facility: any, cost: number) => boolean;
  startBootcampConstruction: (facility: any, cost: number) => boolean;
  startAcademyConstruction: (facility: any, cost: number) => boolean;
  startMedicalConstruction: (facility: any, cost: number) => boolean;
  startCapacityExpansion: (seats: number, cost: number, hours: number) => boolean;
  checkConstructions: () => void;
  setLanguage: (lang: 'en' | 'ru') => void;
  recordMatch: (winner: string, result: any, matchDay: number, opponentName: string, type: 'league' | 'friendly', customPlayedAt?: string) => void;
  markMatchAsSeen: (day: number) => void;
  claimReward: (creditsReward: number, crystalsReward: number) => void;
}

const GameStateContext = createContext<GameStateContextType | undefined>(undefined);

export function GameStateProvider({ children }: { children: ReactNode }) {
  const { user, isUserLoading } = useUser();
  const db = useFirestore();
  const [state, setState] = useState<GameState>(DEFAULT_STATE);
  const [isLoaded, setIsLoaded] = useState(false);

  const getStorageKey = useCallback(() => {
    return user ? `moba_tactics_v4_${user.uid}` : null;
  }, [user]);

  useEffect(() => {
    if (isUserLoading) {
      setIsLoaded(false);
      return;
    }

    if (!user) {
      setState(DEFAULT_STATE);
      setIsLoaded(true);
      return;
    }

    setIsLoaded(false);

    const key = getStorageKey();
    const saved = localStorage.getItem(key!);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setState(s => ({ ...s, ...parsed }));
      } catch (e) {
        console.warn("Failed to parse local storage state", e);
      }
    }

    const profileRef = doc(db, 'players_v2', user.uid);
    const unsubscribe = onSnapshot(profileRef, (docSnap) => {
      if (docSnap.exists()) {
        const profileData = docSnap.data();
        
        setState(s => {
          const startDateStr = profileData.seasonStartDate || s.seasonStartDate;
          
          let currentDay = 0;
          if (startDateStr) {
            const mskNow = getMoscowTime();
            const [year, month, day] = startDateStr.split('-').map(Number);
            
            const todayUtc = Date.UTC(mskNow.getFullYear(), mskNow.getMonth(), mskNow.getDate());
            const startUtc = Date.UTC(year, month - 1, day);
            
            const diffDays = Math.floor((todayUtc - startUtc) / (1000 * 60 * 60 * 24));
            
            if (diffDays >= 0) {
              currentDay = (diffDays % 14) + 1;
            } else {
              currentDay = 1;
            }
          }

          return {
            ...s,
            credits: profileData.inGameCurrency ?? s.credits,
            crystals: profileData.crystals ?? s.crystals,
            wins: profileData.wins ?? s.wins,
            draws: profileData.draws ?? s.draws,
            losses: profileData.losses ?? s.losses,
            points: profileData.points ?? s.points,
            leagueLevel: profileData.leagueLevel ?? s.leagueLevel,
            groupId: profileData.groupId ?? s.groupId,
            divisionSubId: profileData.divisionSubId ?? s.divisionSubId,
            selectedLeagueId: profileData.selectedLeagueId ?? s.selectedLeagueId,
            country: profileData.country ?? s.country,
            lastSeenMatchDay: profileData.lastSeenMatchDay ?? s.lastSeenMatchDay ?? 0,
            lastLeagueMatchDate: profileData.lastLeagueMatchDate ?? s.lastLeagueMatchDate,
            matchHistory: profileData.matchHistory ?? s.matchHistory ?? [],
            seasonStartDate: startDateStr,
            seasonDay: currentDay,
            lastRewardClaimDate: profileData.lastRewardClaimDate ?? s.lastRewardClaimDate,
          };
        });
      }
      setIsLoaded(true);
    }, (error) => {
      console.warn("Firestore sync error:", error.message);
      setIsLoaded(true); 
    });

    return () => unsubscribe();
  }, [user, isUserLoading, db, getStorageKey]);

  useEffect(() => {
    const key = getStorageKey();
    if (isLoaded && key && user) {
      localStorage.setItem(key, JSON.stringify(state));
    }
  }, [state, isLoaded, getStorageKey, user]);

  const addCredits = useCallback((amount: number) => {
    setState(s => {
      const newCredits = s.credits + amount;
      if (user) {
        const profileRef = doc(db, 'players_v2', user.uid);
        setDoc(profileRef, { inGameCurrency: newCredits }, { merge: true });
      }
      return { ...s, credits: newCredits };
    });
  }, [user, db]);

  const addCrystals = useCallback((amount: number) => {
    setState(s => {
      const newCrystals = s.crystals + amount;
      if (user) {
        const profileRef = doc(db, 'players_v2', user.uid);
        setDoc(profileRef, { crystals: newCrystals }, { merge: true });
      }
      return { ...s, crystals: newCrystals };
    });
  }, [user, db]);

  const claimReward = useCallback((creditsReward: number, crystalsReward: number) => {
    const today = getMoscowDateString();
    setState(s => {
      if (s.lastRewardClaimDate === today) return s;
      
      const newCredits = s.credits + creditsReward;
      const newCrystals = s.crystals + crystalsReward;
      
      if (user) {
        const profileRef = doc(db, 'players_v2', user.uid);
        setDoc(profileRef, { 
          inGameCurrency: newCredits, 
          crystals: newCrystals,
          lastRewardClaimDate: today
        }, { merge: true }).catch(e => console.error("Reward sync failed", e));
      }
      
      return {
        ...s,
        credits: newCredits,
        crystals: newCrystals,
        lastRewardClaimDate: today
      };
    });
  }, [user, db]);

  const isSectorBusy = useCallback((sector: any) => {
    return Object.values(sector.constructionFinishes).some(v => v !== null && v !== undefined);
  }, []);

  const startArenaConstruction = useCallback((facility: keyof Omit<ArenaState, 'capacity' | 'constructionFinishes' | 'constructionStarts' | 'pendingCapacitySeats'>, cost: number) => {
    let result = false;
    setState(s => {
      if (s.credits >= cost && !isSectorBusy(s.arena)) {
        const currentLevel = (s.arena as any)[facility];
        const hours = 4 * (currentLevel + 1);
        const startTime = new Date();
        const finishTime = new Date(startTime.getTime() + hours * 3600000);
        result = true;
        const newCredits = s.credits - cost;
        if (user) {
          const profileRef = doc(db, 'players_v2', user.uid);
          setDoc(profileRef, { inGameCurrency: newCredits }, { merge: true });
        }
        return {
          ...s,
          credits: newCredits,
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
  }, [isSectorBusy, user, db]);

  const startHQConstruction = useCallback((facility: keyof Omit<HQState, 'constructionFinishes' | 'constructionStarts'>, cost: number) => {
    let result = false;
    setState(s => {
      if (s.credits >= cost && !isSectorBusy(s.hq)) {
        const currentLevel = (s.hq as any)[facility];
        const hours = 4 * (currentLevel + 1);
        const startTime = new Date();
        const finishTime = new Date(startTime.getTime() + hours * 3600000);
        result = true;
        const newCredits = s.credits - cost;
        if (user) {
          const profileRef = doc(db, 'players_v2', user.uid);
          setDoc(profileRef, { inGameCurrency: newCredits }, { merge: true });
        }
        return {
          ...s,
          credits: newCredits,
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
  }, [isSectorBusy, user, db]);

  const startBootcampConstruction = useCallback((facility: keyof Omit<BootcampState, 'constructionFinishes' | 'constructionStarts'>, cost: number) => {
    let result = false;
    setState(s => {
      if (s.credits >= cost && !isSectorBusy(s.bootcamp)) {
        const currentLevel = (s.bootcamp as any)[facility];
        const hours = 4 * (currentLevel + 1);
        const startTime = new Date();
        const finishTime = new Date(startTime.getTime() + hours * 3600000);
        result = true;
        const newCredits = s.credits - cost;
        if (user) {
          const profileRef = doc(db, 'players_v2', user.uid);
          setDoc(profileRef, { inGameCurrency: newCredits }, { merge: true });
        }
        return {
          ...s,
          credits: newCredits,
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
  }, [isSectorBusy, user, db]);

  const startAcademyConstruction = useCallback((facility: keyof Omit<AcademyState, 'constructionFinishes' | 'constructionStarts'>, cost: number) => {
    let result = false;
    setState(s => {
      if (s.credits >= cost && !isSectorBusy(s.academy)) {
        const currentLevel = (s.academy as any)[facility];
        const hours = 4 * (currentLevel + 1);
        const startTime = new Date();
        const finishTime = new Date(startTime.getTime() + hours * 3600000);
        result = true;
        const newCredits = s.credits - cost;
        if (user) {
          const profileRef = doc(db, 'players_v2', user.uid);
          setDoc(profileRef, { inGameCurrency: newCredits }, { merge: true });
        }
        return {
          ...s,
          credits: newCredits,
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
  }, [isSectorBusy, user, db]);

  const startMedicalConstruction = useCallback((facility: keyof Omit<MedicalState, 'constructionFinishes' | 'constructionStarts'>, cost: number) => {
    let result = false;
    setState(s => {
      if (s.credits >= cost && !isSectorBusy(s.medical)) {
        const currentLevel = (s.medical as any)[facility];
        const hours = 4 * (currentLevel + 1);
        const startTime = new Date();
        const finishTime = new Date(startTime.getTime() + hours * 3600000);
        result = true;
        const newCredits = s.credits - cost;
        if (user) {
          const profileRef = doc(db, 'players_v2', user.uid);
          setDoc(profileRef, { inGameCurrency: newCredits }, { merge: true });
        }
        return {
          ...s,
          credits: newCredits,
          medical: {
            ...s.medical,
            constructionStarts: { ...s.medical.constructionStarts, [facility]: startTime.toISOString() },
            constructionFinishes: { ...s.medical.constructionFinishes, [facility]: finishTime.toISOString() }
          }
        };
      }
      return s;
    });
    return result;
  }, [isSectorBusy, user, db]);

  const startCapacityExpansion = useCallback((seats: number, cost: number, hours: number) => {
    let result = false;
    setState(s => {
      if (s.credits >= cost && !isSectorBusy(s.arena)) {
        const startTime = new Date();
        const finishTime = new Date(startTime.getTime() + hours * 3600000);
        result = true;
        const newCredits = s.credits - cost;
        if (user) {
          const profileRef = doc(db, 'players_v2', user.uid);
          setDoc(profileRef, { inGameCurrency: newCredits }, { merge: true });
        }
        return {
          ...s,
          credits: newCredits,
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
  }, [isSectorBusy, user, db]);

  const checkConstructions = useCallback(() => {
    setState(s => {
      const nowTime = Date.now();
      let hasChanges = false;
      const processSector = (sector: any) => {
        const finishes = { ...(sector.constructionFinishes || {}) };
        const starts = { ...(sector.constructionStarts || {}) };
        const updatedSector = { ...sector };
        Object.entries(finishes).forEach(([id, finishTime]) => {
          if (finishTime && nowTime >= new Date(finishTime as string).getTime()) {
            if (id === 'capacity') {
              updatedSector.capacity += (updatedSector.pendingCapacitySeats || 0);
              updatedSector.pendingCapacitySeats = null;
            } else {
              updatedSector[id] = (updatedSector[id] || 0) + 1;
            }
            finishes[id] = null;
            starts[id] = null;
            hasChanges = true;
          }
        });
        updatedSector.constructionFinishes = finishes;
        updatedSector.constructionStarts = starts;
        return updatedSector;
      };

      const newArena = processSector(s.arena);
      const newHq = processSector(s.hq);
      const newBootcamp = processSector(s.bootcamp);
      const newAcademy = processSector(s.academy);
      const newMedical = processSector(s.medical);

      if (hasChanges) {
        return { ...s, arena: newArena, hq: newHq, bootcamp: newBootcamp, academy: newAcademy, medical: newMedical };
      }
      return s;
    });
  }, []);

  const setLanguage = useCallback((lang: 'en' | 'ru') => {
    setState(s => ({ ...s, language: lang }));
  }, []);

  const assignToRole = useCallback((slot: LineupSlot, heroId: string | null) => {
    setState(s => {
      const newLineup = { ...s.lineup };
      if (heroId) {
        Object.keys(newLineup).forEach(k => {
          if (newLineup[k as LineupSlot] === heroId) {
            newLineup[k as LineupSlot] = null;
          }
        });
      }
      newLineup[slot] = heroId;
      const uniqueHeroIds = Array.from(new Set(Object.values(newLineup).filter(id => id !== null)));
      const newTeam = s.ownedHeroes.filter(h => uniqueHeroIds.includes(h.id));
      return { ...s, lineup: newLineup, team: newTeam };
    });
  }, []);

  const recordMatch = useCallback((winner: string, result: any, matchDay: number, opponentName: string, type: 'league' | 'friendly', customPlayedAt?: string) => {
    const scoreA = result.scoreA || 0;
    const scoreB = result.scoreB || 0;
    let creditsEarned = 50;
    let rankChange = -15;
    let matchWins = 0, matchDraws = 0, matchLosses = 0, matchPoints = 0;

    if (scoreA === 2 && scoreB === 0) {
      creditsEarned = 200; rankChange = 25; matchWins = 1; matchPoints = 3;
    } else if (scoreA === 1 && scoreB === 1) {
      creditsEarned = 100; rankChange = 5; matchDraws = 1; matchPoints = 1;
    } else if (scoreA === 0 && scoreB === 2) {
      matchLosses = 1;
    } else if (scoreA > scoreB) { // for bo1 friendlies
      creditsEarned = 150; matchWins = 1; rankChange = 10;
    } else if (scoreA < scoreB) {
      matchLosses = 1;
    } else {
      matchDraws = 1;
    }

    setState(s => {
      // STRICT BLOCK for duplicate league matches for the same day
      if (type === 'league' && s.matchHistory.some(m => m.day === matchDay && m.type === 'league')) {
        console.warn(`Prevented duplicate league match recording for Day ${matchDay}`);
        return s;
      }

      const matchId = `match_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      const matchEntry: MatchResultEntry = {
        id: matchId,
        day: matchDay,
        type,
        opponentName: opponentName || "Unknown Team",
        winner,
        scoreA,
        scoreB,
        matchSummary: result.matchSummary,
        teamStats: result.teamStats,
        heroPerformance: result.heroPerformance,
        playedAt: customPlayedAt || new Date().toISOString()
      };

      const newState = {
        ...s,
        credits: s.credits + creditsEarned,
        rank: s.rank + rankChange,
        wins: s.wins + matchWins,
        draws: s.draws + matchDraws,
        losses: s.losses + matchLosses,
        points: s.points + matchPoints,
        matchHistory: [matchEntry, ...s.matchHistory].slice(0, 100),
        lastLeagueMatchDate: type === 'league' ? getMoscowDateString() : s.lastLeagueMatchDate
      };

      if (user) {
        const profileRef = doc(db, 'players_v2', user.uid);
        setDoc(profileRef, {
          inGameCurrency: newState.credits,
          wins: newState.wins,
          draws: newState.draws,
          losses: newState.losses,
          points: newState.points,
          lastLeagueMatchDate: newState.lastLeagueMatchDate,
          matchHistory: newState.matchHistory
        }, { merge: true }).catch(e => console.warn("Firestore match sync failed", e));
      }

      return newState;
    });
  }, [user, db]);

  const markMatchAsSeen = useCallback((day: number) => {
    setState(s => {
      if (day <= s.lastSeenMatchDay) return s;
      
      if (user) {
        const profileRef = doc(db, 'players_v2', user.uid);
        setDoc(profileRef, { lastSeenMatchDay: day }, { merge: true })
          .catch(e => console.warn("Failed to update lastSeenMatchDay", e));
      }
      
      return { ...s, lastSeenMatchDay: day };
    });
  }, [user, db]);

  return (
    <GameStateContext.Provider value={{
      ...state,
      isLoaded,
      addCredits,
      addCrystals,
      assignToRole,
      startArenaConstruction,
      startHQConstruction,
      startBootcampConstruction,
      startAcademyConstruction,
      startMedicalConstruction,
      startCapacityExpansion,
      checkConstructions,
      setLanguage,
      recordMatch,
      markMatchAsSeen,
      claimReward
    }}>
      {children}
    </GameStateContext.Provider>
  );
}

export function useGameState() {
  const context = useContext(GameStateContext);
  if (context === undefined) {
    throw new Error('useGameState must be used within a GameStateProvider');
  }
  return context;
}
