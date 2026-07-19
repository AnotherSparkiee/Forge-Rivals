'use client';

/**
 * Глобальное хранилище v88 (Gift Protocol).
 * Внедрена система подарков для S-tier лицензий.
 * Исправлена ошибка STAT_KEYS и инициализация списков.
 */

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode, useRef, useMemo } from 'react';
import { Player, StaffMember, StaffRole, generateScoutedPlayer } from './moba-data';
import { getMoscowTime, getGlobalSeasonInfo, getMoscowDateString, getLevelThreshold } from './time-utils';
import { useUser, useFirestore } from '@/firebase';
import { 
  doc, onSnapshot, collection, setDoc, deleteDoc, writeBatch, 
  query, where, serverTimestamp, arrayUnion, getDoc, updateDoc, 
  runTransaction, increment, getDocs, orderBy, limit 
} from 'firebase/firestore';

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
  isSyncing: boolean; language: string; skillPoints: number;
  isDataReady: boolean; isTeamLoaded: boolean; allSeasonMatches: any[]; nextMatch: any | null; isMatchesLoading: boolean;
  lastProcessedSeason: number;
  trophies: TrophyRecord[];
  version: number;
  
  // Gifting System
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
  
  // Gift Actions
  sendGift: (giftId: string, friendId: string, friendName: string) => Promise<boolean>;
  claimGift: (gift: Gift) => Promise<boolean>;
  generateDailyGifts: (gifts: Gift[]) => void;
}

const DEFAULT_STATE: GameState = {
  credits: 0, crystals: 0, experiencePoints: 0, managerLevel: 1,
  leagueLevel: 9, groupId: 1, selectedLeagueId: null,
  displayName: 'Manager', id: '', isLoaded: false, isTeamLoaded: false,
  clubName: null, clubLogo: null,
  lineup: { carry: null, mid: null, offlane: null, support: null, full_support: null, sub1: null, sub2: null, res1: null, res2: null, res3: null, res4: null, res5: null, res6: null, res7: null, res8: null },
  ownedPlayers: [], youthAcademyPlayers: [], scoutingCandidates: [], lastScoutDate: null,
  staff: { coach: null, analyst: null, scout: null, doctor: null, financier: null },
  strategy: 'Balanced Play', lineSettings: { carry: 'standard', mid: 'standard', offlane: 'standard' },
  rewardDay: 1, lastRewardClaimDate: null, matchHistory: [], lastSeenMatchDay: 0,
  managerSkills: { sponsors: 0, agents: 0, training: 0, medical: 0 },
  skillPoints: 0, arena: { capacity: 5000 }, hq: {}, bootcamp: {}, academy: {}, medical: {},
  country: null, isPremium: false, premiumUntil: null, activeSeasonNumber: 1, seasonNumber: 1, seasonDay: 1, isSyncing: false, language: 'ru',
  isDataReady: false, allSeasonMatches: [], nextMatch: null, isMatchesLoading: true,
  lastProcessedSeason: 0, trophies: [], version: 0,
  availableGiftsToSend: [], receivedGifts: [], lastGiftGenDate: null,
  addCrystals: () => {}, addCredits: () => {}, updatePlayer: () => {}, removePlayer: () => {}, assignToRole: () => {}, updateLineup: () => {}, updateTactics: () => {},
  claimReward: () => {}, setLanguage: () => {}, purchaseLicense: () => false, purchasePremium: () => false,
  setTrainingFocus: () => {}, startDailyPlayerTraining: () => {}, claimDailyPlayerTraining: () => {},
  recoverAllFatigue: () => false, hireStaffMember: () => {}, trainStaffSkill: () => false,
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
  sendGift: async () => false, claimGift: async () => false, generateDailyGifts: () => {}
};

const GameStateContext = createContext<GameState | undefined>(DEFAULT_STATE);

