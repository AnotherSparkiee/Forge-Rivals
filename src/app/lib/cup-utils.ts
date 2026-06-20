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
 * Генерирует стабильный список из 4096 участников кубка.
 */
export function getGlobalCupParticipants(realPlayers: any[], seasonNumber: number): (CupParticipant | null)[] {
  const TOTAL_SLOTS = 4096;
  const fullList: (CupParticipant | null)[] = Array(TOTAL_SLOTS).fill(null);
  
  const allTeams: CupParticipant[] = [];
  for (let lvl = 1; lvl <= 9; lvl++) {
    const groupsInDiv = Math.pow(2, lvl - 1);
    for (let g = 1; g <= groupsInDiv; g++) {
      const realInGroup = realPlayers.filter(p => Number(p.leagueLevel) === lvl && Number(p.groupId) === g);
      const groupTeams: CupParticipant[] = [];
      
      realInGroup.forEach(p => {
        const hasValidName = p.displayName && p.displayName.trim().length >= 2 && p.displayName !== "Unknown Commander";
        if (hasValidName) {
          groupTeams.push({ id: p.id, name: p.displayName, isPlayer: true, level: lvl });
        }
      });
      
      const botsNeeded = Math.max(0, 8 - groupTeams.length);
      for (let i = 0; i < botsNeeded; i++) {
        const botIdNum = (lvl * 1000) + (g * 10) + i + 1000;
        // Убрали "Bot " и пробел, оставили только botID формат
        groupTeams.push({ id: `bot${botIdNum}`, name: `bot${botIdNum}`, isPlayer: false, level: lvl });
      }
      allTeams.push(...groupTeams.slice(0, 8));
    }
  }

  // Детерминированный посев на основе сезона
  const seed = seasonNumber;
  const shuffledTeams = [...allTeams].sort((a, b) => a.id.localeCompare(b.id));
  for (let i = shuffledTeams.length - 1; i > 0; i--) {
    const j = (seed + i) % (i + 1);
    [shuffledTeams[i], shuffledTeams[j]] = [shuffledTeams[j], shuffledTeams[i]];
  }

  const usedIndices = new Set<number>();
  shuffledTeams.forEach((team) => {
    const entryRound = getEntryRound(team.level);
    const step = Math.pow(2, entryRound + 1);
    for (let i = 0; i < TOTAL_SLOTS; i += step) {
      if (!usedIndices.has(i)) {
        fullList[i] = team;
        usedIndices.add(i);
        break;
      }
    }
  });

  return fullList;
}

/**
 * Рекурсивно определяет победителя ветки.
 */
export function getWinnerOfBranch(
  participants: (CupParticipant | null)[], 
  round: number, 
  startIndex: number, 
  cache: Map<string, CupParticipant | null>,
  limitDay: number 
): CupParticipant | null {
  const key = `${startIndex}-${round}`;
  if (cache.has(key)) return cache.get(key)!;
  
  if (round === 0) return participants[startIndex] || null;
  if (round > limitDay) return null;
  
  const step = Math.pow(2, round - 1);
  const h = getWinnerOfBranch(participants, round - 1, startIndex, cache, limitDay);
  const a = getWinnerOfBranch(participants, round - 1, startIndex + step, cache, limitDay);
  
  if (!h && !a) { cache.set(key, null); return null; }
  if (!h) { cache.set(key, a); return a; }
  if (!a) { cache.set(key, h); return h; }

  const hEntry = getEntryRound(h.level);
  const aEntry = getEntryRound(a.level);

  if (round <= hEntry && round <= aEntry) {
    cache.set(key, h); 
    return h;
  }

  const [scoreH, scoreA] = getMatchResult(h.id, a.id, round, 1);
  const winner = scoreH > scoreA ? h : a; 
  
  cache.set(key, winner);
  return winner;
}
