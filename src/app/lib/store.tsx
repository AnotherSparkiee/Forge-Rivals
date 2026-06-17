'use client';

/**
 * @fileOverview Global Game State Store & Sync Core.
 * Centralizes all club data and manages real-time Firestore synchronization with Memory-Locking.
 */

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode, useRef, useMemo } from 'react';
import { Hero, StaffMember, StaffRole } from './moba-data';
import { getMoscowTime, getGlobalSeasonInfo, getMoscowDateString, getSeasonDateLabel } from './time-utils';
import { useUser, useFirestore, useMemoFirebase } from '@/firebase';
import { doc, onSnapshot, collection, setDoc, deleteDoc, writeBatch, query, where, serverTimestamp, arrayUnion, orderBy } from 'firebase/firestore';

export type LineupSlot = 'carry' | 'mid' | 'offlane' | 'support' | 'full_support' | 'sub1' | 'sub2' | 'res1' | 'res2' | 'res3' | 'res4' | 'res5' | 'res6' | 'res7' | 'res8';

// Универсальная проверка завершения матча (Total Bypass Logic)
export const checkIsMatchFinished = (match: any) => {
  if (!match) return false;
  return (
    match.status === 'finished' || 
    match.matchStatus === 'finished' || 
    match.state === 'finished' ||
    match.isFinished === true || 
    match.isCompleted === true ||
    (match.scoreA !== undefined && match.scoreB !== undefined && match.status !== 'pending') ||
    (match.homeScore !== undefined && match.awayScore !== undefined)
  );
};

interface GameState {
  credits: number; 
  crystals: number; 
  experiencePoints: number; 
  managerLevel: number;
  leagueLevel: number; 
  groupId: number; 
  selectedLeagueId: string | null;
  displayName: string; 
  id: string; 
  isLoaded: boolean;
  
  lineup: Record<LineupSlot, string | null>;
  ownedHeroes: Hero[];
  youthAcademyHeroes: Hero[];
  staff: Record<StaffRole, StaffMember | null>;
  strategy: string;
  lineSettings: any;
  rewardDay: number;
  lastRewardClaimDate: string | null;
  matchHistory: any[];
  lastSeenMatchDay: number;
  managerSkills: { sponsors: number; agents: number; training: number; medical: number };
  arena: any;
  hq: any;
  bootcamp: any;
  academy: any;
  medical: any;
  country: string | null;
  isPremium: boolean;
  premiumUntil: string | null;
  activeSeasonNumber: number;
  activeLicenseTier: number | null;
  rank: number;
  seasonDay: number;
  seasonNumber: number;
  isSyncing: boolean;
  language: string;
  skillPoints: number;

  // SYNC CORE DATA
  isDataReady: boolean;
  allSeasonMatches: any[];
  nextMatch: any | null;
  isMatchesLoading: boolean;

  // Actions
  addCrystals: (amount: number) => void;
  addCredits: (amount: number) => void;
  updateHero: (id: string, data: Partial<Hero>, costCredits?: number, costCrystals?: number) => void;
  removeHero: (id: string, refund: number) => void;
  assignToRole: (role: LineupSlot, heroId: string | null) => void;
  updateTactics: (strategy: string, lineSettings: any) => void;
  claimReward: (credits: number, crystals: number) => void;
  setLanguage: (lang: string) => void;
  purchaseLicense: (tier: number, cost: number) => boolean;
  purchasePremium: () => boolean;
  syncStats: (groupPlayers: any[]) => void;
  setTrainingFocus: (heroId: string, focus: string | null) => void;
  startDailyHeroTraining: (heroId: string, focus: string) => void;
  claimDailyHeroTraining: (heroId: string) => void;
  recoverAllFatigue: (type: 'credits' | 'crystals') => boolean;
  hireStaffMember: (member: StaffMember) => void;
  trainStaffSkill: (role: StaffRole, skillKey: 'primary' | 'secondary', cost: number) => boolean;
  addHeroDirectly: (hero: Hero) => void;
  addYouthHeroDirectly: (hero: Hero) => void;
  promoteYouthPlayer: (heroId: string) => void;
  updateProfileName: (name: string) => void;
  updateProfileCountry: (country: string) => void;
  recordMatch: (winner: string, result: any, reward: number, opponentName: string, type: string, playedAt: string, matchId?: string) => void;
  markMatchAsSeen: (day: number) => void;
  markMatchIdAsSeen: (id: string) => void;
  upgradeManagerSkill: (skillKey: keyof GameState['managerSkills']) => void;