export function GameStateProvider({ children }: { children: ReactNode }) {
  const { user, isUserLoading } = useUser();
  const db = useFirestore();
  const [state, setState] = useState<GameState>(DEFAULT_STATE);
  const [allMatches, setAllMatches] = useState<any[]>([]);
  const [isWorldReady, setIsWorldReady] = useState(false);
  
  const stateRef = useRef(state);
  useEffect(() => { stateRef.current = state; }, [state]);

  const staticSeasonInfo = useMemo(() => getGlobalSeasonInfo(), []);

  // Profile Listener
  useEffect(() => {
    if (isUserLoading || !user?.uid) return;
    const rootRef = doc(db, 'players_v10', user.uid);
    let active = true;
    const unsub = onSnapshot(rootRef, (snap) => {
      if (!snap.exists() || !active) return;
      const data = snap.data();
      setState(s => ({
        ...s, id: user.uid, displayName: data.displayName || "Manager",
        selectedLeagueId: data.selectedLeagueId || null, leagueLevel: Number(data.leagueLevel || 9),
        groupId: Number(data.groupId || 1), country: data.country || null,
        clubName: data.clubName || null, clubLogo: data.clubLogo || null,
        lastSeenMatchDay: Number(data.lastSeenMatchDay || 0),
        activeSeasonNumber: Number(staticSeasonInfo.activeSeasonNumber),
        seasonNumber: Number(staticSeasonInfo.seasonNumber), seasonDay: Number(staticSeasonInfo.seasonDay),
        lastProcessedSeason: Number(data.lastProcessedSeason || 0),
        trophies: data.trophies || [],
        version: Number(data.version || 0),
        rank: Number(data.rank || 1),
        lastGiftGenDate: data.lastGiftGenDate || null,
        availableGiftsToSend: data.availableGiftsToSend || [],
        isLoaded: true
      }));
    });
    return () => { active = false; unsub(); };
  }, [user?.uid, isUserLoading, db, staticSeasonInfo]);

  // Team Details Listener
  useEffect(() => {
    if (isUserLoading || !user?.uid || !state.id || !state.selectedLeagueId) return;
    
    const seasonId = `season_${staticSeasonInfo.activeSeasonNumber}`;
    const prefixedGroupId = `${seasonId}_league_${state.selectedLeagueId}_group_${state.groupId}`;
    const teamRef = doc(db, 'leagues_v2', state.selectedLeagueId, 'divisions', String(state.leagueLevel), 'groups', prefixedGroupId, 'teams', state.id);

    let active = true;

    const unsubTeam = onSnapshot(teamRef, (snap) => {
      if (!snap.exists() || !active) {
        if (active) setState(prev => ({ ...prev, isTeamLoaded: false }));
        return;
      }
      const d = snap.data();
      setState(prev => ({
        ...prev, 
        credits: Number(d.credits || 0), 
        crystals: Number(d.crystals || 0),
        experiencePoints: d.experiencePoints ?? 0, 
        managerLevel: d.managerLevel ?? 1,
        skillPoints: d.skillPoints ?? 0, 
        lineup: d.lineup || prev.lineup,
        strategy: d.strategy || 'Balanced Play', 
        lineSettings: d.lineSettings || prev.lineSettings,
        rewardDay: d.rewardDay ?? 1, 
        lastRewardClaimDate: d.lastRewardClaimDate ?? null,
        matchHistory: d.matchHistory ?? [], 
        managerSkills: d.managerSkills ?? { sponsors: 0, agents: 0, training: 0, medical: 0 },
        arena: d.arena ?? { capacity: 5000 }, 
        hq: d.hq ?? {}, 
        bootcamp: d.bootcamp ?? {}, 
        academy: d.academy ?? {}, 
        medical: d.medical ?? {},
        activeLicenseTier: d.activeLicenseTier ?? 4, 
        premiumUntil: d.premiumUntil ?? null,
        isPremium: d.premiumUntil ? new Date(d.premiumUntil) > getMoscowTime() : false,
        rank: d.rank ?? 8, 
        clubName: d.clubName || prev.clubName,
        clubLogo: d.clubLogo || prev.clubLogo,
        scoutingCandidates: d.scoutingCandidates || [], 
        lastScoutDate: d.lastScoutDate || null,
        isTeamLoaded: true
      }));
    });

    const playersUnsub = onSnapshot(collection(teamRef, 'heroes'), (hSnap) => {
      if (!active) return;
      const all = hSnap.docs.map(d => ({ ...d.data(), id: d.id } as Player));
      setState(prev => ({ ...prev, ownedPlayers: all.filter(h => h.isYouth !== true), youthAcademyPlayers: all.filter(h => h.isYouth === true) }));
    });

    const unsubStaff = onSnapshot(collection(teamRef, 'staff'), (sSnap) => {
      if (!active) return;
      const staffObj: any = { coach: null, analyst: null, scout: null, doctor: null, financier: null };
      sSnap.docs.forEach(doc => { const m = doc.data() as StaffMember; staffObj[m.role] = m; });
      setState(prev => ({ ...prev, staff: staffObj }));
    });
    
    const unsubGifts = onSnapshot(collection(doc(db, 'players_v10', user.uid), 'received_gifts'), (snap) => {
      if (!active) return;
      const gifts = snap.docs.map(d => ({ ...d.data(), id: d.id } as Gift));
      setState(prev => ({ ...prev, receivedGifts: gifts }));
    });

    return () => { active = false; unsubTeam(); playersUnsub(); unsubStaff(); unsubGifts(); };
  }, [db, state.id, state.selectedLeagueId, state.leagueLevel, state.groupId, isUserLoading, user?.uid, staticSeasonInfo.activeSeasonNumber]);

  // Global Matches Listener
  useEffect(() => {
    if (isUserLoading || !user?.uid || !state.isLoaded || !state.id || !state.selectedLeagueId) return;
    
    const currentTableId = `s${staticSeasonInfo.activeSeasonNumber}_l${state.selectedLeagueId}_t${state.leagueLevel}_g${state.groupId}`;
    
    const qGroup = query(collection(db, 'matches_v1'), where('tableId', '==', currentTableId));
    const qPersonal = query(collection(db, 'matches_v1'), where('participants', 'array-contains', user.uid));

    let active = true;
    const matchMap = new Map();

    const unsubGroup = onSnapshot(qGroup, (snapshot) => {
      if (!active) return;
      snapshot.docs.forEach(d => matchMap.set(d.id, { ...d.data(), id: d.id }));
      setAllMatches(Array.from(matchMap.values()));
    });

    const unsubPersonal = onSnapshot(qPersonal, (snapshot) => {
      if (!active) return;
      snapshot.docs.forEach(d => matchMap.set(d.id, { ...d.data(), id: d.id }));
      setAllMatches(Array.from(matchMap.values()));
    });

    return () => { active = false; unsubGroup(); unsubPersonal(); };
  }, [db, state.id, state.selectedLeagueId, state.groupId, state.leagueLevel, state.isLoaded, isUserLoading, user?.uid, staticSeasonInfo.activeSeasonNumber]);

  const getRefs = useCallback(() => {
    const s = stateRef.current;
    if (!user?.uid || !s.selectedLeagueId) return null;
    const seasonId = `season_${staticSeasonInfo.activeSeasonNumber}`;
    const prefixedGroupId = `${seasonId}_league_${s.selectedLeagueId}_group_${s.groupId}`;
    return { 
      team: doc(db, 'leagues_v2', s.selectedLeagueId, 'divisions', String(s.leagueLevel), 'groups', prefixedGroupId, 'teams', user.uid),
      root: doc(db, 'players_v10', user.uid),
      table: doc(db, 'league_tables_v1', `s${staticSeasonInfo.activeSeasonNumber}_l${s.selectedLeagueId}_t${s.leagueLevel}_g${s.groupId}`)
    };
  }, [user?.uid, db, staticSeasonInfo.activeSeasonNumber]);

  const addCrystals = useCallback((amount: number) => { const r = getRefs(); if (r) setDoc(r.team, { crystals: increment(amount) }, { merge: true }); }, [getRefs]);
  const addCredits = useCallback((amount: number) => { const r = getRefs(); if (r) setDoc(r.team, { credits: increment(amount) }, { merge: true }); }, [getRefs]);
  
  const updatePlayer = useCallback((id: string, data: Partial<Player>, cr = 0, cy = 0) => {
    const r = getRefs(); if (!r) return;
    updateDoc(doc(collection(r.team, 'heroes'), id), data);
    if (cr || cy) setDoc(r.team, { credits: increment(-cr), crystals: increment(-cy) }, { merge: true });
  }, [getRefs]);

  const removePlayer = useCallback((id: string, refund: number) => {
    const r = getRefs(); if (!r) return;
    deleteDoc(doc(collection(r.team, 'heroes'), id));
    if (refund > 0) setDoc(r.team, { credits: increment(refund) }, { merge: true });
  }, [getRefs]);

  const assignToRole = useCallback((role: LineupSlot, playerId: string | null) => { 
    const r = getRefs(); 
    if (r) setDoc(r.team, { lineup: { [role]: playerId } }, { merge: true }); 
  }, [getRefs]);

  const updateLineup = useCallback((updates: Partial<Record<LineupSlot, string | null>>) => {
    const r = getRefs();
    if (r) {
      const dbUpdates: any = {};
      Object.entries(updates).forEach(([key, val]) => { dbUpdates[`lineup.${key}`] = val; });
      updateDoc(r.team, dbUpdates);
    }
  }, [getRefs]);

  const updateTactics = useCallback((strategy: string, lineSettings: any) => { const r = getRefs(); if (r) setDoc(r.team, { strategy, lineSettings }, { merge: true }); }, [getRefs]);
  
  const claimReward = useCallback((cr: number, cry: number) => { 
    const r = getRefs(); 
    if (r) {
      const crystalGain = stateRef.current.isPremium ? cry + 50 : cry;
      setDoc(r.team, { 
        credits: increment(cr), crystals: increment(crystalGain), lastRewardClaimDate: getMoscowDateString(), 
        rewardDay: (stateRef.current.rewardDay % 30) + 1 
      }, { merge: true }); 
    }
  }, [getRefs]);
  
  const setLanguage = useCallback((lang: string) => setState(s => ({ ...s, language: lang })), []);
  
  const purchaseLicense = useCallback((t: number, c: number) => { 
    const r = getRefs(); 
    if (!r || stateRef.current.crystals < c) return false; 
    setDoc(r.team, { crystals: increment(-c), activeLicenseTier: t }, { merge: true }); 
    return true; 
  }, [getRefs]);

  const purchasePremium = useCallback(() => { 
    const r = getRefs(); 
    if (!r || stateRef.current.crystals < 5000) return false; 
    const exp = new Date(getMoscowTime().getTime() + 30 * 24 * 60 * 60 * 1000); 
    setDoc(r.team, { crystals: increment(-5000), premiumUntil: exp.toISOString() }, { merge: true }); 
    return true; 
  }, [getRefs]);

  const setTrainingFocus = useCallback((playerId: string, focus: string | null) => {
    const r = getRefs(); if (!r) return;
    updateDoc(doc(collection(r.team, 'heroes'), playerId), { trainingFocus: focus });
  }, [getRefs]);

  const startDailyPlayerTraining = useCallback((playerId: string, focus: string) => {
    const r = getRefs(); if (!r) return;
    updateDoc(doc(collection(r.team, 'heroes'), playerId), { dailyTrainingFocus: focus, dailyTrainingFinishTime: new Date(getMoscowTime().getTime() + 24 * 3600000).toISOString() });
  }, [getRefs]);

  const claimDailyPlayerTraining = useCallback((playerId: string) => {
    const r = getRefs(); if (!r) return;
    updateDoc(doc(collection(r.team, 'heroes'), playerId), { dailyTrainingFocus: null, dailyTrainingFinishTime: null });
  }, [getRefs]);

  const recoverAllFatigue = useCallback((type: 'credits' | 'crystals') => {
    const r = getRefs(); if (!r) return false;
    const s = stateRef.current;
    const cost = type === 'credits' ? 75000 : 150;
    if ((type === 'credits' && s.credits < cost) || (type === 'crystals' && s.crystals < cost)) return false;
    const batch = writeBatch(db);
    s.ownedPlayers.forEach(p => { batch.update(doc(collection(r.team, 'heroes'), p.id), { fatigue: 100 }); });
    batch.update(r.team, { [type]: increment(-cost) });
    batch.commit();
    return true;
  }, [getRefs, db]);

  const hireStaffMember = useCallback((member: StaffMember) => {
    const r = getRefs(); if (!r) return;
    setDoc(doc(collection(r.team, 'staff'), member.id), member);
    setDoc(r.team, { credits: increment(-(member.salary / 2)) }, { merge: true });
  }, [getRefs]);

  const trainStaffSkill = useCallback((role: StaffRole, skillKey: 'primary' | 'secondary', cost: number) => {
    const r = getRefs(); if (!r || stateRef.current.crystals < cost) return false;
    const member = stateRef.current.staff[role];
    if (!member) return false;
    updateDoc(doc(collection(r.team, 'staff'), member.id), { [`skills.${skillKey}`]: increment(1) });
    setDoc(r.team, { crystals: increment(-cost) }, { merge: true });
    return true;
  }, [getRefs]);

  const addPlayerDirectly = useCallback((player: Player) => {
    const r = getRefs(); if (!r) return;
    setDoc(doc(collection(r.team, 'heroes'), player.id), player);
  }, [getRefs]);

  const addYouthPlayerDirectly = useCallback((player: Player) => {
    const r = getRefs(); if (!r) return;
    setDoc(doc(collection(r.team, 'heroes'), player.id), { ...player, isYouth: true });
  }, [getRefs]);

  const promoteYouthPlayer = useCallback((playerId: string) => {
    const r = getRefs(); if (!r) return;
    updateDoc(doc(collection(r.team, 'heroes'), playerId), { isYouth: false });
  }, [getRefs]);

  const updateProfileName = useCallback((name: string) => {
    const r = getRefs(); if (!r) return;
    updateDoc(r.root, { clubName: name });
    setDoc(r.team, { clubName: name }, { merge: true });
  }, [getRefs]);

  const updateProfileCountry = useCallback((country: string) => {
    const r = getRefs(); if (!r) return;
    updateDoc(r.root, { country });
  }, [getRefs]);

  const healPlayer = useCallback((playerId: string, type: 'credits' | 'crystals', cost: number) => {
    const r = getRefs(); if (!r) return;
    updateDoc(doc(collection(r.team, 'heroes'), playerId), { isInjured: false, injuredUntil: null });
    setDoc(r.team, { [type]: increment(-cost) }, { merge: true });
  }, [getRefs]);

  const launchFanCampaign = useCallback((type: string, cost: number, fans: number, loyalty: number) => {
    const r = getRefs(); if (!r) return;
    setDoc(r.team, { 
      credits: increment(-cost),
      fanclub: { fanCount: increment(fans), loyalty: increment(loyalty), lastCampaignDate: getMoscowDateString() }
    }, { merge: true });
  }, [getRefs]);

  const addTrophy = useCallback((trophy: TrophyRecord) => {
    const r = getRefs(); if (r) updateDoc(r.root, { trophies: arrayUnion(trophy) });
  }, [getRefs]);

  const resetProfile = useCallback(async () => {
    if (!user?.uid) return;
    setIsWorldReady(false);
    const r = getRefs(); if (!r) return;
    try {
      await deleteDoc(r.team);
      const nq = query(collection(db, 'notifications_v7'), where('userId', '==', user.uid));
      const nSnap = await getDocs(nq);
      const batch = writeBatch(db);
      nSnap.forEach(d => batch.delete(d.ref));
      const rootSnap = await getDoc(r.root);
      const currentData = rootSnap.exists() ? rootSnap.data() : {};
      batch.set(r.root, { id: user.uid, email: currentData.email || null, tgId: currentData.tgId || null, displayName: "Manager", lastLoginDate: new Date().toISOString(), createdAt: currentData.createdAt || new Date().toISOString(), version: 0 });
      await batch.commit();
      window.location.href = '/setup';
    } catch (e) { console.error("Hard profile reset failed:", e); }
  }, [user?.uid, db, getRefs]);

  const payStaffSalaries = async () => {};

  const recordMatch = useCallback((w: string, res: any, rew: number, opp: string, t: string, p: string, mId?: string, extra?: any) => {
    const r = getRefs(); if (!r) return; 
    const id = mId || `match_${Date.now()}`;
    const s = stateRef.current;
    let newLevel = s.managerLevel; let newSkillPoints = s.skillPoints; let bonusCrystals = 0; let newTotalXp = s.experiencePoints;
    const managerXpGain = t === 'league' ? 200 : (t === 'tournament' ? 250 : 50);
    newTotalXp += managerXpGain;
    const threshold = getLevelThreshold(s.managerLevel);
    if (newTotalXp >= threshold) {
      newLevel++; newSkillPoints += 2; bonusCrystals = 50;
      setDoc(doc(db, 'notifications_v7', `lvl_${s.id}_${newLevel}`), { userId: s.id, title: "Level Up!", description: `Reached level ${newLevel}`, type: 'league', read: false, createdAt: getMoscowTime().toISOString() });
    }
    const historyEntry = { id, winner: w, scoreA: res.scoreA, scoreB: res.scoreB, opponentName: opp, type: t, playedAt: p, simulation: res, seen: false, isTbdWin: opp === 'TBD', homeId: extra?.homeId || null, awayId: extra?.awayId || null, homeLogo: extra?.homeLogo || null, awayLogo: extra?.awayLogo || null, homeName: extra?.homeName || null, awayName: extra?.awayName || null };
    setDoc(r.team, { credits: increment(rew), crystals: increment(bonusCrystals), experiencePoints: newTotalXp, managerLevel: newLevel, skillPoints: newSkillPoints, matchHistory: arrayUnion(historyEntry) }, { merge: true });
  }, [getRefs, db]);

  const markMatchIdAsSeen = useCallback((id: string) => { 
    const r = getRefs(); if (!r) return;
    const leagueMatch = allMatches.find(m => m.id === id);
    if (leagueMatch) updateDoc(r.root, { lastSeenMatchDay: Number(leagueMatch.day) });
    const newHistory = stateRef.current.matchHistory.map(m => m.id === id ? { ...m, seen: true } : m);
    setDoc(r.team, { matchHistory: newHistory }, { merge: true });
  }, [getRefs, allMatches]);

  const deleteMatchHistoryEntry = useCallback((id: string) => {
    const r = getRefs(); if (!r) return;
    const newHistory = stateRef.current.matchHistory.filter(m => m.id !== id);
    updateDoc(r.team, { matchHistory: newHistory });
  }, [getRefs]);

  const clearMatchHistory = useCallback(() => {
    const r = getRefs(); if (r) updateDoc(r.team, { matchHistory: [] });
  }, [getRefs]);

  const scoutCandidates = useCallback(() => {
    const r = getRefs(); if (!r) return;
    const candidates = Array.from({ length: 3 }).map((_, i) => generateScoutedPlayer(i, Number(stateRef.current.academy?.scoutsLevel || 0), `scout_${getMoscowTime().getTime()}_${i}`));
    setDoc(r.team, { scoutingCandidates: JSON.parse(JSON.stringify(candidates)), lastScoutDate: getMoscowTime().toISOString() }, { merge: true });
  }, [getRefs]);

  const recruitCandidate = useCallback((playerId: string) => {
    const r = getRefs(); if (!r) return;
    const candidate = stateRef.current.scoutingCandidates.find(c => c.id === playerId);
    if (!candidate) return;
    setDoc(doc(collection(r.team, 'heroes'), candidate.id), { ...candidate, isYouth: true });
    setDoc(r.team, { scoutingCandidates: stateRef.current.scoutingCandidates.filter(c => c.id !== playerId) }, { merge: true });
  }, [getRefs]);

  const clearScoutingReport = useCallback(() => { const r = getRefs(); if (r) setDoc(r.team, { scoutingCandidates: [], lastScoutDate: null }, { merge: true }); }, [getRefs]);
  
  const upgradeManagerSkill = useCallback((key: keyof GameState['managerSkills']) => {
    const r = getRefs(); if (!r || stateRef.current.skillPoints <= 0) return;
    setDoc(r.team, { managerSkills: { [key]: increment(1) }, skillPoints: increment(-1) }, { merge: true });
  }, [getRefs]);

  const startArenaConstruction = useCallback((id: string, cost: number) => startConstruction('arena', id, cost), [addCredits, getRefs]);
  const startHQConstruction = useCallback((id: string, cost: number) => startConstruction('hq', id, cost), [addCredits, getRefs]);
  const startBootcampConstruction = useCallback((id: string, cost: number) => startConstruction('bootcamp', id, cost), [addCredits, getRefs]);
  const startAcademyConstruction = useCallback((id: string, cost: number) => startConstruction('academy', id, cost), [addCredits, getRefs]);
  const startMedicalConstruction = useCallback((id: string, cost: number) => startConstruction('medical', id, cost), [addCredits, getRefs]);
  
  const startConstruction = useCallback((cat: string, id: string, cost: number) => {
    const r = getRefs(); if (!r || stateRef.current.credits < cost) return false;
    const level = (stateRef.current as any)[cat][id] || 0;
    addCredits(-cost);
    setDoc(r.team, { [cat]: { constructionStarts: { [id]: getMoscowTime().toISOString() }, constructionFinishes: { [id]: new Date(getMoscowTime().getTime() + (4 * (level + 1)) * 3600000).toISOString() } } }, { merge: true });
    return true;
  }, [getRefs, addCredits]);

  const accelerateConstruction = useCallback((type: string, id: string, mult: number, price: number) => {
    const r = getRefs(); if (!r || stateRef.current.crystals < price) return false;
    const data = (stateRef.current as any)[type];
    if (data.isAccelerated?.[id]) return false;
    const remaining = new Date(data.constructionFinishes[id]).getTime() - getMoscowTime().getTime();
    addCrystals(-price);
    setDoc(r.team, { [type]: { constructionFinishes: { [id]: new Date(getMoscowTime().getTime() + (remaining / mult)).toISOString() }, isAccelerated: { [id]: true } } }, { merge: true });
    return true;
  }, [getRefs, addCrystals]);

  const checkConstructions = useCallback(() => {
    const r = getRefs(); if (!r) return;
    const cats = ['arena', 'hq', 'bootcamp', 'academy', 'medical'];
    let updateFound = false; const newTeamData: any = {};
    const now = getMoscowTime();
    cats.forEach(cat => {
      const data = (stateRef.current as any)[cat];
      if (data?.constructionFinishes) {
        Object.entries(data.constructionFinishes).forEach(([id, finishIso]: [string, any]) => {
          if (now >= new Date(finishIso)) {
            updateFound = true; 
            if (!newTeamData[cat]) newTeamData[cat] = {};
            newTeamData[cat][id] = increment(1);
            newTeamData[cat].constructionFinishes = { [id]: null };
            newTeamData[cat].constructionStarts = { [id]: null };
          }
        });
      }
    });
    if (updateFound) setDoc(r.team, newTeamData, { merge: true });
  }, [getRefs]);

  const setWorldReady = useCallback((ready: boolean) => { setIsWorldReady(ready); }, []);

  const nextMatchInfo = useMemo(() => {
    if (!user?.uid || !allMatches || allMatches.length === 0) return null;
    const mskNow = getMoscowTime().getTime();
    const futureMatches = allMatches.filter(m => 
      (m.homeId === user.uid || m.awayId === user.uid) && 
      !m.isFinished &&
      new Date(m.startTime).getTime() > mskNow - (1000 * 60 * 2) 
    );
    if (futureMatches.length === 0) return null;
    const sorted = [...futureMatches].sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
    const next = sorted[0];
    return { match: next, opponentName: next.homeId === user.uid ? next.awayName : next.homeName, isHome: next.homeId === user.uid };
  }, [allMatches, user?.uid]);
  
  const generateDailyGifts = useCallback((gifts: Gift[]) => {
    const r = getRefs();
    if (!r) return;
    updateDoc(r.root, { 
      availableGiftsToSend: gifts, 
      lastGiftGenDate: getMoscowDateString() 
    });
  }, [getRefs]);

  const sendGift = useCallback(async (giftId: string, friendId: string, friendName: string) => {
    if (!user) return false;
    const r = getRefs();
    if (!r) return false;
    
    const gift = stateRef.current.availableGiftsToSend.find(g => g.id === giftId);
    if (!gift) return false;
    
    try {
      const friendGiftRef = doc(collection(doc(db, 'players_v10', friendId), 'received_gifts'));
      await setDoc(friendGiftRef, {
        ...gift,
        id: friendGiftRef.id,
        senderId: user.uid,
        senderName: stateRef.current.displayName || "Manager",
        createdAt: new Date().toISOString(),
        claimed: false
      });
      
      const newAvailable = stateRef.current.availableGiftsToSend.filter(g => g.id !== giftId);
      await updateDoc(r.root, { availableGiftsToSend: newAvailable });
      
      addDocumentNonBlocking(collection(db, 'notifications_v7'), {
        userId: friendId,
        title: "Gift Received!",
        description: `Manager ${stateRef.current.displayName} sent you: ${gift.label}`,
        type: 'social',
        read: false,
        createdAt: new Date().toISOString()
      });
      
      return true;
    } catch (e) {
      console.error("Failed to send gift", e);
      return false;
    }
  }, [user, getRefs, db]);

  const claimGift = useCallback(async (gift: Gift) => {
    if (!user) return false;
    const r = getRefs();
    if (!r) return false;
    
    try {
      if (gift.type === 'grant') {
        addCredits(gift.value);
      } else if (gift.type === 'shard') {
        addCrystals(gift.value);
      } else if (gift.type === 'architect') {
        const cats = ['arena', 'hq', 'bootcamp', 'academy', 'medical'];
        let applied = false;
        for (const cat of cats) {
          const data = (stateRef.current as any)[cat];
          if (data?.constructionFinishes) {
             const activeBuilding = Object.entries(data.constructionFinishes).find(([_, finish]) => !!finish);
             if (activeBuilding) {
                const [bId, finishIso]: [string, any] = activeBuilding;
                const newFinish = new Date(new Date(finishIso).getTime() - (gift.value * 3600000)).toISOString();
                const updates: any = {};
                updates[`${cat}.constructionFinishes.${bId}`] = newFinish;
                await updateDoc(r.team, updates);
                applied = true;
                break;
             }
          }
        }
        if (!applied) return false;
      } else if (gift.type === 'teambuilding') {
        const staffRoles: StaffRole[] = ['coach', 'analyst', 'scout', 'doctor', 'financier'];
        const activeStaff = staffRoles.map(role => stateRef.current.staff[role]).filter(Boolean) as StaffMember[];
        if (activeStaff.length === 0) return false;
        const target = activeStaff[0];
        await updateDoc(doc(collection(r.team, 'staff'), target.id), { 
          'skills.primary': increment(gift.value) 
        });
      } else if (gift.type === 'curse') {
        if (stateRef.current.youthAcademyPlayers.length === 0) return false;
        const target = stateRef.current.youthAcademyPlayers[0];
        const keys = STAT_KEYS;
        const randomKey = keys[Math.floor(Math.random() * keys.length)];
        const updates: any = {};
        updates[`proStats.${randomKey}`] = increment(gift.value);
        await updateDoc(doc(collection(r.team, 'heroes'), target.id), updates);
      } else if (gift.type === 'secret') {
        const types = ['grant', 'shard'] as const;
        const randomType = types[Math.floor(Math.random() * types.length)];
        if (randomType === 'grant') addCredits(2000000);
        else addCrystals(200);
      }
      
      await deleteDoc(doc(doc(db, 'players_v10', user.uid), 'received_gifts', gift.id));
      return true;
    } catch (e) {
      console.error("Failed to claim gift", e);
      return false;
    }
  }, [user, getRefs, db, addCredits, addCrystals]);

  const value = useMemo(() => ({
    ...state, 
    isDataReady: state.isLoaded, 
    isTeamLoaded: state.isTeamLoaded, 
    allSeasonMatches: allMatches, 
    nextMatch: nextMatchInfo, 
    isMatchesLoading: !isWorldReady || allMatches.length === 0, 
    addCrystals, addCredits, updatePlayer, removePlayer, assignToRole, updateLineup, updateTactics, claimReward, purchaseLicense, purchasePremium, setLanguage, setTrainingFocus, startDailyPlayerTraining, claimDailyPlayerTraining, recoverAllFatigue, hireStaffMember, trainStaffSkill, addPlayerDirectly, addYouthPlayerDirectly, promoteYouthPlayer, updateProfileName, updateProfileCountry, healPlayer, launchFanCampaign, payStaffSalaries, scoutCandidates, recruitCandidate, clearScoutingReport, upgradeManagerSkill, startArenaConstruction, startHQConstruction, startBootcampConstruction, startAcademyConstruction, startMedicalConstruction, accelerateConstruction, checkConstructions, recordMatch, markMatchIdAsSeen, deleteMatchHistoryEntry, clearMatchHistory, setWorldReady, resetProfile, addTrophy,
    sendGift, claimGift, generateDailyGifts
  }), [state, isWorldReady, allMatches, nextMatchInfo, addCrystals, addCredits, updatePlayer, removePlayer, assignToRole, updateLineup, updateTactics, claimReward, purchaseLicense, purchasePremium, setLanguage, setTrainingFocus, startDailyPlayerTraining, claimDailyPlayerTraining, recoverAllFatigue, hireStaffMember, trainStaffSkill, addPlayerDirectly, addYouthPlayerDirectly, promoteYouthPlayer, updateProfileName, updateProfileCountry, healPlayer, launchFanCampaign, payStaffSalaries, scoutCandidates, recruitCandidate, clearScoutingReport, upgradeManagerSkill, startArenaConstruction, startHQConstruction, startBootcampConstruction, startAcademyConstruction, startMedicalConstruction, accelerateConstruction, checkConstructions, recordMatch, markMatchIdAsSeen, deleteMatchHistoryEntry, clearMatchHistory, setWorldReady, resetProfile, addTrophy, sendGift, claimGift, generateDailyGifts]);

  return <GameStateContext.Provider value={value}>{children}</GameStateContext.Provider>;
}

export function useGameState() {
  const context = useContext(GameStateContext);
  if (context === undefined) throw new Error('useGameState must be used within a GameStateProvider');
  return context;
}
