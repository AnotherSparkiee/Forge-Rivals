
'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode, useRef } from 'react';
import { Hero, INITIAL_HEROES, generateYouthHero, StaffMember, StaffRole } from './moba-data';
import { getMoscowTime, getMoscowDateString, isMatchDue, getGlobalSeasonInfo } from './time-utils';
import { useUser, useFirestore } from '@/firebase';
import { doc, onSnapshot, setDoc, arrayUnion, collection } from 'firebase/firestore';
import { getMockGroupTeams, LEAGUES } from './leagues-data';
import { addDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { usePathname } from 'next/navigation';

export type LineupSlot = 'carry' | 'mid' | 'offlane' | 'support' | 'full_support' | 'sub1' | 'sub2';

interface ArenaState {
  capacity: number; pressCenterLevel: number; cafeLevel: number; shopLevel: number; screensLevel: number; roofLevel: number; lightingLevel: number; pendingCapacitySeats: number | null; constructionFinishes: Record<string, string | null>; constructionStarts: Record<string, string | null>;
}
interface HQState { hrLevel: number; financeLevel: number; scoutsLevel: number; pressOfficeLevel: number; adminLevel: number; constructionFinishes: Record<string, string | null>; constructionStarts: Record<string, string | null>; }
interface BootcampState { bootcampLevel: number; tacticsHallLevel: number; poolLevel: number; researchLevel: number; constructionFinishes: Record<string, string | null>; constructionStarts: Record<string, string | null>; }
interface AcademyState { youthBootcampLevel: number; streamingLevel: number; scoutsLevel: number; discoLevel: number; constructionFinishes: Record<string, string | null>; constructionStarts: Record<string, string | null>; }
interface MedicalState { physiotherapyLevel: number; massageLevel: number; psychiatristLevel: number; labLevel: number; psychologistLevel: number; constructionFinishes: Record<string, string | null>; constructionStarts: Record<string, string | null>; }
interface StaffState { coach: StaffMember | null; analyst: StaffMember | null; scout: StaffMember | null; doctor: StaffMember | null; financier: StaffMember | null; }
export type MatchType = 'league' | 'cup' | 'friendly' | 'basket' | 'tournament' | 'trial';
export interface MatchResultEntry { id: string; day: number; seasonNumber?: number; type: MatchType; opponentName: string; winner: string; scoreA: number; scoreB: number; matchSummary: string; teamStats: any; heroPerformance: any[]; playedAt: string; duration?: string; mvp?: string; preview?: any; timeline?: any[]; postMatch?: any; }

interface GameState {
  credits: number; crystals: number; experiencePoints: number; managerLevel: number; skillPoints: number; managerSkills: { sponsors: number; agents: number; training: number; medical: number; }; activeLicenseTier: number | null; ownedHeroes: Hero[]; youthAcademyHeroes: Hero[]; team: Hero[]; lineup: Record<LineupSlot, string | null>; strategy: string; lineSettings: { carry: string; mid: string; offlane: string }; rank: number; matchHistory: MatchResultEntry[]; language: 'en' | 'ru'; wins: number; draws: number; losses: number; points: number; leagueLevel: number; divisionSubId: number; groupId: number; selectedLeagueId: string | null; country: string | null; lastLeagueMatchDate: null | string; lastCupMatchDate: null | string; lastSeenMatchDay: number; seasonDay: number; seasonNumber: number; lastProcessedSeason: number; lastYouthArrivalDay: number; lastYouthArrivalSeason: number; seasonStartDate: string | null; lastRewardClaimDate: string | null; rewardDay: number; arena: ArenaState; hq: HQState; bootcamp: BootcampState; academy: AcademyState; medical: MedicalState; staff: StaffState; seasonResults: { lastRank: number; lastPoints: number; promoted: boolean; demoted: boolean; seasonNumber: number; awardedTrophy: boolean; } | null; hasEliteTrophy: boolean; isSyncing: boolean;
}

const DEFAULT_ARENA: ArenaState = { capacity: 5000, pressCenterLevel: 0, cafeLevel: 0, shopLevel: 0, screensLevel: 0, roofLevel: 0, lightingLevel: 0, pendingCapacitySeats: null, constructionFinishes: {}, constructionStarts: {} };
const DEFAULT_HQ: HQState = { hrLevel: 0, financeLevel: 0, scoutsLevel: 0, pressOfficeLevel: 0, adminLevel: 0, constructionFinishes: {}, constructionStarts: {} };
const DEFAULT_BOOTCAMP: BootcampState = { bootcampLevel: 0, tacticsHallLevel: 0, poolLevel: 0, researchLevel: 0, constructionFinishes: {}, constructionStarts: {} };
const DEFAULT_ACADEMY: AcademyState = { youthBootcampLevel: 0, streamingLevel: 0, scoutsLevel: 0, discoLevel: 0, constructionFinishes: {}, constructionStarts: {} };
const DEFAULT_MEDICAL: MedicalState = { physiotherapyLevel: 0, massageLevel: 0, psychiatristLevel: 0, labLevel: 0, psychologistLevel: 0, constructionFinishes: {}, constructionStarts: {} };
const DEFAULT_STAFF: StaffState = { coach: null, analyst: null, scout: null, doctor: null, financier: null };
const DEFAULT_STATE: GameState = {
  credits: 10000000, crystals: 0, experiencePoints: 0, managerLevel: 1, skillPoints: 0, managerSkills: { sponsors: 0, agents: 0, training: 0, medical: 0 }, activeLicenseTier: null, ownedHeroes: INITIAL_HEROES, youthAcademyHeroes: [], team: INITIAL_HEROES.slice(0, 5), lineup: { carry: INITIAL_HEROES.find(h => h.role === 'Carry')?.id || null, mid: INITIAL_HEROES.find(h => h.role === 'Midlaner')?.id || null, offlane: INITIAL_HEROES.find(h => h.role === 'Tank')?.id || null, support: INITIAL_HEROES.find(h => h.role === 'Jungler')?.id || null, full_support: INITIAL_HEROES.find(h => h.role === 'Support')?.id || null, sub1: null, sub2: null }, strategy: 'Balanced Play', lineSettings: { carry: 'standard', mid: 'standard', offlane: 'standard' }, rank: 1000, matchHistory: [], language: 'ru', wins: 0, draws: 0, losses: 0, points: 0, leagueLevel: 9, divisionSubId: 1, groupId: 1, selectedLeagueId: null, country: null, lastSeenMatchDay: 0, lastLeagueMatchDate: null, lastCupMatchDate: null, seasonDay: 0, seasonNumber: 0, lastProcessedSeason: 0, lastYouthArrivalDay: 0, lastYouthArrivalSeason: 0, seasonStartDate: null, lastRewardClaimDate: null, rewardDay: 1, arena: DEFAULT_ARENA, hq: DEFAULT_HQ, bootcamp: DEFAULT_BOOTCAMP, academy: DEFAULT_ACADEMY, medical: DEFAULT_MEDICAL, staff: DEFAULT_STAFF, seasonResults: null, hasEliteTrophy: false, isSyncing: false,
};

function sanitizeForFirestore(obj: any) { if (obj === undefined) return null; if (!obj) return obj; try { return JSON.parse(JSON.stringify(obj, (key, value) => value === undefined ? null : value)); } catch (e) { return null; } }
export function getLevelThreshold(level: number): number { if (level <= 1) return 700; if (level === 2) return 1400; if (level === 3) return 3800; return Math.floor(3800 * Math.pow(1.5, level - 3)); }

interface GameStateContextType extends GameState {
  isLoaded: boolean; addCredits: (amount: number) => void; addCrystals: (amount: number) => void; assignToRole: (slot: LineupSlot, heroId: string | null) => void; updateTactics: (strategy: string, lineSettings: { carry: string; mid: string; offlane: string }) => void; startArenaConstruction: (facility: any, cost: number) => boolean; startHQConstruction: (facility: any, cost: number) => boolean; startBootcampConstruction: (facility: any, cost: number) => boolean; startAcademyConstruction: (facility: any, cost: number) => boolean; startMedicalConstruction: (facility: any, cost: number) => boolean; startCapacityExpansion: (seats: number, cost: number, hours: number) => boolean; setLanguage: (lang: 'en' | 'ru') => void; recordMatch: (winner: string, result: any, matchDay: number, opponentName: string, type: MatchResultEntry['type'], customPlayedAt?: string, customId?: string) => void; markMatchAsSeen: (day: number) => void; claimReward: (creditsReward: number, crystalsReward: number) => void; syncStats: (groupPlayers: any[]) => void; dismissSeasonResults: () => void; setSyncing: (val: boolean) => void; setTrainingFocus: (heroId: string, skillKey: string | null) => void; startDailyHeroTraining: (heroId: string, skillKey: string) => void; claimDailyHeroTraining: (heroId: string) => void; updateHero: (heroId: string, updates: Partial<Hero>, creditCost?: number, crystalCost?: number) => void; promoteYouthPlayer: (heroId: string) => void; removeHero: (heroId: string, sellCreditAmount?: number) => void; recoverAllFatigue: (costType: 'credits' | 'crystals') => boolean; hireStaffMember: (member: StaffMember) => void; trainStaffSkill: (role: StaffRole, skillKey: 'primary' | 'secondary', cost: number) => boolean; addHeroDirectly: (hero: Hero) => void; addYouthHeroDirectly: (hero: Hero) => void; updateProfileName: (name: string) => void; updateProfileCountry: (countryName: string) => void; purchaseLicense: (tier: number, cost: number) => boolean; upgradeManagerSkill: (skillKey: keyof GameState['managerSkills']) => void;
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

  const getStorageKey = useCallback(() => user ? `lote_v11_${user.uid}` : null, [user]);

  const runCloudUpdate = useCallback((data: any) => {
    if (!user) return;
    const profileRef = doc(db, 'players_v10', user.uid);
    const payloadStr = JSON.stringify(data);
    if (lastWritePayloadRef.current === payloadStr) return;
    lastWritePayloadRef.current = payloadStr;
    setDoc(profileRef, data, { merge: true }).catch(e => console.warn("Sync err:", e.message));
  }, [user, db]);

  const sendNotification = useCallback((title: string, description: string, type: string) => {
    if (!user) return;
    addDocumentNonBlocking(collection(db, 'notifications_v6'), {
      userId: user.uid, title, description, type, read: false, createdAt: new Date().toISOString()
    });
  }, [user, db]);

  useEffect(() => {
    if (isUserLoading) { setIsLoaded(false); return; }
    if (!user) { setState(DEFAULT_STATE); setIsLoaded(true); return; }
    const isAuthPage = pathname?.startsWith('/auth') || pathname === '/setup';
    if (isAuthPage && !isLoaded) { setIsLoaded(true); return; }

    const profileRef = doc(db, 'players_v10', user.uid);
    const unsubscribe = onSnapshot(profileRef, (docSnap) => {
      if (docSnap.exists()) {
        const profileData = docSnap.data();
        setState(s => {
          const { seasonDay: globalDay, seasonNumber: globalSeason, seasonStartDate: globalStart } = getGlobalSeasonInfo();
          return {
            ...s,
            credits: profileData.inGameCurrency ?? s.credits,
            crystals: profileData.crystals ?? s.crystals,
            experiencePoints: profileData.experiencePoints ?? s.experiencePoints,
            managerLevel: profileData.managerLevel ?? s.managerLevel,
            skillPoints: profileData.skillPoints ?? s.skillPoints,
            managerSkills: profileData.managerSkills || s.managerSkills,
            activeLicenseTier: profileData.activeLicenseTier ?? s.activeLicenseTier,
            ownedHeroes: profileData.ownedHeroes || s.ownedHeroes,
            youthAcademyHeroes: profileData.youthAcademyHeroes || s.youthAcademyHeroes,
            lineup: profileData.lineup || s.lineup,
            strategy: profileData.strategy || s.strategy,
            lineSettings: profileData.lineSettings || s.lineSettings,
            wins: profileData.wins ?? s.wins,
            draws: profileData.draws ?? s.draws,
            losses: profileData.losses ?? s.losses,
            points: profileData.points ?? s.points,
            leagueLevel: profileData.leagueLevel ?? s.leagueLevel,
            groupId: profileData.groupId ?? s.groupId,
            divisionSubId: profileData.divisionSubId ?? s.divisionSubId,
            selectedLeagueId: profileData.selectedLeagueId ?? s.selectedLeagueId,
            country: profileData.country ?? s.country,
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
            staff: profileData.staff || s.staff,
            seasonResults: profileData.seasonResults ?? s.seasonResults,
            hasEliteTrophy: profileData.hasEliteTrophy ?? s.hasEliteTrophy,
          };
        });
        setIsLoaded(true);
      } else if (!isAuthPage) {
        setIsLoaded(true);
      }
    }, () => { setIsLoaded(true); });
    return () => unsubscribe();
  }, [user, isUserLoading, db, pathname, isLoaded]);

  const addCredits = useCallback((amount: number) => { setState(s => { const newVal = s.credits + amount; runCloudUpdate({ inGameCurrency: newVal }); return { ...s, credits: newVal }; }); }, [runCloudUpdate]);
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
      const groupTeams = getMockGroupTeams(state.rank, state.country || "My Team", state.leagueLevel, state.divisionSubId, state.groupId, state.selectedLeagueId, groupPlayers, user.uid, completedDays);
      const myTeam = groupTeams.find(t => t.id === user.uid);
      if (!myTeam) return;
      lastSyncRef.current = { season: globalSeason, day: completedDays, leagueId: state.selectedLeagueId };
      runCloudUpdate({ wins: Number(myTeam.wins || 0), draws: Number(myTeam.draws || 0), losses: Number(myTeam.losses || 0), points: Number(myTeam.points || 0) });
    }
  }, [state, user, runCloudUpdate]);

  const recordMatch = useCallback((winner: string, result: any, matchDay: number, opponentName: string, type: MatchResultEntry['type'], customPlayedAt?: string, customId?: string) => {
    if (!result) return;
    const matchId = customId || `match_${Date.now()}`;
    setState(s => {
      if (s.matchHistory.some(m => m.id === matchId)) return s;
      const matchEntry: MatchResultEntry = { id: matchId, day: matchDay, type, opponentName, winner, scoreA: result.scoreA, scoreB: result.scoreB, matchSummary: result.matchSummary || "", teamStats: result.teamStats || {}, heroPerformance: result.heroPerformance || [], playedAt: customPlayedAt || new Date().toISOString(), duration: result.duration || "", mvp: result.mvp || "", preview: result.preview || null, timeline: result.timeline || [], postMatch: result.postMatch || null };
      const newHistory = [matchEntry, ...s.matchHistory].slice(0, 100);
      runCloudUpdate({ matchHistory: sanitizeForFirestore(newHistory) });
      return { ...s, matchHistory: newHistory };
    });
  }, [runCloudUpdate]);

  const markMatchAsSeen = useCallback((day: number) => { setState(s => { if (day <= s.lastSeenMatchDay) return s; runCloudUpdate({ lastSeenMatchDay: day }); return { ...s, lastSeenMatchDay: day }; }); }, [runCloudUpdate]);
  const claimReward = useCallback((cr: number, cry: number) => { const today = getMoscowDateString(); setState(s => { if (s.lastRewardClaimDate === today) return s; const nCredits = s.credits + cr; const nCrystals = s.crystals + cry; const nDay = s.rewardDay >= 30 ? 1 : s.rewardDay + 1; runCloudUpdate({ inGameCurrency: nCredits, crystals: nCrystals, lastRewardClaimDate: today, rewardDay: nDay }); return { ...s, credits: nCredits, crystals: nCrystals, lastRewardClaimDate: today, rewardDay: nDay }; }); }, [runCloudUpdate]);
  const dismissSeasonResults = useCallback(() => { setState(s => { runCloudUpdate({ seasonResults: null }); return { ...s, seasonResults: null }; }); }, [runCloudUpdate]);
  const startArenaConstruction = useCallback((fac: any, cost: number) => { if (state.credits < cost) return false; const hours = 4 * ((state.arena as any)[fac] + 1); const finish = new Date(Date.now() + hours * 3600000).toISOString(); const newArena = { ...state.arena, constructionStarts: { ...state.arena.constructionStarts, [fac]: new Date().toISOString() }, constructionFinishes: { ...state.arena.constructionFinishes, [fac]: finish } }; runCloudUpdate({ inGameCurrency: state.credits - cost, arena: sanitizeForFirestore(newArena) }); return true; }, [state, runCloudUpdate]);
  const startHQConstruction = useCallback((fac: any, cost: number) => { if (state.credits < cost) return false; const hours = 4 * ((state.hq as any)[fac] + 1); const finish = new Date(Date.now() + hours * 3600000).toISOString(); const newHQ = { ...state.hq, constructionStarts: { ...state.hq.constructionStarts, [fac]: new Date().toISOString() }, constructionFinishes: { ...state.hq.constructionFinishes, [fac]: finish } }; runCloudUpdate({ inGameCurrency: state.credits - cost, hq: sanitizeForFirestore(newHQ) }); return true; }, [state, runCloudUpdate]);
  const startBootcampConstruction = useCallback((fac: any, cost: number) => { if (state.credits < cost) return false; const hours = 4 * ((state.bootcamp as any)[fac] + 1); const finish = new Date(Date.now() + hours * 3600000).toISOString(); const newBoot = { ...state.bootcamp, constructionStarts: { ...state.bootcamp.constructionStarts, [fac]: new Date().toISOString() }, constructionFinishes: { ...state.bootcamp.constructionFinishes, [fac]: finish } }; runCloudUpdate({ inGameCurrency: state.credits - cost, bootcamp: sanitizeForFirestore(newBoot) }); return true; }, [state, runCloudUpdate]);
  const startAcademyConstruction = useCallback((fac: any, cost: number) => { if (state.credits < cost) return false; const hours = 4 * ((state.academy as any)[fac] + 1); const finish = new Date(Date.now() + hours * 3600000).toISOString(); const newAcad = { ...state.academy, constructionStarts: { ...state.academy.constructionStarts, [fac]: new Date().toISOString() }, constructionFinishes: { ...state.academy.constructionFinishes, [fac]: finish } }; runCloudUpdate({ inGameCurrency: state.credits - cost, academy: sanitizeForFirestore(newAcad) }); return true; }, [state, runCloudUpdate]);
  const startMedicalConstruction = useCallback((fac: any, cost: number) => { if (state.credits < cost) return false; const hours = 4 * ((state.medical as any)[fac] + 1); const finish = new Date(Date.now() + hours * 3600000).toISOString(); const newMed = { ...state.medical, constructionStarts: { ...state.medical.constructionStarts, [fac]: new Date().toISOString() }, constructionFinishes: { ...state.medical.constructionFinishes, [fac]: finish } }; runCloudUpdate({ inGameCurrency: state.credits - cost, medical: sanitizeForFirestore(newMed) }); return true; }, [state, runCloudUpdate]);
  const startCapacityExpansion = useCallback((seats: number, cost: number, hours: number) => { if (state.credits < cost) return false; const finish = new Date(Date.now() + hours * 3600000).toISOString(); const newArena = { ...state.arena, pendingCapacitySeats: seats, constructionStarts: { ...state.arena.constructionStarts, capacity: new Date().toISOString() }, constructionFinishes: { ...state.arena.constructionFinishes, capacity: finish } }; runCloudUpdate({ inGameCurrency: state.credits - cost, arena: sanitizeForFirestore(newArena) }); return true; }, [state, runCloudUpdate]);
  const hireStaffMember = useCallback((m: StaffMember) => { const updated = { ...state.staff, [m.role]: m }; runCloudUpdate({ staff: sanitizeForFirestore(updated), inGameCurrency: state.credits - (m.salary/2) }); }, [state, runCloudUpdate]);
  const trainStaffSkill = useCallback((role: StaffRole, key: 'primary'|'secondary', cost: number) => { const m = state.staff[role]; if (!m || state.crystals < cost) return false; const nm = { ...m, skills: { ...m.skills, [key]: m.skills[key]+1 } }; runCloudUpdate({ staff: sanitizeForFirestore({ ...state.staff, [role]: nm }), crystals: state.crystals - cost }); return true; }, [state, runCloudUpdate]);
  const setTrainingFocus = useCallback((id: string, key: string | null) => { const uOwned = state.ownedHeroes.map(h => h.id === id ? { ...h, trainingFocus: key } : h); const uYouth = state.youthAcademyHeroes.map(h => h.id === id ? { ...h, trainingFocus: key } : h); runCloudUpdate({ ownedHeroes: sanitizeForFirestore(uOwned), youthAcademyHeroes: sanitizeForFirestore(uYouth) }); }, [state, runCloudUpdate]);
  const startDailyHeroTraining = useCallback((id: string, key: string) => { const finish = new Date(Date.now() + 86400000).toISOString(); const uOwned = state.ownedHeroes.map(h => h.id === id ? { ...h, dailyTrainingFocus: key, dailyTrainingFinishTime: finish } : h); const uYouth = state.youthAcademyHeroes.map(h => h.id === id ? { ...h, dailyTrainingFocus: key, dailyTrainingFinishTime: finish } : h); runCloudUpdate({ ownedHeroes: sanitizeForFirestore(uOwned), youthAcademyHeroes: sanitizeForFirestore(uYouth) }); }, [state, runCloudUpdate]);
  const claimDailyHeroTraining = useCallback((id: string) => { const proc = (h: Hero) => { if (h.id === id && h.dailyTrainingFocus) { const k = h.dailyTrainingFocus; const cur = (h.proStats as any)[k] || 0; const lim = (h.proTalents ? (h.proTalents as any)[k] : 3.0) * 20; if (cur < lim) { const val = Math.min(lim, cur + Math.floor(Math.random()*3)+3); return { ...h, proStats: { ...h.proStats, [k]: val }, dailyTrainingFocus: null, dailyTrainingFinishTime: null }; } return { ...h, dailyTrainingFocus: null, dailyTrainingFinishTime: null }; } return h; }; const uO = state.ownedHeroes.map(proc); const uY = state.youthAcademyHeroes.map(proc); runCloudUpdate({ ownedHeroes: sanitizeForFirestore(uO), youthAcademyHeroes: sanitizeForFirestore(uY) }); }, [state, runCloudUpdate]);
  const updateHero = useCallback((id: string, up: Partial<Hero>, cr = 0, cy = 0) => { const uO = state.ownedHeroes.map(h => h.id === id ? { ...h, ...up } : h); const uY = state.youthAcademyHeroes.map(h => h.id === id ? { ...h, ...up } : h); runCloudUpdate({ ownedHeroes: sanitizeForFirestore(uO), youthAcademyHeroes: sanitizeForFirestore(uY), inGameCurrency: state.credits - cr, crystals: state.crystals - cy }); }, [state, runCloudUpdate]);
  const promoteYouthPlayer = useCallback((id: string) => { const h = state.youthAcademyHeroes.find(x => x.id === id); if (!h) return; runCloudUpdate({ youthAcademyHeroes: sanitizeForFirestore(state.youthAcademyHeroes.filter(x => x.id !== id)), ownedHeroes: sanitizeForFirestore([...state.ownedHeroes, h]) }); }, [state, runCloudUpdate]);
  const removeHero = useCallback((id: string, cr = 0) => { runCloudUpdate({ ownedHeroes: sanitizeForFirestore(state.ownedHeroes.filter(x => x.id !== id)), youthAcademyHeroes: sanitizeForFirestore(state.youthAcademyHeroes.filter(x => x.id !== id)), inGameCurrency: state.credits + cr }); }, [state, runCloudUpdate]);
  const recoverAllFatigue = useCallback((type: 'credits'|'crystals') => { const cost = type === 'credits' ? 75000 : 0; const gcost = type === 'crystals' ? 150 : 0; if (state.credits < cost || state.crystals < gcost) return false; const uO = state.ownedHeroes.map(h => ({ ...h, fatigue: 0 })); runCloudUpdate({ ownedHeroes: sanitizeForFirestore(uO), inGameCurrency: state.credits - cost, crystals: state.crystals - gcost }); return true; }, [state, runCloudUpdate]);
  const addHeroDirectly = useCallback((h: Hero) => { runCloudUpdate({ ownedHeroes: arrayUnion(sanitizeForFirestore(h)) }); }, [runCloudUpdate]);
  const addYouthHeroDirectly = useCallback((h: Hero) => { runCloudUpdate({ youthAcademyHeroes: arrayUnion(sanitizeForFirestore(h)) }); }, [runCloudUpdate]);
  const updateProfileName = useCallback((n: string) => runCloudUpdate({ displayName: n }), [runCloudUpdate]);
  const updateProfileCountry = useCallback((c: string) => runCloudUpdate({ country: c }), [runCloudUpdate]);
  const purchaseLicense = useCallback((t: number, c: number) => { if (state.crystals < c) return false; runCloudUpdate({ crystals: state.crystals - c, activeLicenseTier: t }); return true; }, [state, runCloudUpdate]);
  const upgradeManagerSkill = useCallback((k: keyof GameState['managerSkills']) => { if (state.skillPoints <= 0) return; const ns = { ...state.managerSkills, [k]: state.managerSkills[k]+1 }; runCloudUpdate({ managerSkills: ns, skillPoints: state.skillPoints - 1 }); }, [state, runCloudUpdate]);

  return (
    <GameStateContext.Provider value={{ ...state, isLoaded, addCredits, addCrystals, assignToRole, updateTactics, startArenaConstruction, startHQConstruction, startBootcampConstruction, startAcademyConstruction, startMedicalConstruction, startCapacityExpansion, hireStaffMember, trainStaffSkill, setLanguage, recordMatch, markMatchAsSeen, claimReward, syncStats, dismissSeasonResults, setSyncing, setTrainingFocus, startDailyHeroTraining, claimDailyHeroTraining, updateHero, promoteYouthPlayer, removeHero, recoverAllFatigue, addHeroDirectly, addYouthHeroDirectly, updateProfileName, updateProfileCountry, purchaseLicense, upgradeManagerSkill }}>
      {children}
    </GameStateContext.Provider>
  );
}

export function useGameState() {
  const context = useContext(GameStateContext);
  if (context === undefined) throw new Error('useGameState must be used within a GameStateProvider');
  return context;
}
