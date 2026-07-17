export type Role = 'Tank' | 'Carry' | 'Support' | 'Midlaner' | 'Jungler';

export interface Player {
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
  injuredUntil?: string | null; 
  isPro?: boolean; 
  careerEndAge?: number; 
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

const PLAYER_NAMES = [
  "Shadow", "Nova", "Cipher", "Apex", "Viper", "Echo", "Ghost", "Raptor", 
  "Titan", "Oracle", "Zenith", "Blaze", "Frost", "Static", "Wraith", 
  "Hunter", "Siren", "Falcon", "Grim", "Pulse", "Onyx", "Rogue", "Aero",
  "Blast", "Drift", "Flux", "Glint", "Haze", "Jolt", "Kite", "Lume", "Mist"
];

const FIRST_NAMES = ["James", "Robert", "John", "Michael", "David", "William", "Richard", "Joseph", "Thomas", "Charles", "Viktor", "Dmitry", "Hans", "Lee", "Chen", "Artyom"];
const LAST_NAMES = ["Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis", "Ivanov", "Petrov", "Schmidt", "Wang", "Kim", "Park", "Sokolov"];

const BOT_TEAM_NAMES = [
  "Neon Phantoms", "Cyber Guard", "Iron Titans", "Global Blitz", "Static Wraiths",
  "Delta Force", "Apex Hunters", "Void Walkers", "Cyber Synapse", "Rogue Unit"
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

export function generateVtunePlayer(seed?: string): Player {
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
    isYouth: false,
    proStats: {
      lastHitting: 8, positioning: 7, reflexes: 8, tiltResistance: 7, versatility: 6,
      mapAwareness: 3, manaManagement: 2, objectiveControl: 4, communication: 3, ganking: 4,
    },
    proTalents: {
      lastHitting: 8, positioning: 7, reflexes: 8, tiltResistance: 7, versatility: 6,
      mapAwareness: 3, manaManagement: 2, objectiveControl: 4, communication: 3, ganking: 4
    },
    xpStats: {}, moral: 70, titles: { league: 0, cup: 0, friendly: 0 }
  };
}

export function generateUniquePlayer(role: Role, index: number, isStarter: boolean = false, seed?: string, isPro: boolean = false): Player {
  const rng = seed ? new SeededRandom(seed) : undefined;
  const codes = Object.keys(COUNTRY_PHOTOS);
  const codeIdx = rng ? rng.range(0, codes.length - 1) : Math.floor(Math.random() * codes.length);
  const code = codes[codeIdx] || 'RU';
  const country = COUNTRY_PHOTOS[code] || COUNTRY_PHOTOS['RU'];
  const nameIdx = rng ? rng.range(0, PLAYER_NAMES.length - 1) : Math.floor(Math.random() * PLAYER_NAMES.length);
  const name = `${PLAYER_NAMES[nameIdx]} ${index + 1}`;
  
  const startAge = getRandomStat(isStarter ? 17 : 18, isStarter ? 28 : 32, rng);
  const playerId = seed ? `p_det_${seed}` : `player_${Date.now()}_${index}_${Math.random().toString(36).substr(2, 5)}`;

  return {
    id: playerId,
    name,
    role,
    baseStats: { attack: 30, defense: 30, health: 800, abilityPower: 30, speed: 320 },
    overallRating: isPro ? 60 : (isStarter ? 35 : 15), 
    abilitiesFocus: 'Balanced',
    image: country.url,
    description: `Уникальный талант из страны: ${country.name}.`,
    price: 0,
    baseAge: startAge,
    hiredAt: new Date().toISOString(),
    age: startAge,
    careerEndAge: isPro ? 35 : 38,
    salary: isPro ? 25000 : 2500,
    form: 90,
    fatigue: 0,
    country: { code, name: country.name, flag: country.flag },
    isInjured: false,
    isYouth: isStarter ? false : (startAge < 18),
    proStats: {
      lastHitting: getRandomStat(5, 10, rng), mapAwareness: getRandomStat(5, 10, rng),
      positioning: getRandomStat(5, 10, rng), reflexes: getRandomStat(5, 10, rng),
      manaManagement: getRandomStat(5, 10, rng), objectiveControl: getRandomStat(5, 10, rng),
      communication: getRandomStat(5, 10, rng), tiltResistance: getRandomStat(5, 10, rng),
      versatility: getRandomStat(5, 10, rng), ganking: getRandomStat(5, 10, rng),
    },
    proTalents: {
      lastHitting: getRandomStat(25, 45, rng), mapAwareness: getRandomStat(25, 45, rng),
      positioning: getRandomStat(25, 45, rng), reflexes: getRandomStat(25, 45, rng),
      manaManagement: getRandomStat(25, 45, rng), objectiveControl: getRandomStat(25, 45, rng),
      communication: getRandomStat(25, 45, rng), tiltResistance: getRandomStat(25, 45, rng),
      versatility: getRandomStat(25, 45, rng), ganking: getRandomStat(25, 45, rng),
    }
  };
}

export function generateScoutedPlayer(index: number, scoutLevel: number, seed?: string): Player {
  const rng = new SeededRandom(seed || `scout_v7_${Date.now()}_${index}`);
  const roles: Role[] = ['Tank', 'Carry', 'Midlaner', 'Jungler', 'Support'];
  const role = roles[rng.range(0, roles.length - 1)];
  const player = generateUniquePlayer(role, index, false, seed);
  player.baseAge = getRandomStat(14, 17, rng);
  player.age = player.baseAge;
  player.isYouth = true;
  return player;
}

export function generateStaffMember(role: StaffRole): StaffMember {
  const first = FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)];
  const last = LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)];
  return {
    id: `staff_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
    firstName: first,
    lastName: last,
    role,
    baseAge: Math.floor(Math.random() * 30) + 25,
    hiredAt: new Date().toISOString(),
    salary: 5000 + Math.floor(Math.random() * 10000),
    image: `https://picsum.photos/seed/${Math.random()}/200/200`,
    skills: {
      primary: 10 + Math.floor(Math.random() * 20),
      secondary: 10 + Math.floor(Math.random() * 20)
    }
  };
}

