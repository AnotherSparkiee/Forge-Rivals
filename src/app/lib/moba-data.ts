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
  isPro?: boolean; 
  careerEndAge?: number; // Age when player retires (30-36)
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
  xpStats?: Record<string, number>; 
  matchesPlayedToday?: number; 
  lastMatchDateXP?: string; 
  totalMatchesPlayed?: number; 
  moral?: number; 
  titles?: {
    league: number;
    cup: number;
    friendly: number;
  };
  isYouth?: boolean;
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
  'TR': { flag: 'Турция', name: 'Турция', url: 'https://i.postimg.cc/MHvbRpyd/tr-1.jpg' }
};

const HERO_NAMES = [
  "Shadow", "Nova", "Cipher", "Apex", "Viper", "Echo", "Ghost", "Raptor", 
  "Titan", "Oracle", "Zenith", "Blaze", "Frost", "Static", "Wraith", 
  "Hunter", "Siren", "Falcon", "Grim", "Pulse", "Onyx", "Rogue", "Aero",
  "Blast", "Drift", "Flux", "Glint", "Haze", "Jolt", "Kite", "Lume", "Mist"
];

const FIRST_NAMES = ["James", "Robert", "John", "Michael", "David", "William", "Richard", "Joseph", "Thomas", "Charles", "Viktor", "Dmitry", "Hans", "Lee", "Chen", "Artyom"];
const LAST_NAMES = ["Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis", "Ivanov", "Petrov", "Schmidt", "Wang", "Kim", "Park", "Sokolov"];

const ROLE_CORE_SKILLS: Record<string, string[]> = {
  'Carry': ['lastHitting', 'positioning', 'reflexes', 'tiltResistance', 'versatility'],
  'Midlaner': ['reflexes', 'lastHitting', 'ganking', 'positioning', 'tiltResistance'],
  'Tank': ['objectiveControl', 'positioning', 'ganking', 'tiltResistance', 'versatility'],
  'Jungler': ['ganking', 'objectiveControl', 'reflexes', 'communication', 'versatility'],
  'Support': ['communication', 'reflexes', 'positioning', 'objectiveControl', 'tiltResistance']
};

const ALL_SKILL_KEYS = [
  'lastHitting', 'mapAwareness', 'positioning', 'reflexes', 
  'manaManagement', 'objectiveControl', 'communication', 
  'tiltResistance', 'versatility', 'ganking'
];

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

export function generateVtuneHero(seed?: string): Hero {
  const rng = new SeededRandom(seed || Date.now());
  const age = (rng.range(183, 189) / 10);
  const careerEnd = rng.range(30, 36);

  return {
    id: 'legend_vtune',
    name: 'V-Tune',
    role: 'Carry',
    baseStats: { attack: 15, defense: 5, health: 600, abilityPower: 10, speed: 320 },
    overallRating: 60,
    abilitiesFocus: 'Balanced',
    image: 'https://iili.io/CnasKk7.md.jpg',
    description: "Элитный украинский Керри. Легендарная сила на профессиональной арене.",
    price: 0,
    baseAge: age,
    hiredAt: new Date().toISOString(),
    age: age,
    careerEndAge: careerEnd,
    salary: 45000,
    form: 95,
    fatigue: 0,
    country: { code: 'UA', name: 'Украина', flag: '🇺🇦' },
    isInjured: false,
    isPro: true,
    proStats: {
      lastHitting: 8,
      positioning: 7,
      reflexes: 8,
      tiltResistance: 7,
      versatility: 6,
      mapAwareness: 3,
      manaManagement: 2,
      objectiveControl: 4,
      communication: 3,
      ganking: 4,
    },
    proTalents: {
      lastHitting: 8, 
      positioning: 7,
      reflexes: 8,
      tiltResistance: 7,
      versatility: 6,
      mapAwareness: 3,
      manaManagement: 2,
      objectiveControl: 4,
      communication: 3,
      ganking: 4
    },
    xpStats: {},
    matchesPlayedToday: 0,
    totalMatchesPlayed: 0,
    moral: 70,
    titles: { league: 0, cup: 0, friendly: 0 }
  };
}

