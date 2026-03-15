
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

const BOT_TEAM_NAMES = [
  "Alpha Strikers", "Void Reapers", "Cyber Knights", "Neon Phantoms", 
  "Shadow Walkers", "Iron Guardians", "Frost Giants", "Storm Bringers",
  "Plasma Wolves", "Nexus Rangers", "Titan Brawlers", "Zenith Hunters",
  "Quantum Phalanx", "Solar Flares", "Lunar Eclipse", "Obsidian Daggers",
  "Vortex Seekers", "Ember Guard", "Glacier Raiders", "Thunder Fist",
  "Digital Demons", "Logic Bombs", "Code Breakers", "Data Wraiths",
  "Signal Ghosts", "Binary Beasts", "Silicon Soldiers", "Circuit Crushers",
  "Vector Vanguards", "Matrix Masters", "Kernel Kings", "Pixel Predators",
  "Rune Wardens", "Mystic Monks", "Ancient Aspects", "Spirit Sentinels",
  "Divine Dragoons", "Celestial Corsairs", "Astral Avengers", "Void Voyagers",
  "Gravity Grunts", "Nebula Knights", "Star Seekers", "Cosmos Command",
  "Galaxy Gladiators", "Orbit Outlaws", "Meteor Menace", "Comet Cutters"
];

/**
 * Deterministically generates bot teams for a specific group in the pyramid.
 */
export function getMockGroupTeams(
  playerRank: number, 
  playerName: string = "Player Team",
  level: number = 9,
  division: number = 1,
  group: number = 1
) {
  // Use a simple hash based on group coordinates to pick bot names
  const seed = (level * 1000) + (division * 100) + group;
  
  const bots = [];
  const usedIndices = new Set<number>();
  
  for (let i = 0; i < 7; i++) {
    let nameIndex = (seed + i * 7) % BOT_TEAM_NAMES.length;
    // Avoid duplicate names in the same group
    while (usedIndices.has(nameIndex)) {
      nameIndex = (nameIndex + 1) % BOT_TEAM_NAMES.length;
    }
    usedIndices.add(nameIndex);
    
    // Bots in higher levels have slightly more points/wins
    const levelModifier = (10 - level) * 5;
    const wins = Math.max(0, Math.floor(((seed + i) % 15) + levelModifier));
    const losses = Math.max(0, 15 - wins);
    
    bots.push({
      name: BOT_TEAM_NAMES[nameIndex],
      wins: wins,
      losses: losses,
      points: wins * 3,
      isPlayer: false
    });
  }

  const playerTeam = { 
    name: playerName, 
    wins: Math.max(0, Math.floor(playerRank / 100)), 
    losses: 5, 
    points: Math.max(0, Math.floor(playerRank / 10)), 
    isPlayer: true 
  };

  const allTeams = [...bots, playerTeam];
  return allTeams.sort((a, b) => b.points - a.points);
}

/**
 * Returns the name of the division based on its level and sub-id
 */
export function getDivisionName(level: number, subId: number): string {
  return `${level}.${subId}`;
}
