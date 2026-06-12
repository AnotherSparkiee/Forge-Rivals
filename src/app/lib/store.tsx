
'use client';

/**
 * @fileOverview Глобальное хранилище данных клуба.
 * Внедрена логика автоматического перехода сезона (Promotion/Relegation).
 */

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode, useRef } from 'react';
import { Hero, StaffMember, StaffRole } from './moba-data';
import { getMoscowTime, getGlobalSeasonInfo, getMoscowDateString } from './time-utils';
import { useUser, useFirestore } from '@/firebase';
import { doc, onSnapshot, collection, setDoc, deleteDoc, writeBatch, getDoc } from 'firebase/firestore';
import { getMockGroupTeams } from './leagues-data';

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
  lastProcessedSeason: number;

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
  lastProcessedSeason: 0,
  addCrystals: () => {}, addCredits: () => {}, updateHero: () => {}, removeHero: () => {}, assignToRole: () => {}, updateTactics: () => {},
  claimReward: () => {}, setLanguage: () => {}, purchaseLicense: () => false, purchasePremium: () => false
};

const GameStateContext = createContext<GameState | undefined>(undefined);

export function GameStateProvider({ children }: { children: ReactNode }) {
  const { user, isUserLoading } = useUser();
  const db = useFirestore();
  const [state, setState] = useState<GameState>(DEFAULT_STATE);
  const stateRef = useRef(state);
  useEffect(() => { stateRef.current = state; }, [state]);

  const [lang, setLang] = useState('ru');

  // Функция перехода сезона
  const processSeasonTransition = useCallback(async (userId: string, rootData: any, teamData: any) => {
    const { seasonNumber, isAfterTransition } = getGlobalSeasonInfo();
    
    // Если переход еще не настал или этот сезон уже обработан - выходим
    if (!isAfterTransition || teamData.lastProcessedSeason >= seasonNumber) return;

    console.log("ARCHITECT: Season transition triggered for", userId);

    // 1. Считаем итоговую позицию в лиге
    const groupTeams = getMockGroupTeams(
      8, teamData.displayName || "My Team", 
      rootData.leagueLevel, 1, rootData.groupId, 
      rootData.selectedLeagueId, [], userId, 14
    );
    
    const myStats = groupTeams.find(t => t.id === userId);
    const myRank = groupTeams.findIndex(t => t.id === userId) + 1;

    let newLevel = rootData.leagueLevel;
    if (myRank === 1 && newLevel > 1) newLevel--;
    if (myRank >= 7 && newLevel < 9) newLevel++;

    // 2. Новая случайная группа
    const maxGroups = Math.pow(2, newLevel - 1);
    const newGroupId = Math.floor(Math.random() * maxGroups) + 1;

    const batch = writeBatch(db);
    const rootRef = doc(db, 'players_v10', userId);
    const oldTeamRef = doc(db, 'leagues_v2', rootData.selectedLeagueId, 'divisions', String(rootData.leagueLevel), 'groups', String(rootData.groupId), 'teams', userId);
    const newTeamRef = doc(db, 'leagues_v2', rootData.selectedLeagueId, 'divisions', String(newLevel), 'groups', String(newGroupId), 'teams', userId);

    // Обновляем указатели
    batch.update(rootRef, {
      leagueLevel: newLevel,
      groupId: newGroupId
    });

    // Переносим данные команды
    batch.set(newTeamRef, {
      ...teamData,
      lastProcessedSeason: seasonNumber,
      // Сброс статистики сезона
      wins: 0, draws: 0, losses: 0, points: 0
    }, { merge: true });

    // Если координаты сменились - удаляем старый документ
    if (oldTeamRef.path !== newTeamRef.path) {
      batch.delete(oldTeamRef);
    }

    await batch.commit();
    console.log("ARCHITECT: Transition complete. New coordinates:", newLevel, newGroupId);
  }, [db]);

  useEffect(() => {
    if (isUserLoading || !user) {
      if (!isUserLoading) setState(s => ({ ...s, isLoaded: true }));
      return;
    }

    const rootRef = doc(db, 'players_v10', user.uid);
    const unsubRoot = onSnapshot(rootRef, async (snap) => {
      if (!snap.exists()) {
        setState(s => ({ ...s, isLoaded: true, id: user.uid }));
        return;
      }
      const rootData = snap.data();
      const { selectedLeagueId, leagueLevel, groupId } = rootData;

      if (!selectedLeagueId) {
        setState(s => ({ 
          ...s, id: user.uid, displayName: rootData.displayName || "Manager", 
          country: rootData.country || null, isLoaded: true 
        }));
        return;
      }

      const teamRef = doc(db, 'leagues_v2', selectedLeagueId, 'divisions', String(leagueLevel || 9), 'groups', String(groupId || 1), 'teams', user.uid);
      
      const unsubTeam = onSnapshot(teamRef, (teamSnap) => {
        if (!teamSnap.exists()) {
          // Если документа нет (например, из-за перехода), пробуем запустить проверку
          return;
        }
        const teamData = teamSnap.data() || {};
        
        // Запускаем проверку сезона (Client-side Trigger)
        processSeasonTransition(user.uid, rootData, teamData);

        const heroesUnsub = onSnapshot(collection(teamRef, 'heroes'), (hSnap) => {
          const allHeroes = hSnap.docs.map(d => ({ ...d.data(), id: d.id } as Hero));
          const staffUnsub = onSnapshot(collection(teamRef, 'staff'), (sSnap) => {
            const staffObj: any = {};
            sSnap.docs.forEach(d => { const m = d.data() as StaffMember; staffObj[m.role] = m; });

            const { seasonDay, seasonNumber } = getGlobalSeasonInfo();

            setState(s => ({
              ...s,
              id: user.uid,
              displayName: rootData.displayName || teamData.displayName || "Manager",
              selectedLeagueId, 
              leagueLevel: leagueLevel || 9, 
              groupId: groupId || 1,
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
              ownedHeroes: allHeroes.filter(h => !h.isYouth),
              youthAcademyHeroes: allHeroes.filter(h => h.isYouth),
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
  }, [user, isUserLoading, db, lang, processSeasonTransition]);

  const getRefs = useCallback(() => {
    const s = stateRef.current;
    if (!user || !s.selectedLeagueId) return null;
    return {
      team: doc(db, 'leagues_v2', s.selectedLeagueId, 'divisions', String(s.leagueLevel), 'groups', String(s.groupId), 'teams', user.uid)
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

  const setLanguage = (l: string) => setLang(l);

  const value = {
    ...state,
    addCrystals, addCredits, updateHero, removeHero, assignToRole, updateTactics, 
    claimReward, setLanguage, purchaseLicense, purchasePremium
  } as any;

  return <GameStateContext.Provider value={value}>{children}</GameStateContext.Provider>;
}

export function useGameState() {
  const context = useContext(GameStateContext);
  if (context === undefined) throw new Error('useGameState must be used within a GameStateProvider');
  return context;
}