export function generateUniqueHero(role: Role, index: number, isStarter: boolean = false, seed?: string, isPro: boolean = false): Hero {
  const rng = seed ? new SeededRandom(seed) : undefined;
  
  const codes = Object.keys(COUNTRY_PHOTOS);
  const codeIdx = rng ? rng.range(0, codes.length - 1) : Math.floor(Math.random() * codes.length);
  const code = codes[codeIdx] || 'RU';
  const country = COUNTRY_PHOTOS[code] || COUNTRY_PHOTOS['RU'];
  
  const nameIdx = rng ? rng.range(0, HERO_NAMES.length - 1) : Math.floor(Math.random() * HERO_NAMES.length);
  const name = `${HERO_NAMES[nameIdx]} ${index + 1}`;
  
  const baseStats = {
    attack: role === 'Carry' || role === 'Jungler' 
      ? getRandomStat(isStarter ? 25 : 30, isStarter ? 35 : 45, rng) 
      : getRandomStat(isStarter ? 5 : 10, isStarter ? 15 : 25, rng),
    defense: role === 'Tank' 
      ? getRandomStat(isStarter ? 30 : 40, isStarter ? 40 : 50, rng) 
      : getRandomStat(isStarter ? 5 : 10, isStarter ? 15 : 25, rng),
    health: role === 'Tank' 
      ? getRandomStat(isStarter ? 900 : 1100, isStarter ? 1100 : 1400, rng) 
      : getRandomStat(isStarter ? 500 : 600, isStarter ? 700 : 850, rng),
    abilityPower: role === 'Midlaner' || role === 'Support' 
      ? getRandomStat(isStarter ? 25 : 30, isStarter ? 40 : 50, rng) 
      : getRandomStat(0, 15, rng),
    speed: getRandomStat(250, 360, rng)
  };

  const startAge = getRandomStat(isStarter ? 17 : 18, isStarter ? 28 : 32, rng);
  const heroId = seed ? `h_det_${seed}` : `hero_${Date.now()}_${index}_${Math.random().toString(36).substr(2, 5)}`;

  const proStats = {
    lastHitting: isPro ? getRandomStat(6, 8, rng) : getRandomStat(isStarter ? 6 : 5, isStarter ? 8 : 15, rng),
    mapAwareness: isPro ? getRandomStat(1, 4, rng) : getRandomStat(isStarter ? 1 : 5, isStarter ? 4 : 15, rng),
    positioning: isPro ? getRandomStat(6, 8, rng) : getRandomStat(isStarter ? 6 : 5, isStarter ? 8 : 15, rng),
    reflexes: isPro ? getRandomStat(6, 8, rng) : getRandomStat(isStarter ? 6 : 5, isStarter ? 8 : 15, rng),
    manaManagement: isPro ? getRandomStat(1, 4, rng) : getRandomStat(isStarter ? 1 : 5, isStarter ? 4 : 15, rng),
    objectiveControl: isPro ? getRandomStat(1, 4, rng) : getRandomStat(isStarter ? 1 : 5, isStarter ? 4 : 15, rng),
    communication: isPro ? getRandomStat(1, 4, rng) : getRandomStat(isStarter ? 1 : 5, isStarter ? 4 : 15, rng),
    tiltResistance: isPro ? getRandomStat(6, 8, rng) : getRandomStat(isStarter ? 6 : 5, isStarter ? 8 : 15, rng),
    versatility: isPro ? getRandomStat(1, 4, rng) : getRandomStat(isStarter ? 1 : 5, isStarter ? 4 : 15, rng),
    ganking: isPro ? getRandomStat(1, 4, rng) : getRandomStat(isStarter ? 1 : 5, isStarter ? 4 : 15, rng),
  };

  const proTalents = {
    lastHitting: isPro ? getRandomStat(6, 8, rng) : getRandomStat(isStarter ? 6 : 5, isStarter ? 8 : 15, rng),
    mapAwareness: isPro ? getRandomStat(1, 4, rng) : getRandomStat(isStarter ? 1 : 5, isStarter ? 4 : 15, rng),
    positioning: isPro ? getRandomStat(6, 8, rng) : getRandomStat(isStarter ? 6 : 5, isStarter ? 8 : 15, rng),
    reflexes: isPro ? getRandomStat(6, 8, rng) : getRandomStat(isStarter ? 6 : 5, isStarter ? 8 : 15, rng),
    manaManagement: isPro ? getRandomStat(1, 4, rng) : getRandomStat(isStarter ? 1 : 5, isStarter ? 4 : 15, rng),
    objectiveControl: isPro ? getRandomStat(1, 4, rng) : getRandomStat(isStarter ? 1 : 5, isStarter ? 4 : 15, rng),
    communication: isPro ? getRandomStat(1, 4, rng) : getRandomStat(isStarter ? 1 : 5, isStarter ? 4 : 15, rng),
    tiltResistance: isPro ? getRandomStat(6, 8, rng) : getRandomStat(isStarter ? 6 : 5, isStarter ? 8 : 15, rng),
    versatility: isPro ? getRandomStat(1, 4, rng) : getRandomStat(isStarter ? 1 : 5, isStarter ? 4 : 15, rng),
    ganking: isPro ? getRandomStat(1, 4, rng) : getRandomStat(isStarter ? 1 : 5, isStarter ? 4 : 15, rng),
  };

  return {
    id: heroId,
    name,
    role,
    baseStats,
    overallRating: isPro ? 60 : (isStarter ? 35 : 15), 
    abilitiesFocus: 'Balanced',
    image: country.url,
    description: isPro ? "Элитный профессиональный атлет с непревзойденным стратегическим потенциалом." : `Уникальный талант из страны: ${country.name}.`,
    price: 0,
    baseAge: startAge,
    hiredAt: new Date().toISOString(),
    age: startAge,
    careerEndAge: isPro ? getRandomStat(30, 36, rng) : 38,
    salary: isPro ? getRandomStat(15000, 35000, rng) : getRandomStat(1500, 5000, rng),
    form: getRandomStat(70, 95, rng),
    fatigue: 0,
    country: { code: code, name: country.name, flag: country.flag },
    isInjured: false,
    isPro: isPro,
    trainingFocus: null,
    dailyTrainingFocus: null,
    dailyTrainingFinishTime: null,
    onTransferUntil: null,
    transferMarketId: null,
    proStats,
    proTalents,
    xpStats: {},
    matchesPlayedToday: 0,
    totalMatchesPlayed: 0,
    moral: 50,
    titles: { league: 0, cup: 0, friendly: 0 }
  };
}

