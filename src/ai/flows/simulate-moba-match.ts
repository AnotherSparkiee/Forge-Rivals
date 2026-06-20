'use server';
/**
 * @fileOverview Ядро симуляции матчей Lines of Enmity v3.
 * 
 * Логика:
 * 1. Расчет базовой мощи команды на основе весов ролей.
 * 2. Применение тактических модификаторов.
 * 3. Симуляция событий на основе дуэлей характеристик.
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
  image: z.string().optional(),
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
    image: z.string().optional(),
    kills: z.number(),
    deaths: z.number(),
    assists: z.number(),
    cs: z.number(),
    kdaRatio: z.string(),
    isPro: z.boolean().optional(),
  })),
  teamComparison: z.object({
    farm: z.array(z.number()),
    tactics: z.array(z.number()),
    teamwork: z.array(z.number()),
    reflexes: z.array(z.number()),
  }).optional(),
});

const SimulateMobaMatchOutputSchema = z.object({
  winner: z.string(),
  seriesScore: z.string(),
  games: z.array(GameStatsSchema),
});
export type SimulateMobaMatchOutput = z.infer<typeof SimulateMobaMatchOutputSchema>;

const ROLE_WEIGHTS: Record<string, Record<keyof z.infer<typeof ProStatsSchema>, number>> = {
  'Carry': { lastHitting: 2.0, positioning: 1.5, reflexes: 1.2, manaManagement: 1.0, tiltResistance: 1.5, mapAwareness: 0.5, objectiveControl: 0.5, communication: 0.5, versatility: 0.8, ganking: 0.5 },
  'Midlaner': { reflexes: 1.8, ganking: 1.6, lastHitting: 1.3, manaManagement: 1.2, versatility: 1.2, mapAwareness: 1.0, positioning: 1.0, objectiveControl: 0.7, communication: 0.8, tiltResistance: 1.0 },
  'Tank': { positioning: 1.8, objectiveControl: 1.5, mapAwareness: 1.2, tiltResistance: 1.4, reflexes: 0.9, communication: 1.0, ganking: 1.0, versatility: 0.8, lastHitting: 0.5, manaManagement: 0.5 },
  'Jungler': { ganking: 2.0, mapAwareness: 1.6, objectiveControl: 1.4, reflexes: 1.2, positioning: 0.8, communication: 1.1, versatility: 1.0, lastHitting: 0.6, manaManagement: 0.8, tiltResistance: 0.9 },
  'Support': { communication: 2.0, mapAwareness: 1.6, positioning: 1.4, reflexes: 1.1, manaManagement: 1.1, objectiveControl: 1.1, versatility: 1.1, tiltResistance: 1.0, lastHitting: 0.3, ganking: 0.8 },
};

function calculateTeamPotential(team: z.infer<typeof TeamSchema>) {
  const activeHeroes = team.heroes.filter(h => !h.isSub).slice(0, 5);
  let power = 0;
  
  const stats = { farm: 0, tactics: 0, teamwork: 0, reflexes: 0 };

  if (activeHeroes.length === 0) return { power: 100, stats };

  activeHeroes.forEach(hero => {
    const weights = ROLE_WEIGHTS[hero.role] || ROLE_WEIGHTS['Midlaner'];
    let heroPower = Number(hero.overallRating || 0) * 0.5;

    Object.entries(hero.proStats).forEach(([key, val]) => {
      const weight = weights[key as keyof typeof weights] || 1.0;
      heroPower += Number(val || 0) * weight;
    });

    if (hero.isPro) heroPower *= 1.15;
    power += heroPower;

    stats.farm += (hero.proStats.lastHitting + hero.proStats.manaManagement) / 2;
    stats.tactics += (hero.proStats.mapAwareness + hero.proStats.objectiveControl) / 2;
    stats.teamwork += (hero.proStats.communication + hero.proStats.versatility) / 2;
    stats.reflexes += (hero.proStats.reflexes + hero.proStats.ganking) / 2;
  });

  stats.farm = Math.round(stats.farm / 5);
  stats.tactics = Math.round(stats.tactics / 5);
  stats.teamwork = Math.round(stats.teamwork / 5);
  stats.reflexes = Math.round(stats.reflexes / 5);

  const strat = (team.strategy || "").toLowerCase();
  let offenseMod = 1.0;
  let defenseMod = 1.0;

  if (strat.includes('агрессивный')) { offenseMod = 1.25; defenseMod = 0.8; }
  else if (strat.includes('сдержанный')) { offenseMod = 0.8; defenseMod = 1.25; }
  else if (strat.includes('быстрый_пуш')) { power *= 1.1; offenseMod = 1.1; }

  return { power: power * offenseMod * defenseMod, stats, mods: { offenseMod, defenseMod } };
}

function runSingleGame(input: SimulateMobaMatchInput, forcedWinner?: 'A' | 'B'): z.infer<typeof GameStatsSchema> {
  const { teamA, teamB } = input;
  const potA = calculateTeamPotential(teamA);
  const potB = calculateTeamPotential(teamB);

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

  const heroesA = teamA.heroes.filter(h => !h.isSub);
  const heroesB = teamB.heroes.filter(h => !h.isSub);
  
  [...heroesA, ...heroesB].forEach(h => {
    playerStats.set(h.name, { 
      kills: 0, deaths: 0, assists: 0, cs: 0, 
      team: heroesA.some(ha => ha.name === h.name) ? teamA.name : teamB.name, 
      pro: !!h.isPro, role: h.role, image: h.image 
    });
  });

  let killsA = 0, killsB = 0;

  for (let m = 1; m <= durationMin; m++) {
    const time = `${m}:00`;
    const phase = m < 15 ? 'early' : (m < 30 ? 'mid' : 'late');
    
    // Choose active side for this minute
    const side = Math.random() > 0.5 ? 'A' : 'B';
    const activeTeam = side === 'A' ? teamA : teamB;
    const opponentTeam = side === 'A' ? teamB : teamA;
    
    const curHeroes = activeTeam.heroes.filter(h => !h.isSub);
    const oppHeroes = opponentTeam.heroes.filter(h => !h.isSub);
    
    if (curHeroes.length === 0 || oppHeroes.length === 0) continue;

    const hero = curHeroes[Math.floor(Math.random() * curHeroes.length)];
    const oppHero = oppHeroes[Math.floor(Math.random() * oppHeroes.length)];

    const roll = Math.random();

    if (roll < 0.45) { // Farming
      const ps = playerStats.get(hero.name);
      if (ps) {
        const eff = (hero.proStats.lastHitting + hero.proStats.manaManagement) / 20;
        ps.cs += Math.floor(eff * 4) + 3;
      }
    } else if (roll < 0.75) { // Ganking / Duel
      const gankPower = (hero.proStats.ganking * 1.5) + (hero.isPro ? 20 : 0);
      const escapePower = (oppHero.proStats.positioning + oppHero.proStats.mapAwareness) / 2;
      
      if (gankPower > escapePower + Math.random() * 30) {
        const ps = playerStats.get(hero.name);
        const ops = playerStats.get(oppHero.name);
        if (ps && ops) {
          ps.kills++; ops.deaths++;
          if (side === 'A') killsA++; else killsB++;
          timeline.push({ time, type: 'kill', event: `${hero.name} уничтожил ${oppHero.name}!`, score: `${killsA}:${killsB}` });
          curHeroes.filter(h => h.name !== hero.name).slice(0, 2).forEach(ah => {
            const aps = playerStats.get(ah.name);
            if (aps) aps.assists++;
          });
        }
      }
    } else if (phase === 'late' && roll < 0.9) { // Teamfight
      timeline.push({ time, type: 'teamfight', event: `Критическое столкновение! Команда ${activeTeam.name} прорывает оборону.`, score: `${killsA}:${killsB}` });
      const luckyHero = curHeroes[0];
      const ps = playerStats.get(luckyHero.name);
      if (ps) ps.kills++;
      if (side === 'A') killsA++; else killsB++;
    }

    if (phase === 'late' && Math.random() > 0.9 && hero.proStats.tiltResistance < 30) {
      timeline.push({ time, type: 'tilt', event: `${hero.name} теряет самообладание! Ошибка под давлением.`, score: `${killsA}:${killsB}` });
    }
  }

  const scoreboard = Array.from(playerStats.entries()).map(([name, s]) => ({
    name, team: s.team, role: s.role, image: s.image, kills: s.kills, deaths: s.deaths, assists: s.assists, cs: s.cs, isPro: s.pro,
    kdaRatio: ((s.kills + s.assists) / Math.max(1, s.deaths)).toFixed(2)
  }));

  const mvp = [...scoreboard].sort((a,b) => parseFloat(b.kdaRatio) - parseFloat(a.kdaRatio))[0]?.name || "None";

  return {
    scoreA: finalScoreA, scoreB: finalScoreB, duration: `${durationMin}:00`,
    mvp,
    matchSummary: `Победа ${finalScoreA > finalScoreB ? teamA.name : teamB.name}. Решающим фактором стала ${potA.stats.farm > potB.stats.farm ? 'экономика' : 'командная работа'}.`,
    timeline: timeline.filter(e => !!e).slice(0, 25), 
    scoreboard,
    teamComparison: {
      farm: [potA.stats.farm, potB.stats.farm],
      tactics: [potA.stats.tactics, potB.stats.tactics],
      teamwork: [potA.stats.teamwork, potB.stats.teamwork],
      reflexes: [potA.stats.reflexes, potB.stats.reflexes]
    }
  };
}

export async function simulateMobaMatch(input: SimulateMobaMatchInput): Promise<SimulateMobaMatchOutput> {
  const numGames = input.isBo3 ? 3 : (input.isBo2 ? 2 : 1);
  const games: any[] = [];
  let winsA = 0, winsB = 0;

  for (let i = 0; i < numGames; i++) {
    let forced: 'A' | 'B' | undefined = undefined;
    if (input.isBo2 && input.scoreA !== undefined) {
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
