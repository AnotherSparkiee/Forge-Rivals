/**
 * @fileOverview Ядро лиг v60: Улучшенное вытеснение ботов и стабильная генерация календаря.
 * Гарантирует, что реальный игрок занимает свой зарезервированный Rank в иерархии группы.
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
 * Creates a stable list of 8 teams for a group.
 * Real players displace bots at their specific Rank (1-8).
 */
export function getStableGroupTeams(level: number, group: number, leagueId: string, realPlayersInGroup: any[] = []) {
  const leagueIdx = (LEAGUES.findIndex(l => l.id === leagueId) + 1).toString().padStart(2, '0');
  const groupPrefix = group.toString().padStart(3, '0');

  const teams = new Array(TEAMS_PER_GROUP).fill(null);

  // 1. Place real players by their Rank (1-8)
  realPlayersInGroup.forEach(p => {
    const slot = Math.min(8, Math.max(1, p.rank || 1));
    teams[slot - 1] = {
      id: p.id,
      name: p.displayName || `Manager_${p.id.slice(0, 4)}`,
      isBot: false,
      rank: slot
    };
  });

  // 2. Fill remaining slots with unique bots (UPPERCASE for consistent ID check)
  for (let i = 0; i < TEAMS_PER_GROUP; i++) {
    if (!teams[i]) {
      const slotNum = i + 1;
      // botID format: BOT + LeagueIndex + Tier + GroupPrefix + Slot
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

export function generateSeasonCalendar(teams: any[], seasonNumber: number, leagueId: string) {
  const n = teams.length;
  const roundsPerHalf = n - 1; 
  const matches = [];
  const indices = Array.from({ length: n }, (_, i) => i);
  
  const league = LEAGUES.find(l => l.id === leagueId) || LEAGUES[0];
  const [hh, mm] = league.startTime.split(':').map(Number);
  
  const epochUtc = new Date(GLOBAL_EPOCH_ISO);
  const seasonStartMs = epochUtc.getTime() + (seasonNumber - 1) * 15 * 24 * 60 * 60 * 1000;

  for (let round = 0; round < roundsPerHalf; round++) {
    for (let i = 0; i < n / 2; i++) {
      let hIdx = indices[i];
      let aIdx = indices[n - 1 - i];
      if ((i + round) % 2 === 1) [hIdx, aIdx] = [aIdx, hIdx];
      
      const day1 = round + 1;
      const day2 = round + 1 + roundsPerHalf;

      const createEntry = (day: number, home: any, away: any) => {
        const startTime = new Date(seasonStartMs + (day - 1) * 24 * 60 * 60 * 1000 + hh * 60 * 60 * 1000 + mm * 60 * 1000);
        return {
          day,
          tour: day,
          homeId: home.id,
          homeName: home.name,
          awayId: away.id,
          awayName: away.name,
          startTime: startTime.toISOString(),
          pairKey: [home.id, away.id].sort().join('_vs_')
        };
      };

      matches.push(createEntry(day1, teams[hIdx], teams[aIdx]));
      matches.push(createEntry(day2, teams[aIdx], teams[hIdx]));
    }
    const last = indices.pop()!;
    indices.splice(1, 0, last);
  }
  return matches.sort((a, b) => a.day - b.day);
}

/**
 * Deterministic match result for bots.
 */
export function getMatchResult(homeId: string, awayId: string, day: number, season: number): [number, number] {
  const seedStr = `${homeId}_${awayId}_s${season}_d${day}`;
  let hash = 0;
  for (let i = 0; i < seedStr.length; i++) {
    hash = ((hash << 5) - hash) + seedStr.charCodeAt(i);
    hash |= 0;
  }
  const val = Math.abs(hash) % 100;
  if (val < 45) return [2, 0];
  if (val < 55) return [1, 1];
  return [0, 2];
}
