'use server';
/**
 * @fileOverview Ядро симуляции матчей Lines of Enmity v3.
 * 
 * Логика:
 * 1. Расчет базовой мощи команды на основе весов ролей (Керри нужен Добив, Танку - Позиционка).
 * 2. Применение тактических модификаторов (Агрессия, Защита и т.д.).
 * 3. Симуляция событий на основе дуэлей характеристик (Ганкинг против Рефлексов).
 * 4. Учет "Тильта" в поздней игре.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const ProStatsSchema = z.object({
  lastHitting: z.number(),
  mapAwareness: z.number(),
  positioning: z.number(),
  reflexes: z.number(),
  manaManagement: z.number(),
  objectiveControl: z.number(),
  communication: z.number(),
  tiltResistance: z.number(),
  versatility: z.number(),
  ganking: z.number(),
});

const HeroStatsSchema = z.object({
  name: z.string(),
  role: z.string(),
  overallRating: z.number(),
  isPro: z.boolean().optional(),
  proStats: ProStatsSchema,
  isSub: z.boolean().optional(),
});

const TeamSchema = z.object({
  name: z.string(),
  heroes: z.array(HeroStatsSchema),
  strategy: z.string().describe('Агрессивный, Сбалансированный, Сдержанный, Быстрый_Пуш, Контр-атака'),
});

const SimulateMobaMatchInputSchema = z.object({
  teamA: TeamSchema,
  teamB: TeamSchema,
  isBo2: z.boolean().default(true),
  isBo3: z.boolean().default(false),
  scoreA: z.number().optional().describe('Принудительный счет для команды А'),
  scoreB: z.number().optional().describe('Принудительный счет для команды Б'),
});
export type SimulateMobaMatchInput = z.infer<typeof SimulateMobaMatchInputSchema>;

const GameStatsSchema = z.object({
  scoreA: z.number(),
  scoreB: z.number(),
  duration: z.string(),
  mvp: z.string(),
  matchSummary: z.string(),
  timeline: z.array(z.object({
    time: z.string(),
    event: z.string(),
    type: z.string(),
    score: z.string().optional(),
  })),
  scoreboard: z.array(z.object({
    name: z.string(),
    team: z.string(),
    role: z.string().optional(),
    kills: z.number(),
    deaths: z.number(),
    assists: z.number(),
    cs: z.number(),
    kdaRatio: z.string(),
    isPro: z.boolean().optional(),
  })),
});

const SimulateMobaMatchOutputSchema = z.object({
  winner: z.string(),
  seriesScore: z.string(),
  games: z.array(GameStatsSchema),
});
export type SimulateMobaMatchOutput = z.infer<typeof SimulateMobaMatchOutputSchema>;

// Веса навыков для каждой роли
const ROLE_WEIGHTS: Record<string, Record<keyof z.infer<typeof ProStatsSchema>, number>> = {
  'Carry': { lastHitting: 1.5, positioning: 1.2, reflexes: 1.0, manaManagement: 0.8, mapAwareness: 0.7, objectiveControl: 0.5, communication: 0.5, tiltResistance: 1.2, versatility: 0.8, ganking: 0.5 },
  'Midlaner': { lastHitting: 1.1, ganking: 1.4, reflexes: 1.3, manaManagement: 1.1, mapAwareness: 1.0, positioning: 1.0, objectiveControl: 0.7, communication: 0.8, tiltResistance: 1.0, versatility: 1.2 },
  'Tank': { positioning: 1.5, objectiveControl: 1.3, mapAwareness: 1.1, tiltResistance: 1.2, reflexes: 0.9, communication: 1.0, ganking: 1.0, versatility: 0.8, lastHitting: 0.5, manaManagement: 0.5 },
  'Jungler': { ganking: 1.6, mapAwareness: 1.4, objectiveControl: 1.2, reflexes: 1.1, positioning: 0.8, communication: 1.1, versatility: 1.0, lastHitting: 0.6, manaManagement: 0.8, tiltResistance: 0.9 },
  'Support': { communication: 1.6, mapAwareness: 1.4, positioning: 1.2, reflexes: 1.1, manaManagement: 1.0, objectiveControl: 1.1, versatility: 1.1, tiltResistance: 1.0, lastHitting: 0.3, ganking: 0.8 },
};

function calculateTeamPotential(team: z.infer<typeof TeamSchema>) {
  const activeHeroes = team.heroes.filter(h => !h.isSub).slice(0, 5);
  let power = 0;

  activeHeroes.forEach(hero => {
    const weights = ROLE_WEIGHTS[hero.role] || ROLE_WEIGHTS['Midlaner'];
    let heroPower = hero.overallRating * 0.5; // База от OVR

    // Вклад навыков с учетом ролевых весов
    Object.entries(hero.proStats).forEach(([key, val]) => {
      const weight = weights[key as keyof typeof weights] || 1.0;
      heroPower += val * weight;
    });

    if (hero.isPro) heroPower += 20; // Бонус профессионала
    power += heroPower;
  });

  // Модификаторы тактики
  const strategy = team.strategy.toLowerCase();
  let offenseMod = 1.0;
  let defenseMod = 1.0;

  if (strategy.includes('агрессивный')) { offenseMod = 1.2; defenseMod = 0.85; }
  else if (strategy.includes('сдержанный')) { offenseMod = 0.85; defenseMod = 1.2; }
  else if (strategy.includes('быстрый_пуш')) { offenseMod = 1.1; defenseMod = 1.1; }

  return { power, offenseMod, defenseMod };
}

function runSingleGame(input: SimulateMobaMatchInput, forcedWinner?: 'A' | 'B'): z.infer<typeof GameStatsSchema> {
  const { teamA, teamB } = input;
  const potA = calculateTeamPotential(teamA);
  const potB = calculateTeamPotential(teamB);

  // Шанс победы команды А
  const totalPower = potA.power + potB.power;
  const winChanceA = (potA.power / totalPower) * 100;
  
  let finalScoreA = 0;
  let finalScoreB = 0;

  if (forcedWinner === 'A') { finalScoreA = 1; }
  else if (forcedWinner === 'B') { finalScoreB = 1; }
  else {
    const roll = Math.random() * 100;
    if (roll < winChanceA) finalScoreA = 1; else finalScoreB = 1;
  }

  const durationMin = 30 + Math.floor(Math.random() * 15);
  const timeline: any[] = [];
  const playerStats = new Map<string, any>();

  const allActive = [...teamA.heroes.filter(h => !h.isSub), ...teamB.heroes.filter(h => !h.isSub)];
  allActive.forEach(h => {
    playerStats.set(h.name, { kills: 0, deaths: 0, assists: 0, cs: 0, team: teamA.heroes.includes(h) ? teamA.name : teamB.name, pro: !!h.isPro, role: h.role });
  });

  let killsA = 0, killsB = 0;

  for (let m = 1; m <= durationMin; m++) {
    const time = `${m}:00`;
    const phase = m < 15 ? 'early' : (m < 30 ? 'mid' : 'late');
    const side = Math.random() > 0.5 ? 'A' : 'B';
    const activeTeam = side === 'A' ? teamA : teamB;
    const opponentTeam = side === 'A' ? teamB : teamA;
    const activePot = side === 'A' ? potA : potB;
    const oppPot = side === 'A' ? potB : potA;

    const heroes = activeTeam.heroes.filter(h => !h.isSub);
    const oppHeroes = opponentTeam.heroes.filter(h => !h.isSub);
    const hero = heroes[Math.floor(Math.random() * heroes.length)];
    const oppHero = oppHeroes[Math.floor(Math.random() * oppHeroes.length)];

    if (!hero || !oppHero) continue;

    const roll = Math.random();

    // 1. Фарм (Early/Mid)
    if (roll < 0.4) {
      const ps = playerStats.get(hero.name);
      if (ps) {
        const farmEff = (hero.proStats.lastHitting + hero.proStats.manaManagement) / 10;
        ps.cs += Math.floor(farmEff * 5) + 5;
        if (m % 8 === 0) {
          timeline.push({ time, type: 'farm', event: `${hero.name} (${ps.team}) эффективно забирает ресурсы, используя менеджмент маны.`, score: `${killsA}:${killsB}` });
        }
      }
    }
    // 2. Ганк / Сражение
    else if (roll < 0.7) {
      const gankPower = (hero.proStats.ganking * activePot.offenseMod) + (hero.isPro ? 15 : 0);
      const escapePower = (oppHero.proStats.mapAwareness + oppHero.proStats.reflexes) * oppPot.defenseMod;

      if (escapePower > gankPower + 10 && Math.random() > 0.4) {
        if (m % 10 === 0) {
          timeline.push({ time, type: 'save', event: `${oppHero.name} читает карту и уходит от атаки ${hero.name}. Блестящие рефлексы!`, score: `${killsA}:${killsB}` });
        }
      } else {
        const ps = playerStats.get(hero.name);
        const ops = playerStats.get(oppHero.name);
        if (ps && ops) {
          ps.kills++; ops.deaths++;
          if (side === 'A') killsA++; else killsB++;
          timeline.push({ time, type: 'kill', event: `${hero.name} совершает убийство! ${oppHero.name} не успел среагировать.`, score: `${killsA}:${killsB}` });
          // Ассисты
          heroes.filter(h => h.name !== hero.name).slice(0, 2).forEach(ah => {
            const aps = playerStats.get(ah.name);
            if (aps) aps.assists++;
          });
        }
      }
    }
    // 3. Объекты (Башни/Рошан)
    else if (roll < 0.85) {
      if (m % 12 === 0) {
        const objControl = hero.proStats.objectiveControl;
        timeline.push({ time, type: 'objective', event: `${hero.name} координирует захват объекта. Контроль объектов: ${objControl}.`, score: `${killsA}:${killsB}` });
      }
    }
    // 4. Тимфайты (Late Game)
    else if (phase === 'late') {
      const teamComm = activeTeam.heroes.reduce((acc, h) => acc + h.proStats.communication, 0) / 5;
      if (m % 15 === 0) {
        timeline.push({ time, type: 'teamfight', event: `Масштабная битва! Команда ${activeTeam.name} доминирует благодаря сыгранности.`, score: `${killsA}:${killsB}` });
      }
    }

    // ТИЛЬТ (После 35 минуты)
    if (m > 35 && Math.random() > 0.85) {
      const tiltHero = Math.random() > 0.5 ? hero : oppHero;
      if (tiltHero.proStats.tiltResistance < 25) {
        timeline.push({ time, type: 'tilt', event: `${tiltHero.name} теряет концентрацию! Критическая ошибка под давлением.`, score: `${killsA}:${killsB}` });
      }
    }
  }

  const scoreboard = Array.from(playerStats.entries()).map(([name, s]) => ({
    name, team: s.team, role: s.role, kills: s.kills, deaths: s.deaths, assists: s.assists, cs: s.cs, isPro: s.pro,
    kdaRatio: ((s.kills + s.assists) / Math.max(1, s.deaths)).toFixed(2)
  }));

  return {
    scoreA: finalScoreA, scoreB: finalScoreB, duration: `${durationMin}:00`,
    mvp: scoreboard.sort((a,b) => parseFloat(b.kdaRatio) - parseFloat(a.kdaRatio))[0].name,
    matchSummary: `Матч завершился победой ${finalScoreA > finalScoreB ? teamA.name : teamB.name}. Решающим фактором стала ${phase === 'early' ? 'доминация на линиях' : 'командная тактика в лейт-гейме'}.`,
    timeline: timeline.slice(0, 30), scoreboard
  };
}

export async function simulateMobaMatch(input: SimulateMobaMatchInput): Promise<SimulateMobaMatchOutput> {
  const numGames = input.isBo3 ? 3 : (input.isBo2 ? 2 : 1);
  const games: any[] = [];
  let winsA = 0, winsB = 0;

  for (let i = 0; i < numGames; i++) {
    let forced: 'A' | 'B' | undefined = undefined;
    
    if (input.isBo2 && input.scoreA !== undefined && input.scoreB !== undefined) {
      if (input.scoreA === 2) forced = 'A';
      else if (input.scoreB === 2) forced = 'B';
      else if (input.scoreA === 1 && input.scoreB === 1) forced = i === 0 ? 'A' : 'B';
    }

    const g = runSingleGame(input, forced);
    games.push(g);
    winsA += g.scoreA;
    winsB += g.scoreB;

    if (input.isBo3 && (winsA === 2 || winsB === 2)) break;
  }

  return {
    winner: winsA > winsB ? input.teamA.name : (winsB > winsA ? input.teamB.name : "Ничья"),
    seriesScore: `${winsA}-${winsB}`,
    games
  };
}

const simulateMobaMatchFlow = ai.defineFlow(
  { name: 'simulateMobaMatchFlow', inputSchema: SimulateMobaMatchInputSchema, outputSchema: SimulateMobaMatchOutputSchema },
  async input => simulateMobaMatch(input)
);
