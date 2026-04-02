'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { Hero, INITIAL_HEROES } from './moba-data';
import { getMoscowTime, getMoscowDateString, isMatchDue, getGlobalSeasonInfo } from './time-utils';
import { useUser, useFirestore, setDocumentNonBlocking } from '@/firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { getMockGroupTeams, LEAGUES } from './leagues-data';

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
  id: string; 
  day: number; 
  seasonNumber?: number;
  type: 'league' | 'friendly' | 'tournament' | 'basket';
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
  lineSettings: { carry: string; mid: string; offlane: string };
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
  lastCupMatchDate: string | null;
  lastSeenMatchDay: number;
  seasonDay: number;
  seasonNumber: number;
  lastProcessedSeason: number;
  seasonStartDate: string | null;
  lastRewardClaimDate: string | null;
  rewardDay: number; 
  arena: ArenaState;
  hq: HQState;
  bootcamp: BootcampState;
  academy: AcademyState;
  medical: MedicalState;
  seasonResults: {
    lastRank: number;
    lastPoints: number;
    promoted: boolean;
    demoted: boolean;
    seasonNumber: number;
    awardedTrophy: boolean;
  } | null;
  hasEliteTrophy: boolean;
  isSyncing: boolean;
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
    carry: INITIAL_HEROES.find(h => h.role === 'Carry')?.id || null,
    mid: INITIAL_HEROES.find(h => h.role === 'Midlaner')?.id || null,
    offlane: INITIAL_HEROES.find(h => h.role === 'Tank')?.id || null,
    support: INITIAL_HEROES.find(h => h.role === 'Jungler')?.id || null,
    full_support: INITIAL_HEROES.find(h => h.role === 'Support')?.id || null,
    sub1: null,
    sub2: null,
  },
  strategy: 'Balanced Play',
  lineSettings: { carry: 'standard', mid: 'standard', offlane: 'standard' },
  rank: 1000,
  matchHistory: [],
  language: 'ru',
  wins: 0,
  draws: 0,
  losses: 0,
  points: 0,
  leagueLevel: 9, 
  divisionSubId: 1,
  groupId: 1,
  selectedLeagueId: null,
  country: null,
  lastLeagueMatchDate: null,
  lastCupMatchDate: null,
  lastSeenMatchDay: 0,
  seasonDay: 0,
  seasonNumber: 0,
  lastProcessedSeason: 0,
  seasonStartDate: null,
  lastRewardClaimDate: null,
  rewardDay: 1,
  arena: DEFAULT_ARENA,
  hq: DEFAULT_HQ,
  bootcamp: DEFAULT_BOOTCAMP,
  academy: DEFAULT_ACADEMY,
  medical: DEFAULT_MEDICAL,
  seasonResults: null,
  hasEliteTrophy: false,
  isSyncing: false,
};

function sanitizeForFirestore(obj: any) {
  return JSON.parse(JSON.stringify(obj));
}

interface GameStateContextType extends GameState {
  isLoaded: boolean;
  addCredits: (amount: number) => void;
  addCrystals: (amount: number) => void;
  assignToRole: (slot: LineupSlot, heroId: string | null) => void;
  updateTactics: (strategy: string, lineSettings: { carry: string; mid: string; offlane: string }) => void;
  startArenaConstruction: (facility: any, cost: number) => boolean;
  startHQConstruction: (facility: any, cost: number) => boolean;
  startBootcampConstruction: (facility: any, cost: number) => boolean;
  startAcademyConstruction: (facility: any, cost: number) => boolean;
  startMedicalConstruction: (facility: any, cost: number) => boolean;
  startCapacityExpansion: (seats: number, cost: number, hours: number) => boolean;
  checkConstructions: () => void;
  setLanguage: (lang: 'en' | 'ru') => void;
  recordMatch: (winner: string, result: any, matchDay: number, opponentName: string, type: MatchResultEntry['type'], customPlayedAt?: string) => void;
  markMatchAsSeen: (day: number) => void;
  claimReward: (creditsReward: number, crystalsReward: number) => void;
  syncStats: (groupPlayers: any[]) => void;
  dismissSeasonResults: () => void;
  setSyncing: (val: boolean) => void;
  setTrainingFocus: (heroId: string, skillKey: string | null) => void;
}

