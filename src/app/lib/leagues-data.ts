/**
 * @fileOverview Ядро лиг v62: Ультимативный генератор календаря в стиле FMO.
 * Реализует алгоритм Berger (Circle Method) для честной круговой системы.
 */

import { GLOBAL_EPOCH_ISO } from './time-utils';

export interface LeagueOption {
  id: string;
  startTime: string; // Формат "HH:mm" в MSK
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
 * Генерирует стабильный состав группы. 
 * Реальные игроки занимают свои Rank (1-8), остальные — боты.
 */
export function getStableGroupTeams(level: number, group: number, leagueId: string, realPlayersInGroup: any[] = []) {
  const leagueIdx = (LEAGUES.findIndex(l => l.id === leagueId) + 1).toString().padStart(2, '0');
  const groupPrefix = group.toString().padStart(3, '0');
  const teams = new Array(TEAMS_PER_GROUP).fill(null);

  realPlayersInGroup.forEach(p => {
    const slot = Math.min(8, Math.max(1, p.rank || 1));
    teams[slot - 1] = {
      id: p.id,
      name: p.displayName || `Manager_${p.id.slice(0, 4)}`,
      isBot: false,
      rank: slot
    };
  });

  for (let i = 0; i < TEAMS_PER_GROUP; i++) {
    if (!teams[i]) {
      const slotNum = i + 1;
      const botId = `BOT${leagueIdx}${level}${groupPrefix}${slotNum}`;
      teams[i] = {
        id: botId,
        name: botId,
        isBot: true,
        rank: slotNum
      };
    }
  }
  return teams;
}

/**
 * Генерация календаря на 14 дней (2 круга) по алгоритму Бергера.
 */
export function generateSeasonCalendar(teams: any[], seasonNumber: number, leagueId: string) {
  const n = teams.length; // 8
  const rounds = n - 1; // 7 rounds in one circle
  const matches = [];
  
  const league = LEAGUES.find(l => l.id === leagueId) || LEAGUES[0];
  const [hh, mm] = league.startTime.split(':').map(Number);
  
  const epochUtc = new Date(GLOBAL_EPOCH_ISO);
  const seasonStartMs = epochUtc.getTime() + (seasonNumber - 1) * 15 * 24 * 60 * 60 * 1000;

  // Berger Table Algorithm (Circle Method)
  const pool = Array.from({ length: n }, (_, i) => i);

  for (let round = 0; round < rounds; round++) {
    for (let i = 0; i < n / 2; i++) {
      const homeIdx = pool[i];
      const awayIdx = pool[n - 1 - i];

      const createMatch = (day: number, h: any, a: any, tour: number) => {
        const startTime = new Date(seasonStartMs + (day - 1) * 24 * 60 * 60 * 1000 + hh * 60 * 60 * 1000 + mm * 60 * 1000);
        return {
          day,
          tour,
          homeId: h.id,
          homeName: h.name,
          awayId: a.id,
          awayName: a.name,
          startTime: startTime.toISOString(),
          pairKey: [h.id, a.id].sort().join('_vs_')
        };
      };

      // 1st leg (Days 1-7)
      const h = teams[homeIdx];
      const a = teams[awayIdx];
      matches.push(createMatch(round + 1, h, a, round + 1));

      // 2nd leg (Days 8-14)
      matches.push(createMatch(round + 8, a, h, round + 8));
    }
    
    // Rotate pool
    const last = pool.pop()!;
    pool.splice(1, 0, last);
  }

  return matches.sort((a, b) => a.day - b.day);
}

/**
 * Deterministically generates a match result based on input parameters.
 * Used for auto-resolving bot matches and pre-calculating series outcomes.
 */
export function getMatchResult(idA: string, idB: string, seed1: any, seed2: any): [number, number] {
  const combinedKey = `${idA}-${idB}-${seed1}-${seed2}`;
  
  // Simple deterministic hash
  let hash = 0;
  for (let i = 0; i < combinedKey.length; i++) {
    hash = ((hash << 5) - hash) + combinedKey.charCodeAt(i);
    hash |= 0;
  }
  
  const absHash = Math.abs(hash);
  const rawScoreA = absHash % 3;
  const rawScoreB = (absHash >> 2) % 3;
  
  // Logic for League/Basket (seed2 is false or a specific flag)
  // League matches are Bo2, results can be 2-0, 0-2, or 1-1.
  if (typeof seed2 === 'boolean' && seed2 === false) {
    if (rawScoreA === rawScoreB) return [1, 1];
    return rawScoreA > rawScoreB ? [2, 0] : [0, 2];
  }
  
  // Logic for Cup (seed2 is season number, implying no draws allowed in bracket)
  if (rawScoreA === rawScoreB) {
    return [rawScoreA + 1, rawScoreB]; // Ensure a winner for the bracket
  }
  
  return [rawScoreA, rawScoreB];
}
