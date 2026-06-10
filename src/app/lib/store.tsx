
'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode, useRef, useMemo } from 'react';
import { Hero, StaffMember, StaffRole } from './moba-data';
import { getMoscowTime, getMoscowDateString, isMatchDue, getGlobalSeasonInfo } from './time-utils';
import { useUser, useFirestore } from '@/firebase';
import { doc, onSnapshot, setDoc, arrayUnion, collection, query, where, getDoc, getDocs, writeBatch, deleteDoc, updateDoc } from 'firebase/firestore';
import { getMockGroupTeams, LEAGUES } from './leagues-data';
import { usePathname } from 'next/navigation';
import { calculateXpGain, calculateHeroOVR, ActivityType } from './xp-utils';
import { setDocumentNonBlocking, updateDocumentNonBlocking } from '@/firebase/non-blocking-updates';

export type LineupSlot = 'carry' | 'mid' | 'offlane' | 'support' | 'full_support' | 'sub1' | 'sub2' | 'res1' | 'res2' | 'res3' | 'res4' | 'res5' | 'res6' | 'res7' | 'res8';

interface ArenaState {
  capacity: number; pressCenterLevel: number; cafeLevel: number; shopLevel: number; screensLevel: number; parkingLevel: number; lightingLevel: number; pendingCapacitySeats: number | null; constructionFinishes: Record<string, string | null>; constructionStarts: Record<string, string | null>; isAccelerated: Record<string, boolean>;
}
interface HQState { hrLevel: number; financeLevel: number; scoutsLevel: number; pressOfficeLevel: number; adminLevel: number; constructionFinishes: Record<string, string | null>; constructionStarts: Record<string, string | null>; isAccelerated: Record<string, boolean>; }
interface BootcampState { bootcampLevel: number; tacticsHallLevel: number; poolLevel: number; researchLevel: number; constructionFinishes: Record<string, string | null>; constructionStarts: Record<string, string | null>; isAccelerated: Record<string, boolean>; }
interface AcademyState { youthBootcampLevel: number; streamingLevel: number; scoutsLevel: number; discoLevel: number; constructionFinishes: Record<string, string | null>; constructionStarts: Record<string, string | null>; isAccelerated: Record<string, boolean>; }
interface MedicalState { physiotherapyLevel: number; massageLevel: number; psychiatristLevel: number; labLevel: number; psychologistLevel: number; constructionFinishes: Record<string, string | null>; constructionStarts: Record<string, string | null>; isAccelerated: Record<string, boolean>; }
interface StaffState { coach: StaffMember | null; analyst: StaffMember | null; scout: StaffMember | null; doctor: StaffMember | null; financier: StaffMember | null; }
export type MatchType = 'league' | 'cup' | 'friendly' | 'basket' | 'tournament' | 'trial';
export interface MatchResultEntry { id: string; day: number; seasonNumber?: number; type: MatchType; opponentName: string; winner: string; scoreA: number; scoreB: number; matchSummary: string; teamStats: any; heroPerformance: any[]; playedAt: string; timeline?: any[]; duration?: string; mvp?: string; preview?: any; postMatch?: any; seen?: boolean; }

interface GameState {
  credits: number; crystals: number; experiencePoints: number; managerLevel: number; skillPoints: number; managerSkills: { sponsors: number; agents: number; training: number; medical: number; }; activeLicenseTier: number | null; ownedHeroes: Hero[]; youthAcademyHeroes: Hero[]; team: Hero[]; lineup: Record<LineupSlot, string | null>; strategy: string; lineSettings: { carry: string; mid: string; offlane: string }; rank: number; matchHistory: MatchResultEntry[]; language: 'en' | 'ru'; wins: number; draws: number; losses: number; points: number; leagueLevel: number; divisionSubId: number; groupId: number; selectedLeagueId: string | null; country: string | null; associationId: string | null; lastLeagueMatchDate: null | string; lastCupMatchDate: null | string; lastSeenMatchDay: number; seasonDay: number; seasonNumber: number; lastProcessedSeason: number; lastYouthArrivalDay: number; lastYouthArrivalSeason: number; seasonStartDate: string | null; lastRewardClaimDate: string | null; rewardDay: number; arena: ArenaState; hq: HQState; bootcamp: BootcampState; academy: AcademyState; medical: MedicalState; staff: StaffState; seasonResults: { lastRank: number; lastPoints: number; promoted: boolean; demoted: boolean; seasonNumber: number; awardedTrophy: boolean; } | null; hasEliteTrophy: boolean; isSyncing: boolean; premiumUntil: string | null; displayName: string; id: string;
}

