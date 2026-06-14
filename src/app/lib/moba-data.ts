
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

function getRandomTalent(rng?: SeededRandom, isPro: boolean = false) {
  if (isPro) {
    if (rng) return rng.range(51, 65);
    return Math.floor(Math.random() * 15) + 51;
  }
  if (rng) return rng.range(25, 50);
  return Math.floor(Math.random() * 26) + 25;
}

export function generateVtuneHero(seed?: string): Hero {
  const rng = new SeededRandom(seed || Date.now());
  const age = (rng.range(183, 189) / 10);
  const careerEnd = rng.range(30, 36);

  return {
    id: 'legend_vtune',
    name: 'V-Tune',
    role: 'Carry',
    baseStats: { attack: 45, defense: 15, health: 800, abilityPower: 20, speed: 340 },
    overallRating: 45,
    abilitiesFocus: 'Balanced',
    image: 'https://iili.io/CCLp4OF.png',
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
      lastHitting: rng.range(6, 7),
      mapAwareness: rng.range(4, 6),
      positioning: rng.range(5, 7),
      reflexes: rng.range(6, 7),
      manaManagement: rng.range(3, 5),
      objectiveControl: rng.range(5, 6),
      communication: rng.range(4, 6),
      tiltResistance: rng.range(5, 7),
      versatility: rng.range(4, 6),
      ganking: rng.range(5, 6),
    },
    proTalents: {
      lastHitting: 61, 
      positioning: 56,
      reflexes: 55,
      tiltResistance: 54,
      versatility: 52,
      // Второстепенные таланты строго 15-38
      mapAwareness: rng.range(15, 38),
      manaManagement: rng.range(15, 38),
      objectiveControl: rng.range(15, 38),
      communication: rng.range(15, 38),
      ganking: rng.range(15, 38)
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

  const proStats = {
    lastHitting: getRandomStat(isStarter ? 5 : 8, isStarter ? 12 : 15, rng),
    mapAwareness: getRandomStat(isStarter ? 5 : 8, isStarter ? 12 : 15, rng),
    positioning: getRandomStat(isStarter ? 5 : 8, isStarter ? 12 : 15, rng),
    reflexes: getRandomStat(isStarter ? 5 : 8, isStarter ? 12 : 15, rng),
    manaManagement: getRandomStat(isStarter ? 5 : 8, isStarter ? 12 : 15, rng),
    objectiveControl: getRandomStat(isStarter ? 5 : 8, isStarter ? 12 : 15, rng),
    communication: getRandomStat(isStarter ? 5 : 8, isStarter ? 12 : 15, rng),
    tiltResistance: getRandomStat(isStarter ? 5 : 8, isStarter ? 12 : 15, rng),
    versatility: getRandomStat(isStarter ? 5 : 8, isStarter ? 12 : 15, rng),
    ganking: getRandomStat(isStarter ? 5 : 8, isStarter ? 12 : 15, rng),
  };

  const proTalents = {
    lastHitting: getRandomTalent(rng, isPro),
    mapAwareness: getRandomTalent(rng, isPro),
    positioning: getRandomTalent(rng, isPro),
    reflexes: getRandomTalent(rng, isPro),
    manaManagement: getRandomTalent(rng, isPro),
    objectiveControl: getRandomTalent(rng, isPro),
    communication: getRandomTalent(rng, isPro),
    tiltResistance: getRandomTalent(rng, isPro),
    versatility: getRandomTalent(rng, isPro),
    ganking: getRandomTalent(rng, isPro),
  };

  const startAge = getRandomStat(isStarter ? 17 : 18, isStarter ? 28 : 32, rng);
  const heroId = seed ? `h_det_${seed}` : `hero_${Date.now()}_${index}_${Math.random().toString(36).substr(2, 5)}`;

  return {
    id: heroId,
    name,
    role,
    baseStats,
    overallRating: isPro ? 45 : 25, 
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

export function generateBotSquad(targetOvr: number = 25): any[] {
  const roles: Role[] = ['Carry', 'Midlaner', 'Tank', 'Jungler', 'Support'];
  return roles.map((role, i) => {
    const stats = {
      lastHitting: targetOvr,
      mapAwareness: targetOvr,
      positioning: targetOvr,
      reflexes: targetOvr,
      manaManagement: targetOvr,
      objectiveControl: targetOvr,
      communication: targetOvr,
      tiltResistance: targetOvr,
      versatility: targetOvr,
      ganking: targetOvr
    };
    return {
      name: `${role} AI ${i + 1}`,
      role: role,
      overallRating: targetOvr,
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
    mapAwareness: rng?.range(20, 45) || 30,
    positioning: rng?.range(20, 45) || 30,
    reflexes: rng?.range(20, 45) || 30,
    manaManagement: rng?.range(20, 45) || 30,
    objectiveControl: rng?.range(20, 45) || 30,
    communication: rng?.range(20, 45) || 30,
    tiltResistance: rng?.range(20, 45) || 30,
    versatility: rng?.range(20, 45) || 30,
    ganking: rng?.range(20, 45) || 30,
  };
  
  hero.proStats = {
    lastHitting: getRandomStat(5, 12, rng),
    mapAwareness: getRandomStat(5, 12, rng),
    positioning: getRandomStat(5, 12, rng),
    reflexes: getRandomStat(5, 12, rng),
    manaManagement: getRandomStat(5, 12, rng),
    objectiveControl: getRandomStat(5, 12, rng),
    communication: getRandomStat(5, 12, rng),
    tiltResistance: getRandomStat(5, 12, rng),
    versatility: getRandomStat(5, 12, rng),
    ganking: getRandomStat(5, 12, rng),
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
