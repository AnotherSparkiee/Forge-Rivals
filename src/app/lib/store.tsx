
'use client';

/**
 * @fileOverview Глобальное хранилище данных клуба с системой предварительной генерации матчей.
 */

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode, useRef } from 'react';
import { Hero, StaffMember, StaffRole } from './moba-data';
import { getMoscowTime, getGlobalSeasonInfo, getMoscowDateString } from './time-utils';
import { useUser, useAuth, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { doc, onSnapshot, collection, setDoc, deleteDoc, writeBatch, query, where, serverTimestamp, getDocs, arrayUnion } from 'firebase/firestore';
import { getMockGroupTeams, getSchedule, generateDeterministicMatchId, LEAGUES } from './leagues-data';

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
  groupMatches: any[]; 
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
  activeSeasonNumber: number;
  isSyncing: boolean;
  language: string;
  lastProcessedSeason: number;
  skillPoints: number;

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
  rewardDay: 1, lastRewardClaimDate: null, lastLeagueMatchDate: null, lastCupMatchDate: null, matchHistory: [], groupMatches: [], lastSeenMatchDay: 0,
  managerSkills: { sponsors: 0, agents: 0, training: 0, medical: 0 },
  managerLevel: 1, skillPoints: 0, lastProcessedSeason: 0,
  arena: { capacity: 5000 }, hq: {}, bootcamp: {}, academy: {}, medical: {},
  country: null, isPremium: false, premiumUntil: null, activeLicenseTier: null,
  rank: 8, seasonDay: 1, seasonNumber: 1, activeSeasonNumber: 1, isSyncing: false, language: 'ru',
  addCrystals: () => {}, addCredits: () => {}, updateHero: () => {}, removeHero: () => {}, assignToRole: () => {}, updateTactics: () => {},
  claimReward: () => {}, setLanguage: () => {}, purchaseLicense: () => false, purchasePremium: () => false,
  syncStats: () => {}, setTrainingFocus: () => {}, startDailyHeroTraining: () => {}, claimDailyHeroTraining: () => {},
  recoverAllFatigue: () => false, hireStaffMember: () => {}, trainStaffSkill: () => false,
  addHeroDirectly: () => {}, addYouthHeroDirectly: () => {}, promoteYouthPlayer: () => {},
  updateProfileName: () => {}, updateProfileCountry: () => {}, recordMatch: () => {},
  markMatchAsSeen: () => {}, markMatchIdAsSeen: () => {}, upgradeManagerSkill: () => {}
};

const GameStateContext = createContext<GameState | undefined>(undefined);

