'use client';

/**
 * @fileOverview Global Game State Store & Sync Core.
 * Centralizes all club data and manages real-time Firestore synchronization.
 */

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode, useRef, useMemo } from 'react';
import { Hero, StaffMember, StaffRole } from './moba-data';
import { getMoscowTime, getGlobalSeasonInfo, getMoscowDateString, getSeasonDateLabel } from './time-utils';
import { useUser, useFirestore, useMemoFirebase } from '@/firebase';
import { doc, onSnapshot, collection, setDoc, deleteDoc, writeBatch, query, where, serverTimestamp, arrayUnion, orderBy } from 'firebase/firestore';

export type LineupSlot = 'carry' | 'mid' | 'offlane' | 'support' | 'full_support' | 'sub1' | 'sub2' | 'res1' | 'res2' | 'res3' | 'res4' | 'res5' | 'res6' | 'res7' | 'res8';

/**
 * УНИВЕРСАЛЬНАЯ ПРОВЕРКА ЗАВЕРШЕНИЯ МАТЧА (V14 Absolute Data Priority)
 * Наличие счета в базе — ЕДИНСТВЕННЫЙ И ПЕРВООЧЕРЕДНОЙ ПРИЗНАК.
 */
export const checkIsMatchFinished = (match: any) => {
  if (!match) return false;
  
  // 1. АБСОЛЮТНЫЙ ПРИОРИТЕТ: Если есть счет, WAITING невозможен.
  const hasScore = (
    match.homeScore !== undefined && match.homeScore !== null ||
    match.scoreA !== undefined && match.scoreA !== null
  );
  
  if (hasScore) return true;

  // 2. ВТОРИЧНО: Статусы (для совместимости)
  const finishedStatuses = ['finished', 'completed', 'resolved', 'done'];
  const statusStr = String(match.status || match.matchStatus || match.state || '').toLowerCase();
  
  return (
    finishedStatuses.includes(statusStr) || 
    match.isFinished === true || 
    match.isCompleted === true
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

  isDataReady: boolean;
  allSeasonMatches: any[];
  nextMatch: any | null;
  isMatchesLoading: boolean;

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
  useEffect(() => { stateRef.current = state; }, [state]);

  // 1. ROOT PROFILE LISTENER
  useEffect(() => {
    if (isUserLoading || !user) {
      if (!isUserLoading) setState(s => ({ ...DEFAULT_STATE, isLoaded: true, language: s.language }));
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
        leagueLevel: Number(data.leagueLevel || 9),
        groupId: Number(data.groupId || 1),
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

    return () => { unsubTeam(); heroesUnsub(); staffUnsub(); };
  }, [db, state.id, state.selectedLeagueId, state.leagueLevel, state.groupId]);

  // 3. MATCHES SYNC CORE
  useEffect(() => {
    const s = state;
    if (!s.isLoaded || !s.id || !s.selectedLeagueId) return;

    const seasonInfo = getGlobalSeasonInfo();
    const seasonId = `season_${seasonInfo.activeSeasonNumber}`;
    const prefixedGroupId = `${seasonId}_league_${s.selectedLeagueId}_group_${s.groupId}`;

    const q = query(
      collection(db, 'matches_v1'),
      where('seasonId', '==', seasonId),
      where('groupId', '==', prefixedGroupId)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const loaded = snapshot.docs.map(d => ({ ...d.data(), id: d.id }));
      const sorted = loaded.sort((a, b) => (a.day || 0) - (b.day || 0));
      setAllMatches(sorted);
      setIsMatchesReady(true);
    });

    return () => unsubscribe();
  }, [db, state.id, state.selectedLeagueId, state.groupId, state.isLoaded]);

  const nextMatchInfo = useMemo(() => {
    if (!isMatchesReady || !user) return null;
    const mskNow = getMoscowTime().getTime();

    // 1. Сначала ищем активный или только что завершенный (в пределах 8 часов)
    const active = allMatches.find(m => 
      (m.homeId === user.uid || m.awayId === user.uid) && 
      !checkIsMatchFinished(m) && 
      new Date(m.startTime).getTime() <= mskNow + 300000 
    );

    if (active) {
      return { 
        match: active, 
        opponentName: active.homeId === user.uid ? active.awayName : active.homeName, 
        day: active.day, 
        dateLabel: getSeasonDateLabel(active.day), 
        isHome: active.homeId === user.uid 
      };
    }

    const recent = allMatches
      .filter(m => (m.homeId === user.uid || m.awayId === user.uid) && checkIsMatchFinished(m))
      .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())
      .find(m => mskNow - new Date(m.startTime).getTime() < 8 * 60 * 60 * 1000);

    if (recent) {
      return { 
        match: recent, 
        opponentName: recent.homeId === user.uid ? recent.awayName : recent.homeName, 
        day: recent.day, 
        dateLabel: getSeasonDateLabel(recent.day), 
        isHome: recent.homeId === user.uid 
      };
    }

    const future = allMatches
      .filter(m => (m.homeId === user.uid || m.awayId === user.uid) && !checkIsMatchFinished(m))
      .sort((a,b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())[0];
    
    if (future) {
      return { 
        match: future, 
        opponentName: future.homeId === user.uid ? future.awayName : future.homeName, 
        day: future.day, 
        dateLabel: getSeasonDateLabel(future.day), 
        isHome: future.homeId === user.uid 
      };
    }

    return null;
  }, [allMatches, isMatchesReady, user]);

  const syncStats = useCallback((groupPlayers: any[]) => {
  }, []);

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

  const addCrystals = (amount: number) => { const r = getRefs(); if (r) setDoc(r.team, { crystals: Math.max(0, stateRef.current.crystals + amount) }, { merge: true }); };
  const addCredits = (amount: number) => { const r = getRefs(); if (r) setDoc(r.team, { credits: Math.max(0, stateRef.current.credits + amount) }, { merge: true }); };
  const updateHero = (id: string, data: Partial<Hero>, creditsCost = 0, crystalsCost = 0) => {
    const r = getRefs(); if (!r) return;
    setDoc(doc(collection(r.team, 'heroes'), id), data, { merge: true });
    if (creditsCost || crystalsCost) setDoc(r.team, { credits: stateRef.current.credits - creditsCost, crystals: stateRef.current.crystals - crystalsCost }, { merge: true });
  };
  const removeHero = (id: string, refund: number) => { const r = getRefs(); if (!r) return; deleteDoc(doc(collection(r.team, 'heroes'), id)); if (refund > 0) addCredits(refund); };
  const assignToRole = (role: LineupSlot, heroId: string | null) => { const r = getRefs(); if (r) setDoc(r.team, { lineup: { ...stateRef.current.lineup, [role]: heroId } }, { merge: true }); };
  const updateTactics = (strategy: string, lineSettings: any) => { const r = getRefs(); if (r) setDoc(r.team, { strategy, lineSettings }, { merge: true }); };
  const claimReward = (cr: number, cry: number) => { const r = getRefs(); if (r) setDoc(r.team, { credits: stateRef.current.credits + cr, crystals: stateRef.current.crystals + (stateRef.current.isPremium ? cry + 50 : cry), lastRewardClaimDate: getMoscowDateString(), rewardDay: (stateRef.current.rewardDay % 30) + 1 }, { merge: true }); };
  const purchaseLicense = (t: number, c: number) => { const r = getRefs(); if (!r || stateRef.current.crystals < c) return false; setDoc(r.team, { crystals: stateRef.current.crystals - c, activeLicenseTier: t }, { merge: true }); return true; };
  const purchasePremium = () => { const r = getRefs(); if (!r || stateRef.current.crystals < 5000) return false; const exp = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); setDoc(r.team, { crystals: stateRef.current.crystals - 5000, premiumUntil: exp.toISOString() }, { merge: true }); return true; };
  const setLanguage = (l: string) => setState(s => ({ ...s, language: l }));
  const setTrainingFocus = (id: string, f: string | null) => updateHero(id, { trainingFocus: f });
  const startDailyHeroTraining = (id: string, f: string) => updateHero(id, { dailyTrainingFocus: f, dailyTrainingFinishTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() });
  const claimDailyHeroTraining = (id: string) => {
    const h = stateRef.current.ownedHeroes.find(x => x.id === id) || stateRef.current.youthAcademyHeroes.find(x => x.id === id);
    if (h?.dailyTrainingFocus) {
      const cur = (h.proStats as any)[h.dailyTrainingFocus] || 0;
      updateHero(id, { proStats: { ...h.proStats, [h.dailyTrainingFocus]: Math.min(100, cur + 1) }, dailyTrainingFocus: null, dailyTrainingFinishTime: null });
    }
  };
  const recoverAllFatigue = (type: 'credits' | 'crystals') => {
    const s = stateRef.current; const r = getRefs(); if (!r) return false;
    const cost = type === 'credits' ? 75000 : 150; const bal = type === 'credits' ? s.credits : s.crystals;
    if (bal < cost) return false;
    s.ownedHeroes.forEach(h => updateHero(h.id, { fatigue: 0 }));
    setDoc(r.team, { [type]: bal - cost }, { merge: true });
    return true;
  };
  const hireStaffMember = (m: StaffMember) => { const r = getRefs(); if (r) { setDoc(doc(collection(r.team, 'staff'), m.id), m); addCredits(-(m.salary / 2)); } };
  const trainStaffSkill = (role: StaffRole, k: 'primary' | 'secondary', cost: number) => {
    const s = stateRef.current; const m = s.staff[role]; if (!m || s.crystals < cost) return false;
    const r = getRefs(); if (!r) return false;
    setDoc(doc(collection(r.team, 'staff'), m.id), { skills: { ...m.skills, [k]: Math.min(99, m.skills[k] + 1) } }, { merge: true });
    addCrystals(-cost); return true;
  };
  const addHeroDirectly = (h: Hero) => { const r = getRefs(); if (r) setDoc(doc(collection(r.team, 'heroes'), h.id), h); };
  const addYouthHeroDirectly = (h: Hero) => { const r = getRefs(); if (r) setDoc(doc(collection(r.team, 'heroes'), h.id), { ...h, isYouth: true }); };
  const promoteYouthPlayer = (id: string) => updateHero(id, { isYouth: false });
  const updateProfileName = (n: string) => { if (!user) return; setDoc(doc(db, 'players_v10', user.uid), { displayName: n }, { merge: true }); const r = getRefs(); if (r) setDoc(r.team, { displayName: n }, { merge: true }); };
  const updateProfileCountry = (c: string) => { if (user) setDoc(doc(db, 'players_v10', user.uid), { country: c }, { merge: true }); };
  const recordMatch = (w: string, res: any, rew: number, opp: string, t: string, p: string, mId?: string) => {
    const r = getRefs(); if (!r) return; const s = stateRef.current; const id = mId || `match_${Date.now()}`;
    if (s.matchHistory.some(m => m.id === id)) return;
    const entry = { id, winner: w, scoreA: res.scoreA, scoreB: res.scoreB, matchSummary: res.matchSummary || "Combat concluded.", opponentName: opp, type: t, playedAt: p, reward: rew, seen: false, day: s.seasonDay, seasonNumber: s.seasonNumber, timeline: res.timeline || [], scoreboard: res.scoreboard || [], mvp: res.mvp, duration: res.duration, games: res.games || [] };
    setDoc(r.team, { credits: s.credits + rew, matchHistory: arrayUnion(entry) }, { merge: true });
  };
  const markMatchAsSeen = (d: number) => { const r = getRefs(); if (r) setDoc(r.team, { lastSeenMatchDay: d }, { merge: true }); };
  const markMatchIdAsSeen = (id: string) => { const r = getRefs(); if (!r) return; const hist = stateRef.current.matchHistory.map(m => m.id === id ? { ...m, seen: true } : m); setDoc(r.team, { matchHistory: hist }, { merge: true }); };
  const upgradeManagerSkill = (k: keyof GameState['managerSkills']) => { const s = stateRef.current; if (s.skillPoints <= 0) return; const r = getRefs(); if (r) setDoc(r.team, { skillPoints: s.skillPoints - 1, managerSkills: { ...s.managerSkills, [k]: s.managerSkills[k] + 1 } }, { merge: true }); };

  const startConstruction = (type: string, id: string, cost: number, baseH: number) => {
    const s = stateRef.current; const r = getRefs(); if (!r || s.credits < cost) return false;
    const data = (s as any)[type]; const lvl = data[id] || 0;
    const dur = baseH * (lvl + 1) * 60 * 60 * 1000;
    setDoc(r.team, { credits: s.credits - cost, [type]: { ...data, constructionStarts: { ...(data.constructionStarts || {}), [id]: new Date().toISOString() }, constructionFinishes: { ...(data.constructionFinishes || {}), [id]: new Date(Date.now() + dur).toISOString() }, isAccelerated: { ...(data.isAccelerated || {}), [id]: false } } }, { merge: true });
    return true;
  };
  const startArenaConstruction = (id: string, c: number) => startConstruction('arena', id, c, 4);
  const startHQConstruction = (id: string, c: number) => startConstruction('hq', id, c, 4);
  const startBootcampConstruction = (id: string, c: number) => startConstruction('bootcamp', id, c, 4);
  const startAcademyConstruction = (id: string, c: number) => startConstruction('academy', id, c, 4);
  const startMedicalConstruction = (id: string, c: number) => startConstruction('medical', id, c, 4);
  const startCapacityExpansion = (s: number, c: number) => {
    const r = getRefs(); if (!r || stateRef.current.credits < c) return false;
    setDoc(r.team, { credits: stateRef.current.credits - c, arena: { ...stateRef.current.arena, pendingSeats: s, constructionStarts: { ...(stateRef.current.arena.constructionStarts || {}), capacity: new Date().toISOString() }, constructionFinishes: { ...(stateRef.current.arena.constructionStarts || {}), capacity: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString() }, isAccelerated: { ...(stateRef.current.arena.isAccelerated || {}), capacity: false } } }, { merge: true });
    return true;
  };
  const accelerateConstruction = (type: string, id: string, mult: number, pr: number) => {
    const r = getRefs(); if (!r || stateRef.current.crystals < pr) return false;
    const data = (stateRef.current as any)[type]; const finIso = data.constructionFinishes?.[id];
    if (!finIso || data.isAccelerated?.[id]) return false;
    const newFin = new Date(Date.now() + (new Date(finIso).getTime() - Date.now()) / mult).toISOString();
    setDoc(r.team, { crystals: stateRef.current.crystals - pr, [type]: { ...data, constructionFinishes: { ...data.constructionFinishes, [id]: newFin }, isAccelerated: { ...data.isAccelerated, [id]: true } } }, { merge: true });
    return true;
  };
  const checkConstructions = useCallback(() => {
    const r = getRefs(); if (!r) return;
    const types = ['arena', 'hq', 'bootcamp', 'academy', 'medical']; const now = Date.now(); const batch = writeBatch(db); let changes = false;
    types.forEach(t => {
      const data = (stateRef.current as any)[t]; if (!data?.constructionFinishes) return;
      Object.entries(data.constructionFinishes).forEach(([id, iso]) => {
        if (now >= new Date(iso as string).getTime()) {
          changes = true; const updated = { ...data };
          if (id === 'capacity') { updated.capacity = (updated.capacity || 5000) + (updated.pendingSeats || 0); delete updated.pendingSeats; }
          else { updated[id] = (updated[id] || 0) + 1; }
          delete updated.constructionStarts[id]; delete updated.constructionFinishes[id]; delete updated.isAccelerated[id];
          batch.update(r.team, { [t]: updated });
        }
      });
    });
    if (changes) batch.commit();
  }, [db, getRefs]);

  const value = useMemo(() => ({
    ...state, isDataReady: isMatchesReady && state.isLoaded, allSeasonMatches: allMatches, nextMatch: nextMatchInfo, isMatchesLoading: !isMatchesReady,
    addCrystals, addCredits, updateHero, removeHero, assignToRole, updateTactics, claimReward, purchaseLicense, purchasePremium, syncStats, setLanguage,
    setTrainingFocus, startDailyHeroTraining, claimDailyHeroTraining, recoverAllFatigue, hireStaffMember, trainStaffSkill, addHeroDirectly, addYouthHeroDirectly, promoteYouthPlayer, updateProfileName, updateProfileCountry, recordMatch, markMatchAsSeen, markMatchIdAsSeen, upgradeManagerSkill, startArenaConstruction, startHQConstruction, startBootcampConstruction, startAcademyConstruction, startMedicalConstruction, startCapacityExpansion, accelerateConstruction, checkConstructions
  }), [state, isMatchesReady, state.isLoaded, allMatches, nextMatchInfo, syncStats, setLanguage, addCrystals, addCredits, updateHero, removeHero, assignToRole, updateTactics, claimReward, purchaseLicense, purchasePremium, setTrainingFocus, startDailyHeroTraining, claimDailyHeroTraining, recoverAllFatigue, hireStaffMember, trainStaffSkill, addHeroDirectly, addYouthHeroDirectly, promoteYouthPlayer, updateProfileName, updateProfileCountry, recordMatch, markMatchAsSeen, markMatchIdAsSeen, upgradeManagerSkill, startArenaConstruction, startHQConstruction, startBootcampConstruction, startAcademyConstruction, startMedicalConstruction, startCapacityExpansion, accelerateConstruction, checkConstructions]);

  return <GameStateContext.Provider value={value as any}>{children}</GameStateContext.Provider>;
}

export function useGameState() {
  const context = useContext(GameStateContext);
  if (context === undefined) throw new Error('useGameState must be used within a GameStateProvider');
  return context;
}
