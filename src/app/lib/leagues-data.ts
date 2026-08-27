/**
 * @fileOverview Ядро лиг v70: Детерминированные ID ботов и формат имен Bot01.
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
  { id: 'ALPHA', startTime: '18:00', description: 'Main Operational League.' },
];

/**
 * Генерирует детерминированный ID бота для слота (скрытый технический ID).
 */
export function getBotId(leagueId: string, level: number, group: number, rank: number): string {
  return `BOT_${leagueId}_L${level}_G${group}_R${rank}`;
}

/**
 * Генерирует публичное имя для бота.
 * Формат: Bot01{Level}{Rank} (согласно запросу пользователя)
 * Пример: Bot0117
 */
export function getBotName(level: number, group: number, rank: number): string {
  const leagueIdx = "01";
  return `Bot${leagueIdx}${level}${rank}`;
}

export function getGroupsCountInLevel(level: number): number {
  return Math.pow(2, level - 1);
}

export function getPromotionTarget(level: number, group: number): { level: number, group: number } {
  if (level <= 1) return { level, group }; 
  return {
    level: level - 1,
    group: Math.ceil(group / 2)
  };
}

export function getRelegationTarget(level: number, group: number, rank: number): { level: number, group: number } {
  if (level >= MAX_LEVELS) return { level, group }; 
  return {
    level: level + 1,
    group: rank === 7 ? (group * 2 - 1) : (group * 2)
  };
}

/**
 * Генерирует детерминированный календарь (Circle Method).
 */
export function generateSeasonCalendar(teams: any[], seasonNumber: number, leagueId: string) {
  const n = TEAMS_PER_GROUP; 
  const rounds = n - 1; 
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
      const hIdx = pool[i];
      const aIdx = pool[n - 1 - i];

      const home = teams[hIdx];
      const away = teams[aIdx];

      const createMatch = (day: number, h: any, a: any, tour: number) => {
        const startTime = new Date(seasonStartMs + (day - 1) * dayMs + hh * 3600000 + mm * 60000);
        return {
          day,
          tour,
          homeId: h.id,
          homeName: h.name,
          homeRank: Number(h.rank),
          awayId: a.id,
          awayName: a.name,
          awayRank: Number(a.rank),
          startTime: startTime.toISOString(),
          type: 'league'
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

/**
 * ДЕТЕРМИНИРОВАННЫЙ РАСЧЕТ РЕЗУЛЬТАТА.
 */
export function getMatchResult(
  rankA: number, 
  rankB: number, 
  level: number, 
  group: number, 
  season: number, 
  tour: number
): [number, number] {
  const combinedKey = `v11-L${level}-G${group}-S${season}-T${tour}-R${rankA}-vs-R${rankB}`;
  let hash = 0;
  for (let i = 0; i < combinedKey.length; i++) {
    hash = ((hash << 5) - hash) + combinedKey.charCodeAt(i);
    hash |= 0;
  }
  const absHash = Math.abs(hash);
  const rankDiff = rankB - rankA;
  const baseChance = 35 + (rankDiff * 2);
  const roll = absHash % 100;
  if (roll < baseChance) return [2, 0];
  if (roll > (100 - baseChance)) return [0, 2];
  return [1, 1];
}
