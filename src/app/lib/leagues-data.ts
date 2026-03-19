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
  { id: 'ALPHA', startTime: '08:00', description: 'Early morning shift. Matches start at 08:00 MSK.' },
  { id: 'BETA', startTime: '09:00', description: 'Morning operations. Matches start at 09:00 MSK.' },
  { id: 'GAMMA', startTime: '10:00', description: 'Morning operations. Matches start at 10:00 MSK.' },
  { id: 'DELTA', startTime: '11:00', description: 'Pre-noon shift. Matches start at 11:00 MSK.' },
  { id: 'EPSILON', startTime: '12:00', description: 'Midday operations. Matches start at 12:00 MSK.' },
  { id: 'ZETA', startTime: '13:00', description: 'Afternoon operations. Matches start at 13:00 MSK.' },
  { id: 'ETA', startTime: '14:00', description: 'Afternoon operations. Matches start at 14:00 MSK.' },
  { id: 'THETA', startTime: '15:00', description: 'Late afternoon shift. Matches start at 15:00 MSK.' },
  { id: 'IOTA', startTime: '16:00', description: 'Late afternoon shift. Matches start at 16:00 MSK.' },
  { id: 'KAPPA', startTime: '17:00', description: 'Early evening operations. Matches start at 17:00 MSK.' },
  { id: 'LAMBDA', startTime: '18:00', description: 'Evening operations. Matches start at 18:00 MSK.' },
  { id: 'MU', startTime: '19:00', description: 'Evening operations. Matches start at 19:00 MSK.' },
  { id: 'NU', startTime: '20:00', description: 'Prime time shift. Matches start at 20:00 MSK.' },
  { id: 'XI', startTime: '21:00', description: 'Late night operations. Matches start at 21:00 MSK.' },
  { id: 'OMICRON', startTime: '22:00', description: 'Late night operations. Matches start at 22:00 MSK.' },
  { id: 'PI', startTime: '23:00', description: 'Midnight operations. Matches start at 23:00 MSK.' },
];

/**
 * Deterministic match result based on team IDs and day.
 * Returns score strictly as [2, 0] (Win), [1, 1] (Draw), or [0, 2] (Loss)
 */
export function getMatchResult(homeId: string, awayId: string, day: number): [number, number] {
  const hId = homeId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const aId = awayId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  // Use a fixed salt to ensure stability
  const seed = (hId * 13) + (aId * 37) + (day * 7);
  const val = seed % 100;
  
  if (val < 40) return [2, 0]; 
  if (val < 70) return [1, 1]; 
  return [0, 2]; 
}

export function getSchedule(teams: any[]) {
  const n = teams.length;
  if (n === 0) return [];
  const rounds = n - 1;
  const half = n / 2;

  const teamsCopy = [...teams];
  const fullSchedule = [];

  for (let r = 0; r < rounds; r++) {
    const roundMatches = [];
    for (let i = 0; i < half; i++) {
      const home = teamsCopy[i];
      const away = teamsCopy[n - 1 - i];
      roundMatches.push({ home, away });
    }
    fullSchedule.push(roundMatches);
    const last = teamsCopy.pop();
    if (last) teamsCopy.splice(1, 0, last);
  }

  const seasonSchedule = [];
  for (let d = 1; d <= SEASON_DURATION_DAYS; d++) {
    const matchDayIdx = (d - 1) % rounds;
    const isSecondRound = d > rounds;
    const dayMatches = fullSchedule[matchDayIdx];
    
    if (isSecondRound) {
      seasonSchedule.push(dayMatches.map(m => ({ home: m.away, away: m.home })));
    } else {
      seasonSchedule.push(dayMatches);
    }
  }
  return seasonSchedule;
}

export function getMockGroupTeams(
  playerRank: number, 
  playerName: string = "Player Team",
  level: number = 1,
  division: number = 1,
  group: number = 1,
  includePlayer: boolean = false,
  currentDay: number = 1,
  playerStats?: { wins: number, draws: number, losses: number, points: number },
  leagueId: string = "ALPHA",
  realPlayers: any[] = [],
  currentPlayerId?: string
) {
  const teams: any[] = [];
  
  // 1. Add all real players from Firestore
  const sortedRealPlayers = [...realPlayers].sort((a, b) => a.id.localeCompare(b.id));
  
  sortedRealPlayers.forEach(p => {
    const isMe = p.id === currentPlayerId;
    teams.push({
      id: p.id,
      name: isMe ? (playerName || p.displayName || "My Team") : (p.displayName || "Unknown Commander"),
      wins: 0, // Reset to 0, will be recalculated deterministically for the table
      draws: 0,
      losses: 0,
      points: 0,
      isPlayer: true,
      isMe: isMe
    });
  });

  // 2. Fill remaining slots with bots
  const botsNeeded = TEAMS_PER_GROUP - teams.length;
  for (let i = 0; i < botsNeeded; i++) {
    const botUniqueId = `${leagueId}_L${level}_G${group}_B${i}`;
    teams.push({
      id: botUniqueId,
      name: `🤖 ${leagueId} Bot #${level}-${group}-${i}`,
      wins: 0,
      draws: 0,
      losses: 0,
      points: 0,
      isPlayer: false,
      isMe: false
    });
  }

  // CRITICAL: Always sort teams by ID before simulating and generating schedule
  // This ensures the bracket (who plays whom on which day) is stable throughout the season.
  teams.sort((a, b) => a.id.localeCompare(b.id));

  // 3. Simulate ALL matches up to currentDay - 1
  const seasonSchedule = getSchedule(teams);
  
  // Also include the current day if the local user has already played it
  const maxDayToSimulate = includePlayer && playerStats ? currentDay : currentDay - 1;

  for (let d = 1; d <= maxDayToSimulate; d++) {
    const matches = seasonSchedule[d - 1];
    if (!matches) continue;

    matches.forEach((m: any) => {
      const home = teams.find(t => t.id === m.home.id);
      const away = teams.find(t => t.id === m.away.id);
      
      if (!home || !away) return;

      const [hScore, aScore] = getMatchResult(home.id, away.id, d);
      applyResult(home, away, hScore, aScore);
    });
  }

  return teams;
}

export function applyResult(home: any, away: any, hScore: number, aScore: number) {
  if (hScore === 2 && aScore === 0) {
    home.wins++;
    home.points += 3;
    away.losses++;
  } else if (hScore === 1 && aScore === 1) {
    home.draws++;
    home.points += 1;
    away.draws++;
    away.points += 1;
  } else if (aScore === 2 && hScore === 0) {
    away.wins++;
    away.points += 3;
    home.losses++;
  }
}