/**
 * Advanced Scouting Logic v7 (Tiered Distribution).
 * Implements the requested tiered talent distribution:
 * Peak Tier (1 skill) -> up to 99
 * High Tier (1 skill) -> 80+
 * Mid Tier (1 skill) -> 50+
 * Low Tier (others) -> 10-27
 */
export function generateScoutedHero(index: number, scoutLevel: number, seed?: string): Hero {
  const rng = new SeededRandom(seed || `scout_v7_${Date.now()}_${index}`);
  const roles: Role[] = ['Tank', 'Carry', 'Midlaner', 'Jungler', 'Support'];
  const role = roles[rng.range(0, roles.length - 1)];
  const hero = generateUniqueHero(role, index, false, seed);
  
  const startAge = getRandomStat(14, 17, rng);
  hero.baseAge = startAge;
  hero.age = startAge;
  hero.hiredAt = new Date().toISOString();
  hero.overallRating = getRandomStat(10, 20, rng);
  hero.salary = getRandomStat(300, 1200, rng);

  // Global Lucky Roll (Monthly Random Super Talent)
  const isMonthlyLucky = rng.next() < 0.0005; 

  let maxPeak = 35;

  if (scoutLevel <= 25) {
    maxPeak = 40;
  } else if (scoutLevel <= 50) {
    maxPeak = 55; 
  } else if (scoutLevel <= 80) {
    maxPeak = 70; 
  } else if (scoutLevel <= 100) {
    maxPeak = 85; 
  } else {
    maxPeak = 95; 
  }

  // Elite Chance for 125+
  if (scoutLevel > 125 && rng.next() < 0.01) {
    maxPeak = 99; 
  }

  // Override for monthly lucky
  if (isMonthlyLucky) {
    maxPeak = 99;
  }

  const finalPeak = rng.range(Math.max(5, maxPeak - 15), maxPeak);

  // TIERED DISTRIBUTION LOGIC
  const coreSkills = [...ROLE_CORE_SKILLS[role]];
  const allSkills = [...ALL_SKILL_KEYS];
  const proTalents: any = {};

  // 1. Peak Tier (1 core skill)
  const peakIdx = rng.range(0, coreSkills.length - 1);
  const peakSkill = coreSkills.splice(peakIdx, 1)[0];
  proTalents[peakSkill] = finalPeak;

  // 2. High Tier (1 core skill) - 80+ if finalPeak is high
  const highIdx = rng.range(0, coreSkills.length - 1);
  const highSkill = coreSkills.splice(highIdx, 1)[0];
  if (finalPeak >= 70) {
    proTalents[highSkill] = rng.range(80, Math.min(95, finalPeak - 2));
  } else {
    proTalents[highSkill] = Math.floor(finalPeak * (0.6 + rng.next() * 0.2));
  }

  // 3. Mid Tier (1 skill from remaining core or secondary) - 50+ if finalPeak high
  const combinedRemaining = [...coreSkills, ...allSkills.filter(s => !ROLE_CORE_SKILLS[role].includes(s))];
  const midIdx = rng.range(0, combinedRemaining.length - 1);
  const midSkill = combinedRemaining.splice(midIdx, 1)[0];
  if (finalPeak >= 70) {
    proTalents[midSkill] = rng.range(50, 65);
  } else {
    proTalents[midSkill] = Math.floor(finalPeak * (0.3 + rng.next() * 0.2));
  }

  // 4. Low Tier (All others) - 10-27 as requested
  allSkills.forEach(skill => {
    if (!proTalents[skill]) {
      proTalents[skill] = rng.range(10, 27);
    }
  });

  hero.proTalents = proTalents;
  
  hero.proStats = {
    lastHitting: getRandomStat(1, 4, rng),
    mapAwareness: getRandomStat(1, 4, rng),
    positioning: getRandomStat(1, 4, rng),
    reflexes: getRandomStat(1, 4, rng),
    manaManagement: getRandomStat(1, 4, rng),
    objectiveControl: getRandomStat(1, 4, rng),
    communication: getRandomStat(1, 4, rng),
    tiltResistance: getRandomStat(1, 4, rng),
    versatility: getRandomStat(1, 4, rng),
    ganking: getRandomStat(1, 4, rng),
  };

  return hero;
}