const DEFAULT_ARENA: ArenaState = { capacity: 5000, pressCenterLevel: 0, cafeLevel: 0, shopLevel: 0, screensLevel: 0, parkingLevel: 0, lightingLevel: 0, pendingCapacitySeats: null, constructionFinishes: {}, constructionStarts: {}, isAccelerated: {} };
const DEFAULT_HQ: HQState = { hrLevel: 0, financeLevel: 0, scoutsLevel: 0, pressOfficeLevel: 0, adminLevel: 0, constructionFinishes: {}, constructionStarts: {}, isAccelerated: {} };
const DEFAULT_BOOTCAMP: BootcampState = { bootcampLevel: 0, tacticsHallLevel: 0, poolLevel: 0, researchLevel: 0, constructionFinishes: {}, constructionStarts: {}, isAccelerated: {} };
const DEFAULT_ACADEMY: AcademyState = { youthBootcampLevel: 0, streamingLevel: 0, scoutsLevel: 0, discoLevel: 0, constructionFinishes: {}, constructionStarts: {}, isAccelerated: {} };
const DEFAULT_MEDICAL: MedicalState = { physiotherapyLevel: 0, massageLevel: 0, psychiatristLevel: 0, labLevel: 0, psychologistLevel: 0, constructionFinishes: {}, constructionStarts: {}, isAccelerated: {} };
const DEFAULT_STAFF: StaffState = { coach: null, analyst: null, scout: null, doctor: null, financier: null };
const DEFAULT_STATE: GameState = {
  credits: 10000000, crystals: 0, experiencePoints: 0, managerLevel: 1, skillPoints: 0, managerSkills: { sponsors: 0, agents: 0, training: 0, medical: 0 }, activeLicenseTier: 4, ownedHeroes: [], youthAcademyHeroes: [], team: [], lineup: { carry: null, mid: null, offlane: null, support: null, full_support: null, sub1: null, sub2: null, res1: null, res2: null, res3: null, res4: null, res5: null, res6: null, res7: null, res8: null }, strategy: 'Balanced Play', lineSettings: { carry: 'standard', mid: 'standard', offlane: 'standard' }, rank: 1000, matchHistory: [], language: 'ru', wins: 0, draws: 0, losses: 0, points: 0, leagueLevel: 9, divisionSubId: 1, groupId: 1, selectedLeagueId: null, country: null, associationId: null, lastSeenMatchDay: 0, lastLeagueMatchDate: null, lastCupMatchDate: null, seasonDay: 0, seasonNumber: 0, lastProcessedSeason: 0, lastYouthArrivalDay: 0, lastYouthArrivalSeason: 0, seasonStartDate: null, lastRewardClaimDate: null, rewardDay: 1, arena: DEFAULT_ARENA, hq: DEFAULT_HQ, bootcamp: DEFAULT_BOOTCAMP, academy: DEFAULT_ACADEMY, medical: DEFAULT_MEDICAL, staff: DEFAULT_STAFF, seasonResults: null, hasEliteTrophy: false, isSyncing: false, premiumUntil: null, displayName: 'Manager', id: ''
};

function sanitizeForFirestore(obj: any) { 
  if (obj === undefined) return null; 
  if (!obj) return obj; 
  try { 
    return JSON.parse(JSON.stringify(obj, (key, value) => value === undefined ? null : value)); 
  } catch (e) { 
    return null; 
  } 
}

export function getLevelThreshold(level: number): number { 
  if (level <= 1) return 700; 
  if (level === 2) return 1400; 
  if (level === 3) return 3800; 
  return Math.floor(3800 * Math.pow(1.5, level - 3)); 
}

interface GameStateContextType extends GameState {
  isLoaded: boolean; 
  isPremium: boolean;
  addCredits: (amount: number, isSponsorship?: boolean) => void; 
  addCrystals: (amount: number) => void; 
  assignToRole: (slot: LineupSlot, heroId: string | null) => void; 
  updateTactics: (strategy: string, lineSettings: { carry: string; mid: string; offlane: string }) => void; 
  startArenaConstruction: (facility: any, cost: number, crewMultiplier?: number, crystalCost?: number) => boolean; 
  startHQConstruction: (facility: any, cost: number, crewMultiplier?: number, crystalCost?: number) => boolean; 
  startBootcampConstruction: (facility: any, cost: number, crewMultiplier?: number, crystalCost?: number) => boolean; 
  startAcademyConstruction: (facility: any, cost: number, crewMultiplier?: number, crystalCost?: number) => boolean; 
  startMedicalConstruction: (facility: any, cost: number, crewMultiplier?: number, crystalCost?: number) => boolean; 
  accelerateConstruction: (sector: string, fac: string, multiplier: number, price: number) => boolean;
  startCapacityExpansion: (seats: number, cost: number, hours: number) => boolean; 
  checkConstructions: () => void; 
  setLanguage: (lang: 'en' | 'ru') => void; 
  recordMatch: (winner: string, result: any, matchDay: number, opponentName: string, type: MatchResultEntry['type'], customPlayedAt?: string, customId?: string, customSeason?: number) => void; 
  recordMatchGlobal: (matchData: any) => void;
  claimReward: (creditsReward: number, crystalsReward: number) => void; 
  syncStats: (groupPlayers: any[]) => void; 
  dismissSeasonResults: () => void; 
  setSyncing: (val: boolean) => void; 
  setTrainingFocus: (heroId: string, skillKey: string | null) => void; 
  startDailyHeroTraining: (heroId: string, skillKey: string) => void; 
  claimDailyHeroTraining: (heroId: string) => void; 
  updateHero: (heroId: string, updates: Partial<Hero>, creditCost?: number, crystalCost?: number) => void; 
  promoteYouthPlayer: (heroId: string) => void; 
  removeHero: (heroId: string, sellCreditAmount?: number) => void; 
  recoverAllFatigue: (costType: 'credits' | 'crystals') => boolean; 
  hireStaffMember: (member: StaffMember) => void; 
  trainStaffSkill: (role: StaffRole, skillKey: 'primary' | 'secondary', cost: number) => boolean; 
  addHeroDirectly: (hero: Hero) => void; 
  addYouthHeroDirectly: (hero: Hero) => void; 
  updateProfileName: (name: string) => void; 
  updateProfileCountry: (countryName: string) => void; 
  purchaseLicense: (tier: number, cost: number) => boolean; 
  purchasePremium: () => boolean;
  upgradeManagerSkill: (skillKey: keyof GameState['managerSkills']) => void; 
  markMatchAsSeen: (day: number) => void;
  markMatchIdAsSeen: (matchId: string) => void;
}

const GameStateContext = createContext<GameStateContextType | undefined>(undefined);

