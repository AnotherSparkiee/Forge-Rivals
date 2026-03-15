
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

export const LEAGUES: LeagueOption[] = [
  { id: 'ALPHA', startTime: '08:00 - 12:00', description: 'Early morning operations for early birds.' },
  { id: 'BETA', startTime: '12:00 - 16:00', description: 'Mid-day tactical window.' },
  { id: 'GAMMA', startTime: '16:00 - 20:00', description: 'Prime time evening matches.' },
  { id: 'DELTA', startTime: '20:00 - 00:00', description: 'Late night competitive sessions.' },
];

/**
 * Deterministic match result based on team IDs and day.
 * Returns score [homeScore, awayScore] (Bo2)
 */
export function getMatchResult(homeId: string, awayId: string, day: number): [number, number] {
  // Simple deterministic seed based on IDs and day
  const hId = parseInt(homeId.replace(/\D/g, '') || '1');
  const aId = parseInt(awayId.replace(/\D/g, '') || '2');
  
  const seed = (hId * 3) + (aId * 7) + (day * 13);
  const val = seed % 10;
  
  if (val < 4) return [2, 0]; // Home Win
  if (val < 7) return [1, 1]; // Draw
  return [0, 2]; // Away Win
}

/**
 * Generates a round-robin schedule for 8 teams using Circle Method.
 */
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
    // Rotate all except first element
    teamsCopy.splice(1, 0, teamsCopy.pop());
  }

  // Round 1: Days 1-7
  // Round 2: Days 8-14 (reverse home/away)
  const seasonSchedule = [];
  for (let d = 1; d <= SEASON_DURATION_DAYS; d++) {
    const matchDay = ((d - 1) % rounds) + 1;
    const isSecondRound = d > rounds;
    const dayMatches = fullSchedule[matchDay - 1];
    seasonSchedule.push(isSecondRound ? dayMatches.map(m => ({ home: m.away, away: m.home })) : dayMatches);
  }
  return seasonSchedule;
}

/**
 * Deterministically generates group teams and their standings based on current day.
 */
export function getMockGroupTeams(
  playerRank: number, 
  playerName: string = "Player Team",
  level: number = 8,
  division: number = 1,
  group: number = 1,
  includePlayer: boolean = true,
  currentDay: number = 1,
  playerStats?: { wins: number, draws: number, losses: number, points: number }
) {
  const teams = [];
  const botLimit = includePlayer ? 7 : 8;
  
  for (let i = 0; i < botLimit; i++) {
    const botIdValue = (level * 10000) + (division * 100) + (group * 10) + i;
    teams.push({
      id: `bot_${botIdValue}`,
      name: `🤖bot${botIdValue}`,
      wins: 0,
      draws: 0,
      losses: 0,
      points: 0,
      isPlayer: false
    });
  }

  if (includePlayer) {
    teams.push({ 
      id: "player_team",
      name: playerName, 
      wins: playerStats ? playerStats.wins : 0,
      draws: playerStats ? playerStats.draws : 0,
      losses: playerStats ? playerStats.losses : 0,
      points: playerStats ? playerStats.points : 0,
      isPlayer: true 
    });
  }

  const seasonSchedule = getSchedule(teams);
  
  // Simulation up to currentDay - 1 (completed matches)
  for (let d = 1; d < currentDay; d++) {
    const matches = seasonSchedule[d - 1];
    matches.forEach((m: any) => {
      const home = teams.find(t => t.id === m.home.id);
      const away = teams.find(t => t.id === m.away.id);
      
      if (!home || !away) return;

      // If one of the teams is a player and we have injected stats, we don't recalculate
      if (playerStats && (home.isPlayer || away.isPlayer)) {
        return;
      }

      const [hScore, aScore] = getMatchResult(home.id, away.id, d);
      applyResult(home, away, hScore, aScore);
    });
  }

  return teams.sort((a, b) => b.points - a.points || (b.wins - a.wins));
}

export function applyResult(home: any, away: any, hScore: number, aScore: number) {
  if (hScore === 2) {
    home.wins++;
    home.points += 3;
    away.losses++;
  } else if (hScore === 1) {
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
