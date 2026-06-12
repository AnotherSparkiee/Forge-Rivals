/**
 * @fileOverview Core logic for League data, deterministic scheduling, and result generation.
 * Enforces Bo2 format (2:0, 1:1, 0:2) and synchronous group updates.
 */

export interface LeagueOption {
  id: string;
  startTime: string;
  description: string;
}

export const MAX_LEVELS = 9;
export const GROUPS_PER_DIVISION = 8; // Max for indexing
export const TEAMS_PER_GROUP = 8;
export const SEASON_DURATION_DAYS = 14;

export const LEAGUES: LeagueOption[] = [
  { id: 'ALPHA', startTime: '08:00', description: 'Early morning shift.' },
  { id: 'BETA', startTime: '09:00', description: 'Morning operations.' },
  { id: 'GAMMA', startTime: '10:00', description: 'Morning operations.' },
  { id: 'DELTA', startTime: '11:00', description: 'Pre-noon shift.' },
  { id: 'EPSILON', startTime: '12:00', description: 'Midday operations.' },
  { id: 'ZETA', startTime: '13:00', description: 'Afternoon operations.' },
  { id: 'ETA', startTime: '14:00', description: 'Afternoon operations.' },
  { id: 'THETA', startTime: '15:00', description: 'Late afternoon shift.' },
  { id: 'IOTA', startTime: '16:00', description: 'Late afternoon shift.' },
  { id: 'KAPPA', startTime: '17:00', description: 'Early evening operations.' },
  { id: 'LAMBDA', startTime: '18:00', description: 'Evening operations.' },
  { id: 'MU', startTime: '19:00', description: 'Evening operations.' },
  { id: 'NU', startTime: '20:00', description: 'Prime time shift.' },
  { id: 'XI', startTime: '21:00', description: 'Late night operations.' },
  { id: 'OMICRON', startTime: '22:00', description: 'Late night operations.' },
  { id: 'PI', startTime: '23:00', description: 'Midnight operations.' },
];

/**
 * SOURCE OF TRUTH: Generates a stable list of 8 teams for a specific group.
 */
export function getStableGroupTeams(
  level: number,
  group: number,
  leagueId: string,
  allLeaguePlayers: any[] = []
) {
  // 1. Find real players in this specific group
  const groupPlayers = allLeaguePlayers.filter(p => 
    p.selectedLeagueId === leagueId && 
    Number(p.leagueLevel) === Number(level) && 
    Number(p.groupId) === Number(group)
  ).map(p => ({
    id: p.id,
    name: p.displayName || "Unknown Commander",
    isBot: false
  }));

  // 2. Fill the rest with deterministic bots
  const teams = [...groupPlayers];
  const botsNeeded = Math.max(0, TEAMS_PER_GROUP - teams.length);
  for (let i = 0; i < botsNeeded; i++) {
    // Unique ID based on pyramid coordinates
    const botId = `bot_${leagueId}_${level}_${group}_${i}`;
    teams.push({
      id: botId,
      name: `Elite Bot ${i + 1}`,
      isBot: true
    });
  }

  // 3. Sort by ID to ensure the calendar pairings are identical for everyone
  return teams.sort((a, b) => a.id.localeCompare(b.id));
}

/**
 * Deterministic Bo2 Result: [2,0], [1,1], [0,2]
 * Ensures total synchronization across all clients.
 */
export function getMatchResult(homeId: string, awayId: string, day: number = 0, season: number = 1): [number, number] {
  const combinedId = `${homeId}-${awayId}-${day}-${season}`;
  let hash = 0;
  for (let i = 0; i < combinedId.length; i++) {
    hash = ((hash << 5) - hash) + combinedId.charCodeAt(i);
    hash |= 0;
  }
  const seed = Math.abs(hash);
  const val = seed % 100;
  
  // Weights: 35% Home Win, 30% Draw, 35% Away Win
  if (val < 35) return [2, 0];
  if (val < 65) return [1, 1];
  return [0, 2];
}

/**
 * Build standings based STRICTLY on finished matches in the database.
 */
export function getGroupStandings(
  level: number,
  group: number,
  leagueId: string,
  seasonNumber: number,
  allLeaguePlayers: any[] = [],
  dbMatches: any[] = []
) {
  const teams = getStableGroupTeams(level, group, leagueId, allLeaguePlayers).map(t => ({
    ...t, wins: 0, draws: 0, losses: 0, points: 0
  }));

  const finishedMatches = dbMatches.filter(m => 
    Number(m.divisionId) === Number(level) && 
    Number(m.groupId) === Number(group) && 
    m.leagueId === leagueId && 
    Number(m.seasonNumber) === Number(seasonNumber) &&
    m.status === 'finished'
  );

  finishedMatches.forEach(m => {
    const home = teams.find(t => t.id === m.homeId);
    const away = teams.find(t => t.id === m.awayId);
    if (home && away) {
      if (m.scoreA > m.scoreB) {
        home.wins++; home.points += 3; away.losses++;
      } else if (m.scoreA === m.scoreB) {
        home.draws++; home.points += 1; away.draws++; away.points += 1;
      } else {
        away.wins++; away.points += 3; home.losses++;
      }
    }
  });

  return teams.sort((a, b) => b.points - a.points || b.wins - a.wins || a.id.localeCompare(b.id));
}

/**
 * Circle-robin algorithm for generating pairings.
 */
export function generateDeterministicDayMatches(
  level: number, 
  group: number, 
  leagueId: string, 
  season: number, 
  day: number,
  teams: any[]
) {
  const matches: any[] = [];
  const n = teams.length;
  const participants = Array.from({ length: n }, (_, i) => i);
  
  // Rotate for round-robin
  for (let r = 1; r < day; r++) {
    const last = participants.pop()!;
    participants.splice(1, 0, last);
  }

  const pairings: [number, number][] = [];
  for (let i = 0; i < n / 2; i++) {
    pairings.push([participants[i], participants[n - 1 - i]]);
  }

  const epochDate = new Date('2025-03-03T00:00:00+03:00');
  const seasonStart = new Date(epochDate.getTime() + (season - 1) * 16 * 24 * 60 * 60 * 1000);
  const matchDate = new Date(seasonStart.getTime() + (day - 1) * 24 * 60 * 60 * 1000);
  
  const league = LEAGUES.find(l => l.id === leagueId) || LEAGUES[0];
  const [hours, mins] = league.startTime.split(':').map(Number);
  matchDate.setHours(hours, mins, 0, 0);

  pairings.forEach(([hIdx, aIdx], i) => {
    const home = teams[hIdx];
    const away = teams[aIdx];
    matches.push({
      id: `match_${season}_${leagueId}_${level}_${group}_d${day}_m${i}`,
      day,
      seasonNumber: season,
      leagueId,
      divisionId: level,
      groupId: group,
      homeId: home.id,
      homeName: home.name,
      awayId: away.id,
      awayName: away.name,
      startTime: matchDate.toISOString(),
      status: 'pending',
      scoreA: 0,
      scoreB: 0,
      type: 'league'
    });
  });

  return matches;
}
