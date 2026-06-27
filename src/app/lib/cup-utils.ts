import { getMatchResult } from './leagues-data';

export interface CupParticipant {
  id: string;
  name: string;
  isPlayer: boolean;
  level: number;
}

/**
 * Рассчитывает, в каком раунде дивизион вступает в борьбу.
 * Див 9 начинает с Раунда 0 (День 1).
 * Див 1 начинает с Раунда 8 (День 9).
 */
export function getEntryRound(level: number): number {
  return Math.max(0, 9 - level);
}

/**
 * Генерирует стабильный список из 4096 участников кубка для конкретной лиги.
 * Все слоты привязаны к Tier-Group-Slot.
 */
export function getLeagueCupParticipants(leagueId: string, realPlayersInLeague: any[], seasonNumber: number): (CupParticipant | null)[] {
  const TOTAL_SLOTS = 4096;
  const fullList: (CupParticipant | null)[] = Array(TOTAL_SLOTS).fill(null);
  
  // 1. Собираем карту реальных игроков для быстрого поиска
  const playerMap = new Map<string, any>();
  realPlayersInLeague.forEach(p => {
    const key = `${p.leagueLevel}_${p.groupId}_${p.rank || 1}`;
    playerMap.set(key, p);
  });

  const leagueIdx = (['ALPHA', 'BETA', 'GAMMA', 'DELTA', 'EPSILON', 'ZETA', 'ETA', 'THETA', 'IOTA', 'KAPPA', 'LAMBDA', 'MU', 'NU', 'XI', 'OMICRON', 'PI'].indexOf(leagueId) + 1).toString().padStart(2, '0');

  let currentGlobalIndex = 0;
  
  // Проходим по всей иерархии дивизионов (Tier 1..9)
  for (let lvl = 1; lvl <= 9; lvl++) {
    const groupsInDiv = Math.pow(2, lvl - 1);
    for (let g = 1; g <= groupsInDiv; g++) {
      for (let slot = 1; slot <= 8; slot++) {
        const key = `${lvl}_${g}_${slot}`;
        const real = playerMap.get(key);
        
        if (real) {
          fullList[currentGlobalIndex] = {
            id: real.id,
            name: real.displayName || "Manager",
            isPlayer: true,
            level: lvl
          };
        } else {
          // Генерация уникального ID бота
          const botId = `bot${leagueIdx}${lvl}${g.toString().padStart(3, '0')}${slot}`;
          fullList[currentGlobalIndex] = {
            id: botId,
            name: botId,
            isPlayer: false,
            level: lvl
          };
        }
        currentGlobalIndex++;
        if (currentGlobalIndex >= TOTAL_SLOTS) break;
      }
      if (currentGlobalIndex >= TOTAL_SLOTS) break;
    }
    if (currentGlobalIndex >= TOTAL_SLOTS) break;
  }

  return fullList;
}

/**
 * Рекурсивно определяет победителя ветки в Кубке.
 * Использует детерминированный алгоритм на основе Seed (Сезон + Раунд + Команды).
 */
export function getWinnerOfBranch(
  participants: (CupParticipant | null)[], 
  round: number, 
  startIndex: number, 
  cache: Map<string, CupParticipant | null>,
  limitDay: number,
  season: number
): CupParticipant | null {
  const key = `${startIndex}-${round}`;
  if (cache.has(key)) return cache.get(key)!;
  
  // Базовый случай: Раунд 0
  if (round === 0) return participants[startIndex] || null;
  if (round > limitDay) return null;
  
  const step = Math.pow(2, round - 1);
  const h = getWinnerOfBranch(participants, round - 1, startIndex, cache, limitDay, season);
  const a = getWinnerOfBranch(participants, round - 1, startIndex + step, cache, limitDay, season);
  
  if (!h && !a) { cache.set(key, null); return null; }
  if (!h) { cache.set(key, a); return a; }
  if (!a) { cache.set(key, h); return h; }

  // Проверка: вступил ли дивизион в игру?
  const hEntry = getEntryRound(h.level);
  const aEntry = getEntryRound(a.level);

  // Если оба еще не вступили по расписанию - "технический" проход первого (для формирования сетки)
  if (round <= hEntry && round <= aEntry) {
    cache.set(key, h); 
    return h;
  }

  // Симуляция результата
  const [scoreH, scoreA] = getMatchResult(h.id, a.id, round, season);
  const winner = scoreH > scoreA ? h : a; 
  
  cache.set(key, winner);
  return winner;
}
