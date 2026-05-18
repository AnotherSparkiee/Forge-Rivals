'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode, useRef } from 'react';
import { Hero, INITIAL_HEROES, generateYouthHero, StaffMember, StaffRole } from './moba-data';
import { getMoscowTime, getMoscowDateString, isMatchDue, getGlobalSeasonInfo } from './time-utils';
import { useUser, useFirestore, setDocumentNonBlocking } from '@/firebase';
import { doc, onSnapshot, updateDoc } from 'firebase/firestore';
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

interface StaffState {
  coach: StaffMember | null;
  analyst: StaffMember | null;
  scout: StaffMember | null;
  doctor: StaffMember | null;
  financier: StaffMember | null;
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
  duration?: string;
  mvp?: string;
  preview?: any;
  timeline?: any[];
  postMatch?: any;
}

interface GameState {
  credits: number;
  crystals: number;
  ownedHeroes: Hero[];
  youthAcademyHeroes: Hero[];
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
  lastYouthArrivalDay: number;
  lastYouthArrivalSeason: number;
  seasonStartDate: string | null;
  lastRewardClaimDate: string | null;
  rewardDay: number; 
  arena: ArenaState;
  hq: HQState;
  bootcamp: BootcampState;
  academy: AcademyState;
  medical: MedicalState;
  staff: StaffState;
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

const DEFAULT_STAFF: StaffState = {
  coach: null,
  analyst: null,
  scout: null,
  doctor: null,
  financier: null,
};

const START_CREDITS = 10000000;

const DEFAULT_STATE: GameState = {
  credits: START_CREDITS,
  crystals: 0,
  ownedHeroes: INITIAL_HEROES,
  youthAcademyHeroes: [],
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
  lastYouthArrivalDay: 0,
  lastYouthArrivalSeason: 0,
  seasonStartDate: null,
  lastRewardClaimDate: null,
  rewardDay: 1,
  arena: DEFAULT_ARENA,
  hq: DEFAULT_HQ,
  bootcamp: DEFAULT_BOOTCAMP,
  academy: DEFAULT_ACADEMY,
  medical: DEFAULT_MEDICAL,
  staff: DEFAULT_STAFF,
  seasonResults: null,
  hasEliteTrophy: false,
  isSyncing: false,
};

function sanitizeForFirestore(obj: any) {
  if (obj === undefined) return null;
  if (!obj) return obj;
  try {
    return JSON.parse(JSON.stringify(obj));
  } catch (e) {
    return null;
  }
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
  setLanguage: (lang: 'en' | 'ru') => void;
  recordMatch: (winner: string, result: any, matchDay: number, opponentName: string, type: MatchResultEntry['type'], customPlayedAt?: string, customId?: string) => void;
  markMatchAsSeen: (day: number) => void;
  claimReward: (creditsReward: number, crystalsReward: number) => void;
  syncStats: (groupPlayers: any[]) => void;
  dismissSeasonResults: () => void;
  setSyncing: (val: boolean) => void;
  setTrainingFocus: (heroId: string, skillKey: string | null) => void;
  startDailyHeroTraining: (heroId: string, skillKey: string) => void;
  claimDailyHeroTraining: (heroId: string) => void;
  updateHero: (heroId: string, updates: Partial<Hero>, creditCost?: number, crystalCost?: number) => void;
  promoteYouthPlayer: (heroId: string) => void;
  removeHero: (heroId: string, sellCreditAmount?: number) => void;
  recoverAllFatigue: (costType: 'credits' | 'crystals') => boolean;
  hireStaffMember: (member: StaffMember) => void;
  trainStaffSkill: (role: StaffRole, skillKey: 'primary' | 'secondary', cost: number) => boolean;
  addHeroDirectly: (hero: Hero) => void;
  addYouthHeroDirectly: (hero: Hero) => void;
  updateProfileName: (name: string) => void;
  updateProfileCountry: (countryName: string) => void;
}

const GameStateContext = createContext<GameStateContextType | undefined>(undefined);

export function GameStateProvider({ children }: { children: ReactNode }) {
  const { user, isUserLoading } = useUser();
  const db = useFirestore();
  const [state, setState] = useState<GameState>(DEFAULT_STATE);
  const [isLoaded, setIsLoaded] = useState(false);
  const lastSyncRef = useRef<{ season: number, day: number, leagueId: string | null } | null>(null);

  const getStorageKey = useCallback(() => {
    return user ? `lote_v1_${user.uid}` : null;
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

    const profileRef = doc(db, 'players_v5', user.uid);
    const unsubscribe = onSnapshot(profileRef, (docSnap) => {
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
            youthAcademyHeroes: profileData.youthAcademyHeroes || s.youthAcademyHeroes || [],
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
            lastYouthArrivalDay: profileData.lastYouthArrivalDay ?? s.lastYouthArrivalDay ?? 0,
            lastYouthArrivalSeason: profileData.lastYouthArrivalSeason ?? s.lastYouthArrivalSeason ?? 0,
            lastRewardClaimDate: profileData.lastRewardClaimDate ?? s.lastRewardClaimDate ?? null,
            rewardDay: profileData.rewardDay ?? s.rewardDay ?? 1,
            arena: profileData.arena || s.arena,
            hq: profileData.hq || s.hq,
            bootcamp: profileData.bootcamp || s.bootcamp,
            academy: profileData.academy || s.academy,
            medical: profileData.medical || s.medical,
            staff: profileData.staff || s.staff || DEFAULT_STAFF,
            seasonResults: profileData.seasonResults ?? s.seasonResults ?? null,
            hasEliteTrophy: profileData.hasEliteTrophy ?? s.hasEliteTrophy ?? false,
          };
        });
      }
      setIsLoaded(true);
    }, (error) => {
      setIsLoaded(true);
    });

    return () => {
      unsubscribe();
    };
  }, [user, isUserLoading, db, getStorageKey]);

  useEffect(() => {
    if (!isLoaded || !user) return;
    
    const { seasonDay, seasonNumber } = getGlobalSeasonInfo();
    const youthCheckDays = [1, 5, 9, 13];
    
    if (youthCheckDays.includes(seasonDay)) {
      if (state.lastYouthArrivalSeason < seasonNumber || state.lastYouthArrivalDay < seasonDay) {
        const newHero = generateYouthHero(state.youthAcademyHeroes.length);
        const updatedAcademy = [...state.youthAcademyHeroes, newHero];
        
        const profileRef = doc(db, 'players_v5', user.uid);
        updateDoc(profileRef, {
          youthAcademyHeroes: sanitizeForFirestore(updatedAcademy),
          lastYouthArrivalDay: seasonDay,
          lastYouthArrivalSeason: seasonNumber
        }).catch(e => console.error("Youth sync failed", e));
      }
    }
  }, [isLoaded, user, state.seasonDay, state.seasonNumber, state.lastYouthArrivalDay, state.lastYouthArrivalSeason, state.youthAcademyHeroes, db]);

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
    const league = LEAGUES.find(l => l.id === state.selectedLeagueId);
    const isPlayedToday = isMatchDue(league?.startTime || "23:00", state.lastLeagueMatchDate);
    const completedDays = isPlayedToday ? globalDay : Math.max(0, globalDay - 1);

    if (lastSyncRef.current?.season === globalSeason && lastSyncRef.current?.day === completedDays && lastSyncRef.current?.leagueId === state.selectedLeagueId) return;

    if (state.lastProcessedSeason > 0 && globalSeason > state.lastProcessedSeason) {
      const lastSeasonTeams = getMockGroupTeams(state.rank, user.displayName || "My Team", state.leagueLevel, state.divisionSubId, state.groupId, state.selectedLeagueId, groupPlayers, user.uid, 14);
      const sorted = [...lastSeasonTeams].sort((a, b) => b.points - a.points || b.wins - a.wins);
      const myPos = sorted.findIndex(t => t.id === user.uid) + 1;
      let newLevel = state.leagueLevel;
      let promoted = false; let demoted = false; let awardedTrophy = false;

      if (myPos === 1) {
        newLevel = Math.max(newLevel - 1, 1);
        if (newLevel < state.leagueLevel) promoted = true;
        if (state.leagueLevel === 1 && state.groupId === 1) awardedTrophy = true;
      } else if (myPos >= 7) {
        newLevel = Math.min(newLevel + 1, 9);
        if (newLevel > state.leagueLevel) demoted = true;
      }

      const results = sanitizeForFirestore({ lastRank: myPos, lastPoints: lastSeasonTeams.find(t => t.id === user.uid)?.points || 0, promoted, demoted, seasonNumber: state.lastProcessedSeason, awardedTrophy });
      lastSyncRef.current = { season: globalSeason, day: completedDays, leagueId: state.selectedLeagueId };
      updateDoc(doc(db, 'players_v5', user.uid), { leagueLevel: newLevel, wins: 0, draws: 0, losses: 0, points: 0, lastProcessedSeason: globalSeason, lastLeagueMatchDate: null, lastCupMatchDate: null, lastSeenMatchDay: 0, seasonResults: results, hasEliteTrophy: awardedTrophy || state.hasEliteTrophy }).catch(e => console.error("League sync failed", e));
      return; 
    }

    if (globalDay > 14) return;
    const groupTeams = getMockGroupTeams(state.rank, user.displayName || "My Team", state.leagueLevel, state.divisionSubId, state.groupId, state.selectedLeagueId, groupPlayers, user.uid, completedDays);
    const myTeam = groupTeams.find(t => t.id === user.uid);
    const myDocInSnapshot = groupPlayers.find(p => p.id === user.uid);
    if (!myTeam || !myDocInSnapshot) return;

    if (Number(myDocInSnapshot.wins) !== Number(myTeam.wins) || Number(myDocInSnapshot.points) !== Number(myTeam.points) || state.lastProcessedSeason !== globalSeason) {
      lastSyncRef.current = { season: globalSeason, day: completedDays, leagueId: state.selectedLeagueId };
      updateDoc(doc(db, 'players_v5', user.uid), { wins: Number(myTeam.wins || 0), draws: Number(myTeam.draws || 0), losses: Number(myTeam.losses || 0), points: Number(myTeam.points || 0), lastProcessedSeason: globalSeason }).catch(e => console.error("Stats sync failed", e));
    }
  }, [state.selectedLeagueId, state.seasonDay, state.lastLeagueMatchDate, state.rank, state.leagueLevel, state.divisionSubId, state.groupId, state.lastProcessedSeason, state.hasEliteTrophy, user, db]);

  const addCredits = useCallback((amount: number) => {
    setState(s => ({ ...s, credits: s.credits + amount }));
    if (user) updateDoc(doc(db, 'players_v5', user.uid), { inGameCurrency: state.credits + amount }).catch(e => console.error("Credits failed", e));
  }, [user, db, state.credits]);

  const addCrystals = useCallback((amount: number) => {
    setState(s => ({ ...s, crystals: s.crystals + amount }));
    if (user) updateDoc(doc(db, 'players_v5', user.uid), { crystals: state.crystals + amount }).catch(e => console.error("Crystals failed", e));
  }, [user, db, state.crystals]);

  const claimReward = useCallback((creditsReward: number, crystalsReward: number) => {
    const today = getMoscowDateString();
    let newCredits = state.credits;
    let newCrystals = state.crystals;
    let nextRewardDay = state.rewardDay;
    setState(s => {
      if (s.lastRewardClaimDate === today) return s;
      newCredits = s.credits + creditsReward; newCrystals = s.crystals + crystalsReward;
      nextRewardDay = s.rewardDay >= 30 ? 1 : s.rewardDay + 1;
      return { ...s, credits: newCredits, crystals: newCrystals, lastRewardClaimDate: today, rewardDay: nextRewardDay };
    });
    if (user && state.lastRewardClaimDate !== today) updateDoc(doc(db, 'players_v5', user.uid), { inGameCurrency: newCredits, crystals: newCrystals, lastRewardClaimDate: today, rewardDay: nextRewardDay }).catch(e => console.error("Reward failed", e));
  }, [user, db, state.credits, state.crystals, state.rewardDay, state.lastRewardClaimDate]);

  const isSectorBusy = useCallback((sector: any) => {
    return sector && sector.constructionFinishes && Object.values(sector.constructionFinishes).some(v => v !== null && v !== undefined);
  }, []);

  const startArenaConstruction = useCallback((facility: any, cost: number) => {
    let result = false; let newState: any;
    setState(s => {
      if (s.credits >= cost && !isSectorBusy(s.arena)) {
        const hours = 4 * ((s.arena as any)[facility] + 1); const startTime = new Date(); const finishTime = new Date(startTime.getTime() + hours * 3600000);
        result = true; const newCredits = s.credits - cost;
        newState = { ...s, credits: newCredits, arena: { ...s.arena, constructionStarts: { ...s.arena.constructionStarts, [facility]: startTime.toISOString() }, constructionFinishes: { ...s.arena.constructionFinishes, [facility]: finishTime.toISOString() } } };
        return newState;
      }
      return s;
    });
    if (user && result && newState) updateDoc(doc(db, 'players_v5', user.uid), { inGameCurrency: newState.credits, arena: sanitizeForFirestore(newState.arena) }).catch(e => console.error("Arena build failed", e));
    return result;
  }, [isSectorBusy, user, db]);

  const startHQConstruction = useCallback((facility: any, cost: number) => {
    let result = false; let newState: any;
    setState(s => {
      if (s.credits >= cost && !isSectorBusy(s.hq)) {
        const hours = 4 * ((s.hq as any)[facility] + 1); const startTime = new Date(); const finishTime = new Date(startTime.getTime() + hours * 3600000);
        result = true; const newCredits = s.credits - cost;
        newState = { ...s, credits: newCredits, hq: { ...s.hq, constructionStarts: { ...s.hq.constructionStarts, [facility]: startTime.toISOString() }, constructionFinishes: { ...s.hq.constructionFinishes, [facility]: finishTime.toISOString() } } };
        return newState;
      }
      return s;
    });
    if (user && result && newState) updateDoc(doc(db, 'players_v5', user.uid), { inGameCurrency: newState.credits, hq: sanitizeForFirestore(newState.hq) }).catch(e => console.error("HQ build failed", e));
    return result;
  }, [isSectorBusy, user, db]);

  const startBootcampConstruction = useCallback((facility: any, cost: number) => {
    let result = false; let newState: any;
    setState(s => {
      if (s.credits >= cost && !isSectorBusy(s.bootcamp)) {
        const hours = 4 * ((s.bootcamp as any)[facility] + 1); const startTime = new Date(); const finishTime = new Date(startTime.getTime() + hours * 3600000);
        result = true; const newCredits = s.credits - cost;
        newState = { ...s, credits: newCredits, bootcamp: { ...s.bootcamp, constructionStarts: { ...s.bootcamp.constructionStarts, [facility]: startTime.toISOString() }, constructionFinishes: { ...s.bootcamp.constructionFinishes, [facility]: finishTime.toISOString() } } };
        return newState;
      }
      return s;
    });
    if (user && result && newState) updateDoc(doc(db, 'players_v5', user.uid), { inGameCurrency: newState.credits, bootcamp: sanitizeForFirestore(newState.bootcamp) }).catch(e => console.error("Bootcamp failed", e));
    return result;
  }, [isSectorBusy, user, db]);

  const startAcademyConstruction = useCallback((facility: any, cost: number) => {
    let result = false; let newState: any;
    setState(s => {
      if (s.credits >= cost && !isSectorBusy(s.academy)) {
        const hours = 4 * ((s.academy as any)[facility] + 1); const startTime = new Date(); const finishTime = new Date(startTime.getTime() + hours * 3600000);
        result = true; const newCredits = s.credits - cost;
        newState = { ...s, credits: newCredits, academy: { ...s.academy, constructionStarts: { ...s.academy.constructionStarts, [facility]: startTime.toISOString() }, constructionFinishes: { ...s.academy.constructionFinishes, [facility]: finishTime.toISOString() } } };
        return newState;
      }
      return s;
    });
    if (user && result && newState) updateDoc(doc(db, 'players_v5', user.uid), { inGameCurrency: newState.credits, academy: sanitizeForFirestore(newState.academy) }).catch(e => console.error("Academy failed", e));
    return result;
  }, [isSectorBusy, user, db]);

  const startMedicalConstruction = useCallback((facility: any, cost: number) => {
    let result = false; let newState: any;
    setState(s => {
      if (s.credits >= cost && !isSectorBusy(s.medical)) {
        const hours = 4 * ((s.medical as any)[facility] + 1); const startTime = new Date(); const finishTime = new Date(startTime.getTime() + hours * 3600000);
        result = true; const newCredits = s.credits - cost;
        newState = { ...s, credits: newCredits, medical: { ...s.medical, constructionStarts: { ...s.medical.constructionStarts, [facility]: startTime.toISOString() }, constructionFinishes: { ...s.medical.constructionFinishes, [facility]: finishTime.toISOString() } } };
        return newState;
      }
      return s;
    });
    if (user && result && newState) updateDoc(doc(db, 'players_v5', user.uid), { inGameCurrency: newState.credits, medical: sanitizeForFirestore(newState.medical) }).catch(e => console.error("Medical failed", e));
    return result;
  }, [isSectorBusy, user, db]);

  const startCapacityExpansion = useCallback((seats: number, cost: number, hours: number) => {
    let result = false; let newState: any;
    setState(s => {
      if (s.credits >= cost && !isSectorBusy(s.arena)) {
        const startTime = new Date(); const finishTime = new Date(startTime.getTime() + hours * 3600000);
        result = true; const newCredits = s.credits - cost;
        newState = { ...s, credits: newCredits, arena: { ...s.arena, pendingCapacitySeats: seats, constructionStarts: { ...s.arena.constructionStarts, capacity: startTime.toISOString() }, constructionFinishes: { ...s.arena.constructionFinishes, capacity: finishTime.toISOString() } } };
        return newState;
      }
      return s;
    });
    if (user && result && newState) updateDoc(doc(db, 'players_v5', user.uid), { inGameCurrency: newState.credits, arena: sanitizeForFirestore(newState.arena) }).catch(e => console.error("Capacity failed", e));
    return result;
  }, [isSectorBusy, user, db]);

  const hireStaffMember = useCallback((member: StaffMember) => {
    let updatedStaff: any;
    setState(s => {
      updatedStaff = { ...s.staff, [member.role]: member };
      return { ...s, staff: updatedStaff, credits: s.credits - (member.salary / 2) };
    });
    if (user) updateDoc(doc(db, 'players_v5', user.uid), { staff: sanitizeForFirestore(updatedStaff), inGameCurrency: state.credits - (member.salary / 2) }).catch(e => console.error("Hire failed", e));
  }, [user, db, state.credits]);

  const trainStaffSkill = useCallback((role: StaffRole, skillKey: 'primary' | 'secondary', cost: number) => {
    let success = false; let updatedStaff: any;
    setState(s => {
      const member = s.staff[role];
      if (!member || s.crystals < cost) return s;
      const currentVal = member.skills[skillKey];
      if (currentVal >= 99) return s;
      
      const newMember = { ...member, skills: { ...member.skills, [skillKey]: currentVal + 1 } };
      updatedStaff = { ...s.staff, [role]: newMember };
      success = true;
      return { ...s, staff: updatedStaff, crystals: s.crystals - cost };
    });
    if (user && success) updateDoc(doc(db, 'players_v5', user.uid), { staff: sanitizeForFirestore(updatedStaff), crystals: state.crystals - cost }).catch(e => console.error("Train failed", e));
    return success;
  }, [user, db, state.crystals]);

  const checkConstructions = useCallback(() => {
    setState(s => {
      const nowTime = Date.now(); let hasChanges = false;
      const processSector = (sector: any) => {
        const updated = { ...sector }; const finishes = { ...(sector.constructionFinishes || {}) }; const starts = { ...(sector.constructionStarts || {}) };
        Object.entries(finishes).forEach(([id, finishTime]) => {
          if (finishTime && nowTime >= new Date(finishTime as string).getTime()) {
            if (id === 'capacity') { updated.capacity += (updated.pendingCapacitySeats || 0); updated.capacity = Number(updated.capacity); updated.pendingCapacitySeats = null; }
            else { updated[id] = Number((updated[id] || 0) + 1); }
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
    let finalLineup: any;
    setState(s => {
      const newLineup = { ...s.lineup };
      if (heroId) { Object.keys(newLineup).forEach(k => { if (newLineup[k as LineupSlot] === heroId) newLineup[k as LineupSlot] = null; }); }
      newLineup[slot] = heroId; finalLineup = newLineup;
      const uniqueHeroIds = Array.from(new Set(Object.values(newLineup).filter(id => id !== null)));
      return { ...s, lineup: newLineup, team: s.ownedHeroes.filter(h => uniqueHeroIds.includes(h.id)), isSyncing: true };
    });
    if (user && finalLineup) {
      updateDoc(doc(db, 'players_v5', user.uid), { lineup: finalLineup }).catch(e => console.error("Lineup failed", e));
      setTimeout(() => setState(prev => ({ ...prev, isSyncing: false })), 1000);
    }
  }, [user, db]);

  const updateTactics = useCallback((strategy: string, lineSettings: { carry: string; mid: string; offlane: string }) => {
    setState(s => ({ ...s, strategy, lineSettings, isSyncing: true }));
    if (user) {
      updateDoc(doc(db, 'players_v5', user.uid), { strategy, lineSettings }).catch(e => console.error("Tactics failed", e));
      setTimeout(() => setState(prev => ({ ...prev, isSyncing: false })), 1000);
    }
  }, [user, db]);

  const setTrainingFocus = useCallback((heroId: string, skillKey: string | null) => {
    let updatedOwned: Hero[] = []; let updatedYouth: Hero[] = [];
    setState(s => {
      updatedOwned = s.ownedHeroes.map(h => h.id === heroId ? { ...h, trainingFocus: skillKey } : h);
      updatedYouth = s.youthAcademyHeroes.map(h => h.id === heroId ? { ...h, trainingFocus: skillKey } : h);
      return { ...s, ownedHeroes: updatedOwned, youthAcademyHeroes: updatedYouth };
    });
    if (user) updateDoc(doc(db, 'players_v5', user.uid), { ownedHeroes: sanitizeForFirestore(updatedOwned), youthAcademyHeroes: sanitizeForFirestore(updatedYouth) }).catch(e => console.error("Focus failed", e));
  }, [user, db]);

  const startDailyHeroTraining = useCallback((heroId: string, skillKey: string) => {
    let updatedOwned: Hero[] = []; let updatedYouth: Hero[] = [];
    setState(s => {
      const finishTime = new Date(Date.now() + 24 * 3600000).toISOString();
      updatedOwned = s.ownedHeroes.map(h => h.id === heroId ? { ...h, dailyTrainingFocus: skillKey, dailyTrainingFinishTime: finishTime } : h);
      updatedYouth = s.youthAcademyHeroes.map(h => h.id === heroId ? { ...h, dailyTrainingFocus: skillKey, dailyTrainingFinishTime: finishTime } : h);
      return { ...s, ownedHeroes: updatedOwned, youthAcademyHeroes: updatedYouth };
    });
    if (user) updateDoc(doc(db, 'players_v5', user.uid), { ownedHeroes: sanitizeForFirestore(updatedOwned), youthAcademyHeroes: sanitizeForFirestore(updatedYouth) }).catch(e => console.error("Daily start failed", e));
  }, [user, db]);

  const claimDailyHeroTraining = useCallback((heroId: string) => {
    let updatedOwned: Hero[] = []; let updatedYouth: Hero[] = [];
    setState(s => {
      const processHero = (hero: Hero) => {
        if (hero.id === heroId && hero.dailyTrainingFocus) {
          const skillKey = hero.dailyTrainingFocus; const currentVal = (hero.proStats as any)[skillKey] || 0;
          const talentLimit = (hero.proTalents ? (hero.proTalents as any)[skillKey] || 3.0 : 3.0) * 20;
          if (currentVal < talentLimit) {
            const gain = Math.floor(Math.random() * (5 - 3 + 1)) + 3; const newVal = Math.min(talentLimit, currentVal + gain);
            return { ...hero, proStats: { ...hero.proStats, [skillKey]: newVal }, dailyTrainingFocus: null, dailyTrainingFinishTime: null };
          }
          return { ...hero, dailyTrainingFocus: null, dailyTrainingFinishTime: null };
        }
        return hero;
      };
      updatedOwned = s.ownedHeroes.map(processHero); updatedYouth = s.youthAcademyHeroes.map(processHero);
      return { ...s, ownedHeroes: updatedOwned, youthAcademyHeroes: updatedYouth };
    });
    if (user) updateDoc(doc(db, 'players_v5', user.uid), { ownedHeroes: sanitizeForFirestore(updatedOwned), youthAcademyHeroes: sanitizeForFirestore(updatedYouth) }).catch(e => console.error("Daily claim failed", e));
  }, [user, db]);

  const updateHero = useCallback((heroId: string, updates: Partial<Hero>, creditCost = 0, crystalCost = 0) => {
    let updatedState: any;
    setState(s => {
      if (s.credits < creditCost || s.crystals < crystalCost) return s;
      const updatedOwned = s.ownedHeroes.map(h => h.id === heroId ? { ...h, ...updates } : h);
      const updatedYouth = s.youthAcademyHeroes.map(h => h.id === heroId ? { ...h, ...updates } : h);
      updatedState = { ownedHeroes: updatedOwned, youthAcademyHeroes: updatedYouth, credits: s.credits - creditCost, crystals: s.crystals - crystalCost };
      return { ...s, ...updatedState };
    });
    if (user && updatedState) updateDoc(doc(db, 'players_v5', user.uid), { ownedHeroes: sanitizeForFirestore(updatedState.ownedHeroes), youthAcademyHeroes: sanitizeForFirestore(updatedState.youthAcademyHeroes), inGameCurrency: updatedState.credits, crystals: updatedState.crystals }).catch(e => console.error("Hero update failed", e));
  }, [user, db]);

  const promoteYouthPlayer = useCallback((heroId: string) => {
    let updatedState: any;
    setState(s => {
      const hero = s.youthAcademyHeroes.find(h => h.id === heroId);
      if (!hero) return s;
      const newAcademy = s.youthAcademyHeroes.filter(h => h.id !== heroId);
      const newOwned = [...s.ownedHeroes, hero];
      updatedState = { youthAcademyHeroes: newAcademy, ownedHeroes: newOwned };
      return { ...s, ...updatedState };
    });
    if (user && updatedState) updateDoc(doc(db, 'players_v5', user.uid), { youthAcademyHeroes: sanitizeForFirestore(updatedState.youthAcademyHeroes), ownedHeroes: sanitizeForFirestore(updatedState.ownedHeroes) }).catch(e => console.error("Promotion failed", e));
  }, [user, db]);

  const removeHero = useCallback((heroId: string, sellCreditAmount = 0) => {
    let updatedData: any;
    setState(s => {
      const updatedOwned = s.ownedHeroes.filter(h => h.id !== heroId);
      const updatedYouth = s.youthAcademyHeroes.filter(h => h.id !== heroId);
      const newLineup = { ...s.lineup };
      Object.keys(newLineup).forEach(k => { if (newLineup[k as LineupSlot] === heroId) newLineup[k as LineupSlot] = null; });
      updatedData = { ownedHeroes: updatedOwned, youthAcademyHeroes: updatedYouth, lineup: newLineup, credits: s.credits + sellCreditAmount };
      return { ...s, ...updatedData };
    });
    if (user && updatedData) updateDoc(doc(db, 'players_v5', user.uid), { ownedHeroes: sanitizeForFirestore(updatedData.ownedHeroes), youthAcademyHeroes: sanitizeForFirestore(updatedData.youthAcademyHeroes), lineup: updatedData.lineup, inGameCurrency: updatedData.credits }).catch(e => console.error("Remove failed", e));
  }, [user, db]);

  const recoverAllFatigue = useCallback((costType: 'credits' | 'crystals') => {
    let success = false; let updatedData: any;
    setState(s => {
      const creditCost = costType === 'credits' ? 75000 : 0; const crystalCost = costType === 'crystals' ? 150 : 0;
      if (s.credits < creditCost || s.crystals < crystalCost) return s;
      const updatedOwned = s.ownedHeroes.map(h => ({ ...h, fatigue: 0 }));
      const updatedYouth = s.youthAcademyHeroes.map(h => ({ ...h, fatigue: 0 }));
      success = true; updatedData = { ownedHeroes: updatedOwned, youthAcademyHeroes: updatedYouth, credits: s.credits - creditCost, crystals: s.crystals - crystalCost };
      return { ...s, ...updatedData };
    });
    if (user && success && updatedData) updateDoc(doc(db, 'players_v5', user.uid), { ownedHeroes: sanitizeForFirestore(updatedData.ownedHeroes), youthAcademyHeroes: sanitizeForFirestore(updatedData.youthAcademyHeroes), inGameCurrency: updatedData.credits, crystals: updatedData.crystals }).catch(e => console.error("Recover failed", e));
    return success;
  }, [user, db]);

  const recordMatch = useCallback((winner: string, result: any, matchDay: number, opponentName: string, type: MatchResultEntry['type'], customPlayedAt?: string, customId?: string) => {
    if (!result) return;
    const matchId = customId || `match_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    let shouldUpdateDB = false; let newState: any = null;
    setState(s => {
      const existingIdx = s.matchHistory.findIndex(m => m.id === matchId);
      if (existingIdx !== -1) {
        const existing = s.matchHistory[existingIdx];
        if (existing.preview !== undefined && result.preview !== undefined && existing.winner === winner) return s;
      }
      const scoreA = result.scoreA || 0; const scoreB = result.scoreB || 0;
      let creditsEarned = 50; let rankChange = -15;
      if (scoreA === 2 && scoreB === 0) { creditsEarned = 200; rankChange = 25; }
      else if (scoreA === 1 && scoreB === 1) { creditsEarned = 100; rankChange = 5; }
      else if (scoreA > scoreB) { creditsEarned = 150; rankChange = 10; }
      else if (scoreA === scoreB) rankChange = 0;
      const xpRange = (type === 'league' || type === 'tournament') ? { min: 2, max: 4 } : { min: 1, max: 1 };
      const applyXP = (hero: Hero) => {
        const isHeroActive = Object.values(s.lineup).includes(hero.id);
        if (isHeroActive && hero.trainingFocus) {
          const skillKey = hero.trainingFocus; const currentVal = (hero.proStats as any)[skillKey] || 0;
          const talentLimit = (hero.proTalents ? (hero.proTalents as any)[skillKey] || 3.0 : 3.0) * 20;
          if (currentVal < talentLimit) { const gain = Math.floor(Math.random() * (xpRange.max - xpRange.min + 1)) + xpRange.min; const newVal = Math.min(talentLimit, currentVal + gain); return { ...hero, proStats: { ...hero.proStats, [skillKey]: newVal } }; }
        }
        return hero;
      };
      const updatedOwned = s.ownedHeroes.map(applyXP); const updatedYouth = s.youthAcademyHeroes.map(applyXP);
      const matchEntry: MatchResultEntry = { id: matchId, day: matchDay, type, opponentName, winner, scoreA, scoreB, matchSummary: result.matchSummary || "", teamStats: sanitizeForFirestore(result.teamStats || {}), heroPerformance: sanitizeForFirestore(result.heroPerformance || []), playedAt: customPlayedAt || new Date().toISOString(), duration: result.duration || "", mvp: result.mvp || "", preview: sanitizeForFirestore(result.preview || null), timeline: sanitizeForFirestore(result.timeline || []), postMatch: sanitizeForFirestore(result.postMatch || null) };
      if (type === 'league' || type === 'tournament') matchEntry.seasonNumber = s.seasonNumber;
      let newHistory = existingIdx !== -1 ? [...s.matchHistory] : [matchEntry, ...s.matchHistory].slice(0, 100);
      if (existingIdx !== -1) newHistory[existingIdx] = matchEntry;
      const todayStr = getMoscowDateString(); shouldUpdateDB = true;
      newState = { ...s, credits: s.credits + creditsEarned, rank: s.rank + rankChange, matchHistory: newHistory, lastLeagueMatchDate: type === 'league' && matchDay === s.seasonDay ? todayStr : s.lastLeagueMatchDate, lastCupMatchDate: type === 'tournament' ? todayStr : s.lastCupMatchDate, ownedHeroes: updatedOwned, youthAcademyHeroes: updatedYouth, isSyncing: true };
      return newState;
    });
    if (user && shouldUpdateDB && newState) {
      updateDoc(doc(db, 'players_v5', user.uid), { inGameCurrency: newState.credits, rank: newState.rank, lastLeagueMatchDate: newState.lastLeagueMatchDate ?? null, lastCupMatchDate: newState.lastCupMatchDate ?? null, matchHistory: newState.matchHistory, ownedHeroes: sanitizeForFirestore(newState.ownedHeroes), youthAcademyHeroes: sanitizeForFirestore(newState.youthAcademyHeroes) }).catch(e => console.error("Match record failed", e));
      setTimeout(() => setState(prev => ({ ...prev, isSyncing: false })), 1500);
    }
  }, [user, db]);

  const markMatchAsSeen = useCallback((day: number) => {
    setState(s => {
      if (day <= s.lastSeenMatchDay) return s;
      if (user) updateDoc(doc(db, 'players_v5', user.uid), { lastSeenMatchDay: day }).catch(e => console.error("Seen failed", e));
      return { ...s, lastSeenMatchDay: day };
    });
  }, [user, db]);

  const dismissSeasonResults = useCallback(() => {
    setState(s => ({ ...s, seasonResults: null }));
    if (user) updateDoc(doc(db, 'players_v5', user.uid), { seasonResults: null }).catch(e => console.error("Dismiss failed", e));
  }, [user, db]);

  const addHeroDirectly = useCallback((hero: Hero) => {
    let updatedOwned: Hero[] = [];
    setState(s => {
      updatedOwned = [...s.ownedHeroes, hero];
      return { ...s, ownedHeroes: updatedOwned };
    });
    if (user) updateDoc(doc(db, 'players_v5', user.uid), { ownedHeroes: sanitizeForFirestore(updatedOwned) }).catch(e => console.error("Add hero failed", e));
  }, [user, db]);

  const addYouthHeroDirectly = useCallback((hero: Hero) => {
    let updatedYouth: Hero[] = [];
    setState(s => {
      updatedYouth = [...s.youthAcademyHeroes, hero];
      return { ...s, youthAcademyHeroes: updatedYouth };
    });
    if (user) updateDoc(doc(db, 'players_v5', user.uid), { youthAcademyHeroes: sanitizeForFirestore(updatedYouth) }).catch(e => console.error("Add youth hero failed", e));
  }, [user, db]);

  const updateProfileName = useCallback((newName: string) => {
    if (user) {
      updateDoc(doc(db, 'players_v5', user.uid), { displayName: newName }).catch(e => console.error("Name change failed", e));
    }
  }, [user, db]);

  const updateProfileCountry = useCallback((newCountry: string) => {
    setState(s => ({ ...s, country: newCountry }));
    if (user) {
      updateDoc(doc(db, 'players_v5', user.uid), { country: newCountry }).catch(e => console.error("Country change failed", e));
    }
  }, [user, db]);

  return (
    <GameStateContext.Provider value={{
      ...state, isLoaded, addCredits, addCrystals, assignToRole, updateTactics, startArenaConstruction, startHQConstruction, startBootcampConstruction, startAcademyConstruction, startMedicalConstruction, startCapacityExpansion, hireStaffMember, trainStaffSkill, checkConstructions, setLanguage, recordMatch, markMatchAsSeen, claimReward, syncStats, dismissSeasonResults, setSyncing, setTrainingFocus, startDailyHeroTraining, claimDailyHeroTraining, updateHero, promoteYouthPlayer, removeHero, recoverAllFatigue, addHeroDirectly, addYouthHeroDirectly, updateProfileName, updateProfileCountry
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
