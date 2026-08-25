/**
 * @fileOverview Ядро лиг v59: Консолидированная лига и логика замещения ботов.
 * Реализует систему, где реальные игроки занимают фиксированные слоты в группах.
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
 * Возвращает количество групп в конкретном дивизионе.
 */
export function getGroupsCountInLevel(level: number): number {
  return Math.pow(2, level - 1);
}

/**
 * Рассчитывает целевую группу при повышении (1 место).
 */
export function getPromotionTarget(level: number, group: number): { level: number, group: number } {
  if (level <= 1) return { level, group }; 
  return {
    level: level - 1,
    group: Math.ceil(group / 2)
  };
}

/**
 * Рассчитывает целевую группу при понижении (7-8 место).
 */
export function getRelegationTarget(level: number, group: number, rank: number): { level: number, group: number } {
  if (level >= MAX_LEVELS) return { level, group }; 
  return {
    level: level + 1,
    group: rank === 7 ? (group * 2 - 1) : (group * 2)
  };
}

/**
 * Генерирует стабильный состав группы, заменяя ботов реальными игроками из БД.
 * @param level Дивизион
 * @param group Номер группы
 * @param leagueId ID лиги
 * @param realPlayersInGroup Список игроков из Firestore, привязанных к этой группе
 */
export function getStableGroupTeams(level: number, group: number, leagueId: string, realPlayersInGroup: any[] = []) {
  const leagueIdx = "01"; 
  const groupPrefix = group.toString().padStart(3, '0');
  
  // Создаем 8 пустых слотов для группы
  const teams = new Array(TEAMS_PER_GROUP).fill(null);

  // 1. Сначала расставляем реальных игроков из "Базы Лиги" согласно их забронированному рангу
  realPlayersInGroup.forEach(p => {
    const slot = Math.min(8, Math.max(1, Number(p.rank || 1)));
    // Если слот свободен, записываем туда реального игрока
    if (!teams[slot - 1]) {
      teams[slot - 1] = {
        id: p.id,
        name: p.clubName || p.displayName || `Manager_${p.id.slice(0, 4)}`,
        logo: p.clubLogo || p.logo || null,
        isBot: false,
        rank: slot,
        isMe: p.isMe || false // Флаг для подсветки локального игрока
      };
    }
  });

  // 2. Все оставшиеся пустые слоты заполняем детерминированными ботами
  for (let i = 0; i < TEAMS_PER_GROUP; i++) {
    if (!teams[i]) {
      const slotNum = i + 1;
      const botId = `BOT${leagueIdx}${level}${groupPrefix}${slotNum}`;
      teams[i] = {
        id: botId,
        name: botId,
        isBot: true,
        rank: slotNum,
        logo: null
      };
    }
  }
  
  return teams;
}

/**
 * Генерация календаря на 14 дней по алгоритму Бергера.
 */
export function generateSeasonCalendar(teams: any[], seasonNumber: number, leagueId: string) {
  const n = teams.length; // 8
  const rounds = n - 1; // 7 раундов в круге
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

      const createMatch = (day: number, home: any, away: any, tour: number) => {
        const startTime = new Date(seasonStartMs + (day - 1) * dayMs + hh * 60 * 60 * 1000 + mm * 60 * 1000);
        return {
          id: `match_s${seasonNumber}_l${leagueId}_d${day}_h${home.id}_a${away.id}`,
          day,
          tour,
          homeId: home.id,
          homeName: home.name,
          homeLogo: home.logo || null,
          awayId: away.id,
          awayName: away.name,
          awayLogo: away.logo || null,
          startTime: startTime.toISOString(),
          type: 'league',
          isFinished: false,
          scoreA: 0,
          scoreB: 0,
          seen: false
        };
      };

      // Первый круг (дома-выезд) - туры 1-7
      matches.push(createMatch(round + 1, teams[hIdx], teams[aIdx], round + 1));
      // Второй круг (выезд-дома) - туры 8-14
      matches.push(createMatch(round + 8, teams[aIdx], teams[hIdx], round + 8));
    }
    
    // Вращение по алгоритму Бергера
    const last = pool.pop()!;
    pool.splice(1, 0, last);
  }

  return matches.sort((a, b) => a.day - b.day);
}

/**
 * Детерминированный расчет результата (Bo2).
 */
export function getMatchResult(idA: string, idB: string, season: number, tour: number): [number, number] {
  const combinedKey = `${idA}-${idB}-${season}-${tour}`;
  
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