export function generateBotSquad(targetOvr: number = 22): any[] {
  const roles: Role[] = ['Carry', 'Midlaner', 'Tank', 'Jungler', 'Support'];
  return roles.map((role) => {
    const val = Math.floor(20 + Math.random() * 6); // 20-25 Range
    const stats = {
      lastHitting: val,
      mapAwareness: val,
      positioning: val,
      reflexes: val,
      manaManagement: val,
      objectiveControl: val,
      communication: val,
      tiltResistance: val,
      versatility: val,
      ganking: val
    };
    return {
      name: `${role} Unit`,
      role: role,
      overallRating: val,
      proStats: stats,
      isSub: false
    };
  });
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
  
  hero.overallRating = getRandomStat(12, 18, rng);
  hero.salary = getRandomStat(300, 1000, rng);
  
  hero.proTalents = {
    lastHitting: rng?.range(30, 60) || 45,
    mapAwareness: rng?.range(18, 37) || 30,
    positioning: rng?.range(18, 37) || 30,
    reflexes: rng?.range(18, 37) || 30,
    manaManagement: rng?.range(18, 37) || 30,
    objectiveControl: rng?.range(18, 37) || 30,
    communication: rng?.range(18, 37) || 30,
    tiltResistance: rng?.range(18, 37) || 30,
    versatility: rng?.range(18, 37) || 30,
    ganking: rng?.range(18, 37) || 30,
  };
  
  hero.proStats = {
    lastHitting: getRandomStat(1, 4, rng),
    mapAwareness: getRandomStat(1, 4, rng),
    positioning: getRandomStat(1, 4, rng),
    reflexes: getRandomStat(1, 4, rng),
    manaManagement: getRandomStat(1, 4, rng),
    objectiveControl: getRandomStat(1, 4, rng),
    communication: getRandomStat(1, 4, rng),
    tiltResistance: getRandomStat(1, 4, rng),
    versatility: getRandomStat(1, 4, rng),
    ganking: getRandomStat(1, 4, rng),
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

export const INITIAL_HEROES: Hero[] = [];
