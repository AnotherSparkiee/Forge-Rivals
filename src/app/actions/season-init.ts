'use server';

/**
 * @fileOverview Атомарный инициализатор игрового мира v5.0.
 * Формирует таблицы, календарь и кубок на стороне сервера.
 */

import { 
  collection, doc, getDocs, writeBatch, query, where, 
  getDoc, serverTimestamp, setDoc
} from 'firebase/firestore';
import { initializeFirebase } from '@/firebase';
import { LEAGUES } from '@/app/lib/leagues-data';

interface TeamStats {
  points: number;
  matchesPlayed: number;
  wins: number;
  draws: number;
  losses: number;
  diff: number;
  goalsScored: number;
  goalsConceded: number;
}

/**
 * ГЛАВНЫЙ ВХОД: Проверяет и инициализирует группу и кубок.
 */
export async function ensureWorldInitialized(
  season: number, 
  leagueId: string, 
  tier: number, 
  group: number,
  userId: string
) {
  const { firestore: db } = initializeFirebase();
  
  const tableId = `season_${season}_tier_${tier}_group_${group}_league_${leagueId}`;
  const tableRef = doc(db, 'league_tables_v1', tableId);
  
  const tableSnap = await getDoc(tableRef);
  if (tableSnap.exists() && tableSnap.data().version === 35) {
    return { success: true, alreadyInitialized: true };
  }

  console.log(`[WORLD GEN] Initializing Season ${season} for League ${leagueId} Group ${group}...`);

  // 1. Собираем реальных игроков этой группы
  const playersSnap = await getDocs(query(
    collection(db, 'players_v10'),
    where('selectedLeagueId', '==', leagueId),
    where('leagueLevel', '==', tier),
    where('groupId', '==', group)
  ));

  const realPlayers = playersSnap.docs.map(d => ({
    id: d.id,
    name: d.data().displayName || `Manager_${d.id.slice(0, 4)}`,
    isBot: false
  }));

  // Гарантируем наличие текущего игрока
  if (!realPlayers.some(p => p.id === userId)) {
    const meSnap = await getDoc(doc(db, 'players_v10', userId));
    if (meSnap.exists()) {
      realPlayers.push({
        id: userId,
        name: meSnap.data().displayName || `Manager_${userId.slice(0, 4)}`,
        isBot: false
      });
    }
  }

  // 2. Инициализируем группу (Таблица + Календарь)
  await initializeSeasonGroupInternal(db, season, tier, group, leagueId, realPlayers);

  // 3. Инициализируем Кубок Лиги (если еще нет)
  await initializePyramidCupInternal(db, season, leagueId);

  return { success: true };
}

