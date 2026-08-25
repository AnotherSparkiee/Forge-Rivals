/**
 * @fileOverview Ядро лиг v64: Абсолютный детерминизм и слот-ориентированная архитектура.
 * Обеспечивает единство календаря для всех участников группы.
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
 * Генерирует состав группы на основе слотов (1-8).
 */
export function getStableGroupTeams(level: number, group: number, leagueId: string, realPlayersInGroup: any[] = []) {
  const leagueIdx = "01"; 
  const groupPrefix = group.toString().padStart(3, '0');
  
  const teams = new Array(TEAMS_PER_GROUP).fill(null);

  // Сначала расставляем реальных игроков по их рангам
  realPlayersInGroup.forEach(p => {
    const slot = Math.min(8, Math.max(1, Number(p.rank || 1)));
    if (!teams[slot - 1]) {
      teams[slot - 1] = {
        id: p.id,
        name: p.clubName || p.displayName || `Manager_${p.id.slice(0, 4)}`,
        logo: p.clubLogo || p.logo || null,
        isBot: false,
        rank: Number(slot),
        isMe: false 
      };
    }
  });

  // Заполняем пустоты ботами
  for (let i = 0; i < TEAMS_PER_GROUP; i++) {
    if (!teams[i]) {
      const slotNum = i + 1;
      const botId = `BOT${leagueIdx}${level}${groupPrefix}${slotNum}`;
      teams[i] = {
        id: botId,
        name: botId,
        isBot: true,
        rank: Number(slotNum),
        logo: null
      };
    }
  }
  
  return teams;
}

/**
 * Генерирует детерминированный календарь. 
 * Использует Circle Method для round-robin.
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

  // Пул индексов для круговой системы
  const pool = Array.from({ length: n }, (_, i) => i);

  for (let round = 0; round < rounds; round++) {
    for (let i = 0; i < n / 2; i++) {
      const hIdx = pool[i];
      const aIdx = pool[n - 1 - i];

      const home = teams[hIdx];
      const away = teams[aIdx];

      const createMatch = (day: number, h: any, a: any, tour: number) => {
        const startTime = new Date(seasonStartMs + (day - 1) * dayMs + hh * 60 * 60 * 1000 + mm * 60 * 1000);
        return {
          id: `v11_s${seasonNumber}_l${leagueId}_lv${h.level || 0}_g${h.group || 0}_t${tour}_hR${h.rank}_aR${a.rank}`,
          day,
          tour,
          homeId: h.id,
          homeName: h.name,
          homeRank: Number(h.rank),
          homeLogo: h.logo || null,
          awayId: a.id,
          awayName: a.name,
          awayRank: Number(a.rank),
          awayLogo: a.logo || null,
          startTime: startTime.toISOString(),
          type: 'league',
          isFinished: false,
          scoreA: 0,
          scoreB: 0
        };
      };

      // Турнирная сетка: 1-7 туры (круг 1), 8-14 туры (круг 2)
      matches.push(createMatch(round + 1, home, away, round + 1));
      matches.push(createMatch(round + 8, away, home, round + 8));
    }
    
    // Сдвиг пула (кроме первого элемента)
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
  tour: number
): [number, number] {
  const combinedKey = `v11-L${level}-G${group}-S${season}-T${tour}-R${rankA}-vs-R${rankB}`;
  
  let hash = 0;
  for (let i = 0; i < combinedKey.length; i++) {
    hash = ((hash << 5) - hash) + combinedKey.charCodeAt(i);
    hash |= 0;
  }
  
  const absHash = Math.abs(hash);
  const roll = absHash % 100;
  
  if (roll < 35) return [2, 0];
  if (roll < 70) return [0, 2];
  return [1, 1];
}
