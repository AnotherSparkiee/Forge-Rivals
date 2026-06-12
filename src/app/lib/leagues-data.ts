
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
 * Deterministic ID for a match to prevent duplicates during generation.
 */
export function generateDeterministicMatchId(
  leagueId: string,
  level: number,
  groupId: number,
  season: number,
  day: number,
  index: number
): string {
  return `match_${leagueId}_L${level}_G${groupId}_S${season}_D${day}_I${index}`;
}

/**
 * Deterministic match result based on team IDs and day.
 */
export function getMatchResult(homeId: string, awayId: string, day: number, isBo3: boolean = false): [number, number] {
  const hId = homeId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const aId = awayId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const seed = (hId * 13) + (aId * 37) + (day * 7);
  const val = seed % 100;
  
  if (isBo3) {
    if (val < 30) return [2, 0]; 
    if (val < 50) return [2, 1]; 
    if (val < 70) return [1, 2]; 
    return [0, 2];
  } else {
    if (val < 40) return [2, 0]; 
    if (val < 70) return [1, 1]; 
    return [0, 2]; 
  }
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

/**
 * Builds the group standings table by simulating all matches up to a specific day.
 */
export function getMockGroupTeams(
  playerRank: number, 
  playerName: string = "Player Team",
  level: number = 9,
  division: number = 1,
  group: number = 1,
  leagueId: string = "ALPHA",
  realPlayers: any[] = [],
  currentPlayerId?: string,
  upToDay: number = 0 
) {
  const teams: any[] = [];
  const sortedRealPlayers = [...(realPlayers || [])].sort((a, b) => (a.id || '').localeCompare(b.id || ''));
  
  sortedRealPlayers.forEach(p => {
    const isMe = p.id === currentPlayerId;
    const hasValidName = p.displayName && p.displayName.trim().length >= 2 && p.displayName !== "Manager";

    if (hasValidName || isMe) {
      teams.push({
        id: p.id,
        name: isMe ? (playerName || p.displayName || "My Team") : p.displayName,
        wins: 0, draws: 0, losses: 0, points: 0,
        isPlayer: true, isMe: isMe
      });
    }
  });

  const botsNeeded = Math.max(0, TEAMS_PER_GROUP - teams.length);
  for (let i = 0; i < botsNeeded; i++) {
    const botIdNum = (Number(level) * 1000) + (Number(group) * 10) + i + 1000;
    teams.push({
      id: `bot_${botIdNum}`,
      name: `Elite Bot ${botIdNum}`,
      wins: 0, draws: 0, losses: 0, points: 0,
      isPlayer: false, isMe: false
    });
  }

  const finalTeams = teams.slice(0, TEAMS_PER_GROUP);
  finalTeams.sort((a, b) => a.id.localeCompare(b.id));

  if (upToDay > 0) {
    const seasonSchedule = getSchedule(finalTeams);
    const limit = Math.min(upToDay, SEASON_DURATION_DAYS);
    for (let d = 1; d <= limit; d++) {
      const matches = seasonSchedule[d - 1];
      if (!matches) continue;
      matches.forEach((m: any) => {
        const home = finalTeams.find(t => t.id === m.home.id);
        const away = finalTeams.find(t => t.id === m.away.id);
        if (!home || !away) return;
        const [hScore, aScore] = getMatchResult(home.id, away.id, d, false);
        applyResult(home, away, hScore, aScore);
      });
    }
  }

  return finalTeams.sort((a, b) => b.points - a.points || b.wins - a.wins || a.id.localeCompare(b.id));
}

export function applyResult(home: any, away: any, hScore: number, aScore: number) {
  if (hScore > aScore) {
    home.wins++; home.points += 3; away.losses++;
  } else if (hScore === aScore) {
    home.draws++; home.points += 1; away.draws++; away.points += 1;
  } else if (aScore > hScore) {
    away.wins++; away.points += 3; home.losses++;
  }
}
