/**
 * @fileOverview Ядро лиг: детерминированное расписание, уникальные боты и круговая система.
 * Внедрены 7-значные уникальные ID для исключения путаницы между лигами.
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
 * Формула ID бота: bot[Лига(2)][Див(1)][Гр(3)][Индекс(1)] - Всего 7 цифр
 * Это гарантирует уникальность во всей игре.
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

  return teams.sort((a, b) => a.id.localeCompare(b.id));
}

/**
 * Алгоритм круговой системы (Round-robin) с ПРИНУДИТЕЛЬНЫМ чередованием 1-1-1-1.
 * Использует детерминированную инверсию пар для обеспечения ритма Home/Away.
 */
export function generateSeasonCalendar(teams: any[]) {
  const n = teams.length;
  const roundsPerHalf = n - 1; 
  const matches = [];
  const indices = Array.from({ length: n }, (_, i) => i);

  for (let round = 0; round < roundsPerHalf; round++) {
    for (let i = 0; i < n / 2; i++) {
      let hIdx = indices[i];
      let aIdx = indices[n - 1 - i];

      // ПРИНУДИТЕЛЬНОЕ ЧЕРЕДОВАНИЕ (V3)
      // Для каждой пары (i) мы инвертируем Home/Away в зависимости от раунда.
      if ((i + round) % 2 === 1) {
        [hIdx, aIdx] = [aIdx, hIdx];
      }

      // Детерминированный ключ пары для уникального ID
      const pairKey = [teams[hIdx].id, teams[aIdx].id].sort().join('_vs_');

      // Первый круг (Дни 1-7)
      matches.push({
        day: round + 1,
        homeId: teams[hIdx].id,
        homeName: teams[hIdx].name,
        awayId: teams[aIdx].id,
        awayName: teams[aIdx].name,
        pairKey
      });

      // Второй круг (Зеркальный своп) (Дни 8-14)
      matches.push({
        day: round + 1 + roundsPerHalf,
        homeId: teams[aIdx].id,
        homeName: teams[aIdx].name,
        awayId: teams[hIdx].id,
        awayName: teams[hIdx].name,
        pairKey
      });
    }
    
    // Вращение по кругу (Berger rotation)
    const last = indices.pop()!;
    indices.splice(1, 0, last);
  }

  return matches;
}

/**
 * Расчет турнирной таблицы группы.
 */
export function getGroupStandings(
  level: number,
  group: number,
  leagueId: string,
  season: number,
  allGroupPlayers: any[],
  allGroupMatches: any[]
) {
  const teams = getStableGroupTeams(level, group, leagueId, allGroupPlayers);
  const standings = teams.map(t => ({
    id: t.id,
    name: t.name,
    wins: 0,
    draws: 0,
    losses: 0,
    points: 0,
    played: 0
  }));

  allGroupMatches.forEach(m => {
    if (m.status === 'finished') {
      const home = standings.find(s => s.id === m.homeId);
      const away = standings.find(s => s.id === m.awayId);
      if (home && away) {
        home.played++;
        away.played++;
        if (m.scoreA > m.scoreB) {
          home.wins++; home.points += 3; away.losses++;
        } else if (m.scoreB > m.scoreA) {
          away.wins++; away.points += 3; home.losses++;
        } else {
          home.draws++; home.points += 1; away.draws++; away.points += 1;
        }
      }
    }
  });

  return standings.sort((a, b) => b.points - a.points || b.wins - a.wins || a.id.localeCompare(b.id));
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
