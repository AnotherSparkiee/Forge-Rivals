
/**
 * @fileOverview Ядро данных лиг v150.
 * Централизованные константы и правила распределения.
 */

export const MAX_LEVELS = 4;
export const TEAMS_PER_GROUP = 8;
export const TOTAL_GROUPS = 15; // 1 + 2 + 4 + 8
export const SEASON_DURATION_DAYS = 14;
export const OFFSEASON_DURATION_DAYS = 3;
export const TOTAL_CYCLE_DAYS = SEASON_DURATION_DAYS + OFFSEASON_DURATION_DAYS;

export const PROMOTION_SLOTS = 2; 
export const RELEGATION_SLOTS = 2; 

export const LEAGUES = [
  { id: 'ALPHA', startTime: '18:00', description: 'Main League' }
];

export function getGroupsCountInLevel(level: number): number {
  return Math.pow(2, level - 1);
}

export function getTableId(season: number, leagueId: string, level: number, group: number): string {
  return `table_v140_S${season}_L${leagueId}_V${level}_G${group}`;
}

export function getBotId(leagueId: string, level: number, group: number, rank: number): string {
  return `BOT_${leagueId}_L${level}_G${group}_R${rank}`;
}

export function getBotName(level: number, group: number, rank: number): string {
  const gStr = String(group).padStart(3, '0');
  const rStr = String(rank).padStart(2, '0');
  return `Bot01${level}${gStr}${rStr}`;
}

/**
 * Генерирует детерминированный календарь матчей (Round Robin).
 * Все матчи привязаны к UTC времени (18:00 MSK = 15:00 UTC).
 */
export function generateSeasonCalendar(teams: any[], seasonNumber: number, leagueId: string) {
  const n = TEAMS_PER_GROUP;
  const matches = [];
  
  // Базовая дата - будет установлена оркестратором при активации сезона
  // Здесь мы генерируем структуру, которую оркестратор наполнит реальными датами
  const pool = Array.from({ length: n }, (_, i) => i);
  
  for (let round = 0; round < n - 1; round++) {
    for (let i = 0; i < n / 2; i++) {
      const hIdx = pool[i];
      const aIdx = pool[n - 1 - i];
      const home = teams[hIdx];
      const away = teams[aIdx];

      // Первый круг (туры 1-7)
      matches.push({
        day: round + 1,
        tour: round + 1,
        season: seasonNumber,
        leagueId,
        homeId: home.id,
        homeName: home.name,
        homeRank: Number(home.rank),
        awayId: away.id,
        awayName: away.name,
        awayRank: Number(away.rank),
        type: 'league',
        version: 140
      });

      // Второй круг (туры 8-14, смена сторон)
      matches.push({
        day: round + 8,
        tour: round + 8,
        season: seasonNumber,
        leagueId,
        homeId: away.id,
        homeName: away.name,
        homeRank: Number(away.rank),
        awayId: home.id,
        awayName: home.name,
        awayRank: Number(home.rank),
        type: 'league',
        version: 140
      });
    }
    const last = pool.pop()!;
    pool.splice(1, 0, last);
  }
  return matches;
}
