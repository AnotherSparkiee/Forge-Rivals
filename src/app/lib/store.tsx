
'use client';

/**
 * @fileOverview Глобальное хранилище данных клуба.
 * Реализует иерархическую загрузку: Root Pointer (players_v10) -> League Group -> Team Data.
 */

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode, useRef } from 'react';
import { Hero, StaffMember, StaffRole } from './moba-data';
import { getMoscowTime, getGlobalSeasonInfo, getMoscowDateString } from './time-utils';
import { useUser, useFirestore } from '@/firebase';
import { doc, onSnapshot, collection, updateDoc, setDoc, deleteDoc, arrayUnion } from 'firebase/firestore';

export type LineupSlot = 'carry' | 'mid' | 'offlane' | 'support' | 'full_support' | 'sub1' | 'sub2' | 'res1' | 'res2' | 'res3' | 'res4' | 'res5' | 'res6' | 'res7' | 'res8';

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
  lastLeagueMatchDate: string | null;
  lastCupMatchDate: string | null;
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
  activeLicenseTier: number | null;
  rank: number;
  seasonDay: number;
  seasonNumber: number;
  isSyncing: boolean;
  language: string;

  // Actions
  addCrystals: (amount: number) => void;
  addCredits: (amount: number) => void;
  updateHero: (id: string, data: Partial<Hero>, costCredits?: number, costCrystals?: number) => void;
  removeHero: (id: string, refund: number) => void;
  assignToRole: (role: LineupSlot, heroId: string | null) => void;
  updateTactics: (strategy: string, lineSettings: any) => void;
  setTrainingFocus: (heroId: string, skill: string | null) => void;
  startDailyHeroTraining: (heroId: string, skill: string) => void;
  claimDailyHeroTraining: (heroId: string) => void;
  recoverAllFatigue: (type: 'credits' | 'crystals') => boolean;
  hireStaffMember: (member: StaffMember) => void;
  trainStaffSkill: (role: StaffRole, skillKey: 'primary' | 'secondary', cost: number) => boolean;
  claimReward: (credits: number, crystals: number) => void;
  recordMatch: (winner: string, result: any, xpGain: number, opponentName: string, type: string, playedAt: string, matchId?: string) => void;
  markMatchAsSeen: (day: number) => void;
  markMatchIdAsSeen: (id: string) => void;
  syncStats: (groupPlayers: any[]) => void;
  upgradeManagerSkill: (skill: keyof GameState['managerSkills']) => void;
  addHeroDirectly: (hero: Hero) => void;
  addYouthHeroDirectly: (hero: Hero) => void;
  promoteYouthPlayer: (heroId: string) => void;
  updateProfileName: (name: string) => void;
  updateProfileCountry: (country: string) => void;
  purchaseLicense: (tier: number, cost: number) => boolean;
  purchasePremium: () => boolean;
  setLanguage: (lang: string) => void;
}

const DEFAULT_STATE: GameState = {
  credits: 0, crystals: 0, experiencePoints: 0, managerLevel: 1,
  leagueLevel: 9, groupId: 1, selectedLeagueId: null,
  displayName: 'Manager', id: '', isLoaded: false,
  lineup: { carry: null, mid: null, offlane: null, support: null, full_support: null, sub1: null, sub2: null, res1: null, res2: null, res3: null, res4: null, res5: null, res6: null, res7: null, res8: null },
  ownedHeroes: [], youthAcademyHeroes: [],
  staff: { coach: null, analyst: null, scout: null, doctor: null, financier: null },
  strategy: 'Balanced Play', lineSettings: { carry: 'standard', mid: 'standard', offlane: 'standard' },
  rewardDay: 1, lastRewardClaimDate: null, lastLeagueMatchDate: null, lastCupMatchDate: null, matchHistory: [], lastSeenMatchDay: 0,
  managerSkills: { sponsors: 0, agents: 0, training: 0, medical: 0 },
  arena: { capacity: 5000 }, hq: {}, bootcamp: {}, academy: {}, medical: {},
  country: null, isPremium: false, premiumUntil: null, activeLicenseTier: null,
  rank: 8, seasonDay: 1, seasonNumber: 1, isSyncing: false, language: 'ru',
  addCrystals: () => {}, addCredits: () => {}, updateHero: () => {}, removeHero: () => {}, assignToRole: () => {}, updateTactics: () => {},
  setTrainingFocus: () => {}, startDailyHeroTraining: () => {}, claimDailyHeroTraining: () => {}, recoverAllFatigue: () => false,
  hireStaffMember: () => {}, trainStaffSkill: () => false, claimReward: () => {}, recordMatch: () => {}, markMatchAsSeen: () => {},
  markMatchIdAsSeen: () => {}, syncStats: () => {}, upgradeManagerSkill: () => {},
  addHeroDirectly: () => {}, addYouthHeroDirectly: () => {}, promoteYouthPlayer: () => {}, updateProfileName: () => {}, updateProfileCountry: () => {},
  purchaseLicense: () => false, purchasePremium: () => false, setLanguage: () => {}
};

