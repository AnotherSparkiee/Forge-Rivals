
import { getMatchResult } from './leagues-data';

export interface CupParticipant {
  id: string;
  name: string;
  isPlayer: boolean;
  level: number;
}

/**
 * Generates the full list of participants for the global cup.
 * Strictly uses only participants from the league (real players + group bots).
 * Places teams from higher divisions first (Priority Seeding).
 */
export function getGlobalCupParticipants(realPlayers: any[], seasonNumber: number): (CupParticipant | null)[] {
  const allPyramidTeams: CupParticipant[] = [];
  
  // 1. Build foundation from 511 groups, strictly ordered by level 1 -> 9
  for (let lvl = 1; lvl <= 9; lvl++) {
    const groupsInDiv = Math.pow(2, lvl - 1);
    for (let g = 1; g <= groupsInDiv; g++) {
      const realInGroup = realPlayers.filter(p => Number(p.leagueLevel) === lvl && Number(p.groupId) === g);
      const groupTeams: CupParticipant[] = [];
      
      realInGroup.forEach(p => {
        if (p.displayName && p.displayName !== "Unknown Commander") {
          groupTeams.push({ id: p.id, name: p.displayName, isPlayer: true, level: lvl });
        }
      });
      
      const botsNeeded = Math.max(0, 8 - groupTeams.length);
      for (let i = 0; i < botsNeeded; i++) {
        const botIdNum = (lvl * 1000) + (g * 10) + i + 1000;
        groupTeams.push({ id: `bot${botIdNum}`, name: `bot${botIdNum}`, isPlayer: false, level: lvl });
      }
      allPyramidTeams.push(...groupTeams.slice(0, 8));
    }
  }

  const TOTAL_SLOTS = 16384;
  const fullList: (CupParticipant | null)[] = Array(TOTAL_SLOTS).fill(null);
  
  // 2. Priority Seeding Logic:
  // We place teams in even indices (0, 2, 4...) to spread them out.
  // Since allPyramidTeams is sorted by level, Div 1 teams will be at the very beginning of the match list.
  // They will face BYEs (nulls) in the first round if the grid is not full.
  allPyramidTeams.forEach((team, i) => {
    if (i < TOTAL_SLOTS / 2) {
      // Place team in even slot. Its opponent at i*2 + 1 will be null (BYE)
      fullList[i * 2] = team;
    } else if (i < TOTAL_SLOTS) {
      // If we exceed 8192 teams, start filling odd slots (unlikely with current 4088 team cap)
      fullList[(i - 8192) * 2 + 1] = team;
    }
  });

  // No global shuffle here to preserve Division Priority as requested.
  // Instead, we can do a deterministic per-season small shuffle within groups if needed, 
  // but the current requirement is strictly level-based priority.

  return fullList;
}

/**
 * Recursively determines the winner of a specific branch in the tournament tree.
 * Uses Bo3 (Best of 3) logic for the Cup.
 */
export function getWinnerOfBranch(
  participants: (CupParticipant | null)[], 
  round: number, 
  startIndex: number, 
  cache: Map<string, CupParticipant | null>
): CupParticipant | null {
  const key = `${startIndex}-${round}`;
  if (cache.has(key)) return cache.get(key)!;
  
  if (round === 0) return participants[startIndex] || null;
  
  const step = Math.pow(2, round - 1);
  const h = getWinnerOfBranch(participants, round - 1, startIndex, cache);
  const a = getWinnerOfBranch(participants, round - 1, startIndex + step, cache);
  
  if (!h && !a) {
    cache.set(key, null);
    return null;
  }
  if (!h) {
    cache.set(key, a);
    return a;
  }
  if (!a) {
    cache.set(key, h);
    return h;
  }

  // Use Bo3 for Cup: Results are strictly 2:0, 2:1, 1:2, 0:2
  const [scoreH, scoreA] = getMatchResult(h.id, a.id, round, true);
  const winner = scoreH > scoreA ? h : a; 
  
  cache.set(key, winner);
  return winner;
}
