
'use client';

/**
 * Глобальное локальное хранилище v242 (ULTRA STABLE).
 * Исправлены ошибки ReferenceError и оптимизирована синхронизация.
 */

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode, useMemo } from 'react';
import { Player, StaffMember, StaffRole, generateScoutedPlayer, getRandomStartingSquad } from './moba-data';
import { getMoscowTime, getGlobalSeasonInfo, getMoscowDateString, getLevelThreshold } from './time-utils';
import { useUser, initializeFirebase } from '@/firebase';
import { doc, onSnapshot } from 'firebase/firestore';

export { getLevelThreshold };

export const STAT_KEYS = [
  'lastHitting', 'mapAwareness', 'positioning', 'reflexes',
  'manaManagement', 'objectiveControl', 'communication',
  'tiltResistance', 'versatility', 'ganking'
];

export type LineupSlot = 
  | 'carry' | 'mid' | 'offlane' | 'support' | 'full_support' 
  | 'sub_carry' | 'sub_mid' | 'sub_offlane' | 'sub_support' | 'sub_full_support'
  | 'res1' | 'res2' | 'res3' | 'res4' | 'res5' | 'res6' | 'res7' | 'res8';

export interface Gift {
  id: string;
  type: 'architect' | 'teambuilding' | 'grant' | 'shard' | 'curse' | 'secret';
  value: number;
  label: string;
  senderId?: string;
  senderName?: string;
  createdAt: string;
  claimed: boolean;
}

interface TrophyRecord {
  id: string;
  name: string;
  type: string;
  date: string;
  reward?: number;
}

interface GameState {
  credits: number; crystals: number; experiencePoints: number; managerLevel: number;
  leagueLevel: number; groupId: number; selectedLeagueId: string | null;
  displayName: string; id: string; numericId: number | null; isLoaded: boolean;
  clubName: string | null; clubLogo: string | null;
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
  isSyncing: boolean; language: string;
  isDataReady: boolean; isTeamLoaded: boolean; allSeasonMatches: any[]; nextMatch: any | null; isMatchesLoading: boolean;
  lastProcessedSeason: number;
  trophies: TrophyRecord[];
  version: number;
  
  availableGiftsToSend: Gift[];
  receivedGifts: Gift[];
  lastGiftGenDate: string | null;

  addCrystals: (amount: number) => void;
  addCredits: (amount: number) => void;
  updatePlayer: (id: string, data: Partial<Player>, costCredits?: number, costCrystals?: number) => void;
  removePlayer: (id: string, refund: number) => void;
  assignToRole: (role: LineupSlot, playerId: string | null) => void;
  updateLineup: (updates: Partial<Record<LineupSlot, string | null>>) => void;
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
  trainHeroSkill: (heroId: string, skillKey: string, amount: number) => Promise<boolean>;
  addPlayerDirectly: (player: Player) => void;
  addYouthPlayerDirectly: (player: Player) => void;
  promoteYouthPlayer: (playerId: string) => void;
  updateProfileName: (name: string) => void;
  updateProfileCountry: (country: string) => void;
  recordMatch: (winner: string, result: any, reward: number, opponentName: string, type: string, playedAt: string, matchId?: string, extraData?: any) => void;
  markMatchIdAsSeen: (id: string) => void;
  deleteMatchHistoryEntry: (id: string) => void;
  clearMatchHistory: () => void;
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
  addTrophy: (trophy: TrophyRecord) => void;
  setWorldReady: (isReady: boolean) => void;
  resetProfile: () => Promise<void>;
  
  sendGift: (gift: Gift, friendId: string, friendName: string) => Promise<boolean>;
  claimGift: (gift: Gift) => Promise<boolean>;
  generateDailyGifts: (gifts: Gift[]) => void;
  
  runTrialMatch: () => Promise<string | null>;
  saveToLocal: (state: Partial<GameState>) => void;
}

const STORAGE_KEY = 'lote_game_state_v242';

