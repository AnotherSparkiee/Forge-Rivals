
'use client';

/**
 * Глобальное облачное хранилище v213 (Firebase Server Sync).
 * Оптимизирована отказоустойчивость: переход на setDoc(merge) вместо updateDoc.
 */

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode, useMemo, useRef } from 'react';
import { Player, StaffMember, StaffRole, generateScoutedPlayer, getRandomStartingSquad } from './moba-data';
import { getMoscowTime, getGlobalSeasonInfo, getMoscowDateString, getLevelThreshold } from './time-utils';
import { useUser, useFirestore } from '@/firebase';
import { doc, onSnapshot, setDoc, collection, getDocs, writeBatch, serverTimestamp } from 'firebase/firestore';

export { getLevelThreshold };

export const STAT_KEYS = [
  'lastHitting', 'mapAwareness', 'positioning', 'reflexes',
  'manaManagement', 'objectiveControl', 'communication',
  'tiltResistance', 'versatility', 'ganking'
];

export type LineupSlot = 'carry' | 'mid' | 'offlane' | 'support' | 'full_support' | 'sub1' | 'sub2' | 'res1' | 'res2' | 'res3' | 'res4' | 'res5' | 'res6' | 'res7' | 'res8';

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
  
  saveToLocal: (state: Partial<GameState>) => void;
}

const DEFAULT_STATE: GameState = {
  credits: 1000000, crystals: 50, experiencePoints: 0, managerLevel: 1,
  leagueLevel: 9, groupId: 1, selectedLeagueId: null,
  displayName: 'Local Manager', id: 'local-manager', isLoaded: false, isTeamLoaded: false,
  clubName: null, clubLogo: null,
  lineup: { carry: null, mid: null, offlane: null, support: null, full_support: null, sub1: null, sub2: null, res1: null, res2: null, res3: null, res4: null, res5: null, res6: null, res7: null, res8: null },
  ownedPlayers: [], youthAcademyPlayers: [], scoutingCandidates: [], lastScoutDate: null,
  staff: { coach: null, analyst: null, scout: null, doctor: null, financier: null },
  strategy: 'Balanced Play', lineSettings: { carry: 'standard', mid: 'standard', offlane: 'standard' },
  rewardDay: 1, lastRewardClaimDate: null, matchHistory: [], lastSeenMatchDay: 0,
  managerSkills: { sponsors: 0, agents: 0, training: 0, medical: 0 },
  arena: { capacity: 5000 }, hq: {}, bootcamp: {}, academy: {}, medical: {},
  country: null, isPremium: false, premiumUntil: null, activeSeasonNumber: 1, seasonNumber: 1, seasonDay: 1, isSyncing: false, language: 'ru',
  isDataReady: false, allSeasonMatches: [], nextMatch: null, isMatchesLoading: true,
  lastProcessedSeason: 0, trophies: [], version: 213,
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
  saveToLocal: () => {}
};

function cleanData(obj: any): any {
  return JSON.parse(JSON.stringify(obj, (key, value) => {
    if (value === undefined) return null;
    if (typeof value === 'number' && isNaN(value)) return null;
    return value;
  }));
}

const GameStateContext = createContext<GameState | undefined>(DEFAULT_STATE);

