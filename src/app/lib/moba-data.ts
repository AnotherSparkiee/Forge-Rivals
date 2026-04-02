export type Role = 'Tank' | 'Carry' | 'Support' | 'Midlaner' | 'Jungler';

export interface Hero {
  id: string;
  name: string;
  role: Role;
  baseStats: {
    attack: number;
    defense: number;
    health: number;
    abilityPower: number;
    speed: number;
  };
  overallRating: number;
  abilitiesFocus: string;
  image: string;
  description: string;
  price: number;
  age: number;
  salary: number;
  form: number; 
  fatigue: number; 
  country: { code: string; name: string; flag: string };
  isInjured: boolean;
  trainingFocus?: string | null;
  dailyTrainingFocus?: string | null;
  dailyTrainingFinishTime?: string | null;
  // Current skill levels (0-100)
  proStats: {
    lastHitting: number;
    mapAwareness: number;
    positioning: number;
    reflexes: number;
    manaManagement: number;
    objectiveControl: number;
    communication: number;
    tiltResistance: number;
    versatility: number;
    ganking: number;
  };
  // Talent limits for each skill (1-5 stars)
  proTalents: {
    lastHitting: number;
    mapAwareness: number;
    positioning: number;
    reflexes: number;
    manaManagement: number;
    objectiveControl: number;
    communication: number;
    tiltResistance: number;
    versatility: number;
    ganking: number;
  };
}

const COUNTRY_PHOTOS: Record<string, { flag: string, name: string, url: string }> = {
  'DE': { flag: '🇩🇪', name: 'Germany', url: 'https://i.postimg.cc/PPS3QFFM/de-1.jpg' },
  'CN': { flag: '🇨🇳', name: 'China', url: 'https://i.postimg.cc/wvzKxSYS/1755011442109.jpg' },
  'RU': { flag: '🇷🇺', name: 'Russia', url: 'https://i.postimg.cc/mg3yfqj5/rus-2.jpg' },
  'UA': { flag: '🇺🇦', name: 'Ukraine', url: 'https://i.postimg.cc/X7fs4pYn/ua-1.jpg' },
  'KR': { flag: '🇰🇷', name: 'South Korea', url: 'https://i.postimg.cc/43mv7dsH/kr-1.jpg' },
  'BR': { flag: '🇧🇷', name: 'Brazil', url: 'https://i.postimg.cc/Z5906yvS/br-1.jpg' },
  'TR': { flag: '🇹🇷', name: 'Turkey', url: 'https://i.postimg.cc/MHvbRpyd/tr-1.jpg' }
};

const HERO_NAMES = [
  "Shadow", "Nova", "Cipher", "Apex", "Viper", "Echo", "Ghost", "Raptor", 
  "Titan", "Oracle", "Zenith", "Blaze", "Frost", "Static", "Wraith", 
  "Hunter", "Siren", "Falcon", "Grim", "Pulse", "Onyx", "Rogue", "Aero",
  "Blast", "Drift", "Flux", "Glint", "Haze", "Jolt", "Kite", "Lume", "Mist"
];

