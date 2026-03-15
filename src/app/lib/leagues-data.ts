
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

export const LEAGUES: LeagueOption[] = [
  { id: 'ALPHA', startTime: '08:00 - 12:00', description: 'Early morning operations for early birds.' },
  { id: 'BETA', startTime: '12:00 - 16:00', description: 'Mid-day tactical window.' },
  { id: 'GAMMA', startTime: '16:00 - 20:00', description: 'Prime time evening matches.' },
  { id: 'DELTA', startTime: '20:00 - 00:00', description: 'Late night competitive sessions.' },
];

/**
 * Returns the name of the division based on its level and sub-id
 */
export function getDivisionName(level: number, subId: number): string {
  return `${level}.${subId}`;
}

/**
 * Returns the full identifier for a player's current location in the pyramid
 */
export function getLeagueIdentifier(level: number, subId: number, groupNum: number): string {
  return `D${level}.${subId}-G${groupNum}`;
}

/**
 * Mock function to get group members (for rankings)
 */
export function getMockGroupTeams(playerRank: number, isPlayerIn: boolean = true) {
  const teams = [
    { name: "Alpha Strikers", wins: 12, losses: 2, points: 36 },
    { name: "Void Reapers", wins: 10, losses: 4, points: 30 },
    { name: "Cyber Knights", wins: 9, losses: 5, points: 27 },
    { name: "Neon Phantoms", wins: 8, losses: 6, points: 24 },
    { name: "Shadow Walkers", wins: 7, losses: 7, points: 21 },
    { name: "Iron Guardians", wins: 5, losses: 9, points: 15 },
    { name: "Frost Giants", wins: 3, losses: 11, points: 9 },
    { name: "Star Voyagers", wins: 1, losses: 13, points: 3 },
  ];

  if (isPlayerIn) {
    // Insert player based on rank
    const playerTeam = { name: "Ваша Команда", wins: Math.max(0, Math.floor(playerRank / 100)), losses: 5, points: Math.max(0, Math.floor(playerRank / 10)), isPlayer: true };
    teams.push(playerTeam);
  }

  return teams.sort((a, b) => b.points - a.points);
}