export function GameStateProvider({ children }: { children: ReactNode }) {
  const { user, isUserLoading } = useUser();
  const db = useFirestore();
  const [state, setState] = useState<GameState>(DEFAULT_STATE);
  const stateRef = useRef(state);
  useEffect(() => { stateRef.current = state; }, [state]);

  const [lang, setLang] = useState('ru');
  const setLanguage = (l: string) => setLang(l);

  // Group Matches Listener
  const groupMatchesQuery = useMemoFirebase(() => {
    const s = stateRef.current;
    if (!s.selectedLeagueId || !s.isLoaded || !user) return null;
    
    const info = getGlobalSeasonInfo();
    return query(
      collection(db, 'matches_v1'),
      where('leagueId', '==', s.selectedLeagueId),
      where('divisionId', '==', s.leagueLevel),
      where('groupId', '==', s.groupId),
      where('seasonNumber', '==', info.activeSeasonNumber)
    );
  }, [db, state.selectedLeagueId, state.leagueLevel, state.groupId, state.isLoaded, user]);

  const { data: dbMatches } = useCollection(groupMatchesQuery);

  const processSeasonTransition = useCallback(async (userId: string, rootData: any, teamData: any) => {
    const { activeSeasonNumber } = getGlobalSeasonInfo();
    if (teamData.lastProcessedSeason >= activeSeasonNumber) return;

    console.log("ARCHITECT: Season transition triggered for", userId);
    const groupTeams = getMockGroupTeams(8, teamData.displayName || "My Team", rootData.leagueLevel, 1, rootData.groupId, rootData.selectedLeagueId, [], userId, 14);
    const myRank = groupTeams.findIndex(t => t.id === userId) + 1;

    let newLevel = rootData.leagueLevel;
    if (myRank === 1 && newLevel > 1) newLevel--;
    if (myRank >= 7 && newLevel < 9) newLevel++;

    const maxGroups = Math.pow(2, newLevel - 1);
    const newGroupId = Math.floor(Math.random() * maxGroups) + 1;

    const batch = writeBatch(db);
    const rootRef = doc(db, 'players_v10', userId);
    const oldTeamRef = doc(db, 'leagues_v2', rootData.selectedLeagueId, 'divisions', String(rootData.leagueLevel), 'groups', String(rootData.groupId), 'teams', userId);
    const newTeamRef = doc(db, 'leagues_v2', rootData.selectedLeagueId, 'divisions', String(newLevel), 'groups', String(newGroupId), 'teams', userId);

    batch.update(rootRef, { leagueLevel: newLevel, groupId: newGroupId });
    batch.set(newTeamRef, { ...teamData, lastProcessedSeason: activeSeasonNumber, wins: 0, draws: 0, losses: 0, points: 0 }, { merge: true });
    if (oldTeamRef.path !== newTeamRef.path) batch.delete(oldTeamRef);

    await batch.commit();
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
          country: rootData.country || null, isLoaded: true, language: lang
        }));
        return;
      }

      const teamRef = doc(db, 'leagues_v2', selectedLeagueId, 'divisions', String(leagueLevel || 9), 'groups', String(groupId || 1), 'teams', user.uid);
      
      const unsubTeam = onSnapshot(teamRef, (teamSnap) => {
        if (!teamSnap.exists()) return;
        const teamData = teamSnap.data() || {};
        processSeasonTransition(user.uid, rootData, teamData);

        const heroesUnsub = onSnapshot(collection(teamRef, 'heroes'), (hSnap) => {
          const allHeroes = hSnap.docs.map(d => ({ ...d.data(), id: d.id } as Hero));
          const staffUnsub = onSnapshot(collection(teamRef, 'staff'), (sSnap) => {
            const staffObj: any = {};
            sSnap.docs.forEach(d => { const m = d.data() as StaffMember; staffObj[m.role] = m; });
            const info = getGlobalSeasonInfo();

            setState(s => ({
              ...s, id: user.uid, displayName: rootData.displayName || teamData.displayName || "Manager",
              selectedLeagueId, leagueLevel: leagueLevel || 9, groupId: groupId || 1,
              credits: teamData.credits ?? 0, crystals: teamData.crystals ?? 0,
              experiencePoints: teamData.experiencePoints ?? 0, managerLevel: teamData.managerLevel ?? 1,
              skillPoints: teamData.skillPoints ?? 0, lineup: teamData.lineup || s.lineup,
              strategy: teamData.strategy || 'Balanced Play', lineSettings: teamData.lineSettings || s.lineSettings,
              rewardDay: teamData.rewardDay ?? 1, lastRewardClaimDate: teamData.lastRewardClaimDate ?? null,
              lastLeagueMatchDate: teamData.lastLeagueMatchDate ?? null, lastCupMatchDate: teamData.lastCupMatchDate ?? null,
              matchHistory: teamData.matchHistory ?? [], lastSeenMatchDay: teamData.lastSeenMatchDay ?? 0,
              managerSkills: teamData.managerSkills ?? { sponsors: 0, agents: 0, training: 0, medical: 0 },
              arena: teamData.arena ?? { capacity: 5000 }, hq: teamData.hq ?? {}, bootcamp: teamData.bootcamp ?? {},
              academy: teamData.academy ?? {}, medical: teamData.medical ?? {},
              country: rootData.country ?? null, isPremium: teamData.premiumUntil ? new Date(teamData.premiumUntil) > new Date() : false,
              premiumUntil: teamData.premiumUntil ?? null, activeLicenseTier: teamData.activeLicenseTier ?? 4,
              rank: teamData.rank ?? 8, ownedHeroes: allHeroes.filter(h => !h.isYouth), youthAcademyHeroes: allHeroes.filter(h => h.isYouth),
              staff: staffObj, seasonDay: info.seasonDay, seasonNumber: info.seasonNumber, activeSeasonNumber: info.activeSeasonNumber, isLoaded: true, language: lang,
              groupMatches: dbMatches || []
            }));
          });
        });
      });
    });
    return () => unsubRoot();
  }, [user, isUserLoading, db, lang, processSeasonTransition, dbMatches]);

  // LAZY CALENDAR GENERATOR
  useEffect(() => {
    const s = stateRef.current;
    if (!s.isLoaded || !s.selectedLeagueId || !user) return;

    const generateScheduleIfMissing = async () => {
      const { activeSeasonNumber } = getGlobalSeasonInfo();

      const existingQuery = query(
        collection(db, 'matches_v1'),
        where('leagueId', '==', s.selectedLeagueId),
        where('divisionId', '==', s.leagueLevel),
        where('groupId', '==', s.groupId),
        where('seasonNumber', '==', activeSeasonNumber)
      );
      
      const snap = await getDocs(existingQuery);
      if (snap.size >= 56) return;

      console.log("ARCHITECT: Initializing schedule for Season", activeSeasonNumber);
      
      const playersQuery = query(
        collection(db, 'players_v10'),
        where('selectedLeagueId', '==', s.selectedLeagueId),
        where('leagueLevel', '==', s.leagueLevel),
        where('groupId', '==', s.groupId)
      );
      const playersSnap = await getDocs(playersQuery);
      const players = playersSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      
      const teams = getMockGroupTeams(8, s.displayName, s.leagueLevel, 1, s.groupId, s.selectedLeagueId!, players, s.id, 0);
      const seasonSchedule = getSchedule(teams);
      
      const batch = writeBatch(db);
      const leagueInfo = LEAGUES.find(l => l.id === s.selectedLeagueId) || LEAGUES[0];
      const [h, m] = leagueInfo.startTime.split(':').map(Number);
      
      const info = getGlobalSeasonInfo();

      seasonSchedule.forEach((dayMatches, dIdx) => {
        const day = dIdx + 1;
        dayMatches.forEach((match: any, mIdx: number) => {
          const matchId = generateDeterministicMatchId(s.selectedLeagueId!, s.leagueLevel, s.groupId, activeSeasonNumber, day, mIdx);
          const matchRef = doc(db, 'matches_v1', matchId);
          
          const startTime = new Date(getMoscowTime());
          
          // Расчет даты начала: если сегодня день 15-16, то Day 1 будет через (17-day) дней.
          let daysToMatch = 0;
          if (info.seasonDay >= 15) {
            daysToMatch = (17 - info.seasonDay) + (day - 1);
          } else {
            daysToMatch = (day - info.seasonDay);
          }
          
          startTime.setDate(startTime.getDate() + daysToMatch);
          startTime.setHours(h, m, 0, 0);

          const matchData = {
            id: matchId,
            leagueId: s.selectedLeagueId,
            divisionId: s.leagueLevel,
            groupId: s.groupId,
            seasonNumber: activeSeasonNumber,
            day: day,
            startTime: startTime.toISOString(),
            type: 'league',
            status: 'pending',
            homeId: match.home.id,
            homeName: match.home.name,
            awayId: match.away.id,
            awayName: match.away.name,
            scoreA: 0,
            scoreB: 0,
            winnerId: null,
            createdAt: serverTimestamp()
          };
          batch.set(matchRef, matchData, { merge: true });
        });
      });
      
      await batch.commit();
      console.log("ARCHITECT: Schedule synchronized.");
    };

    generateScheduleIfMissing();
  }, [db, user, state.isLoaded, state.activeSeasonNumber, state.leagueLevel, state.groupId, state.selectedLeagueId]);

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

  const setTrainingFocus = (heroId: string, focus: string | null) => {
    updateHero(heroId, { trainingFocus: focus });
  };

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
    if ((type === 'credits' ? s.credits : s.crystals) < cost) return false;
    s.ownedHeroes.forEach(h => updateHero(h.id, { fatigue: 0 }));
    setDoc(refs.team, { [type]: (type === 'credits' ? s.credits : s.crystals) - cost }, { merge: true });
    return true;
  };

  const hireStaffMember = (member: StaffMember) => {
    const refs = getRefs(); if (!refs) return;
    const staffRef = doc(collection(refs.team, 'staff'), member.id);
    setDoc(staffRef, member);
    addCredits(-(member.salary / 2));
  };

  const trainStaffSkill = (role: StaffRole, skillKey: 'primary' | 'secondary', cost: number) => {
    const s = stateRef.current;
    const member = s.staff[role];
    if (!member || s.crystals < cost) return false;
    const refs = getRefs(); if (!refs) return false;
    const staffRef = doc(collection(refs.team, 'staff'), member.id);
    setDoc(staffRef, { skills: { ...member.skills, [skillKey]: Math.min(99, member.skills[skillKey] + 1) } }, { merge: true });
    addCrystals(-cost);
    return true;
  };

  const addHeroDirectly = (hero: Hero) => {
    const refs = getRefs(); if (!refs) return;
    setDoc(doc(collection(refs.team, 'heroes'), hero.id), hero);
  };

  const addYouthHeroDirectly = (hero: Hero) => {
    const refs = getRefs(); if (!refs) return;
    setDoc(doc(collection(refs.team, 'heroes'), hero.id), { ...hero, isYouth: true });
  };

  const promoteYouthPlayer = (heroId: string) => {
    updateHero(heroId, { isYouth: false });
  };

  const updateProfileName = (name: string) => {
    if (!user) return;
    setDoc(doc(db, 'players_v10', user.uid), { displayName: name }, { merge: true });
    const refs = getRefs(); if (refs) setDoc(refs.team, { displayName: name }, { merge: true });
  };

  const updateProfileCountry = (country: string) => {
    if (!user) return;
    setDoc(doc(db, 'players_v10', user.uid), { country }, { merge: true });
  };

  const recordMatch = (winner: string, result: any, reward: number, opponentName: string, type: string, playedAt: string, matchId?: string) => {
    const refs = getRefs(); if (!refs) return;
    const s = stateRef.current;
    const mId = matchId || `match_${Date.now()}`;
    const newEntry = {
      id: mId, winner, scoreA: result.scoreA, scoreB: result.scoreB,
      matchSummary: result.matchSummary, opponentName, type, playedAt, reward,
      seen: false, day: s.seasonDay, seasonNumber: s.seasonNumber,
      heroPerformance: result.scoreboard || []
    };
    setDoc(refs.team, { credits: s.credits + reward, matchHistory: arrayUnion(newEntry) }, { merge: true });
  };

  const markMatchAsSeen = (day: number) => {
    const refs = getRefs(); if (!refs) return;
    setDoc(refs.team, { lastSeenMatchDay: day }, { merge: true });
  };

  const markMatchIdAsSeen = (id: string) => {
    const refs = getRefs(); if (!refs) return;
    const hist = stateRef.current.matchHistory.map(m => m.id === id ? { ...m, seen: true } : m);
    setDoc(refs.team, { matchHistory: hist }, { merge: true });
  };

  const upgradeManagerSkill = (key: keyof GameState['managerSkills']) => {
    const s = stateRef.current;
    if (s.skillPoints <= 0) return;
    const refs = getRefs(); if (!refs) return;
    setDoc(refs.team, {
      skillPoints: s.skillPoints - 1,
      managerSkills: { ...s.managerSkills, [key]: s.managerSkills[key] + 1 }
    }, { merge: true });
  };

  const value = {
    ...state, setLanguage, addCrystals, addCredits, updateHero, removeHero, assignToRole, updateTactics, 
    claimReward, purchaseLicense, purchasePremium, syncStats,
    setTrainingFocus, startDailyHeroTraining, claimDailyHeroTraining, recoverAllFatigue,
    hireStaffMember, trainStaffSkill, addHeroDirectly, addYouthHeroDirectly,
    promoteYouthPlayer, updateProfileName, updateProfileCountry, recordMatch,
    markMatchAsSeen, markMatchIdAsSeen, upgradeManagerSkill
  } as any;

  return <GameStateContext.Provider value={value}>{children}</GameStateContext.Provider>;
}

export function useGameState() {
  const context = useContext(GameStateContext);
  if (context === undefined) throw new Error('useGameState must be used within a GameStateProvider');
  return context;
}
