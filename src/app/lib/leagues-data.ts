
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
 * Deterministic result generator for Bo2 Format.
 * Strictly returns [2, 0], [1, 1], or [0, 2].
 */
export function getMatchResult(homeId: string, awayId: string, day: number, isBo3: boolean = false): [number, number] {
  const combinedId = (homeId || "") + (awayId || "");
  let hash = 0;
  for (let i = 0; i < combinedId.length; i++) {
    hash = ((hash << 5) - hash) + combinedId.charCodeAt(i);
    hash |= 0;
  }
  const seed = Math.abs(hash + day * 37); // Specific salt for day
  const val = seed % 100;
  
  if (isBo3) {
    if (val < 30) return [2, 0]; 
    if (val < 50) return [2, 1]; 
    if (val < 70) return [1, 2]; 
    return [0, 2];
  } else {
    // STRICT Bo2 Logic: No 1:0 or 0:1
    if (val < 35) return [2, 0]; // 35% Win
    if (val < 65) return [1, 1]; // 30% Draw
    return [0, 2];               // 35% Loss
  }
}

export function getSchedule(teams: any[]) {
  const n = teams.length;
  if (n !== 8) return []; 
  
  const rounds = n - 1; 
  const half = n / 2;

  const teamsCopy = [...teams];
  const circleMatches = [];

  for (let r = 0; r < rounds; r++) {
    const roundMatches = [];
    for (let i = 0; i < half; i++) {
      const home = teamsCopy[i];
      const away = teamsCopy[n - 1 - i];
      if (r % 2 === 0) {
        roundMatches.push({ home, away });
      } else {
        roundMatches.push({ home: away, away: home });
      }
    }
    circleMatches.push(roundMatches);
    const last = teamsCopy.pop();
    if (last) teamsCopy.splice(1, 0, last);
  }

  const seasonSchedule = [];
  for (let d = 1; d <= 14; d++) {
    const matchDayIdx = (d - 1) % rounds;
    const isSecondCircle = d > rounds;
    const dayMatches = circleMatches[matchDayIdx];
    if (isSecondCircle) {
      seasonSchedule.push(dayMatches.map(m => ({ home: m.away, away: m.home })));
    } else {
      seasonSchedule.push(dayMatches);
    }
  }
  return seasonSchedule;
}

/**
 * Rebuilt standings logic.
 * Exclusively driven by actual database results.
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
  upToDay: number = 0,
  dbMatches: any[] = []
) {
  const teams: any[] = [];
  
  // 1. Initialize participants
  const sortedRealPlayers = [...(realPlayers || [])].sort((a, b) => (a.id || '').localeCompare(b.id || ''));
  sortedRealPlayers.forEach(p => {
    teams.push({
      id: p.id,
      name: p.displayName || "Unknown Manager",
      wins: 0, draws: 0, losses: 0, points: 0,
      isPlayer: true, isMe: p.id === currentPlayerId
    });
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

  // 2. Aggregate actual results from Firestore
  if (dbMatches && dbMatches.length > 0) {
    dbMatches.forEach(m => {
      if (m.status === 'finished') {
        const home = finalTeams.find(t => t.id === m.homeId);
        const away = finalTeams.find(t => t.id === m.awayId);
        if (home && away) {
          applyResult(home, away, m.scoreA, m.scoreB);
        }
      }
    });
  }

  // 3. Sort by Points -> Wins -> ID (alphabetical fallback)
  return finalTeams.sort((a, b) => 
    b.points - a.points || 
    b.wins - a.wins || 
    a.id.localeCompare(b.id)
  );
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
  } else if (aScore > hScore) {
    away.wins++; 
    away.points += 3; 
    home.losses++;
  }
}
