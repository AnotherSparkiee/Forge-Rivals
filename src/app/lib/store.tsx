'use client';

/**
 * @fileOverview Глобальное хранилище v53 (Complete & Fixed). 
 * Реализованы ВСЕ методы интерфейса GameState для корректной работы систем игры.
 */

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode, useRef, useMemo } from 'react';
import { Hero, StaffMember, StaffRole, generateScoutedHero } from './moba-data';
import { getMoscowTime, getGlobalSeasonInfo, getMoscowDateString, getSeasonDateLabel, setServerTime } from './time-utils';
import { useUser, useFirestore } from '@/firebase';
import { doc, onSnapshot, collection, setDoc, deleteDoc, writeBatch, query, where, serverTimestamp, arrayUnion, orderBy, getDoc, updateDoc } from 'firebase/firestore';

export type LineupSlot = 'carry' | 'mid' | 'offlane' | 'support' | 'full_support' | 'sub1' | 'sub2' | 'res1' | 'res2' | 'res3' | 'res4' | 'res5' | 'res6' | 'res7' | 'res8';

export const checkIsMatchFinished = (match: any) => {
  if (!match) return false;
  return (
    (match.homeScore !== undefined && match.homeScore !== null) ||
    (match.scoreA !== undefined && match.scoreA !== null) ||
    match.status === 'finished' ||
    match.isFinished === true
  );
};

interface GameState {
  credits: number; crystals: number; experiencePoints: number; managerLevel: number;
  leagueLevel: number; groupId: number; selectedLeagueId: string | null;
  displayName: string; id: string; isLoaded: boolean;
  lineup: Record<LineupSlot, string | null>;
  ownedHeroes: Hero[]; youthAcademyHeroes: Hero[];
  scoutingCandidates: Hero[]; lastScoutDate: string | null;
  staff: Record<StaffRole, StaffMember | null>;
  strategy: string; lineSettings: any;
  rewardDay: number; lastRewardClaimDate: string | null;
  matchHistory: any[]; lastSeenMatchDay: number;
  managerSkills: { sponsors: number; agents: number; training: number; medical: number };
  arena: any; hq: any; bootcamp: any; academy: any; medical: any;
  country: string | null; isPremium: boolean; premiumUntil: string | null;
  activeSeasonNumber: number; activeLicenseTier: number | null;
  rank: number; seasonDay: number; seasonNumber: number;
  isSyncing: boolean; language: string; skillPoints: number;
  isDataReady: boolean; allSeasonMatches: any[]; nextMatch: any | null; isMatchesLoading: boolean;

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
  setLanguageDirect: (lang: string) => void;
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
  scoutCandidates: () => void;
  recruitCandidate: (heroId: string) => void;
  clearScoutingReport: () => void;
  payStaffSalaries: () => Promise<void>;
  healHero: (heroId: string, type: 'credits' | 'crystals', cost: number) => void;
  launchFanCampaign: (type: 'open_day' | 'autograph' | 'ultras_trip', cost: number, fans: number, loyalty: number) => void;
}

export function getLevelThreshold(lvl: number) {
  return (lvl * 1000) + (lvl * lvl * 500);
}

