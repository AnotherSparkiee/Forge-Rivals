'use server';
/**
 * @fileOverview Ядро симуляции матчей Lines of Enmity v3.2.
 * 
 * Особенности:
 * 1. Учет уровней инфраструктуры (Буткемп, Зал тактики).
 * 2. Учет навыков персонала (Тренер, Аналитик).
 * 3. Расширенная лента событий (Support Save, Objective Control).
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
  infraBonus: z.number().optional().describe('Бонус от уровня Буткемпа и Зала Тактики'),
  staffBonus: z.number().optional().describe('Бонус от навыков Тренера и Аналитика'),
});

const SimulateMobaMatchInputSchema = z.object({
  teamA: TeamSchema,
  teamB: TeamSchema,
  isBo2: z.boolean().default(true),
  isBo3: z.boolean().default(false),
  scoreA: z.number().optional(),
  scoreB: z.number().optional(),
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
  }),
});

const SimulateMobaMatchOutputSchema = z.object({
  winner: z.string(),
  seriesScore: z.string(),
  games: z.array(GameStatsSchema),
});
export type SimulateMobaMatchOutput = z.infer<typeof SimulateMobaMatchOutputSchema>;

const ROLE_WEIGHTS: Record<string, Record<keyof z.infer<typeof ProStatsSchema>, number>> = {
  'Carry': { lastHitting: 2.5, positioning: 1.8, reflexes: 1.5, tiltResistance: 1.4, manaManagement: 1.0, mapAwareness: 0.6, objectiveControl: 0.8, communication: 0.7, versatility: 0.8, ganking: 0.4 },
  'Midlaner': { reflexes: 2.2, ganking: 1.8, lastHitting: 1.5, manaManagement: 1.4, versatility: 1.2, mapAwareness: 1.1, positioning: 1.1, objectiveControl: 0.9, communication: 0.8, tiltResistance: 1.0 },
  'Tank': { positioning: 2.0, objectiveControl: 1.8, mapAwareness: 1.5, tiltResistance: 1.6, reflexes: 1.0, communication: 1.1, ganking: 1.1, versatility: 0.9, lastHitting: 0.4, manaManagement: 0.6 },
  'Jungler': { ganking: 2.2, mapAwareness: 1.8, objectiveControl: 1.6, reflexes: 1.3, positioning: 0.9, communication: 1.2, versatility: 1.1, lastHitting: 0.7, manaManagement: 0.9, tiltResistance: 0.8 },
  'Support': { communication: 2.2, mapAwareness: 1.8, positioning: 1.5, reflexes: 1.2, manaManagement: 1.2, objectiveControl: 1.2, versatility: 1.2, tiltResistance: 1.1, lastHitting: 0.2, ganking: 0.9 },
};

function calculateTeamPotential(team: z.infer<typeof TeamSchema>) {
  const activeHeroes = team.heroes.filter(h => !h.isSub).slice(0, 5);
  let power = 0;
  const stats = { farm: 0, tactics: 0, teamwork: 0, reflexes: 0 };

  if (activeHeroes.length === 0) return { power: 1, stats };

  activeHeroes.forEach(hero => {
    const weights = ROLE_WEIGHTS[hero.role] || ROLE_WEIGHTS['Midlaner'];
    let heroPower = Number(hero.overallRating || 0) * 0.4; // База OVR

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

  stats.farm = Math.round(stats.farm / activeHeroes.length);
  stats.tactics = Math.round(stats.tactics / activeHeroes.length);
  stats.teamwork = Math.round(stats.teamwork / activeHeroes.length);
  stats.reflexes = Math.round(stats.reflexes / activeHeroes.length);

  // ПРИМЕНЕНИЕ БОНУСОВ ИНФРАСТРУКТУРЫ И ПЕРСОНАЛА
  const infraMultiplier = 1 + (Number(team.infraBonus || 0) * 0.02);
  const staffMultiplier = 1 + (Number(team.staffBonus || 0) * 0.005);
  power *= (infraMultiplier * staffMultiplier);

  const strat = (team.strategy || "").toLowerCase();
  if (strat.includes('агрессивный')) power *= 1.08;
  if (strat.includes('сдержанный')) power *= 0.98;
  if (strat.includes('пуш')) power *= 1.05;

  return { power, stats };
}

function runSingleGame(input: SimulateMobaMatchInput, forcedWinner?: 'A' | 'B'): z.infer<typeof GameStatsSchema> {
  const potA = calculateTeamPotential(input.teamA);
  const potB = calculateTeamPotential(input.teamB);

  const winProbA = potA.power / (potA.power + potB.power);
  let scoreA = 0, scoreB = 0;

  if (forcedWinner === 'A') scoreA = 1;
  else if (forcedWinner === 'B') scoreB = 1;
  else {
    const diff = potA.power / potB.power;
    let finalProb = winProbA;
    if (diff > 1.25) finalProb = 0.88;
    if (diff > 1.6) finalProb = 0.99;
    if (diff < 0.75) finalProb = 0.12;
    if (diff < 0.45) finalProb = 0.01;

    if (Math.random() < finalProb) scoreA = 1; else scoreB = 1;
  }

  const duration = 28 + Math.floor(Math.random() * 15);
  const timeline: any[] = [];
  const scoreboardMap = new Map<string, any>();

  const allPlayers = [
    ...input.teamA.heroes.filter(h => !h.isSub).map(h => ({ ...h, team: input.teamA.name })),
    ...input.teamB.heroes.filter(h => !h.isSub).map(h => ({ ...h, team: input.teamB.name }))
  ];

  allPlayers.forEach(p => {
    scoreboardMap.set(p.name, { 
      name: p.name, team: p.team, role: p.role, image: p.image, 
      kills: 0, deaths: 0, assists: 0, cs: 0, isPro: p.isPro 
    });
  });

  let killsA = 0, killsB = 0;

  for (let m = 1; m <= duration; m++) {
    const activeTeam = Math.random() < winProbA ? input.teamA : input.teamB;
    const opponentTeam = activeTeam.name === input.teamA.name ? input.teamB : input.teamA;
    
    const activeHeroes = activeTeam.heroes.filter(h => !h.isSub);
    const opponentHeroes = opponentTeam.heroes.filter(h => !h.isSub);

    if (activeHeroes.length === 0 || opponentHeroes.length === 0) continue;

    const actor = activeHeroes[Math.floor(Math.random() * activeHeroes.length)];
    const target = opponentHeroes[Math.floor(Math.random() * opponentHeroes.length)];
    
    const roll = Math.random();
    
    // Phase 1: Farming (Early game focus)
    if (m < 15 && roll < 0.6) {
      const s = scoreboardMap.get(actor.name);
      if (s) s.cs += Math.floor((actor.proStats.lastHitting / 8) + 4);
    } 
    // Phase 2: Objectives
    else if (roll > 0.85) {
      const teamObjPower = activeHeroes.reduce((acc, h) => acc + h.proStats.objectiveControl, 0) / 5;
      const oppObjPower = opponentHeroes.reduce((acc, h) => acc + h.proStats.objectiveControl, 0) / 5;
      
      if (teamObjPower > oppObjPower * (0.9 + Math.random() * 0.3)) {
        timeline.push({ 
          time: `${m}:00`, type: 'objective', 
          event: `Команда ${activeTeam.name} захватывает ключевой объект! Превосходство в контроле.`,
          score: `${killsA}:${killsB}`
        });
      }
    }
    // Phase 3: Engagements
    else {
      const attackPower = actor.proStats.reflexes + actor.proStats.ganking;
      const defensePower = target.proStats.positioning + target.proStats.mapAwareness;
      
      const successThreshold = defensePower * (0.9 + Math.random() * 0.5);
      
      if (attackPower > successThreshold) {
        // Проверка на "Сейв" от саппорта
        const support = activeHeroes.find(h => h.role === 'Support' || h.role === 'Support_Full');
        if (support && Math.random() < (support.proStats.communication / 150)) {
           timeline.push({ 
             time: `${m}:00`, type: 'save', 
             event: `${support.name} вовремя подстраховал союзника, предотвратив фатальную ошибку!`,
             score: `${killsA}:${killsB}`
           });
        } else {
          const s = scoreboardMap.get(actor.name);
          const st = scoreboardMap.get(target.name);
          if (s && st) {
            s.kills++; st.deaths++;
            if (activeTeam.name === input.teamA.name) killsA++; else killsB++;
            timeline.push({ 
              time: `${m}:00`, type: 'kill', 
              event: `${actor.name} (${actor.role}) совершает точный выпад и ликвидирует ${target.name}!`, 
              score: `${killsA}:${killsB}` 
            });
            activeHeroes.filter(h => h.name !== actor.name).slice(0, 2).forEach(ah => {
              const sa = scoreboardMap.get(ah.name);
              if (sa) sa.assists++;
            });
          }
        }
      }
    }

    // Critical Tilt check
    if (m > 35 && roll > 0.9 && actor.proStats.tiltResistance < 25) {
      timeline.push({ 
        time: `${m}:00`, type: 'tilt', 
        event: `Нервы на пределе! ${actor.name} допускает позиционную ошибку в решающий момент.`, 
        score: `${killsA}:${killsB}` 
      });
    }
  }

  const scoreboard = Array.from(scoreboardMap.values()).map(s => ({
    ...s,
    kdaRatio: ((s.kills + s.assists) / Math.max(1, s.deaths)).toFixed(2)
  }));

  const mvp = [...scoreboard].sort((a, b) => parseFloat(b.kdaRatio) - parseFloat(a.kdaRatio))[0]?.name || "None";

  return {
    scoreA, scoreB, duration: `${duration}:00`, mvp,
    matchSummary: scoreA > scoreB ? `Стратегическая победа ${input.teamA.name}.` : `Команда ${input.teamB.name} оказалась сильнее тактически.`,
    timeline: timeline.filter(e => !!e).slice(0, 35),
    scoreboard,
    teamComparison: {
      farm: [potA.stats.farm, potB.stats.farm],
      tactics: [potA.stats.tactics, potB.stats.tactics],
      teamwork: [potA.stats.teamwork, potB.stats.teamwork],
      reflexes: [potA.stats.reflexes, potB.stats.reflexes],
    }
  };
}

export async function simulateMobaMatch(input: SimulateMobaMatchInput): Promise<SimulateMobaMatchOutput> {
  const games: any[] = [];
  const numGames = input.isBo3 ? 3 : (input.isBo2 ? 2 : 1);
  
  let winsA = 0, winsB = 0;
  for (let i = 0; i < numGames; i++) {
    let forced: 'A' | 'B' | undefined = undefined;
    if (input.scoreA !== undefined && input.scoreB !== undefined) {
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