const DEFAULT_STATE: GameState = {
  credits: 1000000, crystals: 50, experiencePoints: 0, managerLevel: 1,
  leagueLevel: 9, groupId: 1, selectedLeagueId: null,
  displayName: 'Local Manager', id: '', numericId: null, isLoaded: false, isTeamLoaded: false,
  clubName: null, clubLogo: null,
  lineup: { 
    carry: null, mid: null, offlane: null, support: null, full_support: null, 
    sub_carry: null, sub_mid: null, sub_offlane: null, sub_support: null, sub_full_support: null,
    res1: null, res2: null, res3: null, res4: null, res5: null, res6: null, res7: null, res8: null 
  },
  ownedPlayers: [], youthAcademyPlayers: [], scoutingCandidates: [], lastScoutDate: null,
  staff: { coach: null, analyst: null, scout: null, doctor: null, financier: null },
  strategy: 'Balanced Play', lineSettings: { carry: 'standard', mid: 'standard', offlane: 'standard' },
  rewardDay: 1, lastRewardClaimDate: null, matchHistory: [], lastSeenMatchDay: 0,
  managerSkills: { sponsors: 0, agents: 0, training: 0, medical: 0 },
  arena: { capacity: 5000 }, hq: {}, bootcamp: {}, academy: {}, medical: {},
  country: null, isPremium: false, premiumUntil: null, activeSeasonNumber: 1, seasonNumber: 1, seasonDay: 1, isSyncing: false, language: 'ru',
  isDataReady: false, allSeasonMatches: [], nextMatch: null, isMatchesLoading: true,
  lastProcessedSeason: 0, trophies: [], version: 242,
  availableGiftsToSend: [], receivedGifts: [], lastGiftGenDate: null,
  addCrystals: () => {}, addCredits: () => {}, updatePlayer: () => {}, removePlayer: () => {}, assignToRole: () => {}, updateLineup: () => {}, updateTactics: () => {},
  claimReward: () => {}, setLanguage: () => {}, purchaseLicense: () => false, purchasePremium: () => false,
  setTrainingFocus: () => {}, startDailyPlayerTraining: () => {}, claimDailyPlayerTraining: () => {},
  recoverAllFatigue: () => false, hireStaffMember: () => {}, trainStaffSkill: () => false, trainHeroSkill: async () => false,
  addPlayerDirectly: () => {}, addYouthPlayerDirectly: () => {}, promoteYouthPlayer: () => {},
  updateProfileName: () => {}, updateProfileCountry: () => {}, recordMatch: () => {},
  markMatchIdAsSeen: () => {}, deleteMatchHistoryEntry: () => {}, clearMatchHistory: () => {},
  upgradeManagerSkill: () => {},
  startArenaConstruction: () => false, startHQConstruction: () => false, startBootcampConstruction: () => false,
  startAcademyConstruction: () => false, startMedicalConstruction: () => false, startCapacityExpansion: () => false,
  accelerateConstruction: () => false, checkConstructions: () => {},
  scoutCandidates: () => {}, recruitCandidate: () => {}, clearScoutingReport: () => {},
  payStaffSalaries: async () => {}, healPlayer: () => {}, launchFanCampaign: () => {},
  addTrophy: () => {}, setWorldReady: () => {}, resetProfile: async () => {},
  sendGift: async () => false, claimGift: async () => false, generateDailyGifts: () => {},
  runTrialMatch: async () => null,
  saveToLocal: () => {}
};

const GameStateContext = createContext<GameState | undefined>(undefined);

