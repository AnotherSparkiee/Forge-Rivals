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
}

export const INITIAL_HEROES: Hero[] = [
  {
    id: 'h1',
    name: 'Ironclad Bastion',
    role: 'Tank',
    baseStats: { attack: 40, defense: 90, health: 1500, abilityPower: 10, speed: 280 },
    overallRating: 34,
    abilitiesFocus: 'Defensive',
    image: 'https://picsum.photos/seed/tank1/400/600',
    description: 'An unbreakable shield on the battlefield.',
    price: 0
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
    price: 0
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
    price: 0
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
    price: 0
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
    price: 0
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
    price: 0
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
    price: 0
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
    price: 1000
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
    price: 1500
  }
];
