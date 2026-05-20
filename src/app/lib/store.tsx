'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode, useRef } from 'react';
import { Hero, INITIAL_HEROES, generateYouthHero, StaffMember, StaffRole } from './moba-data';
import { getMoscowTime, getMoscowDateString, isMatchDue, getGlobalSeasonInfo } from './time-utils';
import { useUser, useFirestore, updateDocumentNonBlocking, setDocumentNonBlocking } from '@/firebase';
import { doc, onSnapshot, updateDoc, arrayUnion } from 'firebase/firestore';
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
          const cloudYouth = profileData.youthAcademyHeroes || s.youthAcademyHeroes;

          return {
            ...s,
            credits: profileData.inGameCurrency ?? s.credits ?? 0,
            crystals: profileData.crystals ?? s.crystals ?? 0,
            ownedHeroes: cloudHeroes,
            youthAcademyHeroes: cloudYouth,
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
      console.warn("Profile listener error", error);
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
        
        // Side effect outside of state cycle
        setTimeout(() => {
          updateDoc(doc(db, 'players_v5', user.uid), {
            youthAcademyHeroes: sanitizeForFirestore(updatedAcademy),
            lastYouthArrivalDay: seasonDay,
            lastYouthArrivalSeason: seasonNumber
          }).catch(e => console.error("Youth check update failed", e));
        }, 0);
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
      const lastSeasonTeams = getMockGroupTeams(state.rank, state.country || "My Team", state.leagueLevel, state.divisionSubId, state.groupId, state.selectedLeagueId, groupPlayers, user.uid, 14);
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
      
      setTimeout(() => {
        updateDoc(doc(db, 'players_v5', user.uid), { 
          leagueLevel: newLevel, 
          wins: 0, draws: 0, losses: 0, points: 0, 
          lastProcessedSeason: globalSeason, 
          lastLeagueMatchDate: null, 
          lastCupMatchDate: null, 
          lastSeenMatchDay: 0, 
          seasonResults: results, 
          hasEliteTrophy: awardedTrophy || state.hasEliteTrophy 
        }).catch(e => console.error("Season sync failed", e));
      }, 0);
      return; 
    }

    if (globalDay > 14) return;
    const groupTeams = getMockGroupTeams(state.rank, state.country || "My Team", state.leagueLevel, state.divisionSubId, state.groupId, state.selectedLeagueId, groupPlayers, user.uid, completedDays);
    const myTeam = groupTeams.find(t => t.id === user.uid);
    const myDocInSnapshot = groupPlayers.find(p => p.id === user.uid);
    if (!myTeam || !myDocInSnapshot) return;

    if (Number(myDocInSnapshot.wins) !== Number(myTeam.wins) || Number(myDocInSnapshot.points) !== Number(myTeam.points) || state.lastProcessedSeason !== globalSeason) {
      lastSyncRef.current = { season: globalSeason, day: completedDays, leagueId: state.selectedLeagueId };
      setTimeout(() => {
        updateDoc(doc(db, 'players_v5', user.uid), { 
          wins: Number(myTeam.wins || 0), 
          draws: Number(myTeam.draws || 0), 
          losses: Number(myTeam.losses || 0), 
          points: Number(myTeam.points || 0), 
          lastProcessedSeason: globalSeason 
        }).catch(e => console.error("Daily stats sync failed", e));
      }, 0);
    }
  }, [state.selectedLeagueId, state.seasonDay, state.lastLeagueMatchDate, state.rank, state.leagueLevel, state.divisionSubId, state.groupId, state.lastProcessedSeason, state.hasEliteTrophy, state.country, user, db]);

  const addCredits = useCallback((amount: number) => {
    setState(s => {
      const newVal = s.credits + amount;
      setTimeout(() => {
        if (user) updateDoc(doc(db, 'players_v5', user.uid), { inGameCurrency: newVal }).catch(e => console.error("Add credits failed", e));
      }, 0);
      return { ...s, credits: newVal };
    });
  }, [user, db]);

  const addCrystals = useCallback((amount: number) => {
    setState(s => {
      const newVal = s.crystals + amount;
      setTimeout(() => {
        if (user) updateDoc(doc(db, 'players_v5', user.uid), { crystals: newVal }).catch(e => console.error("Add crystals failed", e));
      }, 0);
      return { ...s, crystals: newVal };
    });
  }, [user, db]);

  const claimReward = useCallback((creditsReward: number, crystalsReward: number) => {
    const today = getMoscowDateString();
    setState(s => {
      if (s.lastRewardClaimDate === today) return s;
      const newCredits = s.credits + creditsReward; 
      const newCrystals = s.crystals + crystalsReward;
      const nextRewardDay = s.rewardDay >= 30 ? 1 : s.rewardDay + 1;
      
      setTimeout(() => {
        if (user) updateDoc(doc(db, 'players_v5', user.uid), { 
          inGameCurrency: newCredits, 
          crystals: newCrystals, 
          lastRewardClaimDate: today, 
          rewardDay: nextRewardDay 
        }).catch(e => console.error("Claim reward sync failed", e));
      }, 0);
      
      return { ...s, credits: newCredits, crystals: newCrystals, lastRewardClaimDate: today, rewardDay: nextRewardDay };
    });
  }, [user, db]);

  const startArenaConstruction = useCallback((facility: any, cost: number) => {
    let result = false;
    setState(s => {
      if (s.credits >= cost) {
        const hours = 4 * ((s.arena as any)[facility] + 1); const startTime = new Date(); const finishTime = new Date(startTime.getTime() + hours * 3600000);
        result = true; const newCredits = s.credits - cost;
        const newArena = { ...s.arena, constructionStarts: { ...s.arena.constructionStarts, [facility]: startTime.toISOString() }, constructionFinishes: { ...s.arena.constructionFinishes, [facility]: finishTime.toISOString() } };
        setTimeout(() => {
          if (user) updateDoc(doc(db, 'players_v5', user.uid), { inGameCurrency: newCredits, arena: sanitizeForFirestore(newArena) }).catch(e => console.error("Arena construction failed", e));
        }, 0);
        return { ...s, credits: newCredits, arena: newArena };
      }
      return s;
    });
    return result;
  }, [user, db]);

  const startHQConstruction = useCallback((facility: any, cost: number) => {
    let result = false;
    setState(s => {
      if (s.credits >= cost) {
        const hours = 4 * ((s.hq as any)[facility] + 1); const startTime = new Date(); const finishTime = new Date(startTime.getTime() + hours * 3600000);
        result = true; const newCredits = s.credits - cost;
        const newHQ = { ...s.hq, constructionStarts: { ...s.hq.constructionStarts, [facility]: startTime.toISOString() }, constructionFinishes: { ...s.hq.constructionFinishes, [facility]: finishTime.toISOString() } };
        setTimeout(() => {
          if (user) updateDoc(doc(db, 'players_v5', user.uid), { inGameCurrency: newCredits, hq: sanitizeForFirestore(newHQ) }).catch(e => console.error("HQ construction failed", e));
        }, 0);
        return { ...s, credits: newCredits, hq: newHQ };
      }
      return s;
    });
    return result;
  }, [user, db]);

  const startBootcampConstruction = useCallback((facility: any, cost: number) => {
    let result = false;
    setState(s => {
      if (s.credits >= cost) {
        const hours = 4 * ((s.bootcamp as any)[facility] + 1); const startTime = new Date(); const finishTime = new Date(startTime.getTime() + hours * 3600000);
        result = true; const newCredits = s.credits - cost;
        const newBootcamp = { ...s.bootcamp, constructionStarts: { ...s.bootcamp.constructionStarts, [facility]: startTime.toISOString() }, constructionFinishes: { ...s.bootcamp.constructionFinishes, [facility]: finishTime.toISOString() } };
        setTimeout(() => {
          if (user) updateDoc(doc(db, 'players_v5', user.uid), { inGameCurrency: newCredits, bootcamp: sanitizeForFirestore(newBootcamp) }).catch(e => console.error("Bootcamp construction failed", e));
        }, 0);
        return { ...s, credits: newCredits, bootcamp: newBootcamp };
      }
      return s;
    });
    return result;
  }, [user, db]);

  const startAcademyConstruction = useCallback((facility: any, cost: number) => {
    let result = false;
    setState(s => {
      if (s.credits >= cost) {
        const hours = 4 * ((s.academy as any)[facility] + 1); const startTime = new Date(); const finishTime = new Date(startTime.getTime() + hours * 3600000);
        result = true; const newCredits = s.credits - cost;
        const newAcademy = { ...s.academy, constructionStarts: { ...s.academy.constructionStarts, [facility]: startTime.toISOString() }, constructionFinishes: { ...s.academy.constructionFinishes, [facility]: finishTime.toISOString() } };
        setTimeout(() => {
          if (user) updateDoc(doc(db, 'players_v5', user.uid), { inGameCurrency: newCredits, academy: sanitizeForFirestore(newAcademy) }).catch(e => console.error("Academy construction failed", e));
        }, 0);
        return { ...s, credits: newCredits, academy: newAcademy };
      }
      return s;
    });
    return result;
  }, [user, db]);

  const startMedicalConstruction = useCallback((facility: any, cost: number) => {
    let result = false;
    setState(s => {
      if (s.credits >= cost) {
        const hours = 4 * ((s.medical as any)[facility] + 1); const startTime = new Date(); const finishTime = new Date(startTime.getTime() + hours * 3600000);
        result = true; const newCredits = s.credits - cost;
        const newMedical = { ...s.medical, constructionStarts: { ...s.medical.constructionStarts, [facility]: startTime.toISOString() }, constructionFinishes: { ...s.medical.constructionFinishes, [facility]: finishTime.toISOString() } };
        setTimeout(() => {
          if (user) updateDoc(doc(db, 'players_v5', user.uid), { inGameCurrency: newCredits, medical: sanitizeForFirestore(newMedical) }).catch(e => console.error("Medical construction failed", e));
        }, 0);
        return { ...s, credits: newCredits, medical: newMedical };
      }
      return s;
    });
    return result;
  }, [user, db]);

  const startCapacityExpansion = useCallback((seats: number, cost: number, hours: number) => {
    let result = false;
    setState(s => {
      if (s.credits >= cost) {
        const startTime = new Date(); const finishTime = new Date(startTime.getTime() + hours * 3600000);
        result = true; const newCredits = s.credits - cost;
        const newArena = { ...s.arena, pendingCapacitySeats: seats, constructionStarts: { ...s.arena.constructionStarts, capacity: startTime.toISOString() }, constructionFinishes: { ...s.arena.constructionFinishes, capacity: finishTime.toISOString() } };
        setTimeout(() => {
          if (user) updateDoc(doc(db, 'players_v5', user.uid), { inGameCurrency: newCredits, arena: sanitizeForFirestore(newArena) }).catch(e => console.error("Capacity expansion sync failed", e));
        }, 0);
        return { ...s, credits: newCredits, arena: newArena };
      }
      return s;
    });
    return result;
  }, [user, db]);

  const hireStaffMember = useCallback((member: StaffMember) => {
    setState(s => {
      const updatedStaff = { ...s.staff, [member.role]: member };
      const newCredits = s.credits - (member.salary / 2);
      setTimeout(() => {
        if (user) updateDoc(doc(db, 'players_v5', user.uid), { staff: sanitizeForFirestore(updatedStaff), inGameCurrency: newCredits }).catch(e => console.error("Hire staff failed", e));
      }, 0);
      return { ...s, staff: updatedStaff, credits: newCredits };
    });
  }, [user, db]);

  const trainStaffSkill = useCallback((role: StaffRole, skillKey: 'primary' | 'secondary', cost: number) => {
    let success = false;
    setState(s => {
      const member = s.staff[role];
      if (!member || s.crystals < cost) return s;
      const currentVal = member.skills[skillKey];
      if (currentVal >= 99) return s;
      
      const newMember = { ...member, skills: { ...member.skills, [skillKey]: currentVal + 1 } };
      const updatedStaff = { ...s.staff, [role]: newMember };
      const newCrystals = s.crystals - cost;
      success = true;
      setTimeout(() => {
        if (user) updateDoc(doc(db, 'players_v5', user.uid), { staff: sanitizeForFirestore(updatedStaff), crystals: newCrystals }).catch(e => console.error("Train staff failed", e));
      }, 0);
      return { ...s, staff: updatedStaff, crystals: newCrystals };
    });
    return success;
  }, [user, db]);

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
      const newState = { ...s, arena: processSector(s.arena), hq: processSector(s.hq), bootcamp: processSector(s.bootcamp), academy: processSector(s.academy), medical: processSector(s.medical) };
      setTimeout(() => {
        if (user) {
          updateDoc(doc(db, 'players_v5', user.uid), {
            arena: sanitizeForFirestore(newState.arena),
            hq: sanitizeForFirestore(newState.hq),
            bootcamp: sanitizeForFirestore(newState.bootcamp),
            academy: sanitizeForFirestore(newState.academy),
            medical: sanitizeForFirestore(newState.medical)
          }).catch(e => console.warn("Construction auto-claim cloud sync failed", e));
        }
      }, 0);
      return newState;
    });
  }, [user, db]);

  const setLanguage = useCallback((lang: 'en' | 'ru') => setState(s => ({ ...s, language: lang })), []);
  
  const assignToRole = useCallback((slot: LineupSlot, heroId: string | null) => {
    setState(s => {
      const newLineup = { ...s.lineup };
      if (heroId) { Object.keys(newLineup).forEach(k => { if (newLineup[k as LineupSlot] === heroId) newLineup[k as LineupSlot] = null; }); }
      newLineup[slot] = heroId; 
      setTimeout(() => {
        if (user) updateDoc(doc(db, 'players_v5', user.uid), { lineup: newLineup }).catch(e => console.error("Lineup update failed", e));
      }, 0);
      const uniqueHeroIds = Array.from(new Set(Object.values(newLineup).filter(id => id !== null)));
      return { ...s, lineup: newLineup, team: s.ownedHeroes.filter(h => uniqueHeroIds.includes(h.id)), isSyncing: false };
    });
  }, [user, db]);

  const updateTactics = useCallback((strategy: string, lineSettings: { carry: string; mid: string; offlane: string }) => {
    setState(s => {
      setTimeout(() => {
        if (user) updateDoc(doc(db, 'players_v5', user.uid), { strategy, lineSettings }).catch(e => console.error("Tactics sync failed", e));
      }, 0);
      return { ...s, strategy, lineSettings, isSyncing: false };
    });
  }, [user, db]);

  const setTrainingFocus = useCallback((heroId: string, skillKey: string | null) => {
    setState(s => {
      const updatedOwned = s.ownedHeroes.map(h => h.id === heroId ? { ...h, trainingFocus: skillKey } : h);
      const updatedYouth = s.youthAcademyHeroes.map(h => h.id === heroId ? { ...h, trainingFocus: skillKey } : h);
      setTimeout(() => {
        if (user) updateDoc(doc(db, 'players_v5', user.uid), { 
          ownedHeroes: sanitizeForFirestore(updatedOwned), 
          youthAcademyHeroes: sanitizeForFirestore(updatedYouth) 
        }).catch(e => console.error("Training focus sync failed", e));
      }, 0);
      return { ...s, ownedHeroes: updatedOwned, youthAcademyHeroes: updatedYouth };
    });
  }, [user, db]);

  const startDailyHeroTraining = useCallback((heroId: string, skillKey: string) => {
    setState(s => {
      const finishTime = new Date(Date.now() + 24 * 3600000).toISOString();
      const updatedOwned = s.ownedHeroes.map(h => h.id === heroId ? { ...h, dailyTrainingFocus: skillKey, dailyTrainingFinishTime: finishTime } : h);
      const updatedYouth = s.youthAcademyHeroes.map(h => h.id === heroId ? { ...h, dailyTrainingFocus: skillKey, dailyTrainingFinishTime: finishTime } : h);
      setTimeout(() => {
        if (user) updateDoc(doc(db, 'players_v5', user.uid), { 
          ownedHeroes: sanitizeForFirestore(updatedOwned), 
          youthAcademyHeroes: sanitizeForFirestore(updatedYouth) 
        }).catch(e => console.error("Start daily training sync failed", e));
      }, 0);
      return { ...s, ownedHeroes: updatedOwned, youthAcademyHeroes: updatedYouth };
    });
  }, [user, db]);

  const claimDailyHeroTraining = useCallback((heroId: string) => {
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
      const updatedOwned = s.ownedHeroes.map(processHero); 
      const updatedYouth = s.youthAcademyHeroes.map(processHero);
      setTimeout(() => {
        if (user) updateDoc(doc(db, 'players_v5', user.uid), { 
          ownedHeroes: sanitizeForFirestore(updatedOwned), 
          youthAcademyHeroes: sanitizeForFirestore(updatedYouth) 
        }).catch(e => console.error("Claim training sync failed", e));
      }, 0);
      return { ...s, ownedHeroes: updatedOwned, youthAcademyHeroes: updatedYouth };
    });
  }, [user, db]);

  const updateHero = useCallback((heroId: string, updates: Partial<Hero>, creditCost = 0, crystalCost = 0) => {
    setState(s => {
      if (s.credits < creditCost || s.crystals < crystalCost) return s;
      const updatedOwned = s.ownedHeroes.map(h => h.id === heroId ? { ...h, ...updates } : h);
      const updatedYouth = s.youthAcademyHeroes.map(h => h.id === heroId ? { ...h, ...updates } : h);
      const newCredits = s.credits - creditCost;
      const newCrystals = s.crystals - crystalCost;
      setTimeout(() => {
        if (user) updateDoc(doc(db, 'players_v5', user.uid), { 
          ownedHeroes: sanitizeForFirestore(updatedOwned), 
          youthAcademyHeroes: sanitizeForFirestore(updatedYouth), 
          inGameCurrency: newCredits, 
          crystals: newCrystals 
        }).catch(e => console.error("Update hero sync failed", e));
      }, 0);
      return { ...s, ownedHeroes: updatedOwned, youthAcademyHeroes: updatedYouth, credits: newCredits, crystals: newCrystals };
    });
  }, [user, db]);

  const promoteYouthPlayer = useCallback((heroId: string) => {
    setState(s => {
      const hero = s.youthAcademyHeroes.find(h => h.id === heroId);
      if (!hero) return s;
      const newAcademy = s.youthAcademyHeroes.filter(h => h.id !== heroId);
      const newOwned = [...s.ownedHeroes, hero];
      setTimeout(() => {
        if (user) updateDoc(doc(db, 'players_v5', user.uid), { 
          youthAcademyHeroes: sanitizeForFirestore(newAcademy), 
          ownedHeroes: sanitizeForFirestore(newOwned) 
        }).catch(e => console.error("Promote player sync failed", e));
      }, 0);
      return { ...s, youthAcademyHeroes: newAcademy, ownedHeroes: newOwned };
    });
  }, [user, db]);

  const removeHero = useCallback((heroId: string, sellCreditAmount = 0) => {
    setState(s => {
      const updatedOwned = s.ownedHeroes.filter(h => h.id !== heroId);
      const updatedYouth = s.youthAcademyHeroes.filter(h => h.id !== heroId);
      const newLineup = { ...s.lineup };
      Object.keys(newLineup).forEach(k => { if (newLineup[k as LineupSlot] === heroId) newLineup[k as LineupSlot] = null; });
      const newCredits = s.credits + sellCreditAmount;
      setTimeout(() => {
        if (user) updateDoc(doc(db, 'players_v5', user.uid), { 
          ownedHeroes: sanitizeForFirestore(updatedOwned), 
          youthAcademyHeroes: sanitizeForFirestore(updatedYouth), 
          lineup: newLineup, 
          inGameCurrency: newCredits 
        }).catch(e => console.error("Remove hero sync failed", e));
      }, 0);
      return { ...s, ownedHeroes: updatedOwned, youthAcademyHeroes: updatedYouth, lineup: newLineup, credits: newCredits };
    });
  }, [user, db]);

  const recoverAllFatigue = useCallback((costType: 'credits' | 'crystals') => {
    let success = false;
    setState(s => {
      const creditCost = costType === 'credits' ? 75000 : 0; const crystalCost = costType === 'crystals' ? 150 : 0;
      if (s.credits < creditCost || s.crystals < crystalCost) return s;
      const updatedOwned = s.ownedHeroes.map(h => ({ ...h, fatigue: 0 }));
      const updatedYouth = s.youthAcademyHeroes.map(h => ({ ...h, fatigue: 0 }));
      const newCredits = s.credits - creditCost;
      const newCrystals = s.crystals - crystalCost;
      success = true;
      setTimeout(() => {
        if (user) updateDoc(doc(db, 'players_v5', user.uid), { 
          ownedHeroes: sanitizeForFirestore(updatedOwned), 
          youthAcademyHeroes: sanitizeForFirestore(updatedYouth), 
          inGameCurrency: newCredits, 
          crystals: newCrystals 
        }).catch(e => console.error("Mass recover sync failed", e));
      }, 0);
      return { ...s, ownedHeroes: updatedOwned, youthAcademyHeroes: updatedYouth, credits: newCredits, crystals: newCrystals };
    });
    return success;
  }, [user, db]);

  const recordMatch = useCallback((winner: string, result: any, matchDay: number, opponentName: string, type: MatchResultEntry['type'], customPlayedAt?: string, customId?: string) => {
    if (!result) return;
    const matchId = customId || `match_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
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
      const todayStr = getMoscowDateString(); 
      const newCredits = s.credits + creditsEarned;
      const newRank = s.rank + rankChange;
      const newLastLeagueDate = type === 'league' && matchDay === s.seasonDay ? todayStr : s.lastLeagueMatchDate;
      const newLastCupDate = type === 'tournament' ? todayStr : s.lastCupMatchDate;

      setTimeout(() => {
        if (user) {
          updateDoc(doc(db, 'players_v5', user.uid), { 
            inGameCurrency: newCredits, 
            rank: newRank, 
            lastLeagueMatchDate: newLastLeagueDate ?? null, 
            lastCupMatchDate: newLastCupDate ?? null, 
            matchHistory: newHistory, 
            ownedHeroes: sanitizeForFirestore(updatedOwned), 
            youthAcademyHeroes: sanitizeForFirestore(updatedYouth) 
          }).catch(e => console.error("Record match sync failed", e));
        }
      }, 0);
      
      return { ...s, credits: newCredits, rank: newRank, matchHistory: newHistory, lastLeagueMatchDate: newLastLeagueDate, lastCupMatchDate: newLastCupDate, ownedHeroes: updatedOwned, youthAcademyHeroes: updatedYouth, isSyncing: false };
    });
  }, [user, db]);

  const markMatchAsSeen = useCallback((day: number) => {
    setState(s => {
      if (day <= s.lastSeenMatchDay) return s;
      setTimeout(() => {
        if (user) updateDoc(doc(db, 'players_v5', user.uid), { lastSeenMatchDay: day }).catch(e => console.error("Mark as seen failed", e));
      }, 0);
      return { ...s, lastSeenMatchDay: day };
    });
  }, [user, db]);

  const dismissSeasonResults = useCallback(() => {
    setState(s => {
      setTimeout(() => {
        if (user) updateDoc(doc(db, 'players_v5', user.uid), { seasonResults: null }).catch(e => console.error("Dismiss results failed", e));
      }, 0);
      return { ...s, seasonResults: null };
    });
  }, [user, db]);

  const addHeroDirectly = useCallback((hero: Hero) => {
    if (!user) return;
    updateDoc(doc(db, 'players_v5', user.uid), {
      ownedHeroes: arrayUnion(sanitizeForFirestore(hero))
    }).catch(e => console.error("Cloud direct add failed", e));
  }, [user, db]);

  const addYouthHeroDirectly = useCallback((hero: Hero) => {
    if (!user) return;
    updateDoc(doc(db, 'players_v5', user.uid), {
      youthAcademyHeroes: arrayUnion(sanitizeForFirestore(hero))
    }).catch(e => console.error("Cloud youth direct add failed", e));
  }, [user, db]);

  const updateProfileName = useCallback((newName: string) => {
    setState(s => {
      setTimeout(() => {
        if (user) updateDoc(doc(db, 'players_v5', user.uid), { displayName: newName }).catch(e => console.error("Profile name sync failed", e));
      }, 0);
      return s;
    });
  }, [user, db]);

  const updateProfileCountry = useCallback((newCountry: string) => {
    setState(s => {
      setTimeout(() => {
        if (user) updateDoc(doc(db, 'players_v5', user.uid), { country: newCountry }).catch(e => console.error("Profile country sync failed", e));
      }, 0);
      return { ...s, country: newCountry };
    });
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
