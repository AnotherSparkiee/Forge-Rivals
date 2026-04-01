
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
 * Uses strict Power-of-2 spacing to ensure high-division teams skip early rounds.
 */
export function getGlobalCupParticipants(realPlayers: any[], seasonNumber: number): (CupParticipant | null)[] {
  const TOTAL_SLOTS = 16384;
  const fullList: (CupParticipant | null)[] = Array(TOTAL_SLOTS).fill(null);
  
  // Collect all teams from the pyramid (511 groups * 8 teams = 4088 teams)
  const allTeams: CupParticipant[] = [];
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
      allTeams.push(...groupTeams.slice(0, 8));
    }
  }

  // Deterministic Shuffle based on season
  const seed = seasonNumber;
  const shuffledTeams = [...allTeams].sort((a, b) => a.id.localeCompare(b.id));
  for (let i = shuffledTeams.length - 1; i > 0; i--) {
    const j = (seed + i) % (i + 1);
    [shuffledTeams[i], shuffledTeams[j]] = [shuffledTeams[j], shuffledTeams[i]];
  }

  /**
   * SEEDING LOGIC:
   * We place teams in the 16384 grid based on their entry round.
   * Div 9 (Level 9) enters Round 0: Step 2 (8192 possible positions)
   * Div 1 (Level 1) enters Round 8: Step 256 (64 possible positions)
   */
  const usedIndices = new Set<number>();

  shuffledTeams.forEach((team) => {
    const entryRound = getEntryRound(team.level);
    const step = Math.pow(2, entryRound + 1);
    
    // Find first available slot matching the step requirement
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
 * Teams only "exist" in the tree once they reach their entry round.
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
  
  // If only one team exists, they win by default (Progression without match)
  if (!h) { cache.set(key, a); return a; }
  if (!a) { cache.set(key, h); return h; }

  // MATCH LOGIC:
  // Both must have reached the current round according to their division seed
  const hEntry = getEntryRound(h.level);
  const aEntry = getEntryRound(a.level);

  // A real match only happens if we are at or past the entry round for BOTH
  // Otherwise, the seeded team just waits/advances
  if (round <= hEntry && round <= aEntry) {
    // Both are seeded/waiting, just return one (they don't meet yet)
    cache.set(key, h); 
    return h;
  }

  // If we are here, at least one team has "entered" the bracket and they finally meet
  const [scoreH, scoreA] = getMatchResult(h.id, a.id, round, true);
  const winner = scoreH > scoreA ? h : a; 
  
  cache.set(key, winner);
  return winner;
}
