
import { getMatchResult } from './leagues-data';

export interface CupParticipant {
  id: string;
  name: string;
  isPlayer: boolean;
}

/**
 * Generates the full list of participants for the global cup.
 * Strictly uses only participants from the league (real players + group bots).
 * Fills the 16,384 grid with these participants and nulls (BYES).
 */
export function getGlobalCupParticipants(realPlayers: any[], seasonNumber: number): (CupParticipant | null)[] {
  const allPyramidTeams: CupParticipant[] = [];
  
  // 1. Build foundation from 511 groups (8 teams each = 4088)
  for (let lvl = 1; lvl <= 9; lvl++) {
    const groupsInDiv = Math.pow(2, lvl - 1);
    for (let g = 1; g <= groupsInDiv; g++) {
      const realInGroup = realPlayers.filter(p => Number(p.leagueLevel) === lvl && Number(p.groupId) === g);
      const groupTeams: CupParticipant[] = [];
      
      realInGroup.forEach(p => {
        if (p.displayName && p.displayName !== "Unknown Commander") {
          groupTeams.push({ id: p.id, name: p.displayName, isPlayer: true });
        }
      });
      
      const botsNeeded = Math.max(0, 8 - groupTeams.length);
      for (let i = 0; i < botsNeeded; i++) {
        const botIdNum = (lvl * 1000) + (g * 10) + i + 1000;
        groupTeams.push({ id: `bot${botIdNum}`, name: `bot${botIdNum}`, isPlayer: false });
      }
      allPyramidTeams.push(...groupTeams.slice(0, 8));
    }
  }

  const TOTAL_SLOTS = 16384;
  const fullList: (CupParticipant | null)[] = Array(TOTAL_SLOTS).fill(null);
  
  allPyramidTeams.forEach((team, i) => {
    fullList[i] = team;
  });

  const seed = seasonNumber * 999;
  for (let i = fullList.length - 1; i > 0; i--) {
    const j = (seed + i) % (i + 1);
    [fullList[i], fullList[j]] = [fullList[j], fullList[i]];
  }

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

  // Use Bo3 for Cup
  const [scoreH, scoreA] = getMatchResult(h.id, a.id, round, true);
  const winner = scoreH > scoreA ? h : a; 
  
  cache.set(key, winner);
  return winner;
}
