/**
 * @fileOverview Ядро лиг: детерминированное расписание, уникальные боты и круговая система.
 */

export interface LeagueOption {
  id: string;
  startTime: string;
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
 * Генерирует стабильный список из 8 команд.
 * Формула ID бота: bot[Лига(2)][Див(1)][Гр(3)][Индекс(1)]
 */
export function getStableGroupTeams(level: number, group: number, leagueId: string, allLeaguePlayers: any[] = []) {
  const leagueIdx = LEAGUES.findIndex(l => l.id === leagueId);
  const leagueNum = (leagueIdx + 1).toString().padStart(2, '0');
  const groupNum = group.toString().padStart(3, '0');

  const groupPlayers = allLeaguePlayers.filter(p => 
    p.selectedLeagueId === leagueId && 
    Number(p.leagueLevel) === level && 
    Number(p.groupId) === group
  ).map(p => ({
    id: p.id,
    name: p.displayName || "Unknown Commander",
    isBot: false
  }));

  const teams = [...groupPlayers];
  const botsNeeded = Math.max(0, TEAMS_PER_GROUP - teams.length);
  
  for (let i = 0; i < botsNeeded; i++) {
    const botId = `bot${leagueNum}${level}${groupNum}${i + 1}`;
    teams.push({ id: botId, name: botId, isBot: true });
  }

  // Сортировка для стабильности индексов в алгоритме круговой системы
  return teams.sort((a, b) => a.id.localeCompare(b.id));
}

/**
 * Алгоритм круговой системы (Round-robin) для 8 команд.
 * Генерирует пары на 14 дней (2 круга).
 */
export function generateSeasonCalendar(teams: any[]) {
  const n = teams.length;
  const roundsPerHalf = n - 1; // 7 дней в одном круге
  const matches = [];

  // Создаем массив индексов [0, 1, 2, 3, 4, 5, 6, 7]
  const indices = Array.from({ length: n }, (_, i) => i);

  for (let round = 0; round < roundsPerHalf; round++) {
    for (let i = 0; i < n / 2; i++) {
      const homeIdx = indices[i];
      const awayIdx = indices[n - 1 - i];

      // Первый круг (Дни 1-7)
      matches.push({
        day: round + 1,
        homeId: teams[homeIdx].id,
        homeName: teams[homeIdx].name,
        awayId: teams[awayIdx].id,
        awayName: teams[awayIdx].name
      });

      // Второй круг (Дни 8-14) - зеркальные матчи
      matches.push({
        day: round + 1 + roundsPerHalf,
        homeId: teams[awayIdx].id,
        homeName: teams[awayIdx].name,
        awayId: teams[homeIdx].id,
        awayName: teams[homeIdx].name
      });
    }

    // Вращение индексов (кроме первого элемента)
    const pivot = indices[0];
    const rest = indices.slice(1);
    const last = rest.pop()!;
    indices.splice(0, n, pivot, last, ...rest);
  }

  return matches;
}

/**
 * Детерминированный результат матча Bo2.
 */
export function getMatchResult(homeId: string, awayId: string, day: number, season: number): [number, number] {
  const seedStr = `${homeId}_${awayId}_s${season}_d${day}`;
  let hash = 0;
  for (let i = 0; i < seedStr.length; i++) {
    hash = ((hash << 5) - hash) + seedStr.charCodeAt(i);
    hash |= 0;
  }
  const val = Math.abs(hash) % 100;
  
  if (val < 35) return [2, 0];
  if (val < 65) return [1, 1];
  return [0, 2];
}