function getRandomStat(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getRandomTalent() {
  // Returns a value between 2.0 and 5.0 in steps of 0.5
  return (Math.floor(Math.random() * 7) + 4) / 2;
}

export function generateUniqueHero(role: Role, index: number, isStarter: boolean = false): Hero {
  const codes = Object.keys(COUNTRY_PHOTOS);
  const code = codes[Math.floor(Math.random() * codes.length)];
  const country = COUNTRY_PHOTOS[code];
  const name = `${HERO_NAMES[Math.floor(Math.random() * HERO_NAMES.length)]} ${index + 1}`;
  
  const baseStats = {
    attack: role === 'Carry' || role === 'Jungler' 
      ? getRandomStat(isStarter ? 55 : 70, isStarter ? 75 : 95) 
      : getRandomStat(isStarter ? 15 : 20, isStarter ? 35 : 50),
    defense: role === 'Tank' 
      ? getRandomStat(isStarter ? 65 : 80, isStarter ? 85 : 100) 
      : getRandomStat(isStarter ? 15 : 20, isStarter ? 35 : 50),
    health: role === 'Tank' 
      ? getRandomStat(isStarter ? 1100 : 1400, isStarter ? 1400 : 1800) 
      : getRandomStat(isStarter ? 600 : 700, isStarter ? 850 : 1000),
    abilityPower: role === 'Midlaner' || role === 'Support' 
      ? getRandomStat(isStarter ? 55 : 60, isStarter ? 85 : 110) 
      : getRandomStat(0, 30),
    speed: getRandomStat(250, 360)
  };

  const proStats = {
    lastHitting: getRandomStat(isStarter ? 35 : 40, isStarter ? 65 : 98),
    mapAwareness: getRandomStat(isStarter ? 35 : 40, isStarter ? 65 : 98),
    positioning: getRandomStat(isStarter ? 35 : 40, isStarter ? 65 : 98),
    reflexes: getRandomStat(isStarter ? 35 : 40, isStarter ? 65 : 98),
    manaManagement: getRandomStat(isStarter ? 35 : 40, isStarter ? 65 : 98),
    objectiveControl: getRandomStat(isStarter ? 35 : 40, isStarter ? 65 : 98),
    communication: getRandomStat(isStarter ? 35 : 40, isStarter ? 65 : 98),
    tiltResistance: getRandomStat(isStarter ? 35 : 40, isStarter ? 65 : 98),
    versatility: getRandomStat(isStarter ? 35 : 40, isStarter ? 65 : 98),
    ganking: getRandomStat(isStarter ? 35 : 40, isStarter ? 65 : 98),
  };

  const proTalents = {
    lastHitting: getRandomTalent(),
    mapAwareness: getRandomTalent(),
    positioning: getRandomTalent(),
    reflexes: getRandomTalent(),
    manaManagement: getRandomTalent(),
    objectiveControl: getRandomTalent(),
    communication: getRandomTalent(),
    tiltResistance: getRandomTalent(),
    versatility: getRandomTalent(),
    ganking: getRandomTalent(),
  };

  // Balance calculation to ensure 29-38 rating for starters
  const proSum = Object.values(proStats).reduce((a, b) => a + b, 0);
  const basePower = (baseStats.attack + (baseStats.defense / 2) + (baseStats.abilityPower / 2)) / 5;
  const overall = Math.round((proSum / 10) * 0.4 + basePower * 0.6);

  return {
    id: `hero_${Date.now()}_${index}_${Math.random().toString(36).substr(2, 5)}`,
    name,
    role,
    baseStats,
    overallRating: isStarter ? Math.min(38, Math.max(29, overall)) : overall,
    abilitiesFocus: 'Balanced',
    image: country.url,
    description: `A unique talent from ${country.name}.`,
    price: 0,
    age: getRandomStat(17, 28),
    salary: getRandomStat(2000, 8000),
    form: getRandomStat(70, 95),
    fatigue: 0,
    country: { code, name: country.name, flag: country.flag },
    isInjured: false,
    trainingFocus: null,
    dailyTrainingFocus: null,
    dailyTrainingFinishTime: null,
    proStats,
    proTalents
  };
}

export function getRandomStartingSquad(): Hero[] {
  const roles: Role[] = ['Tank', 'Carry', 'Midlaner', 'Jungler', 'Support', 'Carry', 'Tank'];
  return roles.map((role, i) => generateUniqueHero(role, i, true));
}

export const INITIAL_HEROES: Hero[] = [
  {
    id: 'h1',
    name: 'Ironclad Bastion',
    role: 'Tank',
    baseStats: { attack: 40, defense: 90, health: 1500, abilityPower: 10, speed: 280 },
    overallRating: 34,
    abilitiesFocus: 'Defensive',
    image: 'https://i.postimg.cc/PPS3QFFM/de-1.jpg',
    description: 'An unbreakable shield on the battlefield.',
    price: 0,
    age: 24,
    salary: 4500,
    form: 85,
    fatigue: 12,
    country: { code: 'DE', name: 'Germany', flag: '🇩🇪' },
    isInjured: false,
    trainingFocus: null,
    dailyTrainingFocus: null,
    dailyTrainingFinishTime: null,
    proStats: {
      lastHitting: 45, mapAwareness: 88, positioning: 92, reflexes: 60, manaManagement: 55,
      objectiveControl: 80, communication: 95, tiltResistance: 98, versatility: 70, ganking: 40
    },
    proTalents: {
      lastHitting: 3.5, mapAwareness: 4.5, positioning: 5.0, reflexes: 3.5, manaManagement: 3.0,
      objectiveControl: 4.0, communication: 5.0, tiltResistance: 5.0, versatility: 4.0, ganking: 3.0
    }
  },
  {
    id: 'h2',
    name: 'Swift Gale',
    role: 'Carry',
    baseStats: { attack: 85, defense: 30, health: 800, abilityPower: 20, speed: 340 },
    overallRating: 38,
    abilitiesFocus: 'Aggressive',
    image: 'https://i.postimg.cc/43mv7dsH/kr-1.jpg',
    description: 'Deals massive physical damage from afar.',
    price: 0,
    age: 19,
    salary: 8200,
    form: 92,
    fatigue: 25,
    country: { code: 'KR', name: 'South Korea', flag: '🇰🇷' },
    isInjured: false,
    trainingFocus: null,
    dailyTrainingFocus: null,
    dailyTrainingFinishTime: null,
    proStats: {
      lastHitting: 98, mapAwareness: 75, positioning: 85, reflexes: 95, manaManagement: 70,
      objectiveControl: 65, communication: 60, tiltResistance: 75, versatility: 80, ganking: 50
    },
    proTalents: {
      lastHitting: 5.0, mapAwareness: 4.0, positioning: 4.5, reflexes: 5.0, manaManagement: 4.0,
      objectiveControl: 3.5, communication: 3.5, tiltResistance: 4.0, versatility: 4.0, ganking: 3.0
    }
  }
];