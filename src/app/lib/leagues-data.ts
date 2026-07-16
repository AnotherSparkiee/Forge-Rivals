/**
 * @fileOverview Ядро лиг v50: Канонический генератор FMO.
 */

import { GLOBAL_EPOCH_ISO } from './time-utils';

export interface LeagueOption {
  id: string;
  startTime: string; // "HH:mm" in MSK
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

  // Сначала размещаем всех известных реальных игроков на их позиции
  realPlayersInGroup.forEach(p => {
    const slot = Math.min(8, Math.max(1, Number(p.rank || 1)));
    teams[slot - 1] = {
      id: p.id,
      name: p.name || p.displayName || `Manager_${p.id.slice(0, 4)}`,
      logo: p.logo || null,
      isBot: false,
      rank: slot
    };
  });

  // Заполняем пустоты уникальными ботами
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
  const rounds = n - 1; // 7 раундов в одном круге
  const matches = [];
  
  const league = LEAGUES.find(l => l.id === leagueId) || LEAGUES[0];
  const [hh, mm] = league.startTime.split(':').map(Number);
  
  const epochUtc = new Date(GLOBAL_EPOCH_ISO);
  const cycleDuration = 15; 
  const dayMs = 24 * 60 * 60 * 1000;
  const seasonStartMs = epochUtc.getTime() + (seasonNumber - 1) * cycleDuration * dayMs;

  const pool = Array.from({ length: n }, (_, i) => i);

  for (let round = 0; round < rounds; round++) {
    for (let i = 0; i < n / 2; i++) {
      const homeIdx = pool[i];
      const awayIdx = pool[n - 1 - i];

      const createMatch = (day: number, hIdx: number, aIdx: number, tour: number) => {
        const h = teams[hIdx];
        const a = teams[aIdx];
        const startTime = new Date(seasonStartMs + (day - 1) * dayMs + hh * 60 * 60 * 1000 + mm * 60 * 1000);
        return {
          day,
          tour,
          homeId: h.id,
          homeName: h.name,
          homeLogo: h.logo || null,
          awayId: a.id,
          awayName: a.name,
          awayLogo: a.logo || null,
          startTime: startTime.toISOString(),
          pairKey: [h.id, a.id].sort().join('_vs_')
        };
      };

      // Round 1 (Days 1-7)
      matches.push(createMatch(round + 1, homeIdx, awayIdx, round + 1));
      // Round 2 (Days 8-14)
      matches.push(createMatch(round + 8, awayIdx, homeIdx, round + 8));
    }
    
    // Berger rotation
    const last = pool.pop()!;
    pool.splice(1, 0, last);
  }

  return matches.sort((a, b) => a.day - b.day);
}

/**
 * Deterministically generates a match result based on input parameters.
 */
export function getMatchResult(idA: string, idB: string, seed1: any, seed2: any): [number, number] {
  const combinedKey = `${idA}-${idB}-${seed1}-${seed2}`;
  
  let hash = 0;
  for (let i = 0; i < combinedKey.length; i++) {
    hash = ((hash << 5) - hash) + combinedKey.charCodeAt(i);
    hash |= 0;
  }
  
  const absHash = Math.abs(hash);
  const rawScoreA = absHash % 3;
  const rawScoreB = (absHash >> 2) % 3;
  
  // Bo2 Logic for League (seed2 is false/drawAllowed)
  if (seed2 === false) {
    if (rawScoreA === rawScoreB) return [1, 1];
    return rawScoreA > rawScoreB ? [2, 0] : [0, 2];
  }
  
  // Bracket Logic for Cup (no draws)
  if (rawScoreA === rawScoreB) return [rawScoreA + 1, rawScoreB];
  return [rawScoreA, rawScoreB];
}
