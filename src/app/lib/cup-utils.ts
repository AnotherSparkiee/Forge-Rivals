
import { getMatchResult } from './leagues-data';

export interface CupParticipant {
  id: string;
  name: string;
  isPlayer: boolean;
}

/**
 * Generates the full list of 16,384 participants for the global cup.
 * Uses 4088 teams from the pyramid groups and fills the rest with qualification bots.
 */
export function getGlobalCupParticipants(realPlayers: any[], seasonNumber: number): CupParticipant[] {
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

  // 2. Fill to 16,384 slots with Qualifier Bots
  const TOTAL_SLOTS = 16384;
  const qualifiersNeeded = TOTAL_SLOTS - allPyramidTeams.length;
  
  const qualifierBots = Array.from({ length: qualifiersNeeded }).map((_, i) => ({
    id: `qual_bot_${i + 10000}`,
    name: `qual_bot_${i + 10000}`,
    isPlayer: false
  }));

  const fullList = [...allPyramidTeams, ...qualifierBots];
  fullList.sort((a, b) => a.id.localeCompare(b.id));

  // 3. Deterministic shuffle per season
  const seed = seasonNumber * 999;
  const shuffled = [...fullList];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = (seed + i) % (i + 1);
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  return shuffled;
}

/**
 * Recursively determines the winner of a specific branch in the tournament tree.
 */
export function getWinnerOfBranch(
  participants: CupParticipant[], 
  round: number, 
  startIndex: number, 
  cache: Map<string, CupParticipant>
): CupParticipant {
  const key = `${startIndex}-${round}`;
  if (cache.has(key)) return cache.get(key)!;
  
  if (round === 0) return participants[startIndex];
  
  const step = Math.pow(2, round - 1);
  const h = getWinnerOfBranch(participants, round - 1, startIndex, cache);
  const a = getWinnerOfBranch(participants, round - 1, startIndex + step, cache);
  
  if (!h || !a) return h || a;

  const [scoreH, scoreA] = getMatchResult(h.id, a.id, round);
  const winner = scoreH >= scoreA ? h : a; 
  
  cache.set(key, winner);
  return winner;
}