const GameStateContext = createContext<GameState | undefined>(undefined);

export function getLevelThreshold(lvl: number) { return (lvl * 1500) + (lvl > 5 ? (lvl - 5) * 2000 : 0); }

export function GameStateProvider({ children }: { children: ReactNode }) {
  const { user, isUserLoading } = useUser();
  const db = useFirestore();
  const [state, setState] = useState<GameState>(DEFAULT_STATE);
  const stateRef = useRef(state);
  useEffect(() => { stateRef.current = state; }, [state]);

  const [lang, setLang] = useState('ru');

  useEffect(() => {
    if (isUserLoading || !user) {
      if (!isUserLoading) setState(s => ({ ...s, isLoaded: true }));
      return;
    }

    // 1. Get Root Pointer
    const rootRef = doc(db, 'players_v10', user.uid);
    const unsubRoot = onSnapshot(rootRef, (snap) => {
      if (!snap.exists()) {
        setState(s => ({ ...s, isLoaded: true, id: user.uid }));
        return;
      }
      const rootData = snap.data();
      const { selectedLeagueId, leagueLevel, groupId } = rootData;

      if (!selectedLeagueId) {
        setState(s => ({ 
          ...s, 
          id: user.uid, 
          displayName: rootData.displayName || "Manager", 
          country: rootData.country || null,
          isLoaded: true 
        }));
        return;
      }

      // 2. Subscribe to Team Data in Pyramid Hierarchy
      const teamRef = doc(db, 'leagues_v2', selectedLeagueId, 'divisions', String(leagueLevel), 'groups', String(groupId), 'teams', user.uid);
      
      const unsubTeam = onSnapshot(teamRef, (teamSnap) => {
        const teamData = teamSnap.data() || {};
        
        // 3. Sub-collections (Heroes and Staff)
        const heroesUnsub = onSnapshot(collection(teamRef, 'heroes'), (hSnap) => {
          const allHeroes = hSnap.docs.map(d => ({ ...d.data(), id: d.id } as Hero));
          const owned = allHeroes.filter(h => !h.isYouth);
          const youth = allHeroes.filter(h => h.isYouth);
          
          const staffUnsub = onSnapshot(collection(teamRef, 'staff'), (sSnap) => {
            const staffObj: any = {};
            sSnap.docs.forEach(d => {
              const m = d.data() as StaffMember;
              staffObj[m.role] = m;
            });

            const { seasonDay, seasonNumber } = getGlobalSeasonInfo();

            setState(s => ({
              ...s,
              id: user.uid,
              displayName: rootData.displayName || teamData.displayName || "Manager",
              selectedLeagueId, leagueLevel, groupId,
              credits: teamData.credits ?? 0,
              crystals: teamData.crystals ?? 0,
              experiencePoints: teamData.experiencePoints ?? 0,
              managerLevel: teamData.managerLevel ?? 1,
              lineup: teamData.lineup || s.lineup,
              strategy: teamData.strategy || 'Balanced Play',
              lineSettings: teamData.lineSettings || s.lineSettings,
              rewardDay: teamData.rewardDay ?? 1,
              lastRewardClaimDate: teamData.lastRewardClaimDate ?? null,
              lastLeagueMatchDate: teamData.lastLeagueMatchDate ?? null,
              lastCupMatchDate: teamData.lastCupMatchDate ?? null,
              matchHistory: teamData.matchHistory ?? [],
              lastSeenMatchDay: teamData.lastSeenMatchDay ?? 0,
              managerSkills: teamData.managerSkills ?? { sponsors: 0, agents: 0, training: 0, medical: 0 },
              arena: teamData.arena ?? { capacity: 5000 },
              hq: teamData.hq ?? {},
              bootcamp: teamData.bootcamp ?? {},
              academy: teamData.academy ?? {},
              medical: teamData.medical ?? {},
              country: rootData.country ?? null,
              isPremium: teamData.premiumUntil ? new Date(teamData.premiumUntil) > new Date() : false,
              premiumUntil: teamData.premiumUntil ?? null,
              activeLicenseTier: teamData.activeLicenseTier ?? 4,
              rank: teamData.rank ?? 8,
              ownedHeroes: owned,
              youthAcademyHeroes: youth,
              staff: staffObj,
              seasonDay, seasonNumber,
              isLoaded: true,
              language: lang
            }));
          });
        });
      });
    });

    return () => unsubRoot();
  }, [user, isUserLoading, db, lang]);

  const getRefs = useCallback(() => {
    const s = stateRef.current;
    if (!user || !s.selectedLeagueId) return null;
    const root = doc(db, 'players_v10', user.uid);
    const team = doc(db, 'leagues_v2', s.selectedLeagueId, 'divisions', String(s.leagueLevel), 'groups', String(s.groupId), 'teams', user.uid);
    return { root, team };
  }, [user, db]);

  const addCrystals = (amount: number) => {
    const refs = getRefs(); if (!refs) return;
    updateDoc(refs.team, { crystals: Math.max(0, stateRef.current.crystals + amount) });
  };

  const addCredits = (amount: number) => {
    const refs = getRefs(); if (!refs) return;
    updateDoc(refs.team, { credits: Math.max(0, stateRef.current.credits + amount) });
  };

  const updateHero = (id: string, data: Partial<Hero>, costCredits = 0, costCrystals = 0) => {
    const refs = getRefs(); if (!refs) return;
    const heroRef = doc(collection(refs.team, 'heroes'), id);
    updateDoc(heroRef, data);
    if (costCredits || costCrystals) {
      updateDoc(refs.team, { 
        credits: stateRef.current.credits - costCredits,
        crystals: stateRef.current.crystals - costCrystals
      });
    }
  };

  const removeHero = (id: string, refund: number) => {
    const refs = getRefs(); if (!refs) return;
    deleteDoc(doc(collection(refs.team, 'heroes'), id));
    if (refund > 0) updateDoc(refs.team, { credits: stateRef.current.credits + refund });
  };

  const assignToRole = (role: LineupSlot, heroId: string | null) => {
    const refs = getRefs(); if (!refs) return;
    const newLineup = { ...stateRef.current.lineup, [role]: heroId };
    updateDoc(refs.team, { lineup: newLineup });
  };

  const updateTactics = (strategy: string, lineSettings: any) => {
    const refs = getRefs(); if (!refs) return;
    updateDoc(refs.team, { strategy, lineSettings });
  };

  const claimReward = (credits: number, crystals: number) => {
    const refs = getRefs(); if (!refs) return;
    const today = getMoscowDateString();
    updateDoc(refs.team, {
      credits: stateRef.current.credits + credits,
      crystals: stateRef.current.crystals + crystals,
      lastRewardClaimDate: today,
      rewardDay: (stateRef.current.rewardDay % 30) + 1
    });
  };

  const setLanguage = (l: string) => setLang(l);

  const value = {
    ...state,
    addCrystals, addCredits, updateHero, removeHero, assignToRole, updateTactics, 
    claimReward, setLanguage,
  } as any;

  return (
    <GameStateContext.Provider value={value}>
      {children}
    </GameStateContext.Provider>
  );
}

export function useGameState() {
  const context = useContext(GameStateContext);
  if (context === undefined) throw new Error('useGameState must be used within a GameStateProvider');
  return context;
}
