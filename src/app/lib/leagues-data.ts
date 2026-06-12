/**
 * @fileOverview Core logic for League structure, deterministic scheduling, and Bo2 result generation.
 * Implements the "Source of Truth" for the entire pyramidal league system.
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
 * Based on team power and deterministic seed.
 */
export function getMatchResult(homeId: string, awayId: string, day: number, season: number, homeOvr: number = 25, awayOvr: number = 25): [number, number] {
  const combinedId = `${homeId}-${awayId}-${day}-${season}`;
  let hash = 0;
  for (let i = 0; i < combinedId.length; i++) {
    hash = ((hash << 5) - hash) + combinedId.charCodeAt(i);
    hash |= 0;
  }
  const seed = Math.abs(hash);
  
  // Power factor (OVR advantage increases win chance)
  const powerDiff = homeOvr - awayOvr;
  const homeAdvantage = 35 + (powerDiff * 2); 
  const drawChance = 30;

  const val = seed % 100;
  
  if (val < homeAdvantage) return [2, 0];
  if (val < homeAdvantage + drawChance) return [1, 1];
  return [0, 2];
}

/**
 * Generates a stable list of 8 teams for a group.
 */
export function getStableGroupTeams(level: number, group: number, leagueId: string, allLeaguePlayers: any[] = []) {
  const groupPlayers = allLeaguePlayers.filter(p => 
    p.selectedLeagueId === leagueId && 
    Number(p.leagueLevel) === Number(level) && 
    Number(p.groupId) === Number(group)
  ).map(p => ({
    id: p.id,
    name: p.displayName || "Unknown Commander",
    ovr: 25, // Base OVR for bots/sync
    isBot: false
  }));

  const teams = [...groupPlayers];
  const botsNeeded = Math.max(0, TEAMS_PER_GROUP - teams.length);
  for (let i = 0; i < botsNeeded; i++) {
    const botId = `bot_${leagueId}_${level}_${group}_${i}`;
    teams.push({ id: botId, name: `Elite Bot ${i + 1}`, ovr: 20 + level, isBot: true });
  }
  return teams.sort((a, b) => a.id.localeCompare(b.id));
}

/**
 * Circle-robin algorithm for 14-day calendar (Double Round Robin).
 */
export function generateSeasonCalendar(teams: any[]) {
  const n = teams.length;
  const rounds = (n - 1) * 2; // 14 rounds for 8 teams
  const matches = [];
  
  const teamIndices = Array.from({ length: n }, (_, i) => i);

  for (let r = 0; r < rounds; r++) {
    const day = r + 1;
    const isSecondHalf = r >= (n - 1);
    
    for (let i = 0; i < n / 2; i++) {
      let hIdx = teamIndices[i];
      let aIdx = teamIndices[n - 1 - i];

      // Swap home/away for second half of season
      if (isSecondHalf) {
        [hIdx, aIdx] = [aIdx, hIdx];
      }

      matches.push({
        id: `m_d${day}_p${i}`,
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

    // Rotate indices (keeping first one fixed)
    teamIndices.splice(1, 0, teamIndices.pop()!);
  }

  return matches;
}

/**
 * Calculates standings from matches.
 */
export function calculateStandings(teams: any[], matches: any[]) {
  const stats = teams.map(t => ({ ...t, wins: 0, draws: 0, losses: 0, points: 0, goalsFor: 0, goalsAgainst: 0 }));

  matches.filter(m => m.status === 'finished').forEach(m => {
    const home = stats.find(t => t.id === m.homeId);
    const away = stats.find(t => t.id === m.awayId);
    if (!home || !away) return;

    home.goalsFor += m.scoreA;
    home.goalsAgainst += m.scoreB;
    away.goalsFor += m.scoreB;
    away.goalsAgainst += m.scoreA;

    if (m.scoreA > m.scoreB) {
      home.wins++; home.points += 3; away.losses++;
    } else if (m.scoreA === m.scoreB) {
      home.draws++; home.points += 1; away.draws++; away.points += 1;
    } else {
      away.wins++; away.points += 3; home.losses++;
    }
  });

  return stats.sort((a, b) => b.points - a.points || (b.goalsFor - b.goalsAgainst) - (a.goalsFor - a.goalsAgainst) || a.id.localeCompare(b.id));
}
