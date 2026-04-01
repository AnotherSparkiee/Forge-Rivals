
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
  // Extended Portfolio Data
  age: number;
  talent: number; // 1-5
  salary: number;
  form: number; // 0-100
  fatigue: number; // 0-100
  country: { code: string; name: string; flag: string };
  isInjured: boolean;
  // 10 Professional Characteristics
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

export const INITIAL_HEROES: Hero[] = [
  {
    id: 'h1',
    name: 'Ironclad Bastion',
    role: 'Tank',
    baseStats: { attack: 40, defense: 90, health: 1500, abilityPower: 10, speed: 280 },
    overallRating: 34,
    abilitiesFocus: 'Defensive',
    image: 'https://picsum.photos/seed/de-pro-gamer-v3/400/600',
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
    image: 'https://picsum.photos/seed/carry1/400/600',
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
    image: 'https://picsum.photos/seed/mage1/400/600',
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
    image: 'https://picsum.photos/seed/jungle1/400/600',
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
    image: 'https://picsum.photos/seed/support1/400/600',
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
    image: 'https://picsum.photos/seed/sub1/400/600',
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
    image: 'https://picsum.photos/seed/sub2/400/600',
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