export function GameStateProvider({ children }: { children: ReactNode }) {
  const { user, isUserLoading } = useUser();
  const db = useFirestore();
  const pathname = usePathname();
  const [state, setState] = useState<GameState>(DEFAULT_STATE);
  const [isLoaded, setIsLoaded] = useState(false);
  const lastSyncRef = useRef<{ season: number, day: number, leagueId: string | null } | null>(null);
  const lastWritePayloadRef = useRef<string>("");

  const isPremium = useMemo(() => {
    if (!state.premiumUntil) return false;
    return new Date(state.premiumUntil).getTime() > getMoscowTime().getTime();
  }, [state.premiumUntil]);

  // Hierarchical Path Resolver
  const getTeamRef = useCallback((league: string|null, level: number, group: number, uid: string) => {
    if (!league || !uid) return null;
    return doc(db, 'leagues', league, 'divisions', level.toString(), 'groups', group.toString(), 'teams', uid);
  }, [db]);

  const runCloudUpdate = useCallback((data: any) => {
    if (!user || !state.selectedLeagueId) return;
    const teamRef = getTeamRef(state.selectedLeagueId, state.leagueLevel, state.groupId, user.uid);
    if (!teamRef) return;
    
    const payloadStr = JSON.stringify(data);
    if (lastWritePayloadRef.current === payloadStr) return;
    lastWritePayloadRef.current = payloadStr;
    setDoc(teamRef, data, { merge: true }).catch(e => console.warn("Hierarchy sync err:", e.message));

    const discoveryKeys = ['displayName', 'selectedLeagueId', 'leagueLevel', 'groupId', 'divisionSubId', 'country', 'managerLevel', 'premiumUntil', 'associationId', 'createdAt'];
    const discoveryUpdate: any = {};
    discoveryKeys.forEach(k => { if (data[k] !== undefined) discoveryUpdate[k] = data[k]; });
    if (Object.keys(discoveryUpdate).length > 0) {
      setDoc(doc(db, 'players_v10', user.uid), discoveryUpdate, { merge: true });
    }
  }, [user, state.selectedLeagueId, state.leagueLevel, state.groupId, db, getTeamRef]);

  useEffect(() => {
    if (isUserLoading) { setIsLoaded(false); return; }
    if (!user) { setState(DEFAULT_STATE); setIsLoaded(true); return; }
    const isAuthPage = pathname?.startsWith('/auth') || pathname === '/setup';
    if (isAuthPage && !isLoaded) { setIsLoaded(true); return; }

    const rootRef = doc(db, 'players_v10', user.uid);
    const unsubRoot = onSnapshot(rootRef, (rootSnap) => {
      if (rootSnap.exists()) {
        const rootData = rootSnap.data();
        const { selectedLeagueId, leagueLevel: level, groupId: group } = rootData;
        
        if (selectedLeagueId && level !== undefined && group !== undefined) {
          const teamRef = doc(db, 'leagues', selectedLeagueId, 'divisions', level.toString(), 'groups', group.toString(), 'teams', user.uid);
          
          // Subscribe to sub-collections: heroes, staff
          const heroesUnsub = onSnapshot(collection(teamRef, 'heroes'), (snap) => {
            const list = snap.docs.map(d => ({ ...d.data(), id: d.id } as Hero));
            setState(s => ({ ...s, ownedHeroes: list }));
          });

          const staffUnsub = onSnapshot(collection(teamRef, 'staff'), (snap) => {
            const obj: any = { ...DEFAULT_STAFF };
            snap.docs.forEach(d => {
              const m = d.data() as StaffMember;
              obj[m.role] = m;
            });
            setState(s => ({ ...s, staff: obj }));
          });

          const unsubTeam = onSnapshot(teamRef, (docSnap) => {
            if (docSnap.exists()) {
              const profileData = docSnap.data();
              setState(s => {
                const { seasonDay: globalDay, seasonNumber: globalSeason, seasonStartDate: globalStart } = getGlobalSeasonInfo();
                return {
                  ...s,
                  id: user.uid,
                  // Root profile is the master for displayName
                  displayName: rootData.displayName ?? profileData.displayName ?? s.displayName,
                  credits: profileData.inGameCurrency ?? s.credits,
                  crystals: profileData.crystals ?? s.crystals,
                  experiencePoints: profileData.experiencePoints ?? s.experiencePoints,
                  managerLevel: profileData.managerLevel ?? s.managerLevel,
                  skillPoints: profileData.skillPoints ?? s.skillPoints,
                  managerSkills: profileData.managerSkills || s.managerSkills,
                  activeLicenseTier: profileData.activeLicenseTier ?? s.activeLicenseTier,
                  lineup: profileData.lineup || s.lineup,
                  strategy: profileData.strategy || s.strategy,
                  lineSettings: profileData.lineSettings || s.lineSettings,
                  wins: profileData.wins ?? s.wins,
                  draws: profileData.draws ?? s.draws,
                  losses: profileData.losses ?? s.losses,
                  points: profileData.points ?? s.points,
                  leagueLevel: rootData.leagueLevel ?? s.leagueLevel,
                  groupId: rootData.groupId ?? s.groupId,
                  divisionSubId: rootData.divisionSubId ?? s.divisionSubId,
                  selectedLeagueId: rootData.selectedLeagueId ?? s.selectedLeagueId,
                  country: rootData.country ?? s.country,
                  associationId: profileData.associationId ?? rootData.associationId ?? null,
                  lastSeenMatchDay: profileData.lastSeenMatchDay ?? s.lastSeenMatchDay,
                  lastLeagueMatchDate: profileData.lastLeagueMatchDate ?? s.lastLeagueMatchDate,
                  lastCupMatchDate: profileData.lastCupMatchDate ?? s.lastCupMatchDate,
                  matchHistory: profileData.matchHistory || s.matchHistory,
                  seasonStartDate: globalStart,
                  seasonDay: globalDay,
                  seasonNumber: globalSeason,
                  lastProcessedSeason: profileData.lastProcessedSeason ?? s.lastProcessedSeason,
                  lastYouthArrivalDay: profileData.lastYouthArrivalDay ?? s.lastYouthArrivalDay,
                  lastYouthArrivalSeason: profileData.lastYouthArrivalSeason ?? s.lastYouthArrivalSeason,
                  lastRewardClaimDate: profileData.lastRewardClaimDate ?? s.lastRewardClaimDate,
                  rewardDay: profileData.rewardDay ?? s.rewardDay,
                  arena: profileData.arena || s.arena,
                  hq: profileData.hq || s.hq,
                  bootcamp: profileData.bootcamp || s.bootcamp,
                  academy: profileData.academy || s.academy,
                  medical: profileData.medical || s.medical,
                  seasonResults: profileData.seasonResults ?? s.seasonResults,
                  hasEliteTrophy: profileData.hasEliteTrophy ?? s.hasEliteTrophy,
                  premiumUntil: rootData.premiumUntil ?? s.premiumUntil,
                };
              });
              setIsLoaded(true);
            } else {
              setIsLoaded(true);
            }
          });
          return () => { unsubTeam(); heroesUnsub(); staffUnsub(); };
        } else {
          setIsLoaded(true);
        }
      } else {
        setIsLoaded(true);
      }
    }, () => setIsLoaded(true));

    return () => unsubRoot();
  }, [user, isUserLoading, db, pathname]);

  const checkConstructions = useCallback(() => {
    const now = new Date().getTime();
    let hasGlobalUpdates = false;
    const globalUpdates: any = {};

    const process = (sectorState: any, cloudKey: string) => {
      const finishes = sectorState.constructionFinishes || {};
      const nextSector = JSON.parse(JSON.stringify(sectorState));
      let changed = false;
      
      Object.entries(finishes).forEach(([fac, finishTime]) => {
        if (finishTime && now >= new Date(finishTime as string).getTime()) {
          if (fac === 'capacity') {
            nextSector.capacity = (nextSector.capacity || 5000) + (nextSector.pendingCapacitySeats || 0);
            nextSector.pendingCapacitySeats = null;
          } else {
            nextSector[fac] = (nextSector[fac] || 0) + 1;
          }
          nextSector.constructionFinishes[fac] = null;
          nextSector.constructionStarts[fac] = null;
          if (nextSector.isAccelerated) nextSector.isAccelerated[fac] = false;
          changed = true;
        }
      });
      
      if (changed) {
        globalUpdates[cloudKey] = sanitizeForFirestore(nextSector);
        hasGlobalUpdates = true;
      }
    };

    if (state.arena) process(state.arena, 'arena');
    if (state.hq) process(state.hq, 'hq');
    if (state.bootcamp) process(state.bootcamp, 'bootcamp');
    if (state.academy) process(state.academy, 'academy');
    if (state.medical) process(state.medical, 'medical');

    if (hasGlobalUpdates) {
      runCloudUpdate(globalUpdates);
    }
  }, [state, runCloudUpdate]);

  useEffect(() => {
    if (isLoaded && !!user) {
      const timer = setInterval(checkConstructions, 10000);
      return () => clearInterval(timer);
    }
  }, [isLoaded, user, checkConstructions]);

  const addCredits = useCallback((amount: number, isSponsorship: boolean = false) => { 
    setState(s => { 
      let multiplier = 1.0;
      if (isSponsorship) {
        const tier = s.activeLicenseTier || 4;
        if (tier === 4) multiplier = 0.5;
        else if (tier === 3) multiplier = 1.0;
        else if (tier === 2) multiplier = 1.5;
        else if (tier === 1) multiplier = 2.0;
        const premiumActive = s.premiumUntil && new Date(s.premiumUntil).getTime() > getMoscowTime().getTime();
        if (premiumActive) multiplier += 2.0;
      }
      const finalAmount = Math.round(amount * multiplier);
      const newVal = s.credits + finalAmount; 
      runCloudUpdate({ inGameCurrency: newVal }); 
      return { ...s, credits: newVal }; 
    }); 
  }, [runCloudUpdate]);

  const addCrystals = useCallback((amount: number) => { setState(s => { const newVal = s.crystals + amount; runCloudUpdate({ crystals: newVal }); return { ...s, crystals: newVal }; }); }, [runCloudUpdate]);
  const setLanguage = useCallback((lang: 'en' | 'ru') => setState(s => ({ ...s, language: lang })), []);
  const assignToRole = useCallback((slot: LineupSlot, heroId: string | null) => { setState(s => { const newLineup = { ...s.lineup }; if (heroId) { Object.keys(newLineup).forEach(k => { if (newLineup[k as LineupSlot] === heroId) newLineup[k as LineupSlot] = null; }); } newLineup[slot] = heroId; runCloudUpdate({ lineup: newLineup }); return { ...s, lineup: newLineup }; }); }, [runCloudUpdate]);
  const updateTactics = useCallback((strategy: string, lineSettings: { carry: string; mid: string; offlane: string }) => { setState(s => { runCloudUpdate({ strategy, lineSettings }); return { ...s, strategy, lineSettings }; }); }, [runCloudUpdate]);
  const setSyncing = useCallback((val: boolean) => setState(s => ({ ...s, isSyncing: val })), []);

  const syncStats = useCallback((groupPlayers: any[]) => {
    if (!state.selectedLeagueId || !state.seasonDay || !user) return;
    const { seasonNumber: globalSeason, seasonDay: globalDay } = getGlobalSeasonInfo();
    if (globalDay <= 14) {
      const league = LEAGUES.find(l => l.id === state.selectedLeagueId);
      const isPlayedToday = isMatchDue(league?.startTime || "23:00", state.lastLeagueMatchDate);
      const completedDays = isPlayedToday ? globalDay : Math.max(0, globalDay - 1);
      if (lastSyncRef.current?.season === globalSeason && lastSyncRef.current?.day === completedDays && lastSyncRef.current?.leagueId === state.selectedLeagueId) return;
      const groupTeams = getMockGroupTeams(state.rank, state.displayName || "My Team", state.leagueLevel, state.divisionSubId, state.groupId, state.selectedLeagueId || "ALPHA", groupPlayers, user.uid, completedDays);
      const myTeam = groupTeams.find(t => t.id === user.uid);
      if (!myTeam) return;
      lastSyncRef.current = { season: globalSeason, day: completedDays, leagueId: state.selectedLeagueId };
      runCloudUpdate({ wins: Number(myTeam.wins || 0), draws: Number(myTeam.draws || 0), losses: Number(myTeam.losses || 0), points: Number(myTeam.points || 0) });
    }
  }, [state, user, runCloudUpdate]);

  const recordMatchGlobal = useCallback((matchData: any) => {
    if (!matchData.id || !state.selectedLeagueId) return;
    const path = matchData.type === 'cup' 
      ? doc(db, 'leagues', state.selectedLeagueId, 'cups', matchData.season.toString(), 'matches', matchData.id)
      : doc(db, 'leagues', state.selectedLeagueId, 'divisions', state.leagueLevel.toString(), 'groups', state.groupId.toString(), 'matches', matchData.id);
    setDocumentNonBlocking(path, sanitizeForFirestore(matchData));
  }, [db, state.selectedLeagueId, state.leagueLevel, state.groupId]);

  const recordMatch = useCallback((winner: string, result: any, matchDay: number, opponentName: string, type: MatchResultEntry['type'], customPlayedAt?: string, customId?: string, customSeason?: number) => {
    if (!result || !user || !state.selectedLeagueId) return;
    const matchId = customId || `match_${Date.now()}`;
    const today = getMoscowDateString();

    if (state.matchHistory.some(m => m.id === matchId)) return;

    const activeSeason = customSeason || state.seasonNumber;
    const activeSlots: LineupSlot[] = ['carry', 'mid', 'offlane', 'support', 'full_support'];
    const activeHeroIds = activeSlots.map(slot => state.lineup[slot]).filter(Boolean) as string[];
    
    const teamRef = getTeamRef(state.selectedLeagueId, state.leagueLevel, state.groupId, state.id);
    if (teamRef) {
      state.ownedHeroes.forEach(hero => {
        if (!activeHeroIds.includes(hero.id)) return;
        
        let activity: ActivityType = 'friendly';
        if (type === 'league') activity = 'league';
        if (type === 'cup') activity = 'cup';
        if (type === 'tournament') activity = 'tournament_ext';
        if (type === 'trial') activity = 'trial';
        if (type === 'basket') activity = 'friendly';

        const currentMatchesToday = hero.lastMatchDateXP === today ? (hero.matchesPlayedToday || 0) : 0;
        const win = winner === (state.displayName || "Manager");
        const mvp = result.mvp === hero.name;

        const nextProStats = { ...hero.proStats };
        const nextXPStats = { ...(hero.xpStats || {}) };

        Object.keys(hero.proStats).forEach(statKey => {
          const talentVal = (hero.proTalents as any)[statKey] * 10;
          const currentVal = (hero.proStats as any)[statKey];
          const xpGain = calculateXpGain({
            activity, currentValue: currentVal, talentValue: talentVal,
            infra: { bootcamp: state.bootcamp.bootcampLevel || 0, research: state.bootcamp.researchLevel || 0, psychologist: state.medical.psychologistLevel || 0 },
            matchResult: { win, mvp, great: mvp, fail: false },
            matchesToday: currentMatchesToday + 1
          });
          const currentStatXP = (nextXPStats[statKey] || 0) + xpGain;
          if (currentStatXP >= 100) {
            const points = Math.floor(currentStatXP / 100);
            (nextProStats as any)[statKey] = Math.min(50, currentVal + points); // Max 50 for normal heroes
            nextXPStats[statKey] = currentStatXP % 100;
          } else {
            nextXPStats[statKey] = currentStatXP;
          }
        });

        const nextMatchesPlayed = (hero.totalMatchesPlayed || 0) + 1;
        const nextMoral = Math.min(100, Math.max(0, (hero.moral || 50) + (win ? 2 : (result.scoreA === result.scoreB ? 0 : -2))));
        const nextOVR = calculateHeroOVR(hero.role, nextProStats, nextMatchesPlayed, nextMoral, hero.titles || { league: 0, cup: 0, friendly: 0 });

        updateDocumentNonBlocking(doc(teamRef, 'heroes', hero.id), {
          proStats: nextProStats, xpStats: nextXPStats, overallRating: nextOVR, matchesPlayedToday: currentMatchesToday + 1, totalMatchesPlayed: nextMatchesPlayed, moral: nextMoral, lastMatchDateXP: today
        });
      });
    }

    const matchEntry: MatchResultEntry = { 
      id: matchId, 
      day: matchDay, 
      seasonNumber: activeSeason, 
      type, 
      opponentName, 
      winner, 
      scoreA: result.scoreA, 
      scoreB: result.scoreB, 
      matchSummary: result.matchSummary || "", 
      teamStats: result.teamStats || {}, 
      heroPerformance: result.scoreboard || result.heroPerformance || [], 
      timeline: result.timeline || [],
      playedAt: customPlayedAt || new Date().toISOString(),
      seen: false
    };
    
    const newHistory = [matchEntry, ...state.matchHistory].slice(0, 100);

    // Persist to Firestore directly
    if (teamRef) {
      const updateData: any = { matchHistory: sanitizeForFirestore(newHistory) };
      if (type === 'league') updateData.lastLeagueMatchDate = today;
      if (type === 'cup') updateData.lastCupMatchDate = today;
      updateDoc(teamRef, updateData).catch(e => console.warn("RecordMatch Firestore Err:", e.message));
    }

    recordMatchGlobal({ id: matchId, season: activeSeason, day: matchDay, type, homeId: state.id, awayId: opponentName, scoreA: result.scoreA, scoreB: result.scoreB, winnerId: winner, playedAt: matchEntry.playedAt });

    setState(s => ({ ...s, matchHistory: newHistory, lastLeagueMatchDate: type === 'league' ? today : s.lastLeagueMatchDate, lastCupMatchDate: type === 'cup' ? today : s.lastCupMatchDate }));
  }, [user, state, getTeamRef, recordMatchGlobal]);

  const markMatchAsSeen = useCallback((day: number) => { setState(s => { if (day <= s.lastSeenMatchDay) return s; runCloudUpdate({ lastSeenMatchDay: day }); return { ...s, lastSeenMatchDay: day }; }); }, [runCloudUpdate]);
  
  const markMatchIdAsSeen = useCallback((matchId: string) => {
    setState(s => {
      const newHistory = s.matchHistory.map(m => m.id === matchId ? { ...m, seen: true } : m);
      const teamRef = getTeamRef(s.selectedLeagueId, s.leagueLevel, s.groupId, s.id);
      if (teamRef) {
        updateDoc(teamRef, { matchHistory: sanitizeForFirestore(newHistory) }).catch(() => {});
      }
      return { ...s, matchHistory: newHistory };
    });
  }, [getTeamRef]);

  const claimReward = useCallback((cr: number, cry: number) => { const today = getMoscowDateString(); setState(s => { if (s.lastRewardClaimDate === today) return s; const premiumActive = s.premiumUntil && new Date(s.premiumUntil).getTime() > getMoscowTime().getTime(); let bonusCrystals = premiumActive ? 50 : 0; if (s.activeLicenseTier === 1) bonusCrystals += 10; const nCredits = s.credits + cr; const nCrystals = s.crystals + cry + bonusCrystals; const nDay = s.rewardDay >= 30 ? 1 : s.rewardDay + 1; runCloudUpdate({ inGameCurrency: nCredits, crystals: nCrystals, lastRewardClaimDate: today, rewardDay: nDay }); return { ...s, credits: nCredits, crystals: nCrystals, lastRewardClaimDate: today, rewardDay: nDay }; }); }, [runCloudUpdate]);
  const dismissSeasonResults = useCallback(() => { setState(s => { runCloudUpdate({ seasonResults: null }); return { ...s, seasonResults: null }; }); }, [runCloudUpdate]);
  
  const startArenaConstruction = useCallback((fac: any, cost: number, crewMultiplier: number = 1, crystalCost: number = 0) => { if (state.credits < cost || state.crystals < crystalCost) return false; const hours = (4 * ((state.arena as any)[fac] + 1)) / crewMultiplier; const finish = new Date(Date.now() + hours * 3600000).toISOString(); const newArena = { ...state.arena, constructionStarts: { ...state.arena.constructionStarts, [fac]: new Date().toISOString() }, constructionFinishes: { ...state.arena.constructionFinishes, [fac]: finish }, isAccelerated: { ...state.arena.isAccelerated, [fac]: false } }; runCloudUpdate({ inGameCurrency: state.credits - cost, crystals: state.crystals - crystalCost, arena: sanitizeForFirestore(newArena) }); return true; }, [state, runCloudUpdate]);
  const startHQConstruction = useCallback((fac: any, cost: number, crewMultiplier: number = 1, crystalCost: number = 0) => { if (state.credits < cost || state.crystals < crystalCost) return false; const hours = (4 * ((state.hq as any)[fac] + 1)) / crewMultiplier; const finish = new Date(Date.now() + hours * 3600000).toISOString(); const newHQ = { ...state.hq, constructionStarts: { ...state.hq.constructionStarts, [fac]: new Date().toISOString() }, constructionFinishes: { ...state.hq.constructionFinishes, [fac]: finish }, isAccelerated: { ...state.hq.isAccelerated, [fac]: false } }; runCloudUpdate({ inGameCurrency: state.credits - cost, crystals: state.crystals - crystalCost, hq: sanitizeForFirestore(newHQ) }); return true; }, [state, runCloudUpdate]);
  const startBootcampConstruction = useCallback((fac: any, cost: number, crewMultiplier: number = 1, crystalCost: number = 0) => { if (state.credits < cost || state.crystals < crystalCost) return false; const hours = (4 * ((state.bootcamp as any)[fac] + 1)) / crewMultiplier; const finish = new Date(Date.now() + hours * 3600000).toISOString(); const newBoot = { ...state.bootcamp, constructionStarts: { ...state.bootcamp.constructionStarts, [fac]: new Date().toISOString() }, constructionFinishes: { ...state.bootcamp.constructionFinishes, [fac]: finish }, isAccelerated: { ...state.bootcamp.isAccelerated, [fac]: false } }; runCloudUpdate({ inGameCurrency: state.credits - cost, crystals: state.crystals - crystalCost, bootcamp: sanitizeForFirestore(newBoot) }); return true; }, [state, runCloudUpdate]);
  const startAcademyConstruction = useCallback((fac: any, cost: number, crewMultiplier: number = 1, crystalCost: number = 0) => { if (state.credits < cost || state.crystals < crystalCost) return false; const hours = (4 * ((state.academy as any)[fac] + 1)) / crewMultiplier; const finish = new Date(Date.now() + hours * 3600000).toISOString(); const newAcad = { ...state.academy, constructionStarts: { ...state.academy.constructionStarts, [fac]: new Date().toISOString() }, constructionFinishes: { ...state.academy.constructionFinishes, [fac]: finish }, isAccelerated: { ...state.academy.isAccelerated, [fac]: false } }; runCloudUpdate({ inGameCurrency: state.credits - cost, crystals: state.crystals - crystalCost, academy: sanitizeForFirestore(newAcad) }); return true; }, [state, runCloudUpdate]);
  const startMedicalConstruction = useCallback((fac: any, cost: number, crewMultiplier: number = 1, crystalCost: number = 0) => { if (state.credits < cost || state.crystals < crystalCost) return false; const hours = (4 * ((state.medical as any)[fac] + 1)) / crewMultiplier; const finish = new Date(Date.now() + hours * 3600000).toISOString(); const newMed = { ...state.medical, constructionStarts: { ...state.medical.constructionStarts, [fac]: new Date().toISOString() }, constructionFinishes: { ...state.medical.constructionFinishes, [fac]: finish }, isAccelerated: { ...state.medical.isAccelerated, [fac]: false } }; runCloudUpdate({ inGameCurrency: state.credits - cost, crystals: state.crystals - crystalCost, medical: sanitizeForFirestore(newMed) }); return true; }, [state, runCloudUpdate]);
  const accelerateConstruction = useCallback((sector: string, fac: string, mult: number, price: number) => { if (state.crystals < price) return false; const sectorState = (state as any)[sector]; const finish = sectorState.constructionFinishes[fac]; if (!finish || (sectorState.isAccelerated && sectorState.isAccelerated[fac])) return false; const now = Date.now(); const newRemaining = (new Date(finish).getTime() - now) / mult; const newFinish = new Date(now + newRemaining).toISOString(); runCloudUpdate({ crystals: state.crystals - price, [sector]: sanitizeForFirestore({ ...sectorState, constructionFinishes: { ...sectorState.constructionFinishes, [fac]: newFinish }, isAccelerated: { ...(sectorState.isAccelerated || {}), [fac]: true } }) }); return true; }, [state, runCloudUpdate]);

  const startCapacityExpansion = useCallback((seats: number, cost: number, hours: number) => { if (state.credits < cost) return false; const finish = new Date(Date.now() + hours * 3600000).toISOString(); const newArena = { ...state.arena, pendingCapacitySeats: seats, constructionStarts: { ...state.arena.constructionStarts, capacity: new Date().toISOString() }, constructionFinishes: { ...state.arena.constructionFinishes, capacity: finish }, isAccelerated: { ...state.arena.isAccelerated, capacity: false } }; runCloudUpdate({ inGameCurrency: state.credits - cost, arena: sanitizeForFirestore(newArena) }); return true; }, [state, runCloudUpdate]);
  
  const hireStaffMember = useCallback((m: StaffMember) => { 
    const teamRef = getTeamRef(state.selectedLeagueId, state.leagueLevel, state.groupId, state.id);
    if (!teamRef) return;
    setDocumentNonBlocking(doc(teamRef, 'staff', m.id), sanitizeForFirestore(m));
    addCredits(-(m.salary/2)); 
  }, [state, runCloudUpdate, getTeamRef, addCredits]);

  const trainStaffSkill = useCallback((role: StaffRole, key: 'primary'|'secondary', cost: number) => { 
    const m = state.staff[role]; 
    if (!m || state.crystals < cost) return false; 
    const teamRef = getTeamRef(state.selectedLeagueId, state.leagueLevel, state.groupId, state.id);
    if (!teamRef) return false;
    updateDocumentNonBlocking(doc(teamRef, 'staff', m.id), { skills: { ...m.skills, [key]: m.skills[key]+1 } });
    addCrystals(-cost);
    return true; 
  }, [state, addCrystals, getTeamRef]);

  const setTrainingFocus = useCallback((id: string, key: string | null) => {
    const teamRef = getTeamRef(state.selectedLeagueId, state.leagueLevel, state.groupId, state.id);
    if (!teamRef) return;
    const heroRef = doc(teamRef, 'heroes', id);
    updateDocumentNonBlocking(heroRef, { trainingFocus: key });
  }, [state, getTeamRef]);

  const startDailyHeroTraining = useCallback((id: string, key: string) => { 
    const finish = new Date(Date.now() + 86400000).toISOString(); 
    const teamRef = getTeamRef(state.selectedLeagueId, state.leagueLevel, state.groupId, state.id);
    if (!teamRef) return;
    updateDocumentNonBlocking(doc(teamRef, 'heroes', id), { dailyTrainingFocus: key, dailyTrainingFinishTime: finish });
  }, [state, getTeamRef]);

  const claimDailyHeroTraining = useCallback((id: string) => { 
    const h = state.ownedHeroes.find(x => x.id === id);
    if (!h || !h.dailyTrainingFocus) return;
    const k = h.dailyTrainingFocus; const talentVal = (h.proTalents ? (h.proTalents as any)[k] : 3.0) * 10; 
    const xpGain = calculateXpGain({ activity: 'daily', currentValue: (h.proStats as any)[k] || 0, talentValue: talentVal, infra: { bootcamp: state.bootcamp.bootcampLevel || 0, research: state.bootcamp.researchLevel || 0, psychologist: state.medical.psychologistLevel || 0 }, matchesToday: 0 });
    const nextXPStats = { ...(h.xpStats || {}) }; const currentStatXP = (nextXPStats[k] || 0) + xpGain; const nextProStats = { ...h.proStats };
    if (currentStatXP >= 100) { (nextProStats as any)[k] = Math.min(50, ((h.proStats as any)[k] || 0) + Math.floor(currentStatXP / 100)); nextXPStats[k] = currentStatXP % 100; } else nextXPStats[k] = currentStatXP;
    
    const teamRef = getTeamRef(state.selectedLeagueId, state.leagueLevel, state.groupId, state.id);
    if (!teamRef) return;
    updateDocumentNonBlocking(doc(teamRef, 'heroes', id), { proStats: nextProStats, xpStats: nextXPStats, overallRating: calculateHeroOVR(h.role, nextProStats, h.totalMatchesPlayed || 0, h.moral || 50, h.titles || { league: 0, cup: 0, friendly: 0 }), dailyTrainingFocus: null, dailyTrainingFinishTime: null });
  }, [state, getTeamRef]);

  const updateHero = useCallback((id: string, up: Partial<Hero>, cr = 0, cy = 0) => { 
    const teamRef = getTeamRef(state.selectedLeagueId, state.leagueLevel, state.groupId, state.id);
    if (!teamRef) return;
    updateDocumentNonBlocking(doc(teamRef, 'heroes', id), up);
    if (cr !== 0) addCredits(-cr);
    if (cy !== 0) addCrystals(-cy);
  }, [state, getTeamRef, addCredits, addCrystals]);

  const promoteYouthPlayer = useCallback((id: string) => { 
  }, []);

  const removeHero = useCallback((id: string, cr = 0) => { 
    const teamRef = getTeamRef(state.selectedLeagueId, state.leagueLevel, state.groupId, state.id);
    if (!teamRef) return;
    deleteDoc(doc(teamRef, 'heroes', id));
    if (cr !== 0) addCredits(cr);
  }, [state, getTeamRef, addCredits]);

  const recoverAllFatigue = useCallback((type: 'credits'|'crystals') => { 
    const cost = type === 'credits' ? 75000 : 0; const gcost = type === 'crystals' ? 150 : 0; if (state.credits < cost || state.crystals < gcost) return false; 
    const teamRef = getTeamRef(state.selectedLeagueId, state.leagueLevel, state.groupId, state.id);
    if (!teamRef) return false;
    state.ownedHeroes.forEach(h => {
      updateDocumentNonBlocking(doc(teamRef, 'heroes', h.id), { fatigue: 0 });
    });
    addCredits(-cost); addCrystals(-gcost);
    return true; 
  }, [state, addCredits, addCrystals, getTeamRef]);

  const addHeroDirectly = useCallback((h: Hero) => { 
    const teamRef = getTeamRef(state.selectedLeagueId, state.leagueLevel, state.groupId, state.id);
    if (!teamRef) return;
    setDocumentNonBlocking(doc(teamRef, 'heroes', h.id), sanitizeForFirestore(h));
  }, [state, getTeamRef]);

  const addYouthHeroDirectly = useCallback((h: Hero) => { 
    const teamRef = getTeamRef(state.selectedLeagueId, state.leagueLevel, state.groupId, state.id);
    if (!teamRef) return;
    setDocumentNonBlocking(doc(teamRef, 'heroes', h.id), sanitizeForFirestore({ ...h, isYouth: true }));
  }, [state, getTeamRef]);

  const updateProfileName = useCallback((n: string) => runCloudUpdate({ displayName: n }), [runCloudUpdate]);
  const updateProfileCountry = useCallback((c: string) => runCloudUpdate({ country: c }), [runCloudUpdate]);
  const purchaseLicense = useCallback((t: number, c: number) => { if (state.crystals < c) return false; runCloudUpdate({ crystals: state.crystals - c, activeLicenseTier: t }); return true; }, [state.crystals, runCloudUpdate]);
  const purchasePremium = useCallback(() => { if (state.crystals < 5000) return false; const expiry = new Date(getMoscowTime().getTime() + 30 * 24 * 60 * 60 * 1000).toISOString(); runCloudUpdate({ crystals: state.crystals - 5000, premiumUntil: expiry }); return true; }, [state.crystals, runCloudUpdate]);
  const upgradeManagerSkill = useCallback((k: keyof GameState['managerSkills']) => { if (state.skillPoints <= 0) return; runCloudUpdate({ managerSkills: { ...state.managerSkills, [k]: state.managerSkills[k]+1 }, skillPoints: state.skillPoints - 1 }); }, [state, runCloudUpdate]);

  return (
    <GameStateContext.Provider value={{ 
      ...state, isLoaded, isPremium, addCredits, addCrystals, assignToRole, updateTactics, 
      startArenaConstruction, startHQConstruction, startBootcampConstruction, 
      startAcademyConstruction, startMedicalConstruction, accelerateConstruction, 
      startCapacityExpansion, checkConstructions, hireStaffMember, trainStaffSkill, 
      setLanguage, recordMatch, recordMatchGlobal, markMatchAsSeen, markMatchIdAsSeen, claimReward, syncStats, dismissSeasonResults, 
      setSyncing, setTrainingFocus, startDailyHeroTraining, claimDailyHeroTraining, 
      updateHero, promoteYouthPlayer, removeHero, recoverAllFatigue, addHeroDirectly, 
      addYouthHeroDirectly, updateProfileName, updateProfileCountry, purchaseLicense, 
      purchasePremium, upgradeManagerSkill 
    }}>
      {children}
    </GameStateContext.Provider>
  );
}

export function useGameState() {
  const context = useContext(GameStateContext);
  if (context === undefined) throw new Error('useGameState must be used within a GameStateProvider');
  return context;
}