export function GameStateProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<GameState>(DEFAULT_STATE);
  const { user, isUserLoading } = useUser();
  const staticSeasonInfo = useMemo(() => getGlobalSeasonInfo(), []);

  const saveToLocal = useCallback((updates: Partial<GameState>) => {
    setState(prev => {
      const newState = { ...prev, ...updates };
      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(newState));
      }
      return newState;
    });
  }, []);

  const payStaffSalaries = useCallback(async () => {
    const totalS = state.ownedPlayers.reduce((acc, p) => acc + (p.salary || 0), 0);
    const finalC = Math.round(totalS * 0.55); // 45% subsidy
    if (state.credits >= finalC) {
      saveToLocal({ credits: state.credits - finalC });
    }
  }, [state.credits, state.ownedPlayers, saveToLocal]);

  useEffect(() => {
    if (isUserLoading) return;

    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.version < 242) {
          localStorage.removeItem(STORAGE_KEY);
          window.location.reload();
          return;
        }
        if (user && parsed.id && parsed.id !== user.uid) {
          setState(prev => ({ ...DEFAULT_STATE, id: user.uid, isLoaded: true, language: parsed.language || 'ru' }));
          return;
        }
        setState(prev => ({
          ...DEFAULT_STATE,
          ...parsed,
          id: user?.uid || parsed.id || '',
          isLoaded: true,
          activeSeasonNumber: staticSeasonInfo.activeSeasonNumber,
          seasonNumber: staticSeasonInfo.seasonNumber,
          seasonDay: staticSeasonInfo.seasonDay
        }));
      } catch (e) { setState(prev => ({ ...prev, isLoaded: true })); }
    } else { setState(prev => ({ ...prev, id: user?.uid || '', isLoaded: true })); }
  }, [isUserLoading, user, staticSeasonInfo]);

  useEffect(() => {
    if (!user?.uid || !state.isLoaded) return;
    const { firestore: db } = initializeFirebase();
    const playerRef = doc(db, 'players_v14', user.uid);
    const unsubscribe = onSnapshot(playerRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        saveToLocal({
          clubName: data.clubName || state.clubName,
          clubLogo: data.clubLogo || state.clubLogo,
          country: data.country || state.country,
          numericId: data.numericId || state.numericId,
          selectedLeagueId: data.selectedLeagueId,
          leagueLevel: Number(data.leagueLevel),
          groupId: Number(data.groupId),
          rank: Number(data.rank),
          isTeamLoaded: true,
          managerLevel: data.managerLevel || state.managerLevel,
          experiencePoints: data.experiencePoints || state.experiencePoints
        });
      } else {
        setState(prev => ({ ...prev, isTeamLoaded: false }));
      }
    });
    return () => unsubscribe();
  }, [user?.uid, state.isLoaded, saveToLocal]);

  const addCrystals = useCallback((amount: number) => saveToLocal({ crystals: (state.crystals || 0) + amount }), [state.crystals, saveToLocal]);
  const addCredits = useCallback((amount: number) => saveToLocal({ credits: (state.credits || 0) + amount }), [state.credits, saveToLocal]);
  
  const updatePlayer = useCallback((id: string, data: Partial<Player>, costCr = 0, costCry = 0) => {
    const newOwned = state.ownedPlayers.map(p => p.id === id ? { ...p, ...data } : p);
    const newYouth = state.youthAcademyPlayers.map(p => p.id === id ? { ...p, ...data } : p);
    saveToLocal({ ownedPlayers: newOwned, youthAcademyPlayers: newYouth, credits: (state.credits || 0) - costCr, crystals: (state.crystals || 0) - costCry });
  }, [state.ownedPlayers, state.youthAcademyPlayers, state.credits, state.crystals, saveToLocal]);

  const removePlayer = useCallback((id: string, refund: number) => {
    saveToLocal({ ownedPlayers: state.ownedPlayers.filter(p => p.id !== id), youthAcademyPlayers: state.youthAcademyPlayers.filter(p => p.id !== id), credits: (state.credits || 0) + refund });
  }, [state.ownedPlayers, state.youthAcademyPlayers, state.credits, saveToLocal]);

  const assignToRole = useCallback((role: LineupSlot, pId: string | null) => saveToLocal({ lineup: { ...state.lineup, [role]: pId } }), [state.lineup, saveToLocal]);
  const updateLineup = useCallback((updates: Partial<Record<LineupSlot, string | null>>) => saveToLocal({ lineup: { ...state.lineup, ...updates } }), [state.lineup, saveToLocal]);
  const updateTactics = useCallback((strategy: string, lineSettings: any) => saveToLocal({ strategy, lineSettings }), [saveToLocal]);

  const claimReward = useCallback((cr: number, cry: number) => {
    const cryGain = state.isPremium ? cry + 50 : cry;
    saveToLocal({ credits: (state.credits || 0) + cr, crystals: (state.crystals || 0) + cryGain, lastRewardClaimDate: getMoscowDateString(), rewardDay: ((state.rewardDay || 1) % 30) + 1 });
  }, [state.isPremium, state.credits, state.crystals, state.rewardDay, saveToLocal]);

  const setLanguage = useCallback((lang: string) => saveToLocal({ language: lang }), [saveToLocal]);

  const purchaseLicense = useCallback((t: number, c: number) => {
    if ((state.crystals || 0) < c) return false;
    saveToLocal({ crystals: state.crystals - c, activeLicenseTier: t }); return true;
  }, [state.crystals, saveToLocal]);

  const purchasePremium = useCallback(() => {
    if ((state.crystals || 0) < 5000) return false;
    const exp = new Date(getMoscowTime().getTime() + 30 * 24 * 60 * 60 * 1000);
    saveToLocal({ crystals: state.crystals - 5000, premiumUntil: exp.toISOString(), isPremium: true }); return true;
  }, [state.crystals, saveToLocal]);

  const setTrainingFocus = useCallback((pId: string, focus: string | null) => updatePlayer(pId, { trainingFocus: focus }), [updatePlayer]);
  const startDailyPlayerTraining = useCallback((pId: string, focus: string) => updatePlayer(pId, { dailyTrainingFocus: focus, dailyTrainingFinishTime: new Date(getMoscowTime().getTime() + 24 * 3600000).toISOString() }), [updatePlayer]);
  const claimDailyPlayerTraining = useCallback((pId: string) => updatePlayer(pId, { dailyTrainingFocus: null, dailyTrainingFinishTime: null }), [updatePlayer]);

  const recoverAllFatigue = useCallback((type: 'credits' | 'crystals') => {
    const cost = type === 'credits' ? 75000 : 150; const bal = type === 'credits' ? state.credits : state.crystals;
    if (bal < cost) return false;
    saveToLocal({ ownedPlayers: state.ownedPlayers.map(p => ({ ...p, fatigue: 100 })), [type]: bal - cost }); return true;
  }, [state.credits, state.crystals, state.ownedPlayers, saveToLocal]);

  const hireStaffMember = useCallback((m: StaffMember) => saveToLocal({ staff: { ...state.staff, [m.role]: m }, credits: (state.credits || 0) - (m.salary / 2) }), [state.staff, state.credits, saveToLocal]);
  
  const trainStaffSkill = useCallback((r: StaffRole, sk: 'primary' | 'secondary', cost: number) => {
    if ((state.crystals || 0) < cost) return false;
    const mem = state.staff[r]; if (!mem) return false;
    const upMem = { ...mem, skills: { ...mem.skills, [sk]: (mem.skills[sk] || 0) + 1 } };
    saveToLocal({ staff: { ...state.staff, [r]: upMem }, crystals: state.crystals - cost }); return true;
  }, [state.staff, state.crystals, saveToLocal]);

  const trainHeroSkill = useCallback(async (hId: string, sk: string, amt: number) => {
    const p = state.ownedPlayers.find(pl => pl.id === hId); if (!p) return false;
    updatePlayer(hId, { proStats: { ...p.proStats, [sk]: (p.proStats as any)[sk] + amt } as any }); return true;
  }, [state.ownedPlayers, updatePlayer]);

  const addPlayerDirectly = useCallback((p: Player) => saveToLocal({ ownedPlayers: [...state.ownedPlayers, p] }), [state.ownedPlayers, saveToLocal]);
  const addYouthPlayerDirectly = useCallback((p: Player) => saveToLocal({ youthAcademyPlayers: [...state.youthAcademyPlayers, { ...p, isYouth: true }] }), [state.youthAcademyPlayers, saveToLocal]);
  
  const promoteYouthPlayer = useCallback((pId: string) => {
    const p = state.youthAcademyPlayers.find(pl => pl.id === pId); if (!p) return;
    saveToLocal({ youthAcademyPlayers: state.youthAcademyPlayers.filter(pl => pl.id !== pId), ownedPlayers: [...state.ownedPlayers, { ...p, isYouth: false }] });
  }, [state.youthAcademyPlayers, state.ownedPlayers, saveToLocal]);

  const updateProfileName = useCallback((n: string) => saveToLocal({ clubName: n, displayName: n }), [saveToLocal]);
  const updateProfileCountry = useCallback((c: string) => saveToLocal({ country: c }), [saveToLocal]);
  const healPlayer = useCallback((pId: string, t: 'credits' | 'crystals', c: number) => { updatePlayer(pId, { isInjured: false, injuredUntil: null }); saveToLocal({ [t]: (state as any)[t] - c }); }, [state.credits, state.crystals, updatePlayer, saveToLocal]);
  const launchFanCampaign = useCallback((t: string, c: number, f: number, l: number) => saveToLocal({ credits: (state.credits || 0) - c, arena: { ...state.arena, fanCount: (state.arena.fanCount || 5000) + f, loyalty: (state.arena.loyalty || 30) + l } }), [state.credits, state.arena, saveToLocal]);
  const addTrophy = useCallback((trophy: TrophyRecord) => saveToLocal({ trophies: [...(state.trophies || []), trophy] }), [state.trophies, saveToLocal]);
  
  const resetProfile = useCallback(async () => { 
    if (typeof window !== 'undefined') localStorage.removeItem(STORAGE_KEY);
    setState({ ...DEFAULT_STATE, id: user?.uid || '', isLoaded: true }); 
  }, [user?.uid]);

  const recordMatch = useCallback((w: string, res: any, rew: number, opp: string, t: string, p: string, mId?: string, extra?: any) => {
    const id = mId || `match_${Date.now()}`; let newLvl = state.managerLevel; let newXp = state.experiencePoints + (t === 'league' ? 200 : 50);
    const thr = getLevelThreshold(newLvl); if (newXp >= thr) { newLvl++; newXp -= thr; }
    const entry = { id, winner: w, scoreA: res.scoreA, scoreB: res.scoreB, opponentName: opp, type: t, playedAt: p, simulation: res, seen: false, ...extra };
    saveToLocal({ credits: (state.credits || 0) + rew, experiencePoints: newXp, managerLevel: newLvl, matchHistory: [...state.matchHistory, entry] });
  }, [state.experiencePoints, state.managerLevel, state.credits, state.matchHistory, saveToLocal]);

  const markMatchIdAsSeen = useCallback((id: string) => {
    const mHistory = state.matchHistory.find(m => m.id === id); let updates: Partial<GameState> = {};
    if (mHistory) updates.matchHistory = state.matchHistory.map(m => m.id === id ? { ...m, seen: true } : m);
    const lMatch = (state.allSeasonMatches || []).find(m => m.id === id);
    if (lMatch && Number(lMatch.day) > (state.lastSeenMatchDay || 0)) updates.lastSeenMatchDay = Number(lMatch.day);
    if (Object.keys(updates).length > 0) saveToLocal(updates);
  }, [state.matchHistory, state.allSeasonMatches, state.lastSeenMatchDay, saveToLocal]);

  const deleteMatchHistoryEntry = useCallback((id: string) => saveToLocal({ matchHistory: state.matchHistory.filter(m => m.id !== id) }), [state.matchHistory, saveToLocal]);
  const clearMatchHistory = useCallback(() => saveToLocal({ matchHistory: [] }), [saveToLocal]);
  const upgradeManagerSkill = useCallback((k: keyof GameState['managerSkills']) => saveToLocal({ managerSkills: { ...state.managerSkills, [k]: (state.managerSkills[k] || 0) + 1 } }), [state.managerSkills, saveToLocal]);
  
  const startArenaConstruction = useCallback((id: string, cost: number) => {
    if (state.credits < cost) return false;
    const finish = new Date(getMoscowTime().getTime() + 4 * 3600000).toISOString();
    saveToLocal({ credits: (state.credits || 0) - cost, arena: { ...state.arena, constructionStarts: { ...state.arena.constructionStarts, [id]: getMoscowTime().toISOString() }, constructionFinishes: { ...state.arena.constructionFinishes, [id]: finish } } }); return true;
  }, [state.credits, state.arena, saveToLocal]);

  const startHQConstruction = useCallback((id: string, cost: number) => {
    if (state.credits < cost) return false;
    const finish = new Date(getMoscowTime().getTime() + 4 * 3600000).toISOString();
    saveToLocal({ credits: state.credits - cost, hq: { ...state.hq, constructionStarts: { ...state.hq.constructionStarts, [id]: getMoscowTime().toISOString() }, constructionFinishes: { ...state.hq.constructionFinishes, [id]: finish } } }); return true;
  }, [state.credits, state.hq, saveToLocal]);

  const startBootcampConstruction = useCallback((id: string, cost: number) => {
    if (state.credits < cost) return false;
    const finish = new Date(getMoscowTime().getTime() + 6 * 3600000).toISOString();
    saveToLocal({ credits: state.credits - cost, bootcamp: { ...state.bootcamp, constructionStarts: { ...state.bootcamp.constructionStarts, [id]: getMoscowTime().toISOString() }, constructionFinishes: { ...state.bootcamp.constructionFinishes, [id]: finish } } }); return true;
  }, [state.credits, state.bootcamp, saveToLocal]);

  const startAcademyConstruction = useCallback((id: string, cost: number) => {
    if (state.credits < cost) return false;
    const finish = new Date(getMoscowTime().getTime() + 8 * 3600000).toISOString();
    saveToLocal({ credits: state.credits - cost, academy: { ...state.academy, constructionStarts: { ...state.academy.constructionStarts, [id]: getMoscowTime().toISOString() }, constructionFinishes: { ...state.academy.constructionFinishes, [id]: finish } } }); return true;
  }, [state.credits, state.academy, saveToLocal]);

  const startMedicalConstruction = useCallback((id: string, cost: number) => {
    if (state.credits < cost) return false;
    const finish = new Date(getMoscowTime().getTime() + 4 * 3600000).toISOString();
    saveToLocal({ credits: state.credits - cost, medical: { ...state.medical, constructionStarts: { ...state.medical.constructionStarts, [id]: getMoscowTime().toISOString() }, constructionFinishes: { ...state.medical.constructionFinishes, [id]: finish } } }); return true;
  }, [state.credits, state.medical, saveToLocal]);

  const startCapacityExpansion = useCallback((seats: number, cost: number) => {
    if (state.credits < cost) return false;
    const finish = new Date(getMoscowTime().getTime() + 12 * 3600000).toISOString();
    saveToLocal({ credits: state.credits - cost, arena: { ...state.arena, constructionStarts: { ...state.arena.constructionStarts, capacity: getMoscowTime().toISOString() }, constructionFinishes: { ...state.arena.constructionFinishes, capacity: finish }, pendingCapacity: seats } }); return true;
  }, [state.credits, state.arena, saveToLocal]);

  const accelerateConstruction = useCallback((type: string, id: string, multiplier: number, price: number) => {
    if (state.crystals < price) return false;
    const target = (state as any)[type];
    const finish = new Date(target.constructionFinishes?.[id]).getTime();
    const remaining = finish - getMoscowTime().getTime();
    const newFinish = new Date(getMoscowTime().getTime() + (remaining / multiplier)).toISOString();
    saveToLocal({ crystals: state.crystals - price, [type]: { ...target, constructionFinishes: { ...target.constructionFinishes, [id]: newFinish }, isAccelerated: { ...target.isAccelerated, [id]: true } } }); return true;
  }, [state.crystals, saveToLocal]);

  const checkConstructions = useCallback(() => {
    const now = getMoscowTime().getTime();
    const updates: any = {};
    let changed = false;
    ['arena', 'hq', 'bootcamp', 'academy', 'medical'].forEach(type => {
      const target = (state as any)[type];
      if (target.constructionFinishes) {
        const newTarget = { ...target };
        let targetChanged = false;
        Object.entries(target.constructionFinishes).forEach(([id, finish]: [string, any]) => {
          if (now >= new Date(finish).getTime()) {
            if (id === 'capacity') { newTarget.capacity = (newTarget.capacity || 5000) + (newTarget.pendingCapacity || 0); delete newTarget.pendingCapacity; }
            else { newTarget[id] = (newTarget[id] || 0) + 1; }
            delete newTarget.constructionStarts[id]; delete newTarget.constructionFinishes[id];
            if (newTarget.isAccelerated) delete newTarget.isAccelerated[id];
            targetChanged = true; changed = true;
          }
        });
        if (targetChanged) updates[type] = newTarget;
      }
    });
    if (changed) saveToLocal(updates);
  }, [state, saveToLocal]);

  const scoutCandidates = useCallback(() => {
    const count = 3 + Math.floor((state.academy.scoutsLevel || 0) / 2);
    const newCandidates = Array.from({ length: count }).map((_, i) => generateScoutedPlayer(i, state.academy.scoutsLevel || 1));
    saveToLocal({ scoutingCandidates: newCandidates, lastScoutDate: getMoscowTime().toISOString() });
  }, [state.academy.scoutsLevel, saveToLocal]);

  const recruitCandidate = useCallback((playerId: string) => {
    const p = state.scoutingCandidates.find(pl => pl.id === playerId);
    if (p) saveToLocal({ scoutingCandidates: state.scoutingCandidates.filter(pl => pl.id !== playerId), youthAcademyPlayers: [...state.youthAcademyPlayers, p] });
  }, [state.scoutingCandidates, state.youthAcademyPlayers, saveToLocal]);

  const clearScoutingReport = useCallback(() => saveToLocal({ scoutingCandidates: [] }), [saveToLocal]);

  const setWorldReady = useCallback((r: boolean) => setState(prev => ({ ...prev, isDataReady: r })), []);
  
  const runTrialMatch = useCallback(async () => {
    const squad = (['carry', 'mid', 'offlane', 'support', 'full_support'] as LineupSlot[]).map(s => state.ownedPlayers.find(pl => pl.id === state.lineup[s])).filter(Boolean) as Player[];
    if (squad.length < 5) return null; const cName = state.clubName || "My Club"; const oName = "Training Bot"; const mId = `trial_${Date.now()}`;
    const sim = { winner: cName, seriesScore: "1-0", games: [{ scoreA: 1, scoreB: 0, duration: "32:00", mvp: squad[0].name, matchSummary: "Solid local trial victory.", towersA: 11, towersB: 3, objectivesA: 4, objectivesB: 1, teamAOvr: Math.round(squad.reduce((a, p) => a + p.overallRating, 0) / 5), teamBOvr: 25, timeline: [{ time: "05:00", type: "kill", event: `${squad[0].name} gets first blood!`, score: "1:0" }], scoreboard: [...squad.map(p => ({ name: p.name, team: cName, role: p.role, kills: 2, deaths: 0, assists: 5, cs: 150, matchRating: 8.5, image: p.image }))], teamComparison: { farm: [70, 30], tactics: [60, 40], teamwork: [80, 20], reflexes: [75, 25] } }] };
    recordMatch(cName, sim, 0, oName, 'trial', new Date().toISOString(), mId); return mId;
  }, [state.clubName, state.lineup, state.ownedPlayers, recordMatch]);

  const value = useMemo(() => ({
    ...state, 
    addCrystals, addCredits, updatePlayer, removePlayer, assignToRole, 
    updateLineup, updateTactics, claimReward, purchaseLicense, purchasePremium, 
    setLanguage, setTrainingFocus, startDailyPlayerTraining, claimDailyPlayerTraining, 
    recoverAllFatigue, hireStaffMember, trainStaffSkill, trainHeroSkill, 
    addPlayerDirectly, addYouthPlayerDirectly, promoteYouthPlayer, 
    updateProfileName, updateProfileCountry, healPlayer, launchFanCampaign, 
    scoutCandidates, recruitCandidate, clearScoutingReport, upgradeManagerSkill, 
    startArenaConstruction, startHQConstruction, startBootcampConstruction, 
    startAcademyConstruction, startMedicalConstruction, startCapacityExpansion, 
    accelerateConstruction, checkConstructions, payStaffSalaries, addTrophy, 
    resetProfile, setWorldReady, markMatchIdAsSeen, deleteMatchHistoryEntry, 
    clearMatchHistory, 
    generateDailyGifts: (g: Gift[]) => saveToLocal({ availableGiftsToSend: g, lastGiftGenDate: getMoscowDateString() }), 
    sendGift: async () => true, claimGift: async () => true, runTrialMatch, saveToLocal
  }), [
    state, addCrystals, addCredits, updatePlayer, removePlayer, assignToRole, 
    updateLineup, updateTactics, claimReward, purchaseLicense, purchasePremium, 
    setLanguage, setTrainingFocus, startDailyPlayerTraining, claimDailyPlayerTraining, 
    recoverAllFatigue, hireStaffMember, trainStaffSkill, trainHeroSkill, 
    addPlayerDirectly, addYouthPlayerDirectly, promoteYouthPlayer, 
    updateProfileName, updateProfileCountry, healPlayer, launchFanCampaign, 
    scoutCandidates, recruitCandidate, clearScoutingReport, upgradeManagerSkill, 
    startArenaConstruction, startHQConstruction, startBootcampConstruction, 
    startAcademyConstruction, startMedicalConstruction, startCapacityExpansion, 
    accelerateConstruction, checkConstructions, payStaffSalaries, addTrophy, 
    resetProfile, setWorldReady, markMatchIdAsSeen, deleteMatchHistoryEntry, 
    clearMatchHistory, runTrialMatch, saveToLocal
  ]);

  return <GameStateContext.Provider value={value}>{children}</GameStateContext.Provider>;
}

export function useGameState() {
  const context = useContext(GameStateContext);
  if (context === undefined) throw new Error('useGameState must be used within a GameStateProvider');
  return context;
}
