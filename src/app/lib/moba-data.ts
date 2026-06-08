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
  baseAge: number; 
  hiredAt: string; 
  age: number; 
  salary: number;
  form: number; 
  fatigue: number; 
  country: { code: string; name: string; flag: string };
  isInjured: boolean;
  trainingFocus?: string | null;
  dailyTrainingFocus?: string | null;
  dailyTrainingFinishTime?: string | null;
  onTransferUntil?: string | null; 
  transferMarketId?: string | null; 
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

export type StaffRole = 'coach' | 'analyst' | 'scout' | 'doctor' | 'financier';

export interface StaffMember {
  id: string;
  firstName: string;
  lastName: string;
  role: StaffRole;
  baseAge: number;
  hiredAt: string;
  salary: number;
  image: string;
  skills: {
    primary: number;   
    secondary: number; 
  };
}

const COUNTRY_PHOTOS: Record<string, { flag: string, name: string, url: string }> = {
  'DE': { flag: '🇩🇪', name: 'Германия', url: 'https://i.postimg.cc/PPS3QFFM/de-1.jpg' },
  'CN': { flag: '🇨🇳', name: 'Китай', url: 'https://i.postimg.cc/wvzKxSYS/1755011442109.jpg' },
  'RU': { flag: '🇷🇺', name: 'Россия', url: 'https://i.postimg.cc/mg3yfqj5/rus-2.jpg' },
  'UA': { flag: '🇺🇦', name: 'Украина', url: 'https://i.postimg.cc/X7fs4pYn/ua-1.jpg' },
  'KR': { flag: '🇰🇷', name: 'Южная Корея', url: 'https://i.postimg.cc/43mv7dsH/kr-1.jpg' },
  'BR': { flag: '🇧🇷', name: 'Бразилия', url: 'https://i.postimg.cc/Z5906yvS/br-1.jpg' },
  'TR': { flag: '🇹🇷', name: 'Турция', url: 'https://i.postimg.cc/MHvbRpyd/tr-1.jpg' }
};

const HERO_NAMES = [
  "Shadow", "Nova", "Cipher", "Apex", "Viper", "Echo", "Ghost", "Raptor", 
  "Titan", "Oracle", "Zenith", "Blaze", "Frost", "Static", "Wraith", 
  "Hunter", "Siren", "Falcon", "Grim", "Pulse", "Onyx", "Rogue", "Aero",
  "Blast", "Drift", "Flux", "Glint", "Haze", "Jolt", "Kite", "Lume", "Mist"
];

const FIRST_NAMES = ["James", "Robert", "John", "Michael", "David", "William", "Richard", "Joseph", "Thomas", "Charles", "Viktor", "Dmitry", "Hans", "Lee", "Chen", "Artyom"];
const LAST_NAMES = ["Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis", "Ivanov", "Petrov", "Schmidt", "Wang", "Kim", "Park", "Sokolov"];

class SeededRandom {
  private seed: number;
  constructor(seed: string | number) {
    if (typeof seed === 'string') {
      let hash = 0;
      for (let i = 0; i < seed.length; i++) {
        hash = ((hash << 5) - hash) + seed.charCodeAt(i);
        hash = hash & hash;
      }
      this.seed = Math.abs(hash);
    } else {
      this.seed = Math.abs(seed);
    }
  }
  next() {
    this.seed = (this.seed * 9301 + 49297) % 233280;
    return this.seed / 233280;
  }
  range(min: number, max: number) {
    const val = this.next();
    return Math.floor(val * (max - min + 1)) + min;
  }
}