const DEFAULT_STATE: GameState = {
  credits: 0, crystals: 0, experiencePoints: 0, managerLevel: 1,
  leagueLevel: 9, groupId: 1, selectedLeagueId: null,
  displayName: 'Manager', id: '', isLoaded: false, 
  lineup: { carry: null, mid: null, offlane: null, support: null, full_support: null, sub1: null, sub2: null, res1: null, res2: null, res3: null, res4: null, res5: null, res6: null, res7: null, res8: null },
  ownedHeroes: [], youthAcademyHeroes: [], scoutingCandidates: [], lastScoutDate: null,
  staff: { coach: null, analyst: null, scout: null, doctor: null, financier: null },
  strategy: 'Balanced Play', lineSettings: { carry: 'standard', mid: 'standard', offlane: 'standard' },
  rewardDay: 1, lastRewardClaimDate: null, matchHistory: [], lastSeenMatchDay: 0,
  managerSkills: { sponsors: 0, agents: 0, training: 0, medical: 0 },
  skillPoints: 0, arena: { capacity: 5000 }, hq: {}, bootcamp: {}, academy: {}, medical: {},
  country: null, isPremium: false, premiumUntil: null, activeSeasonNumber: 1, seasonNumber: 1, seasonDay: 1, isSyncing: false, language: 'ru',
  isDataReady: false, allSeasonMatches: [], nextMatch: null, isMatchesLoading: true,
  addCrystals: () => {}, addCredits: () => {}, updateHero: () => {}, removeHero: () => {}, assignToRole: () => {}, updateTactics: () => {},
  claimReward: () => {}, setLanguage: () => {}, purchaseLicense: () => false, purchasePremium: () => false, setLanguageDirect: () => {},
  setTrainingFocus: () => {}, startDailyHeroTraining: () => {}, claimDailyHeroTraining: () => {},
  recoverAllFatigue: () => false, hireStaffMember: () => {}, trainStaffSkill: () => false,
  addHeroDirectly: () => {}, addYouthHeroDirectly: () => {}, promoteYouthPlayer: () => {},
  updateProfileName: () => {}, updateProfileCountry: () => {}, recordMatch: () => {},
  markMatchIdAsSeen: () => {}, upgradeManagerSkill: () => {},
  startArenaConstruction: () => false, startHQConstruction: () => false, startBootcampConstruction: () => false,
  startAcademyConstruction: () => false, startMedicalConstruction: () => false, startCapacityExpansion: () => false,
  accelerateConstruction: () => false, checkConstructions: () => {},
  scoutCandidates: () => {}, recruitCandidate: () => {}, clearScoutingReport: () => {},
  payStaffSalaries: async () => {}, healHero: () => {}, launchFanCampaign: () => {}
};

const GameStateContext = createContext<GameState | undefined>(undefined);