export function generateBotSquad(targetOvr: number = 10): any[] {
  const roles: Role[] = ['Carry', 'Midlaner', 'Tank', 'Jungler', 'Support'];
  const countryCodes = Object.keys(COUNTRY_PHOTOS);

  return roles.map((role, idx) => {
    const val = Math.floor(targetOvr - 3 + Math.random() * 4); 
    const nameSeed = Math.floor(Math.random() * PLAYER_NAMES.length);
    const countryIdx = Math.floor(Math.random() * countryCodes.length);
    const countryCode = countryCodes[countryIdx];
    
    const name = PLAYER_NAMES[nameSeed];
    const image = COUNTRY_PHOTOS[countryCode].url;
    
    const skillBase = Math.max(1, Math.floor(val * 0.25));

    return {
      name: name,
      role: role,
      overallRating: val,
      image: image,
      proStats: { 
        lastHitting: skillBase, 
        mapAwareness: skillBase, 
        positioning: skillBase, 
        reflexes: skillBase, 
        manaManagement: skillBase, 
        objectiveControl: skillBase, 
        communication: skillBase, 
        tiltResistance: skillBase, 
        versatility: skillBase, 
        ganking: skillBase 
      },
      isSub: false
    };
  });
}

export function getRandomBotTeamName(): string {
  return BOT_TEAM_NAMES[Math.floor(Math.random() * BOT_TEAM_NAMES.length)];
}

export function getRandomStartingSquad(): Player[] {
  const roles: Role[] = ['Tank', 'Carry', 'Midlaner', 'Jungler', 'Support', 'Carry', 'Tank'];
  return roles.map((role, i) => generateUniquePlayer(role, i, true));
}