  startArenaConstruction: (id: string, cost: number) => boolean;
  startHQConstruction: (id: string, cost: number) => boolean;
  startBootcampConstruction: (id: string, cost: number) => boolean;
  startAcademyConstruction: (id: string, cost: number) => boolean;
  startMedicalConstruction: (id: string, cost: number) => boolean;
  startCapacityExpansion: (seats: number, cost: number) => boolean;
  accelerateConstruction: (type: string, id: string, multiplier: number, price: number) => boolean;
  checkConstructions: () => void;
}

export function getLevelThreshold(lvl: number) {
  return (lvl * 1000) + (lvl * lvl * 500);
}

const DEFAULT_STATE: GameState = {
  credits: 0, crystals: 0, experiencePoints: 0, managerLevel: 1,
  leagueLevel: 9, groupId: 1, selectedLeagueId: null,
  displayName: 'Manager', id: '', isLoaded: false, 
  lineup: { carry: null, mid: null, offlane: null, support: null, full_support: null, sub1: null, sub2: null, res1: null, res2: null, res3: null, res4: null, res5: null, res6: null, res7: null, res8: null },
  ownedHeroes: [], youthAcademyHeroes: [],
  staff: { coach: null, analyst: null, scout: null, doctor: null, financier: null },
  strategy: 'Balanced Play', lineSettings: { carry: 'standard', mid: 'standard', offlane: 'standard' },
  rewardDay: 1, lastRewardClaimDate: null, matchHistory: [], lastSeenMatchDay: 0,
  managerSkills: { sponsors: 0, agents: 0, training: 0, medical: 0 },
  skillPoints: 0, arena: { capacity: 5000 }, hq: {}, bootcamp: {}, academy: {}, medical: {},
  country: null, isPremium: false, premiumUntil: null, activeSeasonNumber: 1, activeLicenseTier: null,
  rank: 8, seasonDay: 1, seasonNumber: 1, isSyncing: false, language: 'ru',
  isDataReady: false, allSeasonMatches: [], nextMatch: null, isMatchesLoading: true,
  addCrystals: () => {}, addCredits: () => {}, updateHero: () => {}, removeHero: () => {}, assignToRole: () => {}, updateTactics: () => {},
  claimReward: () => {}, setLanguage: () => {}, purchaseLicense: () => false, purchasePremium: () => false,
  syncStats: () => {}, setTrainingFocus: () => {}, startDailyHeroTraining: () => {}, claimDailyHeroTraining: () => {},
  recoverAllFatigue: () => false, hireStaffMember: () => {}, trainStaffSkill: () => false,
  addHeroDirectly: () => {}, addYouthHeroDirectly: () => {}, promoteYouthPlayer: () => {},
  updateProfileName: () => {}, updateProfileCountry: () => {}, recordMatch: () => {},
  markMatchAsSeen: () => {}, markMatchIdAsSeen: () => {}, upgradeManagerSkill: () => {},
  startArenaConstruction: () => false, startHQConstruction: () => false, startBootcampConstruction: () => false,
  startAcademyConstruction: () => false, startMedicalConstruction: () => false, startCapacityExpansion: () => false,
  accelerateConstruction: () => false, checkConstructions: () => {}
};

const GameStateContext = createContext<GameState | undefined>(undefined);

