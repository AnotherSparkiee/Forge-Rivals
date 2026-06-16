/**
 * @fileOverview Core logic for League structure, deterministic scheduling, and Bo2 result generation.
 */

export interface LeagueOption {
  id: string;
  startTime: string;
  description: string;
}

export const MAX_LEVELS = 9;
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
 * Deterministic Bo2 Result: [2,0], [1,1], [0,2]
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
  if (val < 35) return [2, 0];
  if (val < 65) return [1, 1];
  return [0, 2];
}

/**
 * Generates a stable list of 8 teams for a group with globally unique deterministic bot IDs and Names.
 * Bot ID formula: [LeagueIndex(2)][Level(1)][Group(3)][Index(1)]
 */
export function getStableGroupTeams(level: any, group: any, leagueId: string, allLeaguePlayers: any[] = []) {
  const lvl = Number(level);
  const grp = Number(group);
  const leagueIdx = LEAGUES.findIndex(l => l.id === leagueId);

  // Filter players strictly for this specific group
  const groupPlayers = allLeaguePlayers.filter(p => 
    p.selectedLeagueId === leagueId && 
    Number(p.leagueLevel) === lvl && 
    Number(p.groupId) === grp
  ).map(p => ({
    id: p.id,
    name: p.displayName || "Unknown Commander",
    isBot: false
  }));

  const teams = [...groupPlayers];
  const botsNeeded = Math.max(0, TEAMS_PER_GROUP - teams.length);
  
  for (let i = 0; i < botsNeeded; i++) {
    // Globally unique ID: [League(1-16)][Div(1-9)][Group(1-256)][Index(1-8)]
    const botIdNum = ((leagueIdx + 1) * 100000) + (lvl * 1000) + (grp * 10) + (i + 1);
    const botId = `bot_${botIdNum}`;
    const botName = `bot${botIdNum}`;
    
    teams.push({ id: botId, name: botName, isBot: true });
  }

  return teams.sort((a, b) => a.id.localeCompare(b.id));
}

/**
 * Circle-robin algorithm for 14-day calendar.
 */
export function generateSeasonCalendar(teams: any[]) {
  const n = teams.length;
  const rounds = (n - 1) * 2;
  const matches = [];
  const teamIndices = Array.from({ length: n }, (_, i) => i);

  for (let r = 0; r < rounds; r++) {
    const day = r + 1;
    const isSecondHalf = r >= (n - 1);
    
    for (let i = 0; i < n / 2; i++) {
      let hIdx = teamIndices[i];
      let aIdx = teamIndices[n - 1 - i];
      if (isSecondHalf) [hIdx, aIdx] = [aIdx, hIdx];

      matches.push({
        day,
        homeId: teams[hIdx].id,
        homeName: teams[hIdx].name,
        awayId: teams[aIdx].id,
        awayName: teams[aIdx].name,
        status: 'pending',
        scoreA: 0,
        scoreB: 0
      });
    }
    teamIndices.splice(1, 0, teamIndices.pop()!);
  }
  return matches;
}

/**
 * Calculates standings from a list of matches.
 */
export function calculateStandings(teams: any[], matches: any[]) {
  const stats = teams.map(t => ({ 
    ...t, 
    wins: 0, 
    draws: 0, 
    losses: 0, 
    points: 0, 
    goalsFor: 0, 
    goalsAgainst: 0,
    played: 0
  }));

  matches.filter(m => m.status === 'finished').forEach(m => {
    const home = stats.find(t => t.id === m.homeId);
    const away = stats.find(t => t.id === m.awayId);
    if (!home || !away) return;

    home.played++;
    away.played++;
    home.goalsFor += (m.scoreA || 0);
    home.goalsAgainst += (m.scoreB || 0);
    away.goalsFor += (m.scoreB || 0);
    away.goalsAgainst += (m.scoreA || 0);

    if (m.scoreA > m.scoreB) {
      home.wins++; home.points += 3; away.losses++;
    } else if (m.scoreA === m.scoreB) {
      home.draws++; home.points += 1; away.draws++; away.points += 1;
    } else {
      away.wins++; away.points += 3; home.losses++;
    }
  });

  return stats.sort((a, b) => 
    b.points - a.points || 
    (b.goalsFor - b.goalsAgainst) - (a.goalsFor - a.goalsAgainst) || 
    b.goalsFor - a.goalsFor ||
    a.id.localeCompare(b.id)
  );
}

/**
 * Higher level helper for Rankings page.
 */
export function getGroupStandings(level: number, group: number, leagueId: string, season: number, allPlayers: any[], matches: any[]) {
  const teams = getStableGroupTeams(level, group, leagueId, allPlayers);
  return calculateStandings(teams, matches);
}