export function GameStateProvider({ children }: { children: ReactNode }) {
  const { user, isUserLoading: isAuthLoading } = useUser();
  const db = useFirestore();
  const [state, setState] = useState<GameState>(DEFAULT_STATE);
  const [isDataInitialized, setIsDataReady] = useState(false);
  const staticSeasonInfo = useMemo(() => getGlobalSeasonInfo(), []);

  // SYNC WITH FIRESTORE
  useEffect(() => {
    if (!db || !user?.uid) {
      if (!isAuthLoading) setIsDataReady(true);
      return;
    }

    const docRef = doc(db, 'players_v10', user.uid);
    const unsub = onSnapshot(docRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setState(prev => ({
          ...DEFAULT_STATE, 
          ...data,
          id: user.uid,
          isLoaded: true,
          isTeamLoaded: !!data.selectedLeagueId,
          activeSeasonNumber: staticSeasonInfo.activeSeasonNumber,
          seasonNumber: staticSeasonInfo.seasonNumber,
          seasonDay: staticSeasonInfo.seasonDay
        }));
      } else {
        setState(prev => ({ ...prev, id: user.uid, isLoaded: true }));
      }
      setIsDataReady(true);
    }, (error) => {
      console.warn("Firestore Sync Error:", error);
      setIsDataReady(true);
    });

    return () => unsub();
  }, [db, user?.uid, isAuthLoading, staticSeasonInfo]);

  // LOGIC: Find Next Match
  useEffect(() => {
    if (state.allSeasonMatches && state.allSeasonMatches.length > 0 && state.id) {
      const now = getMoscowTime().getTime();
      const myMatches = state.allSeasonMatches
        .filter(m => (m.homeId === state.id || m.awayId === state.id) && !m.isFinished)
        .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
      
      const foundNext = myMatches[0];
      if (foundNext) {
        const isHome = foundNext.homeId === state.id;
        const opponentName = isHome ? foundNext.awayName : foundNext.homeName;
        const opponentLogo = isHome ? foundNext.awayLogo : foundNext.homeLogo;
        
        setState(prev => ({
          ...prev,
          nextMatch: {
            match: foundNext,
            opponentName,
            opponentLogo
          }
        }));
      } else {
        setState(prev => ({ ...prev, nextMatch: null }));
      }
    }
  }, [state.allSeasonMatches, state.id]);

  const saveToFirestore = useCallback(async (updates: Partial<GameState>) => {
    if (!db || !user?.uid) return;
    try {
      const docRef = doc(db, 'players_v10', user.uid);
      // setDoc with merge: true is more robust than updateDoc for rapid updates
      await setDoc(docRef, cleanData(updates), { merge: true });
    } catch (e: any) {
      console.error("Save to Firestore failed:", e.code, e.message);
      // Fallback: still update local state for better UX
      setState(prev => ({ ...prev, ...updates }));
    }
  }, [db, user?.uid]);

  const addCrystals = useCallback((amount: number) => {
    saveToFirestore({ crystals: (state.crystals || 0) + amount });
  }, [state.crystals, saveToFirestore]);

  const addCredits = useCallback((amount: number) => {
    saveToFirestore({ credits: (state.credits || 0) + amount });
  }, [state.credits, saveToFirestore]);

  const updatePlayer = useCallback((id: string, data: Partial<Player>, costCredits = 0, costCrystals = 0) => {
    const newOwned = state.ownedPlayers.map(p => p.id === id ? { ...p, ...data } : p);
    const newYouth = state.youthAcademyPlayers.map(p => p.id === id ? { ...p, ...data } : p);
    saveToFirestore({
      ownedPlayers: newOwned,
      youthAcademyPlayers: newYouth,
      credits: (state.credits || 0) - costCredits,
      crystals: (state.crystals || 0) - costCrystals
    });
  }, [state.ownedPlayers, state.youthAcademyPlayers, state.credits, state.crystals, saveToFirestore]);

  const removePlayer = useCallback((id: string, refund: number) => {
    saveToFirestore({
      ownedPlayers: state.ownedPlayers.filter(p => p.id !== id),
      youthAcademyPlayers: state.youthAcademyPlayers.filter(p => p.id !== id),
      credits: (state.credits || 0) + refund
    });
  }, [state.ownedPlayers, state.youthAcademyPlayers, state.credits, saveToFirestore]);

  const assignToRole = useCallback((role: LineupSlot, playerId: string | null) => {
    saveToFirestore({ lineup: { ...state.lineup, [role]: playerId } });
  }, [state.lineup, saveToFirestore]);

  const updateLineup = useCallback((updates: Partial<Record<LineupSlot, string | null>>) => {
    saveToFirestore({ lineup: { ...state.lineup, ...updates } });
  }, [state.lineup, saveToFirestore]);

  const updateTactics = useCallback((strategy: string, lineSettings: any) => {
    saveToFirestore({ strategy, lineSettings });
  }, [saveToFirestore]);

  const claimReward = useCallback((cr: number, cry: number) => {
    const crystalGain = state.isPremium ? cry + 50 : cry;
    saveToFirestore({
      credits: (state.credits || 0) + cr,
      crystals: (state.crystals || 0) + crystalGain,
      lastRewardClaimDate: getMoscowDateString(),
      rewardDay: ((state.rewardDay || 1) % 30) + 1
    });
  }, [state.isPremium, state.credits, state.crystals, state.rewardDay, saveToFirestore]);

  const setLanguage = useCallback((lang: string) => saveToFirestore({ language: lang }), [saveToFirestore]);

  const purchaseLicense = useCallback((t: number, c: number) => {
    if ((state.crystals || 0) < c) return false;
    saveToFirestore({ crystals: state.crystals - c, activeLicenseTier: t });
    return true;
  }, [state.crystals, saveToFirestore]);

  const purchasePremium = useCallback(() => {
    if ((state.crystals || 0) < 5000) return false;
    const exp = new Date(getMoscowTime().getTime() + 30 * 24 * 60 * 60 * 1000);
    saveToFirestore({ crystals: state.crystals - 5000, premiumUntil: exp.toISOString(), isPremium: true });
    return true;
  }, [state.crystals, saveToFirestore]);

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
    
    const newOwned = state.ownedPlayers.map(p => ({ ...p, fatigue: 100 }));
    saveToFirestore({
      ownedPlayers: newOwned,
      [type]: balance - cost
    });
    return true;
  }, [state.credits, state.crystals, state.ownedPlayers, saveToFirestore]);

  const hireStaffMember = useCallback((member: StaffMember) => {
    const newStaff = { ...state.staff, [member.role]: member };
    saveToFirestore({ staff: newStaff, credits: (state.credits || 0) - (member.salary / 2) });
  }, [state.staff, state.credits, saveToFirestore]);

  const trainStaffSkill = useCallback((role: StaffRole, skillKey: 'primary' | 'secondary', cost: number) => {
    if ((state.crystals || 0) < cost) return false;
    const member = state.staff[role];
    if (!member) return false;
    
    const updatedMember = {
      ...member,
      skills: { ...member.skills, [skillKey]: (member.skills[skillKey] || 0) + 1 }
    };
    const newStaff = { ...state.staff, [role]: updatedMember };
    saveToFirestore({ staff: newStaff, crystals: state.crystals - cost });
    return true;
  }, [state.staff, state.crystals, saveToFirestore]);

  const trainHeroSkill = useCallback(async (heroId: string, skillKey: string, amount: number) => {
    const player = state.ownedPlayers.find(p => p.id === heroId);
    if (!player) return false;
    const newStats = { ...player.proStats, [skillKey]: (player.proStats as any)[skillKey] + amount };
    updatePlayer(heroId, { proStats: newStats as any });
    return true;
  }, [state.ownedPlayers, updatePlayer]);

  const addPlayerDirectly = useCallback((player: Player) => {
    saveToFirestore({ ownedPlayers: [...state.ownedPlayers, player] });
  }, [state.ownedPlayers, saveToFirestore]);

  const addYouthPlayerDirectly = useCallback((player: Player) => {
    saveToFirestore({ youthAcademyPlayers: [...state.youthAcademyPlayers, { ...player, isYouth: true }] });
  }, [state.youthAcademyPlayers, saveToFirestore]);

  const promoteYouthPlayer = useCallback((playerId: string) => {
    const player = state.youthAcademyPlayers.find(p => p.id === playerId);
    if (!player) return;
    saveToFirestore({
      youthAcademyPlayers: state.youthAcademyPlayers.filter(p => p.id !== playerId),
      ownedPlayers: [...state.ownedPlayers, { ...player, isYouth: false }]
    });
  }, [state.youthAcademyPlayers, state.ownedPlayers, saveToFirestore]);

  const updateProfileName = useCallback((name: string) => {
    saveToFirestore({ clubName: name, displayName: name });
  }, [saveToFirestore]);

  const updateProfileCountry = useCallback((country: string) => {
    saveToFirestore({ country });
  }, [saveToFirestore]);

  const healPlayer = useCallback((playerId: string, type: 'credits' | 'crystals', cost: number) => {
    const balance = type === 'credits' ? state.credits : state.crystals;
    updatePlayer(playerId, { isInjured: false, injuredUntil: null });
    saveToFirestore({ [type]: balance - cost });
  }, [state.credits, state.crystals, updatePlayer, saveToFirestore]);

  const launchFanCampaign = useCallback((type: string, cost: number, fans: number, loyalty: number) => {
    saveToFirestore({
      credits: (state.credits || 0) - cost,
      arena: { 
        ...state.arena, 
        fanCount: (state.arena.fanCount || 5000) + fans, 
        loyalty: (state.arena.loyalty || 30) + loyalty 
      }
    });
  }, [state.credits, state.arena, saveToFirestore]);

  const addTrophy = useCallback((trophy: TrophyRecord) => {
    saveToFirestore({ trophies: [...state.trophies, trophy] });
  }, [state.trophies, saveToFirestore]);

  const resetProfile = useCallback(async () => {
    if (!db || !user?.uid) return;
    
    const resetData = {
      ...DEFAULT_STATE,
      id: user.uid,
      displayName: state.displayName || "Manager",
      email: user.email,
      credits: 1000000,
      crystals: 50,
      managerLevel: 1,
      experiencePoints: 0,
      version: 213,
      selectedLeagueId: null, 
      country: null,          
      clubName: null,
      clubLogo: null,
      ownedPlayers: [],
      youthAcademyPlayers: [],
      matchHistory: [],
      trophies: []
    };

    await setDoc(doc(db, 'players_v10', user.uid), cleanData(resetData));
    setState(resetData);
  }, [db, user?.uid, user?.email, state.displayName]);

  const recordMatch = useCallback((w: string, res: any, rew: number, opp: string, t: string, p: string, mId?: string, extra?: any) => {
    const id = mId || `match_${Date.now()}`;
    let newLevel = state.managerLevel; 
    let newTotalXp = state.experiencePoints + (t === 'league' ? 200 : (t === 'tournament' ? 250 : 50));
    
    const threshold = getLevelThreshold(newLevel);
    if (newTotalXp >= threshold) {
      newLevel++;
      newTotalXp -= threshold;
    }
    
    const historyEntry = { id, winner: w, scoreA: res.scoreA, scoreB: res.scoreB, opponentName: opp, type: t, playedAt: p, simulation: res, seen: false, isTbdWin: opp === 'TBD', homeId: extra?.homeId || null, awayId: extra?.awayId || null, homeLogo: extra?.homeLogo || null, awayLogo: extra?.awayLogo || null, homeName: extra?.homeName || null, awayName: extra?.awayName || null };
    
    saveToFirestore({
      credits: (state.credits || 0) + rew,
      experiencePoints: newTotalXp,
      managerLevel: newLevel,
      matchHistory: [...state.matchHistory, historyEntry]
    });
  }, [state.experiencePoints, state.managerLevel, state.credits, state.matchHistory, saveToFirestore]);

  const scoutCandidates = useCallback(() => {
    const candidates = Array.from({ length: 3 }).map((_, i) => generateScoutedPlayer(i, Number(state.academy?.scoutsLevel || 0), `scout_${getMoscowTime().getTime()}_${i}`));
    saveToFirestore({ scoutingCandidates: candidates, lastScoutDate: getMoscowTime().toISOString() });
  }, [state.academy?.scoutsLevel, saveToFirestore]);

  const recruitCandidate = useCallback((playerId: string) => {
    const candidate = state.scoutingCandidates.find(c => c.id === playerId);
    if (!candidate) return;
    saveToFirestore({
      youthAcademyPlayers: [...state.youthAcademyPlayers, { ...candidate, isYouth: true }],
      scoutingCandidates: state.scoutingCandidates.filter(c => c.id !== playerId)
    });
  }, [state.scoutingCandidates, state.youthAcademyPlayers, saveToFirestore]);

  const clearScoutingReport = useCallback(() => saveToFirestore({ scoutingCandidates: [], lastScoutDate: null }), [saveToFirestore]);
  
  const upgradeManagerSkill = useCallback((key: keyof GameState['managerSkills']) => {
    saveToFirestore({ 
      managerSkills: { ...state.managerSkills, [key]: (state.managerSkills[key] || 0) + 1 }
    });
  }, [state.managerSkills, saveToFirestore]);

  const startArenaConstruction = useCallback((id: string, cost: number) => {
    const currentLevel = (state.arena as any)[id] || 0;
    saveToFirestore({
      credits: (state.credits || 0) - cost,
      arena: {
        ...state.arena,
        constructionStarts: { ...state.arena.constructionStarts, [id]: getMoscowTime().toISOString() },
        constructionFinishes: { ...state.arena.constructionFinishes, [id]: new Date(getMoscowTime().getTime() + (4 * (currentLevel + 1)) * 3600000).toISOString() }
      }
    });
    return true;
  }, [state.credits, state.arena, saveToFirestore]);

  const generateDailyGifts = useCallback((gifts: Gift[]) => {
    saveToFirestore({ availableGiftsToSend: gifts, lastGiftGenDate: getMoscowDateString() });
  }, [saveToFirestore]);

  const sendGift = useCallback(async (gift: Gift, friendId: string, friendName: string) => {
    if (!db) return false;
    try {
      const now = new Date().toISOString();
      const giftId = `received_${friendId}_${Date.now()}`;
      await setDoc(doc(db, 'received_gifts_v1', giftId), {
        ...gift,
        id: giftId,
        senderId: state.id,
        senderName: state.clubName || state.displayName,
        receiverId: friendId,
        claimed: false,
        createdAt: now
      });
      saveToFirestore({ availableGiftsToSend: state.availableGiftsToSend.filter(g => g.id !== gift.id) });
      return true;
    } catch (e) {
      console.error(e);
      return false;
    }
  }, [db, state.id, state.clubName, state.displayName, state.availableGiftsToSend, saveToFirestore]);

  const claimGift = useCallback(async (gift: Gift) => {
    if (!db) return false;
    try {
      if (gift.type === 'grant') addCredits(gift.value);
      if (gift.type === 'shard') addCrystals(gift.value);
      
      await setDoc(doc(db, 'received_gifts_v1', gift.id), { claimed: true }, { merge: true });
      saveToFirestore({ receivedGifts: state.receivedGifts.filter(g => g.id !== gift.id) });
      return true;
    } catch (e) {
      console.error(e);
      return false;
    }
  }, [db, state.receivedGifts, addCredits, addCrystals, saveToFirestore]);

  const checkConstructions = useCallback(() => {}, []);

  const setWorldReady = useCallback((ready: boolean) => { setState(prev => ({ ...prev, isDataReady: ready })); }, []);

  const value = useMemo(() => ({
    ...state,
    isLoaded: isDataInitialized,
    addCrystals, addCredits, updatePlayer, removePlayer, assignToRole, updateLineup, updateTactics, claimReward, purchaseLicense, purchasePremium, setLanguage, setTrainingFocus, startDailyPlayerTraining, claimDailyPlayerTraining, recoverAllFatigue, hireStaffMember, trainStaffSkill, trainHeroSkill, addPlayerDirectly, addYouthPlayerDirectly, promoteYouthPlayer, updateProfileName, updateProfileCountry, healPlayer, launchFanCampaign, scoutCandidates, recruitCandidate, clearScoutingReport, upgradeManagerSkill, startArenaConstruction, resetProfile, addTrophy, setWorldReady,
    generateDailyGifts, sendGift, claimGift,
    saveToLocal: (updates: any) => saveToFirestore(updates)
  }), [state, isDataInitialized, addCrystals, addCredits, updatePlayer, removePlayer, assignToRole, updateLineup, updateTactics, claimReward, purchaseLicense, purchasePremium, setLanguage, setTrainingFocus, startDailyPlayerTraining, claimDailyPlayerTraining, recoverAllFatigue, hireStaffMember, trainStaffSkill, trainHeroSkill, addPlayerDirectly, addYouthPlayerDirectly, promoteYouthPlayer, updateProfileName, updateProfileCountry, healPlayer, launchFanCampaign, scoutCandidates, recruitCandidate, clearScoutingReport, upgradeManagerSkill, startArenaConstruction, resetProfile, addTrophy, setWorldReady, generateDailyGifts, sendGift, claimGift, saveToFirestore]);

  return <GameStateContext.Provider value={value}>{children}</GameStateContext.Provider>;
}

export function useGameState() {
  const context = useContext(GameStateContext);
  if (context === undefined) throw new Error('useGameState must be used within a GameStateProvider');
  return context;
}