export function GameStateProvider({ children }: { children: ReactNode }) {
  const { user, isUserLoading } = useUser();
  const db = useFirestore();
  const [state, setState] = useState<GameState>(DEFAULT_STATE);
  const [isMatchesReady, setIsMatchesReady] = useState(false);
  const [allMatches, setAllMatches] = useState<any[]>([]);
  
  const stateRef = useRef(state);
  const isCheckingConstructions = useRef(false);

  useEffect(() => { stateRef.current = state; }, [state]);

  // NTP Time Sync
  useEffect(() => {
    if (!db) return;
    const syncTime = async () => {
      const response = await fetch('https://worldtimeapi.org/api/timezone/Europe/Moscow', { cache: 'no-store' }).catch(() => null);
      if (response && response.ok) {
        const data = await response.json();
        setServerTime(new Date(data.datetime).getTime());
      }
    };
    syncTime();
  }, [db]);

  // Firestore Snapshots: Profile
  useEffect(() => {
    if (isUserLoading || !user?.uid) return;
    const rootRef = doc(db, 'players_v10', user.uid);
    return onSnapshot(rootRef, (snap) => {
      if (!snap.exists()) return;
      const data = snap.data();
      const info = getGlobalSeasonInfo();
      setState(s => ({
        ...s,
        id: user.uid,
        displayName: data.displayName || "Manager",
        selectedLeagueId: data.selectedLeagueId || null,
        leagueLevel: Number(data.leagueLevel || 9),
        groupId: Number(data.groupId || 1),
        country: data.country || null,
        lastSeenMatchDay: Number(data.lastSeenMatchDay || 0),
        activeSeasonNumber: Number(info.activeSeasonNumber),
        seasonNumber: Number(info.seasonNumber),
        seasonDay: Number(info.seasonDay),
        isLoaded: true
      }));
    });
  }, [user?.uid, isUserLoading, db]);

  // Firestore Snapshots: Team & Heroes
  useEffect(() => {
    if (isUserLoading || !user?.uid || !state.id || !state.selectedLeagueId) return;
    const info = getGlobalSeasonInfo();
    const seasonId = `season_${info.activeSeasonNumber}`;
    const prefixedGroupId = `${seasonId}_league_${state.selectedLeagueId}_group_${state.groupId}`;
    const teamRef = doc(db, 'leagues_v2', state.selectedLeagueId, 'divisions', String(state.leagueLevel), 'groups', prefixedGroupId, 'teams', state.id);

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
        managerSkills: d.managerSkills ?? { sponsors: 0, agents: 0, training: 0, medical: 0 },
        arena: d.arena ?? { capacity: 5000 },
        hq: d.hq ?? {}, bootcamp: d.bootcamp ?? {}, academy: d.academy ?? {}, medical: d.medical ?? {},
        activeLicenseTier: d.activeLicenseTier ?? 4,
        premiumUntil: d.premiumUntil ?? null,
        isPremium: d.premiumUntil ? new Date(d.premiumUntil) > new Date() : false,
        rank: d.rank ?? 8,
        scoutingCandidates: d.scoutingCandidates || [],
        lastScoutDate: d.lastScoutDate || null
      }));
    });

    const heroesUnsub = onSnapshot(collection(teamRef, 'heroes'), (hSnap) => {
      const all = hSnap.docs.map(d => ({ ...d.data(), id: d.id } as Hero));
      setState(prev => ({ ...prev, ownedHeroes: all.filter(h => !h.isYouth), youthAcademyHeroes: all.filter(h => h.isYouth) }));
    });

    const staffUnsub = onSnapshot(collection(teamRef, 'staff'), (sSnap) => {
      const staffObj: any = { coach: null, analyst: null, scout: null, doctor: null, financier: null };
      sSnap.docs.forEach(doc => { const m = doc.data() as StaffMember; staffObj[m.role] = m; });
      setState(prev => ({ ...prev, staff: staffObj }));
    });

    return () => { unsubTeam(); heroesUnsub(); staffUnsub(); };
  }, [db, state.id, state.selectedLeagueId, state.leagueLevel, state.groupId, isUserLoading, user?.uid]);

  // Firestore Snapshots: Matches
  useEffect(() => {
    if (isUserLoading || !user?.uid || !state.isLoaded || !state.id || !state.selectedLeagueId) return;
    const info = getGlobalSeasonInfo();
    const seasonId = `season_${info.activeSeasonNumber}`;
    const prefixedGroupId = `${seasonId}_league_${state.selectedLeagueId}_group_${state.groupId}`;
    const q = query(collection(db, 'matches_v1'), where('groupId', '==', String(prefixedGroupId)), where('seasonNumber', '==', info.activeSeasonNumber), where('version', '==', 32));
    return onSnapshot(q, (snapshot) => {
      const loaded = snapshot.docs.map(d => ({ ...d.data(), id: d.id }));
      setAllMatches(loaded.sort((a, b) => Number(a.day) - Number(b.day)));
      setIsMatchesReady(true);
    });
  }, [db, state.id, state.selectedLeagueId, state.groupId, state.isLoaded, isUserLoading, user?.uid]);

  // Memoized Helpers
  const nextMatchInfo = useMemo(() => {
    if (!isMatchesReady || !user?.uid || allMatches.length === 0) return null;
    const future = allMatches.filter(m => (m.homeId === user.uid || m.awayId === user.uid) && !checkIsMatchFinished(m)).sort((a,b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())[0];
    if (future) return { match: future, opponentName: future.homeId === user.uid ? future.awayName : future.homeName, day: Number(future.day), dateLabel: getSeasonDateLabel(future.day, future.seasonNumber), isHome: future.homeId === user.uid };
    return null;
  }, [allMatches, isMatchesReady, user?.uid]);

  const getRefs = useCallback(() => {
    const s = stateRef.current;
    if (!user?.uid || !s.selectedLeagueId) return null;
    const info = getGlobalSeasonInfo();
    const seasonId = `season_${info.activeSeasonNumber}`;
    const prefixedGroupId = `${seasonId}_league_${s.selectedLeagueId}_group_${s.groupId}`;
    return { 
      team: doc(db, 'leagues_v2', s.selectedLeagueId, 'divisions', String(s.leagueLevel), 'groups', prefixedGroupId, 'teams', user.uid),
      root: doc(db, 'players_v10', user.uid)
    };
  }, [user?.uid, db]);

  // IMPLEMENTATIONS
  const addCrystals = (amount: number) => { const r = getRefs(); if (r) setDoc(r.team, { crystals: Math.max(0, stateRef.current.crystals + amount) }, { merge: true }); };
  const addCredits = (amount: number) => { const r = getRefs(); if (r) setDoc(r.team, { credits: Math.max(0, stateRef.current.credits + amount) }, { merge: true }); };
  
  const updateHero = (id: string, data: Partial<Hero>, creditsCost = 0, crystalsCost = 0) => {
    const r = getRefs(); if (!r) return;
    setDoc(doc(collection(r.team, 'heroes'), id), data, { merge: true });
    if (creditsCost || crystalsCost) setDoc(r.team, { credits: stateRef.current.credits - creditsCost, crystals: stateRef.current.crystals - crystalsCost }, { merge: true });
  };

  const removeHero = (id: string, refund: number) => {
    const r = getRefs(); if (!r) return;
    deleteDoc(doc(collection(r.team, 'heroes'), id));
    if (refund) addCredits(refund);
  };

  const assignToRole = (role: LineupSlot, heroId: string | null) => { const r = getRefs(); if (r) setDoc(r.team, { lineup: { ...stateRef.current.lineup, [role]: heroId } }, { merge: true }); };
  const updateTactics = (strategy: string, lineSettings: any) => { const r = getRefs(); if (r) setDoc(r.team, { strategy, lineSettings }, { merge: true }); };
  const claimReward = (cr: number, cry: number) => { const r = getRefs(); if (r) setDoc(r.team, { credits: stateRef.current.credits + cr, crystals: stateRef.current.crystals + (stateRef.current.isPremium ? cry + 50 : cry), lastRewardClaimDate: getMoscowDateString(), rewardDay: (stateRef.current.rewardDay % 30) + 1 }, { merge: true }); };
  
  const purchaseLicense = (t: number, c: number) => { const r = getRefs(); if (!r || stateRef.current.crystals < c) return false; setDoc(r.team, { crystals: stateRef.current.crystals - c, activeLicenseTier: t }, { merge: true }); return true; };
  const purchasePremium = () => { const r = getRefs(); if (!r || stateRef.current.crystals < 5000) return false; const exp = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); setDoc(r.team, { crystals: stateRef.current.crystals - 5000, premiumUntil: exp.toISOString() }, { merge: true }); return true; };
  
  const setLanguage = (lang: string) => setState(s => ({ ...s, language: lang }));
  const setLanguageDirect = (lang: string) => setState(s => ({ ...s, language: lang }));

  const setTrainingFocus = (heroId: string, focus: string | null) => {
    updateHero(heroId, { trainingFocus: focus });
  };

  const startDailyHeroTraining = (id: string, f: string) => updateHero(id, { dailyTrainingFocus: f, dailyTrainingFinishTime: new Date(Date.now() + 86400000).toISOString() });
  
  const claimDailyHeroTraining = (id: string) => {
    const h = stateRef.current.ownedHeroes.find(x => x.id === id) || stateRef.current.youthAcademyHeroes.find(x => x.id === id);
    if (h?.dailyTrainingFocus) {
      const cur = (h.proStats as any)[h.dailyTrainingFocus] || 0;
      updateHero(id, { proStats: { ...h.proStats, [h.dailyTrainingFocus]: Math.min(100, cur + 1) }, dailyTrainingFocus: null, dailyTrainingFinishTime: null });
    }
  };

  const recoverAllFatigue = (type: 'credits' | 'crystals') => {
    const cost = type === 'credits' ? 75000 : 150;
    if (type === 'credits' && stateRef.current.credits < cost) return false;
    if (type === 'crystals' && stateRef.current.crystals < cost) return false;
    if (type === 'credits') addCredits(-cost); else addCrystals(-cost);
    const r = getRefs(); if (!r) return false;
    stateRef.current.ownedHeroes.forEach(h => updateHero(h.id, { fatigue: 0 }));
    return true;
  };

  const hireStaffMember = (m: StaffMember) => { const r = getRefs(); if (r) { setDoc(doc(collection(r.team, 'staff'), m.id), m); addCredits(-(m.salary / 2)); } };
  
  const trainStaffSkill = (role: StaffRole, skillKey: 'primary' | 'secondary', cost: number) => {
    const r = getRefs(); if (!r || stateRef.current.crystals < cost) return false;
    const member = stateRef.current.staff[role]; if (!member) return false;
    addCrystals(-cost);
    const newSkills = { ...member.skills, [skillKey]: Math.min(99, member.skills[skillKey] + 1) };
    setDoc(doc(collection(r.team, 'staff'), member.id), { skills: newSkills }, { merge: true });
    return true;
  };

  const addHeroDirectly = (h: Hero) => { const r = getRefs(); if (r) setDoc(doc(collection(r.team, 'heroes'), h.id), h); };
  const addYouthHeroDirectly = (h: Hero) => { const r = getRefs(); if (r) setDoc(doc(collection(r.team, 'heroes'), h.id), { ...h, isYouth: true }); };
  const promoteYouthPlayer = (id: string) => updateHero(id, { isYouth: false });
  
  const updateProfileName = (n: string) => { if (!user?.uid) return; setDoc(doc(db, 'players_v10', user.uid), { displayName: n }, { merge: true }); const r = getRefs(); if (r) setDoc(r.team, { displayName: n }, { merge: true }); };
  const updateProfileCountry = (c: string) => { if (user?.uid) setDoc(doc(db, 'players_v10', user.uid), { country: c }, { merge: true }); };
  
  const recordMatch = (w: string, res: any, rew: number, opp: string, t: string, p: string, mId?: string) => {
    const r = getRefs(); if (!r) return; 
    const id = mId || `match_${Date.now()}`;
    const entry = { id, winner: w, scoreA: res.scoreA, scoreB: res.scoreB, opponentName: opp, type: t, playedAt: p, reward: rew, simulation: res, seen: false };
    updateDoc(r.team, { credits: stateRef.current.credits + rew, matchHistory: arrayUnion(entry) });
  };

  const markMatchIdAsSeen = (id: string) => { 
    const r = getRefs(); if (!r) return;
    const match = allMatches.find(m => m.id === id);
    if (match) updateDoc(r.root, { lastSeenMatchDay: Number(match.day) });
  };

  const scoutCandidates = useCallback(() => {
    const r = getRefs(); if (!r) return;
    const candidates = Array.from({ length: 3 }).map((_, i) => generateScoutedHero(i, Number(stateRef.current.academy?.scoutsLevel || 0), `scout_${Date.now()}_${i}`));
    updateDoc(r.team, { scoutingCandidates: JSON.parse(JSON.stringify(candidates)), lastScoutDate: new Date().toISOString() });
  }, [getRefs]);

  const recruitCandidate = useCallback((heroId: string) => {
    const r = getRefs(); if (!r) return;
    const candidate = stateRef.current.scoutingCandidates.find(c => c.id === heroId);
    if (!candidate) return;
    setDoc(doc(collection(r.team, 'heroes'), candidate.id), { ...candidate, isYouth: true }, { merge: true });
    updateDoc(r.team, { scoutingCandidates: stateRef.current.scoutingCandidates.filter(c => c.id !== heroId) });
  }, [getRefs]);

  const clearScoutingReport = () => { const r = getRefs(); if (r) updateDoc(r.team, { scoutingCandidates: [], lastScoutDate: null }); };
  
  const payStaffSalaries = useCallback(async () => {
    const r = getRefs(); if (!r) return;
    const today = getMoscowDateString();
    const teamSnap = await getDoc(r.team);
    if (teamSnap.exists() && teamSnap.data().lastStaffSalaryPaymentDate === today) return;
    let total = 0; Object.values(stateRef.current.staff).forEach(m => { if (m) total += m.salary; });
    if (total > 0) {
      await updateDoc(r.team, { credits: Math.max(0, stateRef.current.credits - total), lastStaffSalaryPaymentDate: today });
      await setDoc(doc(db, 'notifications_v7', `staff_${stateRef.current.id}_${today}`), { userId: stateRef.current.id, title: "Staff Salaries", description: `Deducted €${total.toLocaleString()}`, type: 'league', read: false, createdAt: new Date().toISOString() });
    }
  }, [getRefs, db]);

  const upgradeManagerSkill = (skillKey: keyof GameState['managerSkills']) => {
    const r = getRefs(); if (!r || stateRef.current.skillPoints <= 0) return;
    const newSkills = { ...stateRef.current.managerSkills, [skillKey]: stateRef.current.managerSkills[skillKey] + 1 };
    setDoc(r.team, { managerSkills: newSkills, skillPoints: stateRef.current.skillPoints - 1 }, { merge: true });
  };

  const healHero = (heroId: string, type: 'credits' | 'crystals', cost: number) => {
    if (type === 'credits') addCredits(-cost); else addCrystals(-cost);
    updateHero(heroId, { isInjured: false, injuredUntil: null });
  };

  const launchFanCampaign = (type: string, cost: number, fans: number, loyalty: number) => {
    const r = getRefs(); if (!r) return;
    addCredits(-cost);
    const today = getMoscowDateString();
    setDoc(r.team, { 
      fanclub: { 
        fanCount: (stateRef.current.arena?.fanCount || 5000) + fans,
        loyalty: Math.min(100, (stateRef.current.arena?.loyalty || 30) + loyalty),
        lastCampaignDate: today 
      } 
    }, { merge: true });
  };

  const startArenaConstruction = (id: string, cost: number) => startConstruction('arena', id, cost);
  const startHQConstruction = (id: string, cost: number) => startConstruction('hq', id, cost);
  const startBootcampConstruction = (id: string, cost: number) => startConstruction('bootcamp', id, cost);
  const startAcademyConstruction = (id: string, cost: number) => startConstruction('academy', id, cost);
  const startMedicalConstruction = (id: string, cost: number) => startConstruction('medical', id, cost);
  
  const startCapacityExpansion = (seats: number, cost: number) => {
    const r = getRefs(); if (!r || stateRef.current.credits < cost) return false;
    addCredits(-cost);
    const finish = new Date(Date.now() + 12 * 3600000);
    setDoc(r.team, { arena: { ...stateRef.current.arena, constructionStarts: { ...stateRef.current.arena?.constructionStarts, capacity: new Date().toISOString() }, constructionFinishes: { ...stateRef.current.arena?.constructionFinishes, capacity: finish.toISOString() }, pendingCapacity: seats } }, { merge: true });
    return true;
  };

  const startConstruction = (category: string, id: string, cost: number) => {
    const r = getRefs(); if (!r || stateRef.current.credits < cost) return false;
    const level = (stateRef.current as any)[category][id] || 0;
    const finish = new Date(Date.now() + (4 * (level + 1)) * 3600000);
    addCredits(-cost);
    setDoc(r.team, { [category]: { ...stateRef.current[category], constructionStarts: { ...stateRef.current[category]?.constructionStarts, [id]: new Date().toISOString() }, constructionFinishes: { ...stateRef.current[category]?.constructionFinishes, [id]: finish.toISOString() } } }, { merge: true });
    return true;
  };

  const accelerateConstruction = (type: string, id: string, multiplier: number, price: number) => {
    const r = getRefs(); if (!r || stateRef.current.crystals < price) return false;
    const data = (stateRef.current as any)[type];
    if (data.isAccelerated?.[id]) return false;
    const finish = new Date(data.constructionFinishes[id]);
    const remaining = finish.getTime() - Date.now();
    const newFinish = new Date(Date.now() + (remaining / multiplier));
    addCrystals(-price);
    setDoc(r.team, { [type]: { ...data, constructionFinishes: { ...data.constructionFinishes, [id]: newFinish.toISOString() }, isAccelerated: { ...data.isAccelerated, [id]: true } } }, { merge: true });
    return true;
  };

  const checkConstructions = useCallback(() => {
    if (isCheckingConstructions.current) return;
    isCheckingConstructions.current = true;
    const r = getRefs(); if (!r) { isCheckingConstructions.current = false; return; }
    const cats = ['arena', 'hq', 'bootcamp', 'academy', 'medical'];
    let updateFound = false; const newTeamData: any = {};
    cats.forEach(cat => {
      const data = (stateRef.current as any)[cat];
      if (data?.constructionFinishes) {
        Object.entries(data.constructionFinishes).forEach(([id, finishIso]: [string, any]) => {
          if (new Date() >= new Date(finishIso)) {
            updateFound = true; if (!newTeamData[cat]) newTeamData[cat] = { ...data };
            if (id === 'capacity') { newTeamData[cat].capacity = (newTeamData[cat].capacity || 5000) + (data.pendingCapacity || 500); delete newTeamData[cat].pendingCapacity; }
            else { newTeamData[cat][id] = (newTeamData[cat][id] || 0) + 1; }
            delete newTeamData[cat].constructionFinishes[id]; delete newTeamData[cat].constructionStarts[id];
            if (newTeamData[cat].isAccelerated) delete newTeamData[cat].isAccelerated[id];
          }
        });
      }
    });
    if (updateFound) setDoc(r.team, newTeamData, { merge: true });
    isCheckingConstructions.current = false;
  }, [getRefs]);

  const value = useMemo(() => ({
    ...state, isDataReady: isMatchesReady && state.isLoaded, allSeasonMatches: allMatches, nextMatch: nextMatchInfo, isMatchesLoading: !isMatchesReady,
    addCrystals, addCredits, updateHero, removeHero, assignToRole, updateTactics, claimReward, purchaseLicense, purchasePremium, setLanguage, setLanguageDirect,
    setTrainingFocus, startDailyHeroTraining, claimDailyHeroTraining, recoverAllFatigue, hireStaffMember, trainStaffSkill, addHeroDirectly, addYouthHeroDirectly, promoteYouthPlayer, updateProfileName, updateProfileCountry, recordMatch, markMatchIdAsSeen, upgradeManagerSkill, startArenaConstruction, startHQConstruction, startBootcampConstruction, startAcademyConstruction, startMedicalConstruction, startCapacityExpansion, accelerateConstruction, checkConstructions, scoutCandidates, recruitCandidate, clearScoutingReport, payStaffSalaries, healHero, launchFanCampaign
  }), [
    state, isMatchesReady, state.isLoaded, allMatches, nextMatchInfo,
    addCrystals, addCredits, updateHero, removeHero, assignToRole, updateTactics, claimReward, purchaseLicense, purchasePremium, setLanguage, setLanguageDirect,
    setTrainingFocus, startDailyHeroTraining, claimDailyHeroTraining, recoverAllFatigue, hireStaffMember, trainStaffSkill, addHeroDirectly, addYouthHeroDirectly, promoteYouthPlayer, updateProfileName, updateProfileCountry, recordMatch, markMatchIdAsSeen, upgradeManagerSkill, startArenaConstruction, startHQConstruction, startBootcampConstruction, startAcademyConstruction, startMedicalConstruction, startCapacityExpansion, accelerateConstruction, checkConstructions, scoutCandidates, recruitCandidate, clearScoutingReport, payStaffSalaries, healHero, launchFanCampaign
  ]);

  return <GameStateContext.Provider value={value as any}>{children}</GameStateContext.Provider>;
}

export function useGameState() {
  const context = useContext(GameStateContext);
  if (context === undefined) throw new Error('useGameState must be used within a GameStateProvider');
  return context;
}
