
export interface LeagueGroup {
  id: string;
  name: string;
  level: number;
  divisionId: string;
  groupNumber: number;
}

export interface LeagueOption {
  id: string;
  startTime: string;
  description: string;
}

export const MAX_LEVELS = 9;
export const GROUPS_PER_DIVISION = 8;
export const TEAMS_PER_GROUP = 8;

export const LEAGUES: LeagueOption[] = [
  { id: 'ALPHA', startTime: '08:00 - 12:00', description: 'Early morning operations for early birds.' },
  { id: 'BETA', startTime: '12:00 - 16:00', description: 'Mid-day tactical window.' },
  { id: 'GAMMA', startTime: '16:00 - 20:00', description: 'Prime time evening matches.' },
  { id: 'DELTA', startTime: '20:00 - 00:00', description: 'Late night competitive sessions.' },
];

/**
 * Deterministically generates group teams for a specific group in the pyramid.
 * If includePlayer is true, it generates 7 bots + 1 player.
 * If includePlayer is false, it generates 8 bots.
 */
export function getMockGroupTeams(
  playerRank: number, 
  playerName: string = "Player Team",
  level: number = 9,
  division: number = 1,
  group: number = 1,
  includePlayer: boolean = true
) {
  const teams = [];
  const botLimit = includePlayer ? 7 : 8;
  
  for (let i = 0; i < botLimit; i++) {
    // Generate a unique ID based on pyramid coordinates (level, division, group, slot)
    const botIdValue = (level * 10000) + (division * 100) + (group * 10) + i;
    
    // Bots in higher levels (closer to level 1) have slightly better stats
    const levelModifier = (10 - level) * 5;
    const wins = Math.max(0, Math.floor(((botIdValue) % 15) + levelModifier));
    const losses = Math.max(0, 15 - wins);
    
    teams.push({
      id: `bot_${botIdValue}`,
      name: `🤖bot${botIdValue}`,
      wins: wins,
      losses: losses,
      points: wins * 3,
      isPlayer: false
    });
  }

  if (includePlayer) {
    teams.push({ 
      id: "player_team",
      name: playerName, 
      wins: Math.max(0, Math.floor(playerRank / 100)), 
      losses: 5, 
      points: Math.max(0, Math.floor(playerRank / 10)), 
      isPlayer: true 
    });
  }

  // Sort teams by points descending to determine table positions
  return teams.sort((a, b) => b.points - a.points);
}

/**
 * Returns the name of the division based on its level and sub-id
 */
export function getDivisionName(level: number, subId: number): string {
  return `${level}.${subId}`;
}