async function initializeSeasonGroupInternal(
  db: any, season: number, tier: number, group: number, leagueId: string, realPlayers: any[]
) {
  const batch = writeBatch(db);
  const tableId = `season_${season}_tier_${tier}_group_${group}_league_${leagueId}`;
  const tableRef = doc(db, 'league_tables_v1', tableId);

  const teams = [...realPlayers];
  const botsNeeded = Math.max(0, 8 - teams.length);
  const leagueIdx = LEAGUES.findIndex(l => l.id === leagueId);
  const lPref = (leagueIdx + 1).toString().padStart(2, '0');
  const gPref = group.toString().padStart(3, '0');

  for (let i = 0; i < botsNeeded; i++) {
    const botId = `bot${lPref}${tier}${gPref}${i + 1}`;
    teams.push({ id: botId, name: botId, isBot: true });
  }

  teams.sort((a, b) => a.id.localeCompare(b.id));
  const teamIds = teams.map(t => t.id);
  const stats: Record<string, TeamStats> = {};
  teams.forEach(t => {
    stats[t.id] = { points: 0, matchesPlayed: 0, wins: 0, draws: 0, losses: 0, diff: 0, goalsScored: 0, goalsConceded: 0 };
  });

  batch.set(tableRef, {
    id: tableId, season, tier, group, leagueId, teams: teamIds,
    teamData: teams.map(t => ({ id: t.id, name: t.name, isBot: !!t.isBot })),
    stats, updatedAt: serverTimestamp(), version: 35
  });

  const schedule = generateRoundRobin(teamIds);
  const leagueInfo = LEAGUES.find(l => l.id === leagueId) || LEAGUES[0];
  const [hh, mm] = leagueInfo.startTime.split(':').map(Number);
  const seasonStart = new Date('2026-06-22T00:00:00+03:00');
  const startMs = seasonStart.getTime() + (season - 1) * 15 * 24 * 60 * 60 * 1000;

  schedule.forEach((roundMatches, roundIdx) => {
    const tour = roundIdx + 1;
    roundMatches.forEach((m, mIdx) => {
      const matchTime = new Date(startMs + (tour - 1) * 24 * 60 * 60 * 1000 + hh * 3600000 + mm * 60000);
      const matchId = `m_${tableId}_t${tour}_idx${mIdx}`;
      const homeTeam = teams.find(t => t.id === m.home);
      const awayTeam = teams.find(t => t.id === m.away);

      batch.set(doc(db, 'matches_v1', matchId), {
        id: matchId, tableId, season, tour, day: tour, leagueId, tier, groupId: String(group),
        homeId: m.home, homeName: homeTeam?.name || m.home,
        awayId: m.away, awayName: awayTeam?.name || m.away,
        startTime: matchTime.toISOString(), status: "scheduled", isFinished: false,
        createdAt: serverTimestamp(), version: 35
      });
    });
  });

  await batch.commit();
}

async function initializePyramidCupInternal(db: any, season: number, leagueId: string) {
  const cupDocId = `season_${season}_league_${leagueId}`;
  const cupRef = doc(db, 'cup_pyramid_v1', cupDocId);
  const cupSnap = await getDoc(cupRef);
  if (cupSnap.exists()) return;

  const playersSnap = await getDocs(query(collection(db, 'players_v10'), where('selectedLeagueId', '==', leagueId)));
  const participants = playersSnap.docs.map(d => ({ 
    id: d.id, name: d.data().displayName || `Manager_${d.id.slice(0,4)}`, isPlayer: true, level: d.data().leagueLevel || 9 
  }));
  
  const totalSlots = 32;
  const leagueIdx = LEAGUES.findIndex(l => l.id === leagueId);
  const lPref = (leagueIdx + 1).toString().padStart(2, '0');

  while (participants.length < totalSlots) {
    const botId = `bot${lPref}cup${participants.length + 1}`;
    participants.push({ id: botId, name: botId, isPlayer: false, level: 9 });
  }

  // Shuffle
  const seed = season;
  participants.sort((a, b) => a.id.localeCompare(b.id));
  for (let i = participants.length - 1; i > 0; i--) {
    const j = (seed + i) % (i + 1);
    [participants[i], participants[j]] = [participants[j], participants[i]];
  }

  const round1 = [];
  for (let i = 0; i < participants.length; i += 2) {
    round1.push({
      matchId: `cup_s${season}_l${leagueId}_r1_m${(i/2)+1}`,
      home: participants[i], away: participants[i+1],
      scoreA: null, scoreB: null, winnerId: null, status: 'scheduled'
    });
  }

  await setDoc(cupRef, {
    season, leagueId, rounds: { r1: round1, r2: Array(8).fill(null), r3: Array(4).fill(null), r4: Array(2).fill(null), r5: [null] },
    status: 'active', createdAt: serverTimestamp(), version: 35
  });
}

function generateRoundRobin(teams: string[]) {
  const n = teams.length;
  const rounds = [];
  const players = [...teams];
  for (let r = 0; r < n - 1; r++) {
    const roundMatches = [];
    for (let i = 0; i < n / 2; i++) {
      roundMatches.push({ home: players[i], away: players[n - 1 - i] });
    }
    rounds.push(roundMatches);
    players.splice(1, 0, players.pop()!);
  }
  const secondCircle = rounds.map(r => r.map(m => ({ home: m.away, away: m.home })));
  return [...rounds, ...secondCircle];
}
