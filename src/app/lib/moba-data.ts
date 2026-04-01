
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
  talent: number; 
  salary: number;
  form: number; 
  fatigue: number; 
  country: { code: string; name: string; flag: string };
  isInjured: boolean;
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

export function generateUniqueHero(role: Role, index: number): Hero {
  const codes = Object.keys(COUNTRY_PHOTOS);
  const code = codes[Math.floor(Math.random() * codes.length)];
  const country = COUNTRY_PHOTOS[code];
  const name = `${HERO_NAMES[Math.floor(Math.random() * HERO_NAMES.length)]} ${index + 1}`;
  
  const baseStats = {
    attack: role === 'Carry' || role === 'Jungler' ? getRandomStat(70, 95) : getRandomStat(20, 50),
    defense: role === 'Tank' ? getRandomStat(80, 100) : getRandomStat(20, 50),
    health: role === 'Tank' ? getRandomStat(1400, 1800) : getRandomStat(700, 1000),
    abilityPower: role === 'Midlaner' || role === 'Support' ? getRandomStat(60, 110) : getRandomStat(0, 30),
    speed: getRandomStat(250, 360)
  };

  const proStats = {
    lastHitting: getRandomStat(40, 98),
    mapAwareness: getRandomStat(40, 98),
    positioning: getRandomStat(40, 98),
    reflexes: getRandomStat(40, 98),
    manaManagement: getRandomStat(40, 98),
    objectiveControl: getRandomStat(40, 98),
    communication: getRandomStat(40, 98),
    tiltResistance: getRandomStat(40, 98),
    versatility: getRandomStat(40, 98),
    ganking: getRandomStat(40, 98),
  };

  const overall = Math.round(Object.values(proStats).reduce((a, b) => a + b, 0) / 10 * 0.4 + (baseStats.attack + baseStats.defense) / 4);

  return {
    id: `hero_${Date.now()}_${index}`,
    name,
    role,
    baseStats,
    overallRating: overall,
    abilitiesFocus: 'Balanced',
    image: country.url,
    description: `A unique talent from ${country.name}.`,
    price: 0,
    age: getRandomStat(17, 28),
    talent: getRandomStat(3, 5),
    salary: getRandomStat(2000, 8000),
    form: getRandomStat(70, 95),
    fatigue: 0,
    country: { code, name: country.name, flag: country.flag },
    isInjured: false,
    proStats
  };
}

export function getRandomStartingSquad(): Hero[] {
  const roles: Role[] = ['Tank', 'Carry', 'Midlaner', 'Jungler', 'Support', 'Carry', 'Tank'];
  return roles.map((role, i) => generateUniqueHero(role, i));
}

