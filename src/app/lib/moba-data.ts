
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
    if (rng) return (rng.range(0, 4) + 9) / 2; // 4.5 - 6.5
    return (Math.floor(Math.random() * 5) + 9) / 2;
  }
  if (rng) return (rng.range(0, 6) + 4) / 2; // 2.0 - 5.0
  return (Math.floor(Math.random() * 7) + 4) / 2;
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
    description: "Elite Ukrainian Carry. A legendary force on the professional circuit.",
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
      mapAwareness: rng.range(5, 6),
      positioning: rng.range(6, 7),
      reflexes: rng.range(6, 7),
      manaManagement: rng.range(5, 6),
      objectiveControl: rng.range(5, 6),
      communication: rng.range(5, 6),
      tiltResistance: rng.range(6, 7),
      versatility: rng.range(6, 7),
      ganking: rng.range(5, 6),
    },
    proTalents: {
      lastHitting: (rng.range(59, 61) / 10),
      positioning: (rng.range(53, 56) / 10),
      reflexes: (rng.range(51, 55) / 10),
      tiltResistance: (rng.range(51, 54) / 10),
      versatility: (rng.range(50, 54) / 10),
      mapAwareness: 4.5,
      manaManagement: 4.5,
      objectiveControl: 4.5,
      communication: 4.5,
      ganking: 4.5
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
    lastHitting: getRandomStat(isStarter ? 10 : 15, isStarter ? 25 : (isPro ? 45 : 35), rng),
    mapAwareness: getRandomStat(isStarter ? 10 : 15, isStarter ? 25 : (isPro ? 45 : 35), rng),
    positioning: getRandomStat(isStarter ? 10 : 15, isStarter ? 25 : (isPro ? 45 : 35), rng),
    reflexes: getRandomStat(isStarter ? 10 : 15, isStarter ? 25 : (isPro ? 45 : 35), rng),
    manaManagement: getRandomStat(isStarter ? 10 : 15, isStarter ? 25 : (isPro ? 45 : 35), rng),
    objectiveControl: getRandomStat(isStarter ? 10 : 15, isStarter ? 25 : (isPro ? 45 : 35), rng),
    communication: getRandomStat(isStarter ? 10 : 15, isStarter ? 25 : (isPro ? 45 : 35), rng),
    tiltResistance: getRandomStat(isStarter ? 10 : 15, isStarter ? 25 : (isPro ? 45 : 35), rng),
    versatility: getRandomStat(isStarter ? 10 : 15, isStarter ? 25 : (isPro ? 45 : 35), rng),
    ganking: getRandomStat(isStarter ? 10 : 15, isStarter ? 25 : (isPro ? 45 : 35), rng),
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
    description: isPro ? "An elite professional athlete with unmatched strategic potential." : `A unique talent from ${country.name}.`,
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
