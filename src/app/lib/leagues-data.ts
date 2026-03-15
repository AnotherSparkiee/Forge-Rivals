
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
 * Generates a round-robin schedule for 8 teams.
 * Returns an array of pairings for each day.
 */
export function getSchedule(teams: any[], day: number) {
  if (day < 1 || day > SEASON_DURATION_DAYS) return null;

  // Day 1-7: First round. Day 8-14: Second round (reversed home/away)
  const isSecondRound = day > 7;
  const matchDay = isSecondRound ? day - 7 : day;

  // Circle method for round robin
  const teamsCopy = [...teams];
  const n = teamsCopy.length;
  const rounds = n - 1;
  const half = n / 2;

  const schedule = [];
  for (let r = 0; r < rounds; r++) {
    const roundMatches = [];
    for (let i = 0; i < half; i++) {
      const home = teamsCopy[i];
      const away = teamsCopy[n - 1 - i];
      roundMatches.push({ home, away });
    }
    schedule.push(roundMatches);
    // Rotate teams except the first one
    teamsCopy.splice(1, 0, teamsCopy.pop());
  }

  const currentDayMatches = schedule[matchDay - 1];
  
  if (isSecondRound) {
    // Reverse home/away for second round
    return currentDayMatches.map(m => ({ home: m.away, away: m.home }));
  }
  return currentDayMatches;
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
  currentDay: number = 1
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
      wins: 0,
      draws: 0,
      losses: 0,
      points: 0,
      isPlayer: true 
    });
  }

  // To make standings deterministic but progressing, we simulate results up to (currentDay - 1)
  // Each day has results based on team strength (derived from ID)
  for (let day = 1; day < currentDay; day++) {
    const matches = getSchedule(teams, day);
    if (!matches) continue;

    matches.forEach(m => {
      // Deterministic outcome based on IDs
      const hId = parseInt(m.home.id.replace('bot_', '').replace('player_team', '99999'));
      const aId = parseInt(m.away.id.replace('bot_', '').replace('player_team', '99999'));
      
      const combined = hId + aId + day;
      const resultValue = combined % 10;

      if (resultValue < 4) { // Home win 2-0
        m.home.wins++;
        m.home.points += 3;
        m.away.losses++;
      } else if (resultValue < 7) { // Draw 1-1
        m.home.draws++;
        m.home.points += 1;
        m.away.draws++;
        m.away.points += 1;
      } else { // Away win 0-2
        m.away.wins++;
        m.away.points += 3;
        m.home.losses++;
      }
    });
  }

  return teams.sort((a, b) => b.points - a.points || (b.wins - a.wins));
}
