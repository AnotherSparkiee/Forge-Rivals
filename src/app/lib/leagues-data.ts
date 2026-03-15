
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
  const hId = parseInt(homeId.replace('bot_', '').replace('player_team', '99999'));
  const aId = parseInt(awayId.replace('bot_', '').replace('player_team', '99999'));
  
  const seed = hId + aId + day;
  const val = seed % 10;
  
  if (val < 4) return [2, 0]; // Home Win
  if (val < 7) return [1, 1]; // Draw
  return [0, 2]; // Away Win
}

/**
 * Generates a round-robin schedule for 8 teams using Circle Method.
 */
export function getSchedule(teams: any[], day?: number) {
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
  if (day !== undefined) {
    const matchDay = ((day - 1) % rounds) + 1;
    const isSecondRound = day > rounds;
    const dayMatches = fullSchedule[matchDay - 1];
    
    if (isSecondRound) {
      return dayMatches.map(m => ({ home: m.away, away: m.home }));
    }
    return dayMatches;
  }

  // Return all 14 days
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

  // Calculate standings up to (currentDay - 1) for bots
  // If playerStats are provided, we don't recalculate player stats from deterministic results
  const seasonSchedule = getSchedule(teams);
  for (let day = 1; day < currentDay; day++) {
    const matches = seasonSchedule[day - 1];
    matches.forEach((m: any) => {
      // If we have player stats, skip re-simulating the player's past matches to avoid double counting
      if (playerStats && (m.home.isPlayer || m.away.isPlayer)) {
        // We only simulate bot vs bot matches if we already have injected player stats
        if (!m.home.isPlayer && !m.away.isPlayer) {
          const [hScore, aScore] = getMatchResult(m.home.id, m.away.id, day);
          this.applyResult(m.home, m.away, hScore, aScore);
        }
        return;
      }

      // Default simulation for all teams
      const [hScore, aScore] = getMatchResult(m.home.id, m.away.id, day);
      if (hScore === 2) {
        m.home.wins++;
        m.home.points += 3;
        m.away.losses++;
      } else if (hScore === 1) {
        m.home.draws++;
        m.home.points += 1;
        m.away.draws++;
        m.away.points += 1;
      } else {
        m.away.wins++;
        m.away.points += 3;
        m.home.losses++;
      }
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
