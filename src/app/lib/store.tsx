
'use client';

/**
 * Глобальное локальное хранилище v245 (SERVER AUTHORITATIVE).
 * Прямые записи updateDoc удалены и заменены на Server Actions.
 */

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode, useMemo } from 'react';
import { Player, StaffMember, StaffRole, generateScoutedPlayer, getRandomStartingSquad } from './moba-data';
import { getMoscowTime, getGlobalSeasonInfo, getMoscowDateString, getLevelThreshold } from './time-utils';
import { useUser, initializeFirebase } from '@/firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { claimDailyRewardAction, purchasePremiumAction } from '@/app/actions/economy';
import { updateLineupAction, startDailyTrainingAction, listPlayerOnMarketAction } from '@/app/actions/gameplay';
import { useToast } from '@/hooks/use-toast';

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
  isDataReady: boolean; isTeamLoaded: boolean; isInitialSyncDone: boolean; allSeasonMatches: any[]; nextMatch: any | null; isMatchesLoading: boolean;
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

const STORAGE_KEY = 'lote_game_state_v245';

const DEFAULT_STATE: GameState = {
  credits: 1000000, crystals: 50, experiencePoints: 0, managerLevel: 1,
  leagueLevel: 9, groupId: 1, selectedLeagueId: null,
  displayName: 'Local Manager', id: '', numericId: null, isLoaded: false, isTeamLoaded: false, isInitialSyncDone: false,
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
  lastProcessedSeason: 0, trophies: [], version: 245,
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
  const { toast } = useToast();
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

  useEffect(() => {
    if (isUserLoading) return;
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (user && parsed.id && parsed.id !== user.uid) {
          setState(prev => ({ ...DEFAULT_STATE, id: user.uid, isLoaded: true, language: parsed.language || 'ru' }));
          return;
        }
        setState(prev => ({ ...DEFAULT_STATE, ...parsed, id: user?.uid || parsed.id || '', isLoaded: true }));
      } catch (e) { setState(prev => ({ ...prev, isLoaded: true })); }
    } else { setState(prev => ({ ...prev, id: user?.uid || '', isLoaded: true })); }
  }, [isUserLoading, user]);

  // СИНХРОНИЗАЦИЯ С FIRESTORE
  useEffect(() => {
    if (!user?.uid || !state.isLoaded) {
      if (state.isLoaded && !user) setState(prev => ({ ...prev, isInitialSyncDone: true }));
      return;
    }
    const { firestore: db } = initializeFirebase();
    const playerRef = doc(db, 'players_v14', user.uid);
    const unsubscribe = onSnapshot(playerRef, (snapshot) => {
      if (snapshot.exists()) {
        const d = snapshot.data();
        saveToLocal({
          ...d,
          isTeamLoaded: true,
          isInitialSyncDone: true,
          credits: Number(d.credits),
          crystals: Number(d.crystals)
        } as any);
      } else {
        setState(prev => ({ ...prev, isTeamLoaded: false, isInitialSyncDone: true }));
      }
    });
    return () => unsubscribe();
  }, [user?.uid, state.isLoaded, saveToLocal]);

  // ЗАЩИЩЕННЫЕ ДЕЙСТВИЯ (SERVER ACTIONS)
  
  const claimReward = useCallback(async () => {
    if (!user?.uid) return;
    const res = await claimDailyRewardAction(user.uid);
    if (res.success) {
      toast({ title: state.language === 'ru' ? "Награда получена!" : "Reward Claimed!" });
    } else {
      toast({ variant: "destructive", title: res.error });
    }
  }, [user?.uid, state.language, toast]);

  const purchasePremium = useCallback(() => {
    if (!user?.uid) return false;
    purchasePremiumAction(user.uid).then(res => {
      if (!res.success) toast({ variant: "destructive", title: res.error });
    });
    return true;
  }, [user?.uid, toast]);

  const updateLineup = useCallback((updates: any) => {
    if (!user?.uid) return;
    updateLineupAction(user.uid, updates);
  }, [user?.uid]);

  const startDailyPlayerTraining = useCallback((pId: string, focus: string) => {
    if (!user?.uid) return;
    startDailyTrainingAction(user.uid, pId, focus);
  }, [user?.uid]);

  const assignToRole = useCallback((role: LineupSlot, pId: string | null) => {
    updateLineup({ [role]: pId });
  }, [updateLineup]);

  const value = useMemo(() => ({
    ...state, 
    claimReward, purchasePremium, updateLineup, startDailyPlayerTraining, assignToRole,
    addCrystals: () => console.warn("Client-side state write blocked by security policy."),
    addCredits: () => console.warn("Client-side state write blocked by security policy."),
    updatePlayer: () => console.warn("Client-side state write blocked by security policy."),
    setLanguage: (lang: string) => saveToLocal({ language: lang }),
    saveToLocal,
    resetProfile: async () => { if (typeof window !== 'undefined') localStorage.removeItem(STORAGE_KEY); window.location.reload(); }
  }), [state, claimReward, purchasePremium, updateLineup, startDailyPlayerTraining, assignToRole, saveToLocal]);

  return <GameStateContext.Provider value={value}>{children}</GameStateContext.Provider>;
}

export function useGameState() {
  const context = useContext(GameStateContext);
  if (context === undefined) throw new Error('useGameState must be used within a GameStateProvider');
  return context;
}
