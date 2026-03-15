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
    abilitiesFocus: 'Sustain',
    image: 'https://picsum.photos/seed/support1/400/600',
    description: 'Keeps the team alive and empowered.',
    price: 0
  }
];

export const SHOP_HEROES: Hero[] = [
  {
    id: 'h6',
    name: 'Frost Queen',
    role: 'Midlaner',
    baseStats: { attack: 20, defense: 30, health: 800, abilityPower: 110, speed: 300 },
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
    abilitiesFocus: 'Unstoppable',
    image: 'https://picsum.photos/seed/colossus/400/600',
    description: 'A literal mountain that moves.',
    price: 1500
  }
];