// Fallback initial heroes for existing sessions
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
    talent: 4,
    salary: 4500,
    form: 85,
    fatigue: 12,
    country: { code: 'DE', name: 'Germany', flag: '🇩🇪' },
    isInjured: false,
    proStats: {
      lastHitting: 45, mapAwareness: 88, positioning: 92, reflexes: 60, manaManagement: 55,
      objectiveControl: 80, communication: 95, tiltResistance: 98, versatility: 70, ganking: 40
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
    talent: 5,
    salary: 8200,
    form: 92,
    fatigue: 25,
    country: { code: 'KR', name: 'South Korea', flag: '🇰🇷' },
    isInjured: false,
    proStats: {
      lastHitting: 98, mapAwareness: 75, positioning: 85, reflexes: 95, manaManagement: 70,
      objectiveControl: 65, communication: 60, tiltResistance: 75, versatility: 80, ganking: 50
    }
  },
  {
    id: 'h3',
    name: 'Arcane Weaver',
    role: 'Midlaner',
    baseStats: { attack: 25, defense: 25, health: 850, abilityPower: 95, speed: 310 },
    overallRating: 36,
    abilitiesFocus: 'Burst Damage',
    image: 'https://i.postimg.cc/wvzKxSYS/1755011442109.jpg',
    description: 'Masters of spells and map control.',
    price: 0,
    age: 21,
    talent: 4,
    salary: 6100,
    form: 78,
    fatigue: 18,
    country: { code: 'CN', name: 'China', flag: '🇨🇳' },
    isInjured: false,
    proStats: {
      lastHitting: 88, mapAwareness: 92, positioning: 80, reflexes: 82, manaManagement: 95,
      objectiveControl: 85, communication: 88, tiltResistance: 80, versatility: 85, ganking: 75
    }
  },
  {
    id: 'h4',
    name: 'Shadow Stalker',
    role: 'Jungler',
    baseStats: { attack: 75, defense: 45, health: 950, abilityPower: 40, speed: 360 },
    overallRating: 32,
    abilitiesFocus: 'Utility',
    image: 'https://i.postimg.cc/mg3yfqj5/rus-2.jpg',
    description: 'Strikes from the shadows when least expected.',
    price: 0,
    age: 23,
    talent: 3,
    salary: 3800,
    form: 82,
    fatigue: 35,
    country: { code: 'RU', name: 'Russia', flag: '🇷🇺' },
    isInjured: false,
    proStats: {
      lastHitting: 60, mapAwareness: 85, positioning: 75, reflexes: 88, manaManagement: 65,
      objectiveControl: 90, communication: 70, tiltResistance: 85, versatility: 75, ganking: 98
    }
  },
  {
    id: 'h5',
    name: 'Aura Bloom',
    role: 'Support',
    baseStats: { attack: 30, defense: 50, health: 1000, abilityPower: 60, speed: 320 },
    overallRating: 29,
    abilitiesFocus: 'Sustain',
    image: 'https://i.postimg.cc/X7fs4pYn/ua-1.jpg',
    description: 'Keeps the team alive and empowered.',
    price: 0,
    age: 20,
    talent: 4,
    salary: 4200,
    form: 88,
    fatigue: 10,
    country: { code: 'UA', name: 'Ukraine', flag: '🇺🇦' },
    isInjured: false,
    proStats: {
      lastHitting: 40, mapAwareness: 95, positioning: 90, reflexes: 75, manaManagement: 85,
      objectiveControl: 80, communication: 98, tiltResistance: 95, versatility: 90, ganking: 60
    }
  },
  {
    id: 'h_sub1',
    name: 'Crimson Blade',
    role: 'Carry',
    baseStats: { attack: 78, defense: 35, health: 850, abilityPower: 15, speed: 330 },
    overallRating: 33,
    abilitiesFocus: 'Burst Damage',
    image: 'https://i.postimg.cc/Z5906yvS/br-1.jpg',
    description: 'A versatile substitute with high damage potential.',
    price: 0,
    age: 22,
    talent: 3,
    salary: 3100,
    form: 70,
    fatigue: 5,
    country: { code: 'BR', name: 'Brazil', flag: '🇧🇷' },
    isInjured: false,
    proStats: {
      lastHitting: 82, mapAwareness: 65, positioning: 70, reflexes: 85, manaManagement: 60,
      objectiveControl: 60, communication: 75, tiltResistance: 80, versatility: 85, ganking: 70
    }
  },
  {
    id: 'h_sub2',
    name: 'Earthen Guard',
    role: 'Tank',
    baseStats: { attack: 45, defense: 85, health: 1400, abilityPower: 5, speed: 290 },
    overallRating: 31,
    abilitiesFocus: 'Sustain',
    image: 'https://i.postimg.cc/MHvbRpyd/tr-1.jpg',
    description: 'Provides reliable backup defense when needed.',
    price: 0,
    age: 26,
    talent: 3,
    salary: 2900,
    form: 75,
    fatigue: 0,
    country: { code: 'TR', name: 'Turkey', flag: '🇹🇷' },
    isInjured: false,
    proStats: {
      lastHitting: 50, mapAwareness: 80, positioning: 85, reflexes: 55, manaManagement: 50,
      objectiveControl: 75, communication: 85, tiltResistance: 90, versatility: 65, ganking: 30
    }
  }
];

export const SHOP_HEROES: Hero[] = [
  {
    id: 'h6',
    name: 'Frost Queen',
    role: 'Midlaner',
    baseStats: { attack: 20, defense: 30, health: 800, abilityPower: 110, speed: 300 },
    overallRating: 45,
    abilitiesFocus: 'Crowd Control',
    image: 'https://picsum.photos/seed/frost/400/600',
    description: 'Freezes enemies in their tracks.',
    price: 1000,
    age: 22,
    talent: 5,
    salary: 12000,
    form: 95,
    fatigue: 40,
    country: { code: 'ES', name: 'Spain', flag: '🇪🇸' },
    isInjured: false,
    proStats: {
      lastHitting: 92, mapAwareness: 95, positioning: 88, reflexes: 85, manaManagement: 98,
      objectiveControl: 90, communication: 85, tiltResistance: 88, versatility: 92, ganking: 80
    }
  },
  {
    id: 'h7',
    name: 'Colossus',
    role: 'Tank',
    baseStats: { attack: 50, defense: 100, health: 1800, abilityPower: 0, speed: 250 },
    overallRating: 52,
    abilitiesFocus: 'Unstoppable',
    image: 'https://picsum.photos/seed/colossus/400/600',
    description: 'A literal mountain that moves.',
    price: 1500,
    age: 28,
    talent: 5,
    salary: 15000,
    form: 98,
    fatigue: 15,
    country: { code: 'KZ', name: 'Kazakhstan', flag: '🇰🇿' },
    isInjured: false,
    proStats: {
      lastHitting: 55, mapAwareness: 90, positioning: 98, reflexes: 65, manaManagement: 60,
      objectiveControl: 95, communication: 92, tiltResistance: 100, versatility: 75, ganking: 45
    }
  }
];