export function GameStateProvider({ children }: { children: ReactNode }) {
  const { user, isUserLoading } = useUser();
  const db = useFirestore();
  const [state, setState] = useState<GameState>(DEFAULT_STATE);
  const [isMatchesReady, setIsMatchesReady] = useState(false);
  const [allMatches, setAllMatches] = useState<any[]>([]);
  
  const stateRef = useRef(state);
  const memoryCache = useRef({
    hasDataEverLoaded: false,
    lastValidMatches: [] as any[],
    lastUserId: null as string | null,
    lastLeagueId: null as string | null
  });

  useEffect(() => { stateRef.current = state; }, [state]);

  // 1. ROOT PROFILE LISTENER
  useEffect(() => {
    if (isUserLoading || !user) {
      if (!isUserLoading) {
        setState(s => ({ ...DEFAULT_STATE, isLoaded: true, language: s.language }));
        memoryCache.current.hasDataEverLoaded = false;
        memoryCache.current.lastValidMatches = [];
      }
      return;
    }

    const rootRef = doc(db, 'players_v10', user.uid);
    const unsubscribe = onSnapshot(rootRef, (snap) => {
      if (!snap.exists()) {
        setState(s => ({ ...s, id: user.uid, isLoaded: true }));
        return;
      }
      const data = snap.data();
      setState(s => ({
        ...s,
        id: user.uid,
        displayName: data.displayName || "Manager",
        selectedLeagueId: data.selectedLeagueId || null,
        leagueLevel: data.leagueLevel || 9,
        groupId: data.groupId || 1,
        country: data.country || null,
        isLoaded: true
      }));
    }, (err) => {
      setState(s => ({ ...s, isLoaded: true }));
    });

    return () => unsubscribe();
  }, [user, isUserLoading, db]);

  // 2. TEAM DATA LISTENER
  useEffect(() => {
    const s = state;
    if (!s.id || !s.selectedLeagueId) return;

    const seasonInfo = getGlobalSeasonInfo();
    const seasonId = `season_${seasonInfo.activeSeasonNumber}`;
    const prefixedGroupId = `${seasonId}_league_${s.selectedLeagueId}_group_${s.groupId}`;
    
    const teamRef = doc(db, 'leagues_v2', s.selectedLeagueId, 'divisions', String(s.leagueLevel), 'groups', prefixedGroupId, 'teams', s.id);

    const unsubTeam = onSnapshot(teamRef, (snap) => {
      if (!snap.exists()) return;
      const d = snap.data();
      setState(prev => ({
        ...prev,
        credits: Number(d.credits || 0),
        crystals: Number(d.crystals || 0),
        experiencePoints: d.experiencePoints ?? 0,
        managerLevel: d.managerLevel ?? 1,
        skillPoints: d.skillPoints ?? 0,
        lineup: d.lineup || prev.lineup,
        strategy: d.strategy || 'Balanced Play',
        lineSettings: d.lineSettings || prev.lineSettings,
        rewardDay: d.rewardDay ?? 1,
        lastRewardClaimDate: d.lastRewardClaimDate ?? null,
        matchHistory: d.matchHistory ?? [],
        lastSeenMatchDay: d.lastSeenMatchDay ?? 0,
        managerSkills: d.managerSkills ?? { sponsors: 0, agents: 0, training: 0, medical: 0 },
        arena: d.arena ?? { capacity: 5000 },
        hq: d.hq ?? {},
        bootcamp: d.bootcamp ?? {},
        academy: d.academy ?? {},
        medical: d.medical ?? {},
        activeLicenseTier: d.activeLicenseTier ?? 4,
        premiumUntil: d.premiumUntil ?? null,
        isPremium: d.premiumUntil ? new Date(d.premiumUntil) > new Date() : false,
        rank: d.rank ?? 8
      }));
    });

    const heroesUnsub = onSnapshot(collection(teamRef, 'heroes'), (hSnap) => {
      const all = hSnap.docs.map(d => ({ ...d.data(), id: d.id } as Hero));
      setState(prev => ({
        ...prev,
        ownedHeroes: all.filter(h => !h.isYouth),
        youthAcademyHeroes: all.filter(h => h.isYouth)
      }));
    });

    const staffUnsub = onSnapshot(collection(teamRef, 'staff'), (sSnap) => {
      const staffObj: any = {};
      sSnap.docs.forEach(d => { const m = d.data() as StaffMember; staffObj[m.role] = m; });
      setState(prev => ({ ...prev, staff: staffObj }));
    });

    return () => {
      unsubTeam();
      heroesUnsub();
      staffUnsub();
    };
  }, [db, state.id, state.selectedLeagueId, state.leagueLevel, state.groupId]);

  // 3. MATCHES SYNC CORE - MEMORY LOCKED & DEDUPLICATED
  useEffect(() => {
    const s = state;
    if (!s.isLoaded || !s.id) return;

    const seasonInfo = getGlobalSeasonInfo();
    const seasonId = `season_${seasonInfo.activeSeasonNumber}`;

    if (memoryCache.current.lastUserId !== s.id || memoryCache.current.lastLeagueId !== s.selectedLeagueId) {
      memoryCache.current.hasDataEverLoaded = false;
      memoryCache.current.lastValidMatches = [];
      memoryCache.current.lastUserId = s.id;
      memoryCache.current.lastLeagueId = s.selectedLeagueId;
      setIsMatchesReady(false);
      setAllMatches([]);
    }

    if (!s.selectedLeagueId) {
      setIsMatchesReady(true);
      return;
    }

    const prefixedGroupId = `${seasonId}_league_${s.selectedLeagueId}_group_${s.groupId}`;
    const q = query(
      collection(db, 'matches_v1'),
      where('seasonId', '==', seasonId),
      where('groupId', '==', prefixedGroupId)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const uniqueMatchesMap = new Map();
      snapshot.forEach((doc) => {
        uniqueMatchesMap.set(doc.id, { ...doc.data(), id: doc.id });
      });

      const loaded = Array.from(uniqueMatchesMap.values());
      const sorted = loaded.sort((a, b) => (a.day || 0) - (b.day || 0));
      
      if (snapshot.metadata.fromCache && sorted.length === 0 && memoryCache.current.hasDataEverLoaded) {
        return; 
      }

      memoryCache.current.lastValidMatches = sorted;
      memoryCache.current.hasDataEverLoaded = true;
      setAllMatches(sorted);
      setIsMatchesReady(true);
    }, (error) => {
      console.warn("[Matches Sync] Error:", error);
      setIsMatchesReady(true); 
    });

    return () => unsubscribe();
  }, [db, state.id, state.selectedLeagueId, state.groupId, state.isLoaded]);

  const nextMatchInfo = useMemo(() => {
    if (!isMatchesReady || !user) return null;
    const matchesToUse = allMatches.length > 0 ? allMatches : memoryCache.current.lastValidMatches;
    if (matchesToUse.length === 0) return null;

    const mskNow = getMoscowTime().getTime();

    // 1. Ищем "Активный" матч: время пришло, но статус не finished
    const activeMatch = matchesToUse.find(m => 
      (m.homeId === user.uid || m.awayId === user.uid) && 
      !checkIsMatchFinished(m) && 
      new Date(m.startTime).getTime() <= mskNow + 600000 // Либо уже начался, либо начнется через 10 мин
    );

    if (activeMatch) {
      return {
        match: activeMatch,
        opponentName: activeMatch.homeId === user.uid ? activeMatch.awayName : activeMatch.homeName,
        day: activeMatch.day,
        dateLabel: getSeasonDateLabel(activeMatch.day),
        isHome: activeMatch.homeId === user.uid
      };
    }

    // 2. Ищем матч, который только что закончился (не более 12 часов назад)
    const recentlyFinished = matchesToUse
      .filter(m => (m.homeId === user.uid || m.awayId === user.uid) && checkIsMatchFinished(m))
      .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())
      .find(m => mskNow - new Date(m.startTime).getTime() < 12 * 60 * 60 * 1000);

    if (recentlyFinished) {
      return {
        match: recentlyFinished,
        opponentName: recentlyFinished.homeId === user.uid ? recentlyFinished.awayName : recentlyFinished.homeName,
        day: recentlyFinished.day,
        dateLabel: getSeasonDateLabel(recentlyFinished.day),
        isHome: recentlyFinished.homeId === user.uid
      };
    }

    // 3. Ищем следующий запланированный матч в будущем
    const myFuture = matchesToUse
      .filter(m => (m.homeId === user.uid || m.awayId === user.uid) && !checkIsMatchFinished(m))
      .sort((a,b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
    
    if (myFuture.length > 0) {
      const m = myFuture[0];
      return {
        match: m,
        opponentName: m.homeId === user.uid ? m.awayName : m.homeName,
        day: m.day,
        dateLabel: getSeasonDateLabel(m.day),
        isHome: m.homeId === user.uid
      };
    }

    return null;
  }, [allMatches, isMatchesReady, user]);

  const isDataReady = isMatchesReady && state.isLoaded;

  const getRefs = useCallback(() => {
    const s = stateRef.current;
    if (!user || !s.selectedLeagueId) return null;
    const seasonInfo = getGlobalSeasonInfo();
    const seasonId = `season_${seasonInfo.activeSeasonNumber}`;
    const prefixedGroupId = `${seasonId}_league_${s.selectedLeagueId}_group_${s.groupId}`;
    return {
      team: doc(db, 'leagues_v2', s.selectedLeagueId, 'divisions', String(s.leagueLevel), 'groups', prefixedGroupId, 'teams', user.uid)
    };
  }, [user, db]);

  const addCrystals = (amount: number) => {
    const refs = getRefs(); if (!refs) return;
    setDoc(refs.team, { crystals: Math.max(0, stateRef.current.crystals + amount) }, { merge: true });
  };

  const addCredits = (amount: number) => {
    const refs = getRefs(); if (!refs) return;
    setDoc(refs.team, { credits: Math.max(0, stateRef.current.credits + amount) }, { merge: true });
  };

  const purchaseLicense = (tier: number, cost: number) => {
    const s = stateRef.current;
    const refs = getRefs();
    if (!refs || s.crystals < cost) return false;
    setDoc(refs.team, { crystals: s.crystals - cost, activeLicenseTier: tier }, { merge: true });
    return true;
  };

  const purchasePremium = () => {
    const s = stateRef.current;
    const refs = getRefs();
    if (!refs || s.crystals < 5000) return false;
    const expiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    setDoc(refs.team, { crystals: s.crystals - 5000, premiumUntil: expiry.toISOString() }, { merge: true });
    return true;
  };

  const updateHero = (id: string, data: Partial<Hero>, costCredits = 0, costCrystals = 0) => {
    const refs = getRefs(); if (!refs) return;
    const heroRef = doc(collection(refs.team, 'heroes'), id);
    setDoc(heroRef, data, { merge: true });
    if (costCredits || costCrystals) {
      setDoc(refs.team, { credits: stateRef.current.credits - costCredits, crystals: stateRef.current.crystals - costCrystals }, { merge: true });
    }
  };

  const removeHero = (id: string, refund: number) => {
    const refs = getRefs(); if (!refs) return;
    deleteDoc(doc(collection(refs.team, 'heroes'), id));
    if (refund > 0) setDoc(refs.team, { credits: stateRef.current.credits + refund }, { merge: true });
  };

  const assignToRole = (role: LineupSlot, heroId: string | null) => {
    const refs = getRefs(); if (!refs) return;
    setDoc(refs.team, { lineup: { ...stateRef.current.lineup, [role]: heroId } }, { merge: true });
  };

  const updateTactics = (strategy: string, lineSettings: any) => {
    const refs = getRefs(); if (!refs) return;
    setDoc(refs.team, { strategy, lineSettings }, { merge: true });
  };

  const claimReward = (credits: number, crystals: number) => {
    const refs = getRefs(); if (!refs) return;
    const today = getMoscowDateString();
    setDoc(refs.team, {
      credits: stateRef.current.credits + credits,
      crystals: stateRef.current.crystals + (stateRef.current.isPremium ? crystals + 50 : crystals),
      lastRewardClaimDate: today,
      rewardDay: (stateRef.current.rewardDay % 30) + 1
    }, { merge: true });
  };

  const syncStats = useCallback((groupPlayers: any[]) => {
    const s = stateRef.current;
    if (!s.id || !groupPlayers.length) return;
    const sorted = [...groupPlayers].sort((a, b) => b.points - a.points || b.wins - a.wins || a.id.localeCompare(b.id));
    const myRank = sorted.findIndex(p => p.id === s.id) + 1;
    if (myRank !== s.rank && myRank > 0) {
       const refs = getRefs();
       if (refs) setDoc(refs.team, { rank: myRank }, { merge: true });
    }
  }, [getRefs]);

  const setLanguage = (l: string) => {
    setState(s => ({ ...s, language: l }));
  };

  const setTrainingFocus = (heroId: string, focus: string | null) => { updateHero(heroId, { trainingFocus: focus }); };
  const startDailyHeroTraining = (heroId: string, focus: string) => {
    const finish = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    updateHero(heroId, { dailyTrainingFocus: focus, dailyTrainingFinishTime: finish });
  };
  const claimDailyHeroTraining = (heroId: string) => {
    const hero = stateRef.current.ownedHeroes.find(h => h.id === heroId) || stateRef.current.youthAcademyHeroes.find(h => h.id === heroId);
    if (!hero || !hero.dailyTrainingFocus) return;
    const skill = hero.dailyTrainingFocus;
    const currentVal = (hero.proStats as any)[skill] || 0;
    updateHero(heroId, { proStats: { ...hero.proStats, [skill]: Math.min(100, currentVal + 1) }, dailyTrainingFocus: null, dailyTrainingFinishTime: null });
  };

  const recoverAllFatigue = (type: 'credits' | 'crystals') => {
    const s = stateRef.current;
    const refs = getRefs();
    if (!refs) return false;
    const cost = type === 'credits' ? 75000 : 150;
    const balance = type === 'credits' ? s.credits : s.crystals;
    if (balance < cost) return false;
    s.ownedHeroes.forEach(h => updateHero(h.id, { fatigue: 0 }));
    setDoc(refs.team, { [type]: balance - cost }, { merge: true });
    return true;
  };

  const hireStaffMember = (member: StaffMember) => {
    const refs = getRefs(); if (!refs) return;
    setDoc(doc(collection(refs.team, 'staff'), member.id), member);
    addCredits(-(member.salary / 2));
  };

  const trainStaffSkill = (role: StaffRole, skillKey: 'primary' | 'secondary', cost: number) => {
    const s = stateRef.current;
    const member = s.staff[role];
    if (!member || s.crystals < cost) return false;
    const refs = getRefs(); if (!refs) return false;
    setDoc(doc(collection(refs.team, 'staff'), member.id), { skills: { ...member.skills, [skillKey]: Math.min(99, member.skills[skillKey] + 1) } }, { merge: true });
    addCrystals(-cost);
    return true;
  };

  const addHeroDirectly = (hero: Hero) => { const refs = getRefs(); if (!refs) return; setDoc(doc(collection(refs.team, 'heroes'), hero.id), hero); };
  const addYouthHeroDirectly = (hero: Hero) => { const refs = getRefs(); if (!refs) return; setDoc(doc(collection(refs.team, 'heroes'), hero.id), { ...hero, isYouth: true }); };
  const promoteYouthPlayer = (heroId: string) => { updateHero(heroId, { isYouth: false }); };

  const updateProfileName = (name: string) => {
    if (!user) return;
    setDoc(doc(db, 'players_v10', user.uid), { displayName: name }, { merge: true });
    const refs = getRefs(); if (refs) setDoc(refs.team, { displayName: name }, { merge: true });
  };

  const updateProfileCountry = (country: string) => { if (!user) return; setDoc(doc(db, 'players_v10', user.uid), { country }, { merge: true }); };

  const recordMatch = (winner: string, result: any, reward: number, opponentName: string, type: string, playedAt: string, matchId?: string) => {
    const refs = getRefs(); if (!refs) return;
    const s = stateRef.current;
    const mId = matchId || `match_${Date.now()}`;
    if (s.matchHistory.some(m => m.id === mId)) return;
    const newEntry = { id: mId, winner, scoreA: result.scoreA, scoreB: result.scoreB, matchSummary: result.matchSummary || "Combat finalized.", opponentName, type, playedAt, reward, seen: false, day: s.seasonDay, seasonNumber: s.seasonNumber, timeline: result.timeline || [], scoreboard: result.scoreboard || [], mvp: result.mvp, duration: result.duration, games: result.games || [] };
    setDoc(refs.team, { credits: s.credits + reward, matchHistory: arrayUnion(newEntry) }, { merge: true });
  };

  const markMatchAsSeen = (day: number) => { const refs = getRefs(); if (!refs) return; setDoc(refs.team, { lastSeenMatchDay: day }, { merge: true }); };
  const markMatchIdAsSeen = (id: string) => { const refs = getRefs(); if (!refs) return; const hist = stateRef.current.matchHistory.map(m => m.id === id ? { ...m, seen: true } : m); setDoc(refs.team, { matchHistory: hist }, { merge: true }); };

  const upgradeManagerSkill = (key: keyof GameState['managerSkills']) => {
    const s = stateRef.current;
    if (s.skillPoints <= 0) return;
    const refs = getRefs(); if (!refs) return;
    setDoc(refs.team, { skillPoints: s.skillPoints - 1, managerSkills: { ...s.managerSkills, [key]: s.managerSkills[key] + 1 } }, { merge: true });
  };

  const startConstruction = (type: string, id: string, cost: number, baseDurationHours: number) => {
    const s = stateRef.current;
    const refs = getRefs();
    if (!refs || s.credits < cost) return false;
    const currentData = (s as any)[type];
    const currentLevel = currentData[id] || 0;
    const durationMs = baseDurationHours * (currentLevel + 1) * 60 * 60 * 1000;
    const startTime = new Date().toISOString();
    const finishTime = new Date(Date.now() + durationMs).toISOString();
    setDoc(refs.team, { credits: s.credits - cost, [type]: { ...currentData, constructionStarts: { ...(currentData.constructionStarts || {}), [id]: startTime }, constructionFinishes: { ...(currentData.constructionFinishes || {}), [id]: finishTime }, isAccelerated: { ...(currentData.isAccelerated || {}), [id]: false } } }, { merge: true });
    return true;
  };

  const startArenaConstruction = (id: string, cost: number) => startConstruction('arena', id, cost, 4);
  const startHQConstruction = (id: string, cost: number) => startConstruction('hq', id, cost, 4);
  const startBootcampConstruction = (id: string, cost: number) => startConstruction('bootcamp', id, cost, 4);
  const startAcademyConstruction = (id: string, cost: number) => startConstruction('academy', id, cost, 4);
  const startMedicalConstruction = (id: string, cost: number) => startConstruction('medical', id, cost, 4);

  const startCapacityExpansion = (seats: number, cost: number) => {
    const s = stateRef.current;
    const refs = getRefs();
    if (!refs || s.credits < cost) return false;
    const durationMs = 8 * 60 * 60 * 1000;
    const finishTime = new Date(Date.now() + durationMs).toISOString();
    setDoc(refs.team, { credits: s.credits - cost, arena: { ...s.arena, pendingSeats: seats, constructionStarts: { ...(s.arena.constructionStarts || {}), capacity: new Date().toISOString() }, constructionFinishes: { ...(s.arena.constructionFinishes || {}), capacity: finishTime }, isAccelerated: { ...(s.arena.isAccelerated || {}), capacity: false } } }, { merge: true });
    return true;
  };

  const accelerateConstruction = (type: string, id: string, multiplier: number, price: number) => {
    const s = stateRef.current;
    const refs = getRefs();
    if (!refs || s.crystals < price) return false;
    const currentData = (s as any)[type];
    const finishIso = currentData.constructionFinishes?.[id];
    if (!finishIso || currentData.isAccelerated?.[id]) return false;
    const finishTime = new Date(finishIso).getTime();
    const timeLeft = finishTime - Date.now();
    const newFinishTime = new Date(Date.now() + (timeLeft / multiplier)).toISOString();
    setDoc(refs.team, { crystals: s.crystals - price, [type]: { ...currentData, constructionFinishes: { ...currentData.constructionFinishes, [id]: newFinishTime }, isAccelerated: { ...currentData.isAccelerated, [id]: true } } }, { merge: true });
    return true;
  };

  const checkConstructions = useCallback(() => {
    const s = stateRef.current;
    const refs = getRefs();
    if (!refs) return;
    const types = ['arena', 'hq', 'bootcamp', 'academy', 'medical'];
    const now = Date.now();
    const batch = writeBatch(db);
    let hasChanges = false;
    types.forEach(type => {
      const data = (s as any)[type];
      if (!data?.constructionFinishes) return;
      Object.entries(data.constructionFinishes).forEach(([id, finishIso]) => {
        if (now >= new Date(finishIso as string).getTime()) {
          hasChanges = true;
          const updatedData = { ...data };
          if (id === 'capacity') { updatedData.capacity = (updatedData.capacity || 5000) + (updatedData.pendingSeats || 0); delete updatedData.pendingSeats; } else { updatedData[id] = (updatedData[id] || 0) + 1; }
          delete updatedData.constructionStarts[id]; delete updatedData.constructionFinishes[id]; delete updatedData.isAccelerated[id];
          batch.update(refs.team, { [type]: updatedData });
        }
      });
    });
    if (hasChanges) batch.commit();
  }, [db, getRefs]);

  const value = useMemo(() => ({
    ...state,
    isDataReady,
    allSeasonMatches: allMatches,
    nextMatch: nextMatchInfo,
    isMatchesLoading: !isMatchesReady,
    addCrystals, addCredits, updateHero, removeHero, assignToRole, updateTactics, claimReward, purchaseLicense, purchasePremium, syncStats, setTrainingFocus, startDailyHeroTraining, claimDailyHeroTraining, recoverAllFatigue, hireStaffMember, trainStaffSkill, addHeroDirectly, addYouthHeroDirectly, promoteYouthPlayer, updateProfileName, updateProfileCountry, recordMatch, markMatchAsSeen, markMatchIdAsSeen, upgradeManagerSkill, startArenaConstruction, startHQConstruction, startBootcampConstruction, startAcademyConstruction, startMedicalConstruction, startCapacityExpansion, accelerateConstruction, checkConstructions, setLanguage
  }), [state, isDataReady, allMatches, nextMatchInfo, isMatchesReady, syncStats, getRefs, checkConstructions, setLanguage]);

  return <GameStateContext.Provider value={value as any}>{children}</GameStateContext.Provider>;
}

export function useGameState() {
  const context = useContext(GameStateContext);
  if (context === undefined) throw new Error('useGameState must be used within a GameStateProvider');
  return context;
}