const GameStateContext = createContext<GameStateContextType | undefined>(undefined);

export function GameStateProvider({ children }: { children: ReactNode }) {
  const { user, isUserLoading } = useUser();
  const db = useFirestore();
  const [state, setState] = useState<GameState>(DEFAULT_STATE);
  const [isLoaded, setIsLoaded] = useState(false);

  const getStorageKey = useCallback(() => {
    return user ? `moba_tactics_v8_${user.uid}` : null;
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

    const safetyTimer = setTimeout(() => {
      if (!isLoaded) {
        setIsLoaded(true);
      }
    }, 8000);

    const profileRef = doc(db, 'players_v5', user.uid);
    const unsubscribe = onSnapshot(profileRef, (docSnap) => {
      clearTimeout(safetyTimer);
      if (docSnap.exists()) {
        const profileData = docSnap.data();
        
        setState(s => {
          const { seasonDay: globalDay, seasonNumber: globalSeason, seasonStartDate: globalStart } = getGlobalSeasonInfo();
          const history = profileData.matchHistory || s.matchHistory || [];
          const cloudHeroes = profileData.ownedHeroes || s.ownedHeroes;

          return {
            ...s,
            credits: profileData.inGameCurrency ?? s.credits ?? 0,
            crystals: profileData.crystals ?? s.crystals ?? 0,
            ownedHeroes: cloudHeroes,
            lineup: profileData.lineup || s.lineup,
            strategy: profileData.strategy || s.strategy,
            lineSettings: profileData.lineSettings || s.lineSettings,
            wins: profileData.wins ?? s.wins ?? 0,
            draws: profileData.draws ?? s.draws ?? 0,
            losses: profileData.losses ?? s.losses ?? 0,
            points: profileData.points ?? s.points ?? 0,
            leagueLevel: profileData.leagueLevel ?? s.leagueLevel ?? 9,
            groupId: profileData.groupId ?? s.groupId ?? 1,
            divisionSubId: profileData.divisionSubId ?? s.divisionSubId ?? 1,
            selectedLeagueId: profileData.selectedLeagueId ?? s.selectedLeagueId ?? null,
            country: profileData.country ?? s.country ?? null,
            lastSeenMatchDay: profileData.lastSeenMatchDay ?? s.lastSeenMatchDay ?? 0,
            lastLeagueMatchDate: profileData.lastLeagueMatchDate ?? s.lastLeagueMatchDate ?? null,
            lastCupMatchDate: profileData.lastCupMatchDate ?? s.lastCupMatchDate ?? null,
            matchHistory: history,
            seasonStartDate: globalStart,
            seasonDay: globalDay,
            seasonNumber: globalSeason,
            lastProcessedSeason: profileData.lastProcessedSeason ?? s.lastProcessedSeason ?? 0,
            lastRewardClaimDate: profileData.lastRewardClaimDate ?? s.lastRewardClaimDate ?? null,
            rewardDay: profileData.rewardDay ?? s.rewardDay ?? 1,
            seasonResults: profileData.seasonResults ?? s.seasonResults ?? null,
            hasEliteTrophy: profileData.hasEliteTrophy ?? s.hasEliteTrophy ?? false,
          };
        });
      }
      setIsLoaded(true);
    }, (error) => {
      clearTimeout(safetyTimer);
      setIsLoaded(true);
    });

    return () => {
      clearTimeout(safetyTimer);
      unsubscribe();
    };
  }, [user, isUserLoading, db, getStorageKey]);

  useEffect(() => {
    const key = getStorageKey();
    if (isLoaded && key && user) {
      localStorage.setItem(key, JSON.stringify(state));
    }
  }, [state, isLoaded, getStorageKey, user]);

  const setSyncing = useCallback((val: boolean) => {
    setState(s => ({ ...s, isSyncing: val }));
  }, []);

  const syncStats = useCallback((groupPlayers: any[]) => {
    if (!state.selectedLeagueId || !state.seasonDay || !user) return;

    const { seasonNumber: globalSeason, seasonDay: globalDay } = getGlobalSeasonInfo();

    if (state.lastProcessedSeason > 0 && globalSeason > state.lastProcessedSeason) {
      const lastSeasonTeams = getMockGroupTeams(
        state.rank, 
        user.displayName || "My Team", 
        state.leagueLevel, 
        state.divisionSubId, 
        state.groupId, 
        state.selectedLeagueId,
        groupPlayers,
        user.uid,
        14 
      );

      const sorted = [...lastSeasonTeams].sort((a, b) => b.points - a.points || b.wins - a.wins);
      const myPos = sorted.findIndex(t => t.id === user.uid) + 1;
      
      let newLevel = state.leagueLevel;
      let promoted = false;
      let demoted = false;
      let awardedTrophy = false;

      if (myPos === 1) {
        newLevel = Math.max(newLevel - 1, 1);
        if (newLevel < state.leagueLevel) promoted = true;
        if (state.leagueLevel === 1 && state.groupId === 1) awardedTrophy = true;
      } else if (myPos >= 7) {
        newLevel = Math.min(newLevel + 1, 9);
        if (newLevel > state.leagueLevel) demoted = true;
      }

      const results = sanitizeForFirestore({
        lastRank: myPos,
        lastPoints: lastSeasonTeams.find(t => t.id === user.uid)?.points || 0,
        promoted,
        demoted,
        seasonNumber: state.lastProcessedSeason,
        awardedTrophy
      });

      const profileRef = doc(db, 'players_v5', user.uid);
      setDocumentNonBlocking(profileRef, {
        leagueLevel: newLevel,
        wins: 0, draws: 0, losses: 0, points: 0,
        lastProcessedSeason: globalSeason,
        lastLeagueMatchDate: null,
        lastCupMatchDate: null,
        lastSeenMatchDay: 0,
        seasonResults: results,
        hasEliteTrophy: awardedTrophy || state.hasEliteTrophy
      }, { merge: true });

      return; 
    }

    if (globalDay > 14) return;

    const league = LEAGUES.find(l => l.id === state.selectedLeagueId);
    const isPlayedToday = isMatchDue(league?.startTime || "23:00", state.lastLeagueMatchDate);
    const completedDays = isPlayedToday ? state.seasonDay : Math.max(0, state.seasonDay - 1);

    const groupTeams = getMockGroupTeams(
      state.rank, user.displayName || "My Team", state.leagueLevel, state.divisionSubId, state.groupId, state.selectedLeagueId,
      groupPlayers, user.uid, completedDays
    );

    const myTeam = groupTeams.find(t => t.id === user.uid);
    if (!myTeam) return;

    if (state.wins !== myTeam.wins || state.points !== myTeam.points || state.lastProcessedSeason !== globalSeason) {
      const profileRef = doc(db, 'players_v5', user.uid);
      setDocumentNonBlocking(profileRef, {
        wins: Number(myTeam.wins || 0),
        draws: Number(myTeam.draws || 0),
        losses: Number(myTeam.losses || 0),
        points: Number(myTeam.points || 0),
        lastProcessedSeason: globalSeason 
      }, { merge: true });
    }
  }, [state.selectedLeagueId, state.seasonDay, state.lastLeagueMatchDate, state.rank, state.leagueLevel, state.divisionSubId, state.groupId, state.lastProcessedSeason, state.hasEliteTrophy, user, db]);

  const addCredits = useCallback((amount: number) => {
    setState(s => {
      const newCredits = s.credits + amount;
      if (user) {
        const profileRef = doc(db, 'players_v5', user.uid);
        setDocumentNonBlocking(profileRef, { inGameCurrency: newCredits }, { merge: true });
      }
      return { ...s, credits: newCredits };
    });
  }, [user, db]);

  const addCrystals = useCallback((amount: number) => {
    setState(s => {
      const newCrystals = s.crystals + amount;
      if (user) {
        const profileRef = doc(db, 'players_v5', user.uid);
        setDocumentNonBlocking(profileRef, { crystals: newCrystals }, { merge: true });
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
      const nextRewardDay = s.rewardDay >= 30 ? 1 : s.rewardDay + 1;
      if (user) {
        const profileRef = doc(db, 'players_v5', user.uid);
        setDocumentNonBlocking(profileRef, { inGameCurrency: newCredits, crystals: newCrystals, lastRewardClaimDate: today, rewardDay: nextRewardDay }, { merge: true });
      }
      return { ...s, credits: newCredits, crystals: newCrystals, lastRewardClaimDate: today, rewardDay: nextRewardDay };
    });
  }, [user, db]);

  const isSectorBusy = useCallback((sector: any) => {
    return sector && sector.constructionFinishes && Object.values(sector.constructionFinishes).some(v => v !== null && v !== undefined);
  }, []);

  const startArenaConstruction = useCallback((facility: any, cost: number) => {
    let result = false;
    setState(s => {
      if (s.credits >= cost && !isSectorBusy(s.arena)) {
        const hours = 4 * ((s.arena as any)[facility] + 1);
        const startTime = new Date();
        const finishTime = new Date(startTime.getTime() + hours * 3600000);
        result = true;
        const newCredits = s.credits - cost;
        if (user) {
          const profileRef = doc(db, 'players_v5', user.uid);
          setDocumentNonBlocking(profileRef, { inGameCurrency: newCredits, arena: sanitizeForFirestore({ ...s.arena, constructionStarts: { ...s.arena.constructionStarts, [facility]: startTime.toISOString() }, constructionFinishes: { ...s.arena.constructionFinishes, [facility]: finishTime.toISOString() } }) }, { merge: true });
        }
        return { ...s, credits: newCredits, arena: { ...s.arena, constructionStarts: { ...s.arena.constructionStarts, [facility]: startTime.toISOString() }, constructionFinishes: { ...s.arena.constructionFinishes, [facility]: finishTime.toISOString() } } };
      }
      return s;
    });
    return result;
  }, [isSectorBusy, user, db]);

  const startHQConstruction = useCallback((facility: any, cost: number) => {
    let result = false;
    setState(s => {
      if (s.credits >= cost && !isSectorBusy(s.hq)) {
        const hours = 4 * ((s.hq as any)[facility] + 1);
        const startTime = new Date();
        const finishTime = new Date(startTime.getTime() + hours * 3600000);
        result = true;
        const newCredits = s.credits - cost;
        if (user) {
          const profileRef = doc(db, 'players_v5', user.uid);
          setDocumentNonBlocking(profileRef, { inGameCurrency: newCredits, hq: sanitizeForFirestore({ ...s.hq, constructionStarts: { ...s.hq.constructionStarts, [facility]: startTime.toISOString() }, constructionFinishes: { ...s.hq.constructionFinishes, [facility]: finishTime.toISOString() } }) }, { merge: true });
        }
        return { ...s, credits: newCredits, hq: { ...s.hq, constructionStarts: { ...s.hq.constructionStarts, [facility]: startTime.toISOString() }, constructionFinishes: { ...s.hq.constructionFinishes, [facility]: finishTime.toISOString() } } };
      }
      return s;
    });
    return result;
  }, [isSectorBusy, user, db]);

  const startBootcampConstruction = useCallback((facility: any, cost: number) => {
    let result = false;
    setState(s => {
      if (s.credits >= cost && !isSectorBusy(s.bootcamp)) {
        const hours = 4 * ((s.bootcamp as any)[facility] + 1);
        const startTime = new Date();
        const finishTime = new Date(startTime.getTime() + hours * 3600000);
        result = true;
        const newCredits = s.credits - cost;
        if (user) {
          const profileRef = doc(db, 'players_v5', user.uid);
          setDocumentNonBlocking(profileRef, { inGameCurrency: newCredits, bootcamp: sanitizeForFirestore({ ...s.bootcamp, constructionStarts: { ...s.bootcamp.constructionStarts, [facility]: startTime.toISOString() }, constructionFinishes: { ...s.bootcamp.constructionFinishes, [facility]: finishTime.toISOString() } }) }, { merge: true });
        }
        return { ...s, credits: newCredits, bootcamp: { ...s.bootcamp, constructionStarts: { ...s.bootcamp.constructionStarts, [facility]: startTime.toISOString() }, constructionFinishes: { ...s.bootcamp.constructionFinishes, [facility]: finishTime.toISOString() } } };
      }
      return s;
    });
    return result;
  }, [isSectorBusy, user, db]);

  const startAcademyConstruction = useCallback((facility: any, cost: number) => {
    let result = false;
    setState(s => {
      if (s.credits >= cost && !isSectorBusy(s.academy)) {
        const hours = 4 * ((s.academy as any)[facility] + 1);
        const startTime = new Date();
        const finishTime = new Date(startTime.getTime() + hours * 3600000);
        result = true;
        const newCredits = s.credits - cost;
        if (user) {
          const profileRef = doc(db, 'players_v5', user.uid);
          setDocumentNonBlocking(profileRef, { inGameCurrency: newCredits, academy: sanitizeForFirestore({ ...s.academy, constructionStarts: { ...s.academy.constructionStarts, [facility]: startTime.toISOString() }, constructionFinishes: { ...s.academy.constructionFinishes, [facility]: finishTime.toISOString() } }) }, { merge: true });
        }
        return { ...s, credits: newCredits, academy: { ...s.academy, constructionStarts: { ...s.academy.constructionStarts, [facility]: startTime.toISOString() }, constructionFinishes: { ...s.academy.constructionFinishes, [facility]: finishTime.toISOString() } } };
      }
      return s;
    });
    return result;
  }, [isSectorBusy, user, db]);

  const startMedicalConstruction = useCallback((facility: any, cost: number) => {
    let result = false;
    setState(s => {
      if (s.credits >= cost && !isSectorBusy(s.medical)) {
        const hours = 4 * ((s.medical as any)[facility] + 1);
        const startTime = new Date();
        const finishTime = new Date(startTime.getTime() + hours * 3600000);
        result = true;
        const newCredits = s.credits - cost;
        if (user) {
          const profileRef = doc(db, 'players_v5', user.uid);
          setDocumentNonBlocking(profileRef, { inGameCurrency: newCredits, medical: sanitizeForFirestore({ ...s.medical, constructionStarts: { ...s.medical.constructionStarts, [facility]: startTime.toISOString() }, constructionFinishes: { ...s.medical.constructionFinishes, [facility]: finishTime.toISOString() } }) }, { merge: true });
        }
        return { ...s, credits: newCredits, medical: { ...s.medical, constructionStarts: { ...s.medical.constructionStarts, [facility]: startTime.toISOString() }, constructionFinishes: { ...s.medical.constructionFinishes, [facility]: finishTime.toISOString() } } };
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
          const profileRef = doc(db, 'players_v5', user.uid);
          setDocumentNonBlocking(profileRef, { inGameCurrency: newCredits, arena: sanitizeForFirestore({ ...s.arena, pendingCapacitySeats: seats, constructionStarts: { ...s.arena.constructionStarts, capacity: startTime.toISOString() }, constructionFinishes: { ...s.arena.constructionFinishes, capacity: finishTime.toISOString() } }) }, { merge: true });
        }
        return { ...s, credits: newCredits, arena: { ...s.arena, pendingCapacitySeats: seats, constructionStarts: { ...s.arena.constructionStarts, capacity: startTime.toISOString() }, constructionFinishes: { ...s.arena.constructionFinishes, capacity: finishTime.toISOString() } } };
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
        const updated = { ...sector };
        const finishes = { ...(sector.constructionFinishes || {}) };
        const starts = { ...(sector.constructionStarts || {}) };
        Object.entries(finishes).forEach(([id, finishTime]) => {
          if (finishTime && nowTime >= new Date(finishTime as string).getTime()) {
            if (id === 'capacity') {
              updated.capacity += (updated.pendingCapacitySeats || 0);
              updated.pendingCapacitySeats = null;
            } else {
              updated[id] = (updated[id] || 0) + 1;
            }
            finishes[id] = null; starts[id] = null; hasChanges = true;
          }
        });
        updated.constructionFinishes = finishes; updated.constructionStarts = starts;
        return updated;
      };
      if (!hasChanges) return s;
      return { ...s, arena: processSector(s.arena), hq: processSector(s.hq), bootcamp: processSector(s.bootcamp), academy: processSector(s.academy), medical: processSector(s.medical) };
    });
  }, []);

  const setLanguage = useCallback((lang: 'en' | 'ru') => setState(s => ({ ...s, language: lang })), []);
  
  const assignToRole = useCallback((slot: LineupSlot, heroId: string | null) => {
    setState(s => {
      const newLineup = { ...s.lineup };
      if (heroId) {
        Object.keys(newLineup).forEach(k => { 
          if (newLineup[k as LineupSlot] === heroId) newLineup[k as LineupSlot] = null; 
        });
      }
      newLineup[slot] = heroId;
      const uniqueHeroIds = Array.from(new Set(Object.values(newLineup).filter(id => id !== null)));
      
      const newState = { ...s, lineup: newLineup, team: s.ownedHeroes.filter(h => uniqueHeroIds.includes(h.id)), isSyncing: true };
      
      if (user) {
        setDocumentNonBlocking(doc(db, 'players_v5', user.uid), { lineup: newLineup }, { merge: true });
        setTimeout(() => setState(prev => ({ ...prev, isSyncing: false })), 1000);
      }
      
      return newState;
    });
  }, [user, db]);

  const updateTactics = useCallback((strategy: string, lineSettings: { carry: string; mid: string; offlane: string }) => {
    setState(s => {
      const newState = { ...s, strategy, lineSettings, isSyncing: true };
      if (user) {
        setDocumentNonBlocking(doc(db, 'players_v5', user.uid), { strategy, lineSettings }, { merge: true });
        setTimeout(() => setState(prev => ({ ...prev, isSyncing: false })), 1000);
      }
      return newState;
    });
  }, [user, db]);

  const setTrainingFocus = useCallback((heroId: string, skillKey: string | null) => {
    setState(s => {
      const updatedHeroes = s.ownedHeroes.map(h => h.id === heroId ? { ...h, trainingFocus: skillKey } : h);
      if (user) {
        setDocumentNonBlocking(doc(db, 'players_v5', user.uid), { ownedHeroes: sanitizeForFirestore(updatedHeroes) }, { merge: true });
      }
      return { ...s, ownedHeroes: updatedHeroes };
    });
  }, [user, db]);

  const recordMatch = useCallback((winner: string, result: any, matchDay: number, opponentName: string, type: MatchResultEntry['type'], customPlayedAt?: string) => {
    const scoreA = result.scoreA || 0;
    const scoreB = result.scoreB || 0;
    let creditsEarned = 50; let rankChange = -15;
    if (scoreA === 2 && scoreB === 0) { creditsEarned = 200; rankChange = 25; }
    else if (scoreA === 1 && scoreB === 1) { creditsEarned = 100; rankChange = 5; }
    else if (scoreA > scoreB) { creditsEarned = 150; rankChange = 10; }
    else if (scoreA === scoreB) rankChange = 0;

    setState(s => {
      if (type === 'league' && s.matchHistory.some(m => m.day === matchDay && m.type === 'league' && m.seasonNumber === s.seasonNumber)) return s;
      
      // Calculate XP for training
      const xpRange = (type === 'league' || type === 'tournament') ? { min: 2, max: 4 } : { min: 1, max: 1 };
      const updatedHeroes = s.ownedHeroes.map(hero => {
        const isHeroActive = Object.values(s.lineup).includes(hero.id);
        if (isHeroActive && hero.trainingFocus) {
          const skillKey = hero.trainingFocus;
          const currentVal = (hero.proStats as any)[skillKey] || 0;
          // Added safety check for proTalents
          const talentLimit = (hero.proTalents ? (hero.proTalents as any)[skillKey] || 3.0 : 3.0) * 20;
          if (currentVal < talentLimit) {
            const gain = Math.floor(Math.random() * (xpRange.max - xpRange.min + 1)) + xpRange.min;
            const newVal = Math.min(talentLimit, currentVal + gain);
            return { ...hero, proStats: { ...hero.proStats, [skillKey]: newVal } };
          }
        }
        return hero;
      });

      const matchEntry: MatchResultEntry = {
        id: `match_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        day: matchDay, type, opponentName, winner, scoreA, scoreB,
        matchSummary: result.matchSummary || "",
        teamStats: sanitizeForFirestore(result.teamStats || {}),
        heroPerformance: sanitizeForFirestore(result.heroPerformance || []),
        playedAt: customPlayedAt || new Date().toISOString()
      };
      if (type === 'league' || type === 'tournament') matchEntry.seasonNumber = s.seasonNumber;
      
      const todayStr = getMoscowDateString();
      const newState = { ...s, credits: s.credits + creditsEarned, rank: s.rank + rankChange, matchHistory: [matchEntry, ...s.matchHistory].slice(0, 500), 
        lastLeagueMatchDate: type === 'league' && matchDay === s.seasonDay ? todayStr : s.lastLeagueMatchDate,
        lastCupMatchDate: type === 'tournament' ? todayStr : s.lastCupMatchDate,
        ownedHeroes: updatedHeroes,
        isSyncing: true
      };
      if (user) {
        setDocumentNonBlocking(doc(db, 'players_v5', user.uid), { 
          inGameCurrency: newState.credits, 
          rank: newState.rank, 
          lastLeagueMatchDate: newState.lastLeagueMatchDate ?? null, 
          lastCupMatchDate: newState.lastCupMatchDate ?? null,
          matchHistory: newState.matchHistory,
          ownedHeroes: sanitizeForFirestore(updatedHeroes)
        }, { merge: true });
        setTimeout(() => setState(prev => ({ ...prev, isSyncing: false })), 1500);
      }
      return newState;
    });
  }, [user, db]);

  const markMatchAsSeen = useCallback((day: number) => {
    setState(s => {
      if (day <= s.lastSeenMatchDay) return s;
      if (user) setDocumentNonBlocking(doc(db, 'players_v5', user.uid), { lastSeenMatchDay: day }, { merge: true });
      return { ...s, lastSeenMatchDay: day };
    });
  }, [user, db]);

  const dismissSeasonResults = useCallback(() => {
    setState(s => ({ ...s, seasonResults: null }));
    if (user) setDocumentNonBlocking(doc(db, 'players_v5', user.uid), { seasonResults: null }, { merge: true });
  }, [user, db]);

  return (
    <GameStateContext.Provider value={{
      ...state, isLoaded, addCredits, addCrystals, assignToRole, updateTactics, startArenaConstruction, startHQConstruction, startBootcampConstruction, startAcademyConstruction, startMedicalConstruction, startCapacityExpansion, checkConstructions, setLanguage, recordMatch, markMatchAsSeen, claimReward, syncStats, dismissSeasonResults, setSyncing, setTrainingFocus
    }}>
      {children}
    </GameStateContext.Provider>
  );
}

export function useGameState() {
  const context = useContext(GameStateContext);
  if (context === undefined) throw new Error('useGameState must be used within a GameStateProvider');
  return context;
}
