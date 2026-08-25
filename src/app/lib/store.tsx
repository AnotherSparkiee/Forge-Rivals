'use client';

/**
 * Глобальное локальное хранилище v222 (Reverted to Real Time).
 */

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode, useMemo } from 'react';
import { Player, StaffMember, StaffRole, generateScoutedPlayer, getRandomStartingSquad } from './moba-data';
import { getMoscowTime, getGlobalSeasonInfo, getMoscowDateString, getLevelThreshold } from './time-utils';

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
  displayName: string; id: string; isLoaded: boolean;
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

const STORAGE_KEY = 'lote_game_state_v222';

const DEFAULT_STATE: GameState = {
  credits: 1000000, crystals: 50, experiencePoints: 0, managerLevel: 1,
  leagueLevel: 9, groupId: 1, selectedLeagueId: null,
  displayName: 'Local Manager', id: 'init-node', isLoaded: false, isTeamLoaded: false,
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
  lastProcessedSeason: 0, trophies: [], version: 222,
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

const GameStateContext = createContext<GameState | undefined>(DEFAULT_STATE);

export function GameStateProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<GameState>(DEFAULT_STATE);
  const staticSeasonInfo = useMemo(() => getGlobalSeasonInfo(), []);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setState(prev => ({
          ...DEFAULT_STATE,
          ...parsed,
          isLoaded: true,
          isTeamLoaded: !!parsed.selectedLeagueId,
          activeSeasonNumber: staticSeasonInfo.activeSeasonNumber,
          seasonNumber: staticSeasonInfo.seasonNumber,
          seasonDay: staticSeasonInfo.seasonDay
        }));
      } catch (e) {
        console.error("Failed to load local state", e);
        setState(prev => ({ ...prev, isLoaded: true }));
      }
    } else {
      setState(prev => ({ ...prev, isLoaded: true }));
    }
  }, [staticSeasonInfo]);

  useEffect(() => {
    if (state.allSeasonMatches && state.allSeasonMatches.length > 0) {
      const myMatches = state.allSeasonMatches
        .filter(m => (m.homeId === state.id || m.awayId === state.id) && !m.isFinished)
        .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
      
      const foundNext = myMatches[0];
      if (foundNext) {
        const isHome = foundNext.homeId === state.id;
        setState(prev => ({
          ...prev,
          nextMatch: {
            match: foundNext,
            opponentName: isHome ? foundNext.awayName : foundNext.homeName,
            opponentLogo: isHome ? foundNext.awayLogo : foundNext.homeLogo
          }
        }));
      } else {
        setState(prev => ({ ...prev, nextMatch: null }));
      }
    }
  }, [state.allSeasonMatches, state.id]);

  const saveToLocal = useCallback((updates: Partial<GameState>) => {
    setState(prev => {
      const newState = { ...prev, ...updates };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newState));
      return newState;
    });
  }, []);

  const addCrystals = useCallback((amount: number) => saveToLocal({ crystals: (state.crystals || 0) + amount }), [state.crystals, saveToLocal]);
  const addCredits = useCallback((amount: number) => saveToLocal({ credits: (state.credits || 0) + amount }), [state.credits, saveToLocal]);

  const updatePlayer = useCallback((id: string, data: Partial<Player>, costCredits = 0, costCrystals = 0) => {
    const newOwned = state.ownedPlayers.map(p => p.id === id ? { ...p, ...data } : p);
    const newYouth = state.youthAcademyPlayers.map(p => p.id === id ? { ...p, ...data } : p);
    saveToLocal({
      ownedPlayers: newOwned,
      youthAcademyPlayers: newYouth,
      credits: (state.credits || 0) - costCredits,
      crystals: (state.crystals || 0) - costCrystals
    });
  }, [state.ownedPlayers, state.youthAcademyPlayers, state.credits, state.crystals, saveToLocal]);

  const removePlayer = useCallback((id: string, refund: number) => {
    saveToLocal({
      ownedPlayers: state.ownedPlayers.filter(p => p.id !== id),
      youthAcademyPlayers: state.youthAcademyPlayers.filter(p => p.id !== id),
      credits: (state.credits || 0) + refund
    });
  }, [state.ownedPlayers, state.youthAcademyPlayers, state.credits, saveToLocal]);

  const assignToRole = useCallback((role: LineupSlot, playerId: string | null) => {
    saveToLocal({ lineup: { ...state.lineup, [role]: playerId } });
  }, [state.lineup, saveToLocal]);

  const updateLineup = useCallback((updates: Partial<Record<LineupSlot, string | null>>) => {
    saveToLocal({ lineup: { ...state.lineup, ...updates } });
  }, [state.lineup, saveToLocal]);

  const updateTactics = useCallback((strategy: string, lineSettings: any) => {
    saveToLocal({ strategy, lineSettings });
  }, [saveToLocal]);

  const claimReward = useCallback((cr: number, cry: number) => {
    const crystalGain = state.isPremium ? cry + 50 : cry;
    saveToLocal({
      credits: (state.credits || 0) + cr,
      crystals: (state.crystals || 0) + crystalGain,
      lastRewardClaimDate: getMoscowDateString(),
      rewardDay: ((state.rewardDay || 1) % 30) + 1
    });
  }, [state.isPremium, state.credits, state.crystals, state.rewardDay, saveToLocal]);

  const setLanguage = useCallback((lang: string) => saveToLocal({ language: lang }), [saveToLocal]);

  const purchaseLicense = useCallback((t: number, c: number) => {
    if ((state.crystals || 0) < c) return false;
    saveToLocal({ crystals: state.crystals - c, activeLicenseTier: t });
    return true;
  }, [state.crystals, saveToLocal]);

  const purchasePremium = useCallback(() => {
    if ((state.crystals || 0) < 5000) return false;
    const exp = new Date(getMoscowTime().getTime() + 30 * 24 * 60 * 60 * 1000);
    saveToLocal({ crystals: state.crystals - 5000, premiumUntil: exp.toISOString(), isPremium: true });
    return true;
  }, [state.crystals, saveToLocal]);

  const setTrainingFocus = useCallback((playerId: string, focus: string | null) => {
    updatePlayer(playerId, { trainingFocus: focus });
  }, [updatePlayer]);

  const startDailyPlayerTraining = useCallback((playerId: string, focus: string) => {
    updatePlayer(playerId, { 
      dailyTrainingFocus: focus, 
      dailyTrainingFinishTime: new Date(getMoscowTime().getTime() + 24 * 3600000).toISOString() 
    });
  }, [updatePlayer]);

  const claimDailyPlayerTraining = useCallback((playerId: string) => {
    updatePlayer(playerId, { dailyTrainingFocus: null, dailyTrainingFinishTime: null });
  }, [updatePlayer]);

  const recoverAllFatigue = useCallback((type: 'credits' | 'crystals') => {
    const cost = type === 'credits' ? 75000 : 150;
    const balance = type === 'credits' ? state.credits : state.crystals;
    if (balance < cost) return false;
    saveToLocal({
      ownedPlayers: state.ownedPlayers.map(p => ({ ...p, fatigue: 100 })),
      [type]: balance - cost
    });
    return true;
  }, [state.credits, state.crystals, state.ownedPlayers, saveToLocal]);

  const hireStaffMember = useCallback((member: StaffMember) => {
    saveToLocal({ staff: { ...state.staff, [member.role]: member }, credits: (state.credits || 0) - (member.salary / 2) });
  }, [state.staff, state.credits, saveToLocal]);

  const trainStaffSkill = useCallback((role: StaffRole, skillKey: 'primary' | 'secondary', cost: number) => {
    if ((state.crystals || 0) < cost) return false;
    const member = state.staff[role];
    if (!member) return false;
    const updatedMember = { ...member, skills: { ...member.skills, [skillKey]: (member.skills[skillKey] || 0) + 1 } };
    saveToLocal({ staff: { ...state.staff, [role]: updatedMember }, crystals: state.crystals - cost });
    return true;
  }, [state.staff, state.crystals, saveToLocal]);

  const trainHeroSkill = useCallback(async (heroId: string, skillKey: string, amount: number) => {
    const player = state.ownedPlayers.find(p => p.id === heroId);
    if (!player) return false;
    const newStats = { ...player.proStats, [skillKey]: (player.proStats as any)[skillKey] + amount };
    updatePlayer(heroId, { proStats: newStats as any });
    return true;
  }, [state.ownedPlayers, updatePlayer]);

  const addPlayerDirectly = useCallback((player: Player) => saveToLocal({ ownedPlayers: [...state.ownedPlayers, player] }), [state.ownedPlayers, saveToLocal]);
  const addYouthPlayerDirectly = useCallback((player: Player) => saveToLocal({ youthAcademyPlayers: [...state.youthAcademyPlayers, { ...player, isYouth: true }] }), [state.youthAcademyPlayers, saveToLocal]);

  const promoteYouthPlayer = useCallback((playerId: string) => {
    const player = state.youthAcademyPlayers.find(p => p.id === playerId);
    if (!player) return;
    saveToLocal({
      youthAcademyPlayers: state.youthAcademyPlayers.filter(p => p.id !== playerId),
      ownedPlayers: [...state.ownedPlayers, { ...player, isYouth: false }]
    });
  }, [state.youthAcademyPlayers, state.ownedPlayers, saveToLocal]);

  const updateProfileName = useCallback((name: string) => saveToLocal({ clubName: name, displayName: name }), [saveToLocal]);
  const updateProfileCountry = useCallback((country: string) => saveToLocal({ country }), [saveToLocal]);
  const healPlayer = useCallback((playerId: string, type: 'credits' | 'crystals', cost: number) => {
    updatePlayer(playerId, { isInjured: false, injuredUntil: null });
    saveToLocal({ [type]: (state as any)[type] - cost });
  }, [state.credits, state.crystals, updatePlayer, saveToLocal]);

  const launchFanCampaign = useCallback((type: string, cost: number, fans: number, loyalty: number) => {
    saveToLocal({
      credits: (state.credits || 0) - cost,
      arena: { ...state.arena, fanCount: (state.arena.fanCount || 5000) + fans, loyalty: (state.arena.loyalty || 30) + loyalty }
    });
  }, [state.credits, state.arena, saveToLocal]);

  const resetProfile = useCallback(async () => {
    localStorage.removeItem(STORAGE_KEY);
    setState({ ...DEFAULT_STATE, isLoaded: true });
  }, []);

  const recordMatch = useCallback((w: string, res: any, rew: number, opp: string, t: string, p: string, mId?: string, extra?: any) => {
    const id = mId || `match_${Date.now()}`;
    let newLevel = state.managerLevel; 
    let newTotalXp = state.experiencePoints + (t === 'league' ? 200 : 50);
    const threshold = getLevelThreshold(newLevel);
    if (newTotalXp >= threshold) { newLevel++; newTotalXp -= threshold; }
    
    const entry = { id, winner: w, scoreA: res.scoreA, scoreB: res.scoreB, opponentName: opp, type: t, playedAt: p, simulation: res, seen: false, ...extra };
    saveToLocal({ credits: (state.credits || 0) + rew, experiencePoints: newTotalXp, managerLevel: newLevel, matchHistory: [...state.matchHistory, entry] });
  }, [state.experiencePoints, state.managerLevel, state.credits, state.matchHistory, saveToLocal]);

  const markMatchIdAsSeen = useCallback((id: string) => {
    const matchInHistory = state.matchHistory.find(m => m.id === id);
    let updates: Partial<GameState> = {};
    
    if (matchInHistory) {
      const newHistory = state.matchHistory.map(m => m.id === id ? { ...m, seen: true } : m);
      updates.matchHistory = newHistory;
    }

    const leagueMatch = (state.allSeasonMatches || []).find(m => m.id === id);
    if (leagueMatch && Number(leagueMatch.day) > (state.lastSeenMatchDay || 0)) {
      updates.lastSeenMatchDay = Number(leagueMatch.day);
    }

    if (Object.keys(updates).length > 0) {
      saveToLocal(updates);
    }
  }, [state.matchHistory, state.allSeasonMatches, state.lastSeenMatchDay, saveToLocal]);

  const deleteMatchHistoryEntry = useCallback((id: string) => {
    saveToLocal({ matchHistory: state.matchHistory.filter(m => m.id !== id) });
  }, [state.matchHistory, saveToLocal]);

  const clearMatchHistory = useCallback(() => {
    saveToLocal({ matchHistory: [] });
  }, [saveToLocal]);

  const scoutCandidates = useCallback(() => {
    const candidates = Array.from({ length: 3 }).map((_, i) => generateScoutedPlayer(i, Number(state.academy?.scoutsLevel || 0), `scout_${getMoscowTime().getTime()}_${i}`));
    saveToLocal({ scoutingCandidates: candidates, lastScoutDate: getMoscowTime().toISOString() });
  }, [state.academy?.scoutsLevel, saveToLocal]);

  const recruitCandidate = useCallback((playerId: string) => {
    const candidate = state.scoutingCandidates.find(c => c.id === playerId);
    if (!candidate) return;
    saveToLocal({ youthAcademyPlayers: [...state.youthAcademyPlayers, { ...candidate, isYouth: true }], scoutingCandidates: state.scoutingCandidates.filter(c => c.id !== playerId) });
  }, [state.scoutingCandidates, state.youthAcademyPlayers, saveToLocal]);

  const clearScoutingReport = useCallback(() => saveToLocal({ scoutingCandidates: [], lastScoutDate: null }), [saveToLocal]);
  const upgradeManagerSkill = useCallback((key: keyof GameState['managerSkills']) => saveToLocal({ managerSkills: { ...state.managerSkills, [key]: (state.managerSkills[key] || 0) + 1 } }), [state.managerSkills, saveToLocal]);

  const startArenaConstruction = useCallback((id: string, cost: number) => {
    saveToLocal({
      credits: (state.credits || 0) - cost,
      arena: {
        ...state.arena,
        constructionStarts: { ...state.arena.constructionStarts, [id]: getMoscowTime().toISOString() },
        constructionFinishes: { ...state.arena.constructionFinishes, [id]: new Date(getMoscowTime().getTime() + 4 * 3600000).toISOString() }
      }
    });
    return true;
  }, [state.credits, state.arena, saveToLocal]);

  const setWorldReady = useCallback((ready: boolean) => setState(prev => ({ ...prev, isDataReady: ready })), []);

  const runTrialMatch = useCallback(async () => {
    const activeSlots: LineupSlot[] = ['carry', 'mid', 'offlane', 'support', 'full_support'];
    const squad = activeSlots.map(s => state.ownedPlayers.find(p => p.id === state.lineup[s])).filter(Boolean) as Player[];
    
    if (squad.length < 5) return null;

    const clubName = state.clubName || "My Club";
    const opponentName = "Training Bot";
    const mId = `trial_${Date.now()}`;
    const now = new Date().toISOString();

    const simulation = {
      winner: clubName,
      seriesScore: "1-0",
      games: [{
        scoreA: 1, scoreB: 0,
        duration: "32:00",
        mvp: squad[0].name,
        matchSummary: "Solid local trial victory.",
        towersA: 11, towersB: 3,
        objectivesA: 4, objectivesB: 1,
        teamAOvr: Math.round(squad.reduce((a, p) => a + p.overallRating, 0) / 5),
        teamBOvr: 25,
        timeline: [
          { time: "05:00", type: "kill", event: `${squad[0].name} gets first blood!`, score: "1:0" },
          { time: "15:00", type: "tower", event: `${clubName} destroys mid tower!`, score: "1:0" },
          { time: "32:00", type: "objective", event: "Final ancient destroyed!", score: "1:0" }
        ],
        scoreboard: [
          ...squad.map(p => ({ name: p.name, team: clubName, role: p.role, kills: 2, deaths: 0, assists: 5, cs: 150, matchRating: 8.5, image: p.image })),
          { name: "Bot1", team: opponentName, role: "Carry", kills: 0, deaths: 2, assists: 0, cs: 100, matchRating: 5.0 }
        ],
        teamComparison: {
          farm: [70, 30], tactics: [60, 40], teamwork: [80, 20], reflexes: [75, 25]
        }
      }]
    };

    recordMatch(clubName, simulation, 0, opponentName, 'trial', now, mId);
    return mId;
  }, [state, recordMatch]);

  const value = useMemo(() => ({
    ...state,
    addCrystals, addCredits, updatePlayer, removePlayer, assignToRole, updateLineup, updateTactics, claimReward, purchaseLicense, purchasePremium, setLanguage, setTrainingFocus, startDailyPlayerTraining, claimDailyPlayerTraining, recoverAllFatigue, hireStaffMember, trainStaffSkill, trainHeroSkill, addPlayerDirectly, addYouthPlayerDirectly, promoteYouthPlayer, updateProfileName, updateProfileCountry, healPlayer, launchFanCampaign, scoutCandidates, recruitCandidate, clearScoutingReport, upgradeManagerSkill, startArenaConstruction, resetProfile, setWorldReady,
    markMatchIdAsSeen, deleteMatchHistoryEntry, clearMatchHistory,
    generateDailyGifts: (gifts: Gift[]) => saveToLocal({ availableGiftsToSend: gifts, lastGiftGenDate: getMoscowDateString() }),
    sendGift: async () => true, claimGift: async () => true,
    runTrialMatch,
    saveToLocal
  }), [state, addCrystals, addCredits, updatePlayer, removePlayer, assignToRole, updateLineup, updateTactics, claimReward, purchaseLicense, purchasePremium, setLanguage, setTrainingFocus, startDailyPlayerTraining, claimDailyPlayerTraining, recoverAllFatigue, hireStaffMember, trainStaffSkill, trainHeroSkill, addPlayerDirectly, addYouthPlayerDirectly, promoteYouthPlayer, updateProfileName, updateProfileCountry, healPlayer, launchFanCampaign, scoutCandidates, recruitCandidate, clearScoutingReport, upgradeManagerSkill, startArenaConstruction, resetProfile, setWorldReady, markMatchIdAsSeen, deleteMatchHistoryEntry, clearMatchHistory, runTrialMatch, saveToLocal]);

  return <GameStateContext.Provider value={value}>{children}</GameStateContext.Provider>;
}

export function useGameState() {
  const context = useContext(GameStateContext);
  if (context === undefined) throw new Error('useGameState must be used within a GameStateProvider');
  return context;
}
