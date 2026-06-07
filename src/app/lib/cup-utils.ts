
import { getMatchResult } from './leagues-data';

export interface CupParticipant {
  id: string;
  name: string;
  isPlayer: boolean;
  level: number;
}

/**
 * Calculates which round a division starts their tournament.
 * Div 9 starts at Round 0 (Day 1).
 * Div 1 starts at Round 8 (Day 9).
 */
export function getEntryRound(level: number): number {
  return Math.max(0, 9 - level);
}

/**
 * Generates the full list of participants for the global cup.
 * STRICT FILTER: Ignores players without valid names.
 */
export function getGlobalCupParticipants(realPlayers: any[], seasonNumber: number): (CupParticipant | null)[] {
  const TOTAL_SLOTS = 16384;
  const fullList: (CupParticipant | null)[] = Array(TOTAL_SLOTS).fill(null);
  
  const allTeams: CupParticipant[] = [];
  for (let lvl = 1; lvl <= 9; lvl++) {
    const groupsInDiv = Math.pow(2, lvl - 1);
    for (let g = 1; g <= groupsInDiv; g++) {
      const realInGroup = realPlayers.filter(p => Number(p.leagueLevel) === lvl && Number(p.groupId) === g);
      const groupTeams: CupParticipant[] = [];
      
      realInGroup.forEach(p => {
        // STRICT FILTER: Only allow players with names longer than 1 char and not default
        const hasValidName = p.displayName && p.displayName.trim().length >= 2 && p.displayName !== "Unknown Commander";
        if (hasValidName) {
          groupTeams.push({ id: p.id, name: p.displayName, isPlayer: true, level: lvl });
        }
      });
      
      const botsNeeded = Math.max(0, 8 - groupTeams.length);
      for (let i = 0; i < botsNeeded; i++) {
        const botIdNum = (lvl * 1000) + (g * 10) + i + 1000;
        groupTeams.push({ id: `bot${botIdNum}`, name: `bot${botIdNum}`, isPlayer: false, level: lvl });
      }
      allTeams.push(...groupTeams.slice(0, 8));
    }
  }

  // Deterministic Seed based on season
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
 * Recursively determines the winner of a specific branch in the tournament tree.
 * Respects the currentDay limit to prevent showing future results.
 */
export function getWinnerOfBranch(
  participants: (CupParticipant | null)[], 
  round: number, 
  startIndex: number, 
  cache: Map<string, CupParticipant | null>,
  limitDay: number // Results only known up to this day
): CupParticipant | null {
  const key = `${startIndex}-${round}`;
  if (cache.has(key)) return cache.get(key)!;
  
  if (round === 0) return participants[startIndex] || null;
  
  // A winner of round R is only known if limitDay >= R
  if (round > limitDay) return null;
  
  const step = Math.pow(2, round - 1);
  const h = getWinnerOfBranch(participants, round - 1, startIndex, cache, limitDay);
  const a = getWinnerOfBranch(participants, round - 1, startIndex + step, cache, limitDay);
  
  if (!h && !a) {
    cache.set(key, null);
    return null;
  }
  
  if (!h) { cache.set(key, a); return a; }
  if (!a) { cache.set(key, h); return h; }

  const hEntry = getEntryRound(h.level);
  const aEntry = getEntryRound(a.level);

  // If both teams are still in their seeding phase, they both "advance"
  // but only return one as the branch representative.
  if (round <= hEntry && round <= aEntry) {
    cache.set(key, h); 
    return h;
  }

  // Real match
  const [scoreH, scoreA] = getMatchResult(h.id, a.id, round, true);
  const winner = scoreH > scoreA ? h : a; 
  
  cache.set(key, winner);
  return winner;
}
