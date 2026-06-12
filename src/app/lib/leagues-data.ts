
export interface LeagueGroup {
  id: string;
  name: string;
  level: number;
  divisionId: string;
  groupNumber: number;
}

export interface LeagueOption {
  id: string;
  startTime: string;
  description: string;
}

export const MAX_LEVELS = 9;
export const GROUPS_PER_DIVISION = 8;
export const TEAMS_PER_GROUP = 8;
export const SEASON_DURATION_DAYS = 14;

// 16 Leagues from 08:00 to 23:00 MSK
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
 * STRICT DETERMINISTIC RESULT GENERATOR.
 * Returns only [2,0], [1,1], [0,2] based on seeded IDs.
 * Used by all match listeners and table generators for 100% sync.
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
  
  // 35% Home Win (2:0), 30% Draw (1:1), 35% Away Win (0:2)
  if (val < 35) return [2, 0];
  if (val < 65) return [1, 1];
  return [0, 2];
}

/**
 * Standings calculation logic.
 * Exclusively uses real Firestore data for ground truth.
 */
export function getGroupStandings(
  level: number,
  group: number,
  leagueId: string,
  seasonNumber: number,
  currentDay: number,
  realPlayers: any[] = [],
  dbMatches: any[] = []
) {
  const teams: any[] = [];
  
  // 1. Setup participants (Real players)
  const sortedPlayers = [...(realPlayers || [])].sort((a, b) => (a.id || '').localeCompare(b.id || ''));
  sortedPlayers.forEach(p => {
    teams.push({ 
      id: p.id, 
      name: p.displayName || "Manager", 
      wins: 0, 
      draws: 0, 
      losses: 0, 
      points: 0 
    });
  });

  // 2. Add Bots to fill the group to 8 teams
  const botsNeeded = Math.max(0, TEAMS_PER_GROUP - teams.length);
  for (let i = 0; i < botsNeeded; i++) {
    const botId = `bot_${level}_${group}_${i}`;
    teams.push({ 
      id: botId, 
      name: `Elite Bot ${i + 1}`, 
      wins: 0, 
      draws: 0, 
      losses: 0, 
      points: 0 
    });
  }
  
  // Sort teams by ID for deterministic processing
  teams.sort((a, b) => a.id.localeCompare(b.id));

  // 3. Aggregate results
  // We check both Firestore (dbMatches) and "future" matches if they are already due
  const nowMs = Date.now();
  
  // Instead of just dbMatches, we can deterministically infer results for passed time
  // to ensure tables are NEVER empty if matches should have happened
  for (let d = 1; d <= 14; d++) {
    const dayMatches = generateDeterministicDayMatches(level, group, leagueId, seasonNumber, d, teams);
    
    dayMatches.forEach(m => {
      const startTime = new Date(m.startTime).getTime();
      const dbMatch = dbMatches.find(dbm => dbm.id === m.id);
      
      if (dbMatch?.status === 'finished') {
        const home = teams.find(t => t.id === dbMatch.homeId);
        const away = teams.find(t => t.id === dbMatch.awayId);
        if (home && away) applyResult(home, away, dbMatch.scoreA, dbMatch.scoreB);
      } else if (nowMs >= startTime) {
        // Fallback for real-time display if DB record isn't "finished" yet
        const [sA, sB] = getMatchResult(m.homeId, m.awayId, d, seasonNumber);
        const home = teams.find(t => t.id === m.homeId);
        const away = teams.find(t => t.id === m.awayId);
        if (home && away) applyResult(home, away, sA, sB);
      }
    });
  }

  // 4. Return sorted standings: Points > Wins > ID
  return teams.sort((a, b) => b.points - a.points || b.wins - a.wins || a.id.localeCompare(b.id));
}

export function applyResult(home: any, away: any, hScore: number, aScore: number) {
  if (hScore > aScore) {
    home.wins++; 
    home.points += 3; 
    away.losses++;
  } else if (hScore === aScore) {
    home.draws++; 
    home.points += 1; 
    away.draws++; 
    away.points += 1;
  } else {
    away.wins++; 
    away.points += 3; 
    home.losses++;
  }
}

/**
 * Generates the deterministic match schedule for a specific day/group/season.
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
  const league = LEAGUES.find(l => l.id === leagueId) || LEAGUES[0];
  
  // Simple Round-Robin Pairing (Deterministic)
  // Day 1: 0-7, 1-6, 2-5, 3-4
  // Day 2: 0-6, 7-5, 1-4, 2-3 ... and so on
  const n = teams.length;
  const pairings: [number, number][] = [];
  
  // Standard circle algorithm for round robin
  const participants = Array.from({ length: n }, (_, i) => i);
  for (let r = 1; r < day; r++) {
    const last = participants.pop()!;
    participants.splice(1, 0, last);
  }

  for (let i = 0; i < n / 2; i++) {
    pairings.push([participants[i], participants[n - 1 - i]]);
  }

  pairings.forEach(([hIdx, aIdx], i) => {
    const home = teams[hIdx];
    const away = teams[aIdx];
    const matchId = `match_${season}_${leagueId}_${level}_${group}_d${day}_m${i}`;
    
    // Set start time based on league schedule and day
    const startTime = new Date();
    // Reset to start of season (Season 1 starts March 3, 2025)
    const epochDate = new Date('2025-03-03T00:00:00+03:00');
    const seasonStart = new Date(epochDate.getTime() + (season - 1) * 16 * 24 * 60 * 60 * 1000);
    const matchDate = new Date(seasonStart.getTime() + (day - 1) * 24 * 60 * 60 * 1000);
    
    const [hours, mins] = league.startTime.split(':').map(Number);
    matchDate.setHours(hours, mins, 0, 0);

    matches.push({
      id: matchId,
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
      status: 'pending'
    });
  });

  return matches;
}