function getRandomStat(min: number, max: number, rng?: SeededRandom) {
  if (rng) return rng.range(min, max);
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getRandomTalent(rng?: SeededRandom) {
  if (rng) return (rng.range(0, 6) + 4) / 2;
  return (Math.floor(Math.random() * 7) + 4) / 2;
}

export function generateUniqueHero(role: Role, index: number, isStarter: boolean = false, seed?: string): Hero {
  const rng = seed ? new SeededRandom(seed) : undefined;
  
  const codes = Object.keys(COUNTRY_PHOTOS);
  const codeIdx = rng ? rng.range(0, codes.length - 1) : Math.floor(Math.random() * codes.length);
  const code = codes[codeIdx] || 'RU';
  const country = COUNTRY_PHOTOS[code] || COUNTRY_PHOTOS['RU'];
  
  const nameIdx = rng ? rng.range(0, HERO_NAMES.length - 1) : Math.floor(Math.random() * HERO_NAMES.length);
  const name = `${HERO_NAMES[nameIdx]} ${index + 1}`;
  
  const baseStats = {
    attack: role === 'Carry' || role === 'Jungler' 
      ? getRandomStat(isStarter ? 55 : 70, isStarter ? 75 : 95, rng) 
      : getRandomStat(isStarter ? 15 : 20, isStarter ? 35 : 50, rng),
    defense: role === 'Tank' 
      ? getRandomStat(isStarter ? 65 : 80, isStarter ? 85 : 100, rng) 
      : getRandomStat(isStarter ? 15 : 20, isStarter ? 35 : 50, rng),
    health: role === 'Tank' 
      ? getRandomStat(isStarter ? 1100 : 1400, isStarter ? 1400 : 1800, rng) 
      : getRandomStat(isStarter ? 600 : 700, isStarter ? 850 : 1000, rng),
    abilityPower: role === 'Midlaner' || role === 'Support' 
      ? getRandomStat(isStarter ? 55 : 60, isStarter ? 85 : 110, rng) 
      : getRandomStat(0, 30, rng),
    speed: getRandomStat(250, 360, rng)
  };

  const proStats = {
    lastHitting: getRandomStat(isStarter ? 35 : 40, isStarter ? 65 : 98, rng),
    mapAwareness: getRandomStat(isStarter ? 35 : 40, isStarter ? 65 : 98, rng),
    positioning: getRandomStat(isStarter ? 35 : 40, isStarter ? 65 : 98, rng),
    reflexes: getRandomStat(isStarter ? 35 : 40, isStarter ? 65 : 98, rng),
    manaManagement: getRandomStat(isStarter ? 35 : 40, isStarter ? 65 : 98, rng),
    objectiveControl: getRandomStat(isStarter ? 35 : 40, isStarter ? 65 : 98, rng),
    communication: getRandomStat(isStarter ? 35 : 40, isStarter ? 65 : 98, rng),
    tiltResistance: getRandomStat(isStarter ? 35 : 40, isStarter ? 65 : 98, rng),
    versatility: getRandomStat(isStarter ? 35 : 40, isStarter ? 65 : 98, rng),
    ganking: getRandomStat(isStarter ? 35 : 40, isStarter ? 65 : 98, rng),
  };

  const proTalents = {
    lastHitting: getRandomTalent(rng),
    mapAwareness: getRandomTalent(rng),
    positioning: getRandomTalent(rng),
    reflexes: getRandomTalent(rng),
    manaManagement: getRandomTalent(rng),
    objectiveControl: getRandomTalent(rng),
    communication: getRandomTalent(rng),
    tiltResistance: getRandomTalent(rng),
    versatility: getRandomTalent(rng),
    ganking: getRandomTalent(rng),
  };

  const proSum = Object.values(proStats).reduce((a, b) => a + b, 0);
  const basePower = (baseStats.attack + (baseStats.defense / 2) + (baseStats.abilityPower / 2)) / 5;
  const overall = Math.round((proSum / 10) * 0.4 + basePower * 0.6);

  const startAge = getRandomStat(isStarter ? 17 : 18, isStarter ? 28 : 32, rng);
  const heroId = seed ? `h_det_${seed}` : `hero_${Date.now()}_${index}_${Math.random().toString(36).substr(2, 5)}`;

  return {
    id: heroId,
    name,
    role,
    baseStats,
    overallRating: isStarter ? Math.min(38, Math.max(29, overall)) : overall,
    abilitiesFocus: 'Balanced',
    image: country.url,
    description: `A unique talent from ${country.name}.`,
    price: 0,
    baseAge: startAge,
    hiredAt: new Date().toISOString(),
    age: startAge,
    salary: getRandomStat(2000, 8000, rng),
    form: getRandomStat(70, 95, rng),
    fatigue: 0,
    country: { code: code, name: country.name, flag: country.flag },
    isInjured: false,
    trainingFocus: null,
    dailyTrainingFocus: null,
    dailyTrainingFinishTime: null,
    onTransferUntil: null,
    transferMarketId: null,
    proStats,
    proTalents
  };
}

export function generateYouthHero(index: number, seed?: string): Hero {
  const rng = seed ? new SeededRandom(seed) : undefined;
  const roles: Role[] = ['Tank', 'Carry', 'Midlaner', 'Jungler', 'Support'];
  const role = roles[rng ? rng.range(0, roles.length - 1) : Math.floor(Math.random() * roles.length)];
  const hero = generateUniqueHero(role, index, false, seed);
  
  const startAge = getRandomStat(14, 17, rng);
  hero.baseAge = startAge;
  hero.age = startAge;
  hero.hiredAt = new Date().toISOString();
  
  hero.overallRating = getRandomStat(15, 25, rng);
  hero.salary = getRandomStat(500, 1500, rng);
  
  hero.proTalents = {
    lastHitting: getRandomTalent(rng) + 0.5,
    mapAwareness: getRandomTalent(rng) + 0.5,
    positioning: getRandomTalent(rng) + 0.5,
    reflexes: getRandomTalent(rng) + 0.5,
    manaManagement: getRandomTalent(rng) + 0.5,
    objectiveControl: getRandomTalent(rng) + 0.5,
    communication: getRandomTalent(rng) + 0.5,
    tiltResistance: getRandomTalent(rng) + 0.5,
    versatility: getRandomTalent(rng) + 0.5,
    ganking: getRandomTalent(rng) + 0.5,
  };
  
  hero.proStats = {
    lastHitting: getRandomStat(10, 30, rng),
    mapAwareness: getRandomStat(10, 30, rng),
    positioning: getRandomStat(10, 30, rng),
    reflexes: getRandomStat(10, 30, rng),
    manaManagement: getRandomStat(10, 30, rng),
    objectiveControl: getRandomStat(10, 30, rng),
    communication: getRandomStat(10, 30, rng),
    tiltResistance: getRandomStat(10, 30, rng),
    versatility: getRandomStat(10, 30, rng),
    ganking: getRandomStat(10, 30, rng),
  };

  return hero;
}

export function generateStaffMember(role: StaffRole): StaffMember {
  const startAge = getRandomStat(32, 60);
  const firstName = FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)];
  const lastName = LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)];
  
  return {
    id: `staff_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
    firstName,
    lastName,
    role,
    baseAge: startAge,
    hiredAt: new Date().toISOString(),
    salary: getRandomStat(15000, 45000),
    image: `https://picsum.photos/seed/${Math.random()}/200/200`,
    skills: {
      primary: getRandomStat(10, 45),
      secondary: getRandomStat(10, 45)
    }
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
    baseAge: 24,
    hiredAt: "2024-01-01T00:00:00.000Z",
    age: 24,
    salary: 4500,
    form: 85,
    fatigue: 12,
    country: { code: 'DE', name: 'Германия', flag: '🇩🇪' },
    isInjured: false,
    trainingFocus: null,
    dailyTrainingFocus: null,
    dailyTrainingFinishTime: null,
    onTransferUntil: null,
    transferMarketId: null,
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
    baseAge: 19,
    hiredAt: "2024-01-01T00:00:00.000Z",
    age: 19,
    salary: 8200,
    form: 92,
    fatigue: 25,
    country: { code: 'KR', name: 'Южная Корея', flag: '🇰🇷' },
    isInjured: false,
    trainingFocus: null,
    dailyTrainingFocus: null,
    dailyTrainingFinishTime: null,
    onTransferUntil: null,
    transferMarketId: null,
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