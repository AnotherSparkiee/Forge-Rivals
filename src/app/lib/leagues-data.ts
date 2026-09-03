/**
 * @fileOverview Ядро лиг v76: Immutable Schedule.
 */

import { GLOBAL_EPOCH_ISO } from './time-utils';

export interface LeagueOption {
  id: string;
  startTime: string; // "HH:mm" in MSK
  description: string;
}

export const MAX_LEVELS = 9;
export const TEAMS_PER_GROUP = 8;
export const TOTAL_GROUPS = 511; 
export const SEASON_DURATION_DAYS = 14;

export const LEAGUES: LeagueOption[] = [
  { id: 'ALPHA', startTime: '18:00', description: 'Main Operational League.' },
];

export function getTableId(season: number, leagueId: string, level: number, group: number): string {
  return `table_v140_S${season}_L${leagueId}_V${level}_G${group}`;
}

export function getBotId(leagueId: string, level: number, group: number, rank: number): string {
  return `BOT_${leagueId}_L${level}_G${group}_R${rank}`;
}

export function getBotName(level: number, group: number, rank: number): string {
  const leagueIdx = "01";
  const gStr = String(group).padStart(3, '0');
  const rStr = String(rank).padStart(2, '0');
  return `Bot${leagueIdx}${level}${gStr}${rStr}`;
}

export function getGroupsCountInLevel(level: number): number {
  return Math.pow(2, level - 1);
}

export function generateSeasonCalendar(teams: any[], seasonNumber: number, leagueId: string) {
  const n = TEAMS_PER_GROUP; 
  const rounds = n - 1; 
  const matches = [];
  
  const league = LEAGUES.find(l => l.id === leagueId) || LEAGUES[0];
  const [hh, mm] = league.startTime.split(':').map(Number);
  
  const epochUtc = new Date(GLOBAL_EPOCH_ISO);
  const cycleDuration = 17; 
  const dayMs = 24 * 60 * 60 * 1000;
  const seasonStartMs = epochUtc.getTime() + (seasonNumber - 1) * cycleDuration * dayMs;

  const pool = Array.from({ length: n }, (_, i) => i);

  for (let round = 0; round < rounds; round++) {
    for (let i = 0; i < n / 2; i++) {
      const hIdx = pool[i];
      const aIdx = pool[n - 1 - i];

      const home = teams[hIdx];
      const away = teams[aIdx];

      const createMatch = (day: number, h: any, a: any, tour: number) => {
        // Конвертация MSK (UTC+3) в UTC: вычитаем 3 часа
        const startTime = new Date(seasonStartMs + (day - 1) * dayMs + (hh - 3) * 3600000 + mm * 60000);
        const mId = `match_v140_S${seasonNumber}_L${leagueId}_T${tour}_H${h.rank}_A${a.rank}`;
        
        // Генерация детерминированного сида на основе ID матча
        let seed = 0;
        for (let j = 0; j < mId.length; j++) {
          seed = ((seed << 5) - seed) + mId.charCodeAt(j);
          seed |= 0;
        }

        return {
          day,
          tour,
          season: seasonNumber,
          homeId: h.id,
          homeName: h.name,
          homeRank: Number(h.rank),
          awayId: a.id,
          awayName: a.name,
          awayRank: Number(a.rank),
          startTime: startTime.toISOString(),
          type: 'league',
          resultSeed: Math.abs(seed) % 1000
        };
      };

      matches.push(createMatch(round + 1, home, away, round + 1));
      matches.push(createMatch(round + 8, away, home, round + 8));
    }
    const last = pool.pop()!;
    pool.splice(1, 0, last);
  }

  return matches.sort((a, b) => a.tour - b.tour);
}

export function getMatchResult(
  rankA: number, 
  rankB: number, 
  level: number, 
  group: number, 
  season: number, 
  tour: number,
  resultSeed: number = 0
): [number, number] {
  const combinedKey = `v140-L${level}-G${group}-S${season}-T${tour}-R${rankA}-vs-R${rankB}`;
  let hash = 0;
  for (let i = 0; i < combinedKey.length; i++) {
    hash = ((hash << 5) - hash) + combinedKey.charCodeAt(i);
    hash |= 0;
  }
  
  // Используем переданный resultSeed вместо случайности
  const absHash = Math.abs(hash + resultSeed);
  
  const rankDiff = rankB - rankA;
  const baseChance = 35 + (rankDiff * 2);
  const roll = absHash % 100;
  
  if (roll < baseChance) return [2, 0];
  if (roll > (100 - (baseChance / 2))) return [0, 2];
  return [1, 1];
}