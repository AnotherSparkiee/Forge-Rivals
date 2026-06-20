'use client';

/**
 * Глобальное хранилище v60 (Improved recordMatch logic). 
 */

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode, useRef, useMemo } from 'react';
import { Player, StaffMember, StaffRole, generateScoutedPlayer } from './moba-data';
import { getMoscowTime, getGlobalSeasonInfo, getMoscowDateString, setServerTime } from './time-utils';
import { useUser, useFirestore } from '@/firebase';
import { doc, onSnapshot, collection, setDoc, deleteDoc, writeBatch, query, where, serverTimestamp, arrayUnion, getDoc, updateDoc, limit } from 'firebase/firestore';

export type LineupSlot = 'carry' | 'mid' | 'offlane' | 'support' | 'full_support' | 'sub1' | 'sub2' | 'res1' | 'res2' | 'res3' | 'res4' | 'res5' | 'res6' | 'res7' | 'res8';

interface GameState {
  credits: number; crystals: number; experiencePoints: number; managerLevel: number;
  leagueLevel: number; groupId: number; selectedLeagueId: string | null;
  displayName: string; id: string; isLoaded: boolean;
  lineup: Record<LineupSlot, string | null>;
  ownedPlayers: Player[]; youthAcademyPlayers: Player[];
  scoutingCandidates: Player[]; lastScoutDate: string | null;
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
  updatePlayer: (id: string, data: Partial<Player>, costCredits?: number, costCrystals?: number) => void;
  removePlayer: (id: string, refund: number) => void;
  assignToRole: (role: LineupSlot, playerId: string | null) => void;
  updateTactics: (strategy: string, lineSettings: any) => void;
  claimReward: (credits: number, crystals: number) => void;
  setLanguage: (lang: string) => void;
  purchaseLicense: (tier: number, cost: number) => boolean;
  purchasePremium: () => boolean;
  setTrainingFocus: (playerId: string, focus: string | null) => void;
  startDailyPlayerTraining: (playerId: string, focus: string) => void;
  claimDailyPlayerTraining: (playerId: string) => void;
  recoverAllFatigue: (type: 'credits' | 'crystals') => boolean;
  hireStaffMember: (member: StaffMember) => void;
  trainStaffSkill: (role: StaffRole, skillKey: 'primary' | 'secondary', cost: number) => boolean;
  addPlayerDirectly: (player: Player) => void;
  addYouthPlayerDirectly: (player: Player) => void;
  promoteYouthPlayer: (playerId: string) => void;
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
  recruitCandidate: (playerId: string) => void;
  clearScoutingReport: () => void;
  payStaffSalaries: () => Promise<void>;
  healPlayer: (playerId: string, type: 'credits' | 'crystals', cost: number) => void;
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
  ownedPlayers: [], youthAcademyPlayers: [], scoutingCandidates: [], lastScoutDate: null,
  staff: { coach: null, analyst: null, scout: null, doctor: null, financier: null },
  strategy: 'Balanced Play', lineSettings: { carry: 'standard', mid: 'standard', offlane: 'standard' },
  rewardDay: 1, lastRewardClaimDate: null, matchHistory: [], lastSeenMatchDay: 0,
  managerSkills: { sponsors: 0, agents: 0, training: 0, medical: 0 },
  skillPoints: 0, arena: { capacity: 5000 }, hq: {}, bootcamp: {}, academy: {}, medical: {},
  country: null, isPremium: false, premiumUntil: null, activeSeasonNumber: 1, seasonNumber: 1, seasonDay: 1, isSyncing: false, language: 'ru',
  isDataReady: false, allSeasonMatches: [], nextMatch: null, isMatchesLoading: true,
  addCrystals: () => {}, addCredits: () => {}, updatePlayer: () => {}, removePlayer: () => {}, assignToRole: () => {}, updateTactics: () => {},
  claimReward: () => {}, setLanguage: () => {}, purchaseLicense: () => false, purchasePremium: () => false,
  setTrainingFocus: () => {}, startDailyPlayerTraining: () => {}, claimDailyPlayerTraining: () => {},
  recoverAllFatigue: () => false, hireStaffMember: () => {}, trainStaffSkill: () => false,
  addPlayerDirectly: () => {}, addYouthPlayerDirectly: () => {}, promoteYouthPlayer: () => {},
  updateProfileName: () => {}, updateProfileCountry: () => {}, recordMatch: () => {},
  markMatchIdAsSeen: () => {}, upgradeManagerSkill: () => {},
  startArenaConstruction: () => false, startHQConstruction: () => false, startBootcampConstruction: () => false,
  startAcademyConstruction: () => false, startMedicalConstruction: () => false, startCapacityExpansion: () => false,
  accelerateConstruction: () => false, checkConstructions: () => {},
  scoutCandidates: () => {}, recruitCandidate: () => {}, clearScoutingReport: () => {},
  payStaffSalaries: async () => {}, healPlayer: () => {}, launchFanCampaign: () => {}
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

  useEffect(() => {
    if (isUserLoading || !user?.uid) return;
    const rootRef = doc(db, 'players_v10', user.uid);
    return onSnapshot(rootRef, (snap) => {
      if (!snap.exists()) return;
      const data = snap.data();
      const info = getGlobalSeasonInfo();
      setState(s => ({
        ...s, id: user.uid, displayName: data.displayName || "Manager",
        selectedLeagueId: data.selectedLeagueId || null, leagueLevel: Number(data.leagueLevel || 9),
        groupId: Number(data.groupId || 1), country: data.country || null,
        lastSeenMatchDay: Number(data.lastSeenMatchDay || 0),
        activeSeasonNumber: Number(info.activeSeasonNumber),
        seasonNumber: Number(info.seasonNumber), seasonDay: Number(info.seasonDay), isLoaded: true
      }));
    });
  }, [user?.uid, isUserLoading, db]);

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
        ...prev, credits: Number(d.credits || 0), crystals: Number(d.crystals || 0),
        experiencePoints: d.experiencePoints ?? 0, managerLevel: d.managerLevel ?? 1,
        skillPoints: d.skillPoints ?? 0, lineup: d.lineup || prev.lineup,
        strategy: d.strategy || 'Balanced Play', lineSettings: d.lineSettings || prev.lineSettings,
        rewardDay: d.rewardDay ?? 1, lastRewardClaimDate: d.lastRewardClaimDate ?? null,
        matchHistory: d.matchHistory ?? [], managerSkills: d.managerSkills ?? { sponsors: 0, agents: 0, training: 0, medical: 0 },
        arena: d.arena ?? { capacity: 5000 }, hq: d.hq ?? {}, bootcamp: d.bootcamp ?? {}, academy: d.academy ?? {}, medical: d.medical ?? {},
        activeLicenseTier: d.activeLicenseTier ?? 4, premiumUntil: d.premiumUntil ?? null,
        isPremium: d.premiumUntil ? new Date(d.premiumUntil) > new Date() : false,
        rank: d.rank ?? 8, scoutingCandidates: d.scoutingCandidates || [], lastScoutDate: d.lastScoutDate || null
      }));
    });

    const playersUnsub = onSnapshot(collection(teamRef, 'heroes'), (hSnap) => {
      const all = hSnap.docs.map(d => ({ ...d.data(), id: d.id } as Player));
      setState(prev => ({ 
        ...prev, 
        ownedPlayers: all.filter(h => h.isYouth !== true), 
        youthAcademyPlayers: all.filter(h => h.isYouth === true) 
      }));
    });

    const staffUnsub = onSnapshot(collection(teamRef, 'staff'), (sSnap) => {
      const staffObj: any = { coach: null, analyst: null, scout: null, doctor: null, financier: null };
      sSnap.docs.forEach(doc => { const m = doc.data() as StaffMember; staffObj[m.role] = m; });
      setState(prev => ({ ...prev, staff: staffObj }));
    });

    return () => { unsubTeam(); playersUnsub(); staffUnsub(); };
  }, [db, state.id, state.selectedLeagueId, state.leagueLevel, state.groupId, isUserLoading, user?.uid]);

  useEffect(() => {
    if (isUserLoading || !user?.uid || !state.isLoaded || !state.id || !state.selectedLeagueId) return;
    const info = getGlobalSeasonInfo();
    const q = query(collection(db, 'matches_v1'), where('seasonNumber', '==', info.activeSeasonNumber), limit(500));
    return onSnapshot(q, (snapshot) => {
      const loaded = snapshot.docs.map(d => ({ ...d.data(), id: d.id }));
      setAllMatches(loaded);
      setIsMatchesReady(true);
    });
  }, [db, state.id, state.selectedLeagueId, state.groupId, state.isLoaded, isUserLoading, user?.uid]);

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

  const addCrystals = (amount: number) => { const r = getRefs(); if (r) updateDoc(r.team, { crystals: Math.max(0, stateRef.current.crystals + amount) }); };
  const addCredits = (amount: number) => { const r = getRefs(); if (r) updateDoc(r.team, { credits: Math.max(0, stateRef.current.credits + amount) }); };
  
  const updatePlayer = (id: string, data: Partial<Player>, cr = 0, cy = 0) => {
    const r = getRefs(); if (!r) return;
    updateDoc(doc(collection(r.team, 'heroes'), id), data);
    if (cr || cy) updateDoc(r.team, { credits: stateRef.current.credits - cr, crystals: stateRef.current.crystals - cy });
  };

  const removePlayer = (id: string, refund: number) => {
    const r = getRefs(); if (!r) return;
    deleteDoc(doc(collection(r.team, 'heroes'), id));
    if (refund > 0) updateDoc(r.team, { credits: stateRef.current.credits + refund });
  };

  const assignToRole = (role: LineupSlot, playerId: string | null) => { const r = getRefs(); if (r) updateDoc(r.team, { [`lineup.${role}`]: playerId }); };
  const updateTactics = (strategy: string, lineSettings: any) => { const r = getRefs(); if (r) updateDoc(r.team, { strategy, lineSettings }); };
  
  const claimReward = (cr: number, cry: number) => { 
    const r = getRefs(); if (r) updateDoc(r.team, { credits: stateRef.current.credits + cr, crystals: stateRef.current.crystals + (stateRef.current.isPremium ? cry + 50 : cry), lastRewardClaimDate: getMoscowDateString(), rewardDay: (stateRef.current.rewardDay % 30) + 1 }); 
  };
  
  const purchaseLicense = (t: number, c: number) => { const r = getRefs(); if (!r || stateRef.current.crystals < c) return false; updateDoc(r.team, { crystals: stateRef.current.crystals - c, activeLicenseTier: t }); return true; };
  const purchasePremium = () => { const r = getRefs(); if (!r || stateRef.current.crystals < 5000) return false; const exp = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); updateDoc(r.team, { crystals: stateRef.current.crystals - 5000, premiumUntil: exp.toISOString() }); return true; };
  
  const setLanguage = (lang: string) => setState(s => ({ ...s, language: lang }));

  const setTrainingFocus = (playerId: string, focus: string | null) => updatePlayer(playerId, { trainingFocus: focus });
  const startDailyPlayerTraining = (id: string, f: string) => updatePlayer(id, { dailyTrainingFocus: f, dailyTrainingFinishTime: new Date(Date.now() + 86400000).toISOString() });
  
  const claimDailyPlayerTraining = (id: string) => {
    const p = stateRef.current.ownedPlayers.find(x => x.id === id) || stateRef.current.youthAcademyPlayers.find(x => x.id === id);
    if (p?.dailyTrainingFocus) {
      const cur = (p.proStats as any)[p.dailyTrainingFocus] || 0;
      updatePlayer(id, { proStats: { ...p.proStats, [p.dailyTrainingFocus]: Math.min(100, cur + 1) }, dailyTrainingFocus: null, dailyTrainingFinishTime: null });
    }
  };

  const recoverAllFatigue = (type: 'credits' | 'crystals') => {
    const cost = type === 'credits' ? 75000 : 150;
    if (stateRef.current[type] < cost) return false;
    if (type === 'credits') addCredits(-cost); else addCrystals(-cost);
    stateRef.current.ownedPlayers.forEach(p => updatePlayer(p.id, { fatigue: 0 }));
    return true;
  };

  const hireStaffMember = (m: StaffMember) => { const r = getRefs(); if (r) { setDoc(doc(collection(r.team, 'staff'), m.id), m); addCredits(-(m.salary / 2)); } };
  const trainStaffSkill = (role: StaffRole, key: 'primary' | 'secondary', cost: number) => {
    const r = getRefs(); if (!r || stateRef.current.crystals < cost) return false;
    const member = stateRef.current.staff[role]; if (!member) return false;
    addCrystals(-cost);
    updateDoc(doc(collection(r.team, 'staff'), member.id), { [`skills.${key}`]: Math.min(99, member.skills[key] + 1) });
    return true;
  };

  const addPlayerDirectly = (p: Player) => { const r = getRefs(); if (r) setDoc(doc(collection(r.team, 'heroes'), p.id), { ...p, isYouth: false }); };
  const addYouthPlayerDirectly = (p: Player) => { const r = getRefs(); if (r) setDoc(doc(collection(r.team, 'heroes'), p.id), { ...p, isYouth: true }); };
  const promoteYouthPlayer = (id: string) => updatePlayer(id, { isYouth: false });
  
  const updateProfileName = (n: string) => { const r = getRefs(); if (r) { updateDoc(r.root, { displayName: n }); updateDoc(r.team, { displayName: n }); } };
  const updateProfileCountry = (c: string) => { const r = getRefs(); if (r) updateDoc(r.root, { country: c }); };
  
  const recordMatch = (w: string, res: any, rew: number, opp: string, t: string, p: string, mId?: string) => {
    const r = getRefs(); if (!r) return; 
    const id = mId || `match_${Date.now()}`;
    const entry = { id, winner: w, scoreA: res.scoreA, scoreB: res.scoreB, opponentName: opp, type: t, playedAt: p, reward: rew, simulation: res, seen: false };
    updateDoc(r.team, { credits: stateRef.current.credits + rew, matchHistory: arrayUnion(entry) });
  };

  const markMatchIdAsSeen = (id: string) => { 
    const r = getRefs(); if (!r) return;
    const leagueMatch = allMatches.find(m => m.id === id);
    if (leagueMatch) updateDoc(r.root, { lastSeenMatchDay: Number(leagueMatch.day) });
    const newHistory = stateRef.current.matchHistory.map(m => m.id === id ? { ...m, seen: true } : m);
    updateDoc(r.team, { matchHistory: newHistory });
  };

  const scoutCandidates = () => {
    const r = getRefs(); if (!r) return;
    const candidates = Array.from({ length: 3 }).map((_, i) => generateScoutedPlayer(i, Number(stateRef.current.academy?.scoutsLevel || 0), `scout_${Date.now()}_${i}`));
    updateDoc(r.team, { scoutingCandidates: JSON.parse(JSON.stringify(candidates)), lastScoutDate: new Date().toISOString() });
  };

  const recruitCandidate = (playerId: string) => {
    const r = getRefs(); if (!r) return;
    const candidate = stateRef.current.scoutingCandidates.find(c => c.id === playerId);
    if (!candidate) return;
    setDoc(doc(collection(r.team, 'heroes'), candidate.id), { ...candidate, isYouth: true });
    updateDoc(r.team, { scoutingCandidates: stateRef.current.scoutingCandidates.filter(c => c.id !== playerId) });
  };

  const clearScoutingReport = () => {
    const r = getRefs(); if (r) updateDoc(r.team, { scoutingCandidates: [], lastScoutDate: null });
  };
  
  const payStaffSalaries = async () => {
    const r = getRefs(); if (!r) return;
    const today = getMoscowDateString();
    const teamSnap = await getDoc(r.team);
    if (teamSnap.exists() && teamSnap.data().lastStaffSalaryPaymentDate === today) return;
    let total = 0; Object.values(stateRef.current.staff).forEach(m => { if (m) total += m.salary; });
    if (total > 0) {
      await updateDoc(r.team, { credits: Math.max(0, stateRef.current.credits - total), lastStaffSalaryPaymentDate: today });
      await setDoc(doc(db, 'notifications_v7', `staff_${stateRef.current.id}_${today}`), { userId: stateRef.current.id, title: "Staff Salaries", description: `Deducted €${total.toLocaleString()}`, type: 'league', read: false, createdAt: new Date().toISOString() });
    }
  };

  const upgradeManagerSkill = (key: keyof GameState['managerSkills']) => {
    const r = getRefs(); if (!r || stateRef.current.skillPoints <= 0) return;
    updateDoc(r.team, { [`managerSkills.${key}`]: stateRef.current.managerSkills[key] + 1, skillPoints: stateRef.current.skillPoints - 1 });
  };

  const healPlayer = (playerId: string, type: 'credits' | 'crystals', cost: number) => {
    if (type === 'credits') addCredits(-cost); else addCrystals(-cost);
    updatePlayer(playerId, { isInjured: false, injuredUntil: null });
  };

  const launchFanCampaign = (type: string, cost: number, fans: number, loyalty: number) => {
    const r = getRefs(); if (!r) return;
    addCredits(-cost);
    const today = getMoscowDateString();
    const currentFanData = stateRef.current.arena?.fanclub || { fanCount: 5000, loyalty: 30 };
    updateDoc(r.team, { fanclub: { fanCount: (currentFanData.fanCount || 5000) + fans, loyalty: Math.min(100, (currentFanData.loyalty || 30) + loyalty), lastCampaignDate: today } });
  };

  const startArenaConstruction = (id: string, cost: number) => startConstruction('arena', id, cost);
  const startHQConstruction = (id: string, cost: number) => startConstruction('hq', id, cost);
  const startBootcampConstruction = (id: string, cost: number) => startConstruction('bootcamp', id, cost);
  const startAcademyConstruction = (id: string, cost: number) => startConstruction('academy', id, cost);
  const startMedicalConstruction = (id: string, cost: number) => startConstruction('medical', id, cost);
  
  const startCapacityExpansion = (seats: number, cost: number) => {
    const r = getRefs(); if (!r || stateRef.current.credits < cost) return false;
    addCredits(-cost);
    updateDoc(r.team, { 'arena.constructionStarts.capacity': new Date().toISOString(), 'arena.constructionFinishes.capacity': new Date(Date.now() + 12 * 3600000).toISOString(), 'arena.pendingCapacity': seats });
    return true;
  };

  const startConstruction = (cat: string, id: string, cost: number) => {
    const r = getRefs(); if (!r || stateRef.current.credits < cost) return false;
    const level = (stateRef.current as any)[cat][id] || 0;
    addCredits(-cost);
    updateDoc(r.team, { [`${cat}.constructionStarts.${id}`]: new Date().toISOString(), [`${cat}.constructionFinishes.${id}`]: new Date(Date.now() + (4 * (level + 1)) * 3600000).toISOString() });
    return true;
  };

  const accelerateConstruction = (type: string, id: string, mult: number, price: number) => {
    const r = getRefs(); if (!r || stateRef.current.crystals < price) return false;
    const data = (stateRef.current as any)[type];
    if (data.isAccelerated?.[id]) return false;
    const remaining = new Date(data.constructionFinishes[id]).getTime() - Date.now();
    addCrystals(-price);
    updateDoc(r.team, { [`${type}.constructionFinishes.${id}`]: new Date(Date.now() + (remaining / mult)).toISOString(), [`${type}.isAccelerated.${id}`]: true });
    return true;
  };

  const checkConstructions = useCallback(() => {
    const r = getRefs(); if (!r) return;
    const cats = ['arena', 'hq', 'bootcamp', 'academy', 'medical'];
    let updateFound = false; const newTeamData: any = {};
    cats.forEach(cat => {
      const data = (stateRef.current as any)[cat];
      if (data?.constructionFinishes) {
        Object.entries(data.constructionFinishes).forEach(([id, finishIso]: [string, any]) => {
          if (new Date() >= new Date(finishIso)) {
            updateFound = true; 
            if (id === 'capacity') {
              newTeamData[`${cat}.capacity`] = (data.capacity || 5000) + (data.pendingCapacity || 500);
              newTeamData[`${cat}.pendingCapacity`] = null;
            } else { newTeamData[`${cat}.${id}`] = (data[id] || 0) + 1; }
            newTeamData[`${cat}.constructionFinishes.${id}`] = null;
            newTeamData[`${cat}.constructionStarts.${id}`] = null;
          }
        });
      }
    });
    if (updateFound) updateDoc(r.team, newTeamData);
  }, [getRefs]);

  const nextMatchInfo = useMemo(() => {
    if (!user?.uid || !allMatches || allMatches.length === 0) return null;
    const futureMatches = allMatches.filter(m => (m.homeId === user.uid || m.awayId === user.uid) && !m.isFinished);
    if (futureMatches.length === 0) return null;
    const sorted = [...futureMatches].sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
    const next = sorted[0];
    return { match: next, opponentName: next.homeId === user.uid ? next.awayName : next.homeName, isHome: next.homeId === user.uid };
  }, [allMatches, user?.uid]);

  const value = useMemo(() => ({
    ...state, isDataReady: isMatchesReady && state.isLoaded, allSeasonMatches: allMatches, nextMatch: nextMatchInfo, isMatchesLoading: !isMatchesReady,
    addCrystals, addCredits, updatePlayer, removePlayer, assignToRole, updateTactics, claimReward, purchaseLicense, purchasePremium, setLanguage,
    setTrainingFocus, startDailyPlayerTraining, claimDailyPlayerTraining, recoverAllFatigue, hireStaffMember, trainStaffSkill, addPlayerDirectly, addYouthPlayerDirectly, promoteYouthPlayer, updateProfileName, updateProfileCountry, recordMatch, markMatchIdAsSeen, upgradeManagerSkill, startArenaConstruction, startHQConstruction, startBootcampConstruction, startAcademyConstruction, startMedicalConstruction, startCapacityExpansion, accelerateConstruction, checkConstructions, scoutCandidates, recruitCandidate, clearScoutingReport, payStaffSalaries, healPlayer, launchFanCampaign
  }), [state, isMatchesReady, state.isLoaded, allMatches, nextMatchInfo]);

  return <GameStateContext.Provider value={value as any}>{children}</GameStateContext.Provider>;
}

export function useGameState() {
  const context = useContext(GameStateContext);
  if (context === undefined) throw new Error('useGameState must be used within a GameStateProvider');
  return context;
}
