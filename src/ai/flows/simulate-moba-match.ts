'use server';
/**
 * @fileOverview Ядро симуляции матчей Lines of Enmity v4.4 (Staff Integration + Tactics).
 * 
 * Особенности:
 * 1. Взвешенная оценка ролей (Carry, Mid, Tank, Jungler, Support).
 * 2. Учет навыков персонала (Coach, Analyst) в реальном времени.
 * 3. Логически обоснованная генерация Scoreboard и MVP.
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

const PlayerStatsSchema = z.object({
  id: z.string().optional(),
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
  heroes: z.array(PlayerStatsSchema), // Keeps internal field name 'heroes' for backward compatibility in input
  strategy: z.string().describe('Aggressive, Balanced, Defensive, Fast_Push, Counter-attack'),
  infraBonus: z.number().optional().describe('Bonus from Bootcamp/Tactics Hall'),
  staffBonus: z.number().optional().describe('Bonus from Coach skills'),
  analystBonus: z.number().optional().describe('Bonus from Analyst skills'),
  synergy: z.number().optional().describe('Team cohesion level (0-100)'),
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
  towersA: z.number(),
  towersB: z.number(),
  objectivesA: z.number(),
  objectivesB: z.number(),
  timeline: z.array(z.object({
    time: z.string(),
    event: z.string(),
    type: z.string(), // kill, save, objective, tower, injury, tilt
    score: z.string().optional(),
  })),
  scoreboard: z.array(z.object({
    id: z.string().optional(),
    name: z.string(),
    team: z.string(),
    role: z.string().optional(),
    image: z.string().optional(),
    kills: z.number(),
    deaths: z.number(),
    assists: z.number(),
    cs: z.number(),
    matchRating: z.number(),
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
  'Carry': { lastHitting: 3.5, positioning: 2.2, reflexes: 1.8, tiltResistance: 1.5, manaManagement: 1.0, mapAwareness: 0.5, objectiveControl: 0.8, communication: 0.5, versatility: 0.7, ganking: 0.3 },
  'Midlaner': { reflexes: 2.8, ganking: 2.5, lastHitting: 1.8, manaManagement: 1.5, versatility: 1.5, mapAwareness: 1.2, positioning: 1.2, objectiveControl: 1.0, communication: 0.8, tiltResistance: 1.2 },
  'Tank': { positioning: 2.5, objectiveControl: 2.5, mapAwareness: 2.0, tiltResistance: 2.0, reflexes: 1.0, communication: 1.5, ganking: 1.2, versatility: 1.0, lastHitting: 0.5, manaManagement: 0.8 },
  'Jungler': { ganking: 3.0, mapAwareness: 2.2, objectiveControl: 2.0, reflexes: 1.8, positioning: 1.0, communication: 1.3, versatility: 1.2, lastHitting: 0.8, manaManagement: 1.0, tiltResistance: 1.0 },
  'Support': { communication: 3.0, mapAwareness: 2.5, positioning: 2.0, reflexes: 1.5, manaManagement: 1.5, objectiveControl: 1.5, versatility: 1.5, tiltResistance: 1.5, lastHitting: 0.2, ganking: 1.0 },
};

function calculateTeamPotential(team: z.infer<typeof TeamSchema>) {
  const activeHeroes = team.heroes.filter(h => !h.isSub).slice(0, 5);
  let power = 0;
  const stats = { farm: 0, tactics: 0, teamwork: 0, reflexes: 0 };

  if (activeHeroes.length === 0) return { power: 1, stats };

  activeHeroes.forEach(hero => {
    const weights = ROLE_WEIGHTS[hero.role] || ROLE_WEIGHTS['Midlaner'];
    let heroContribution = Number(hero.overallRating || 0) * 2.0;

    Object.entries(hero.proStats).forEach(([key, val]) => {
      const weight = weights[key as keyof typeof weights] || 1.0;
      heroContribution += Number(val || 0) * weight;
    });

    if (hero.isPro) heroContribution *= 1.25;
    power += heroContribution;

    stats.farm += (hero.proStats.lastHitting + hero.proStats.manaManagement) / 2;
    stats.tactics += (hero.proStats.mapAwareness + hero.proStats.objectiveControl) / 2;
    stats.teamwork += (hero.proStats.communication + hero.proStats.versatility) / 2;
    stats.reflexes += (hero.proStats.reflexes + hero.proStats.ganking) / 2;
  });

  const count = activeHeroes.length;
  stats.farm = Math.round(stats.farm / count);
  stats.tactics = Math.round(stats.tactics / count);
  stats.teamwork = Math.round(stats.teamwork / count);
  stats.reflexes = Math.round(stats.reflexes / count);

  // Apply Staff Bonuses
  const coachBonus = Number(team.staffBonus || 0) * 0.5;
  const analystBonus = Number(team.analystBonus || 0) * 0.5;
  
  stats.teamwork += coachBonus;
  stats.tactics += analystBonus;

  const infraMultiplier = 1 + (Number(team.infraBonus || 0) * 0.03);
  const synergyMultiplier = 1 + (Number(team.synergy || 0) * 0.003);
  
  power *= (infraMultiplier * synergyMultiplier);
  power += (coachBonus * 10) + (analystBonus * 10);

  const strat = (team.strategy || "").toLowerCase();
  if (strat.includes('aggressive')) power *= 1.12; 
  if (strat.includes('defensive')) power *= 1.05;
  if (strat.includes('push')) power *= 1.08;

  return { power, stats };
}

function runSingleGame(input: SimulateMobaMatchInput, forcedWinner?: 'A' | 'B'): z.infer<typeof GameStatsSchema> {
  const potA = calculateTeamPotential(input.teamA);
  const potB = calculateTeamPotential(input.teamB);

  const winProbA = potA.power / (potA.power + potB.power);
  let finalWinner: 'A' | 'B';

  if (forcedWinner === 'A') finalWinner = 'A';
  else if (forcedWinner === 'B') finalWinner = 'B';
  else {
    finalWinner = Math.random() < winProbA ? 'A' : 'B';
  }

  const duration = 28 + Math.floor(Math.random() * 14);
  const timeline: any[] = [];
  const scoreboardMap = new Map<string, any>();

  const allPlayers = [
    ...input.teamA.heroes.filter(h => !h.isSub).map(h => ({ ...h, team: input.teamA.name })),
    ...input.teamB.heroes.filter(h => !h.isSub).map(h => ({ ...h, team: input.teamB.name }))
  ];

  allPlayers.forEach(p => {
    scoreboardMap.set(p.name, { 
      id: p.id, name: p.name, team: p.team, role: p.role, image: p.image, 
      kills: 0, deaths: 0, assists: 0, cs: 0, isPro: p.isPro,
      matchRating: 6.0
    });
  });

  let killsA = 0, killsB = 0;
  let towersA = finalWinner === 'A' ? 9 + Math.floor(Math.random()*3) : Math.floor(Math.random()*6);
  let towersB = finalWinner === 'B' ? 9 + Math.floor(Math.random()*3) : Math.floor(Math.random()*6);
  let objectivesA = 0, objectivesB = 0;

  for (let m = 1; m <= duration; m++) {
    const isEarly = m < 12;
    const isLate = m > 22;
    
    const activeTeam = Math.random() < winProbA ? input.teamA : input.teamB;
    const opponentTeam = activeTeam.name === input.teamA.name ? input.teamB : input.teamA;
    const isAActive = activeTeam.name === input.teamA.name;
    
    const heroes = activeTeam.heroes.filter(h => !h.isSub);
    const targets = opponentTeam.heroes.filter(h => !h.isSub);

    if (heroes.length === 0 || targets.length === 0) continue;

    const actor = heroes[Math.floor(Math.random() * heroes.length)];
    const target = targets[Math.floor(Math.random() * targets.length)];
    const roll = Math.random();

    if (isEarly && roll < 0.55) {
      const s = scoreboardMap.get(actor.name);
      if (s) {
        const gain = Math.floor((actor.proStats.lastHitting / 12) + 7);
        s.cs += gain;
        s.matchRating += 0.05;
      }
    } 
    else if (roll > 0.92) {
      const type = Math.random() > 0.35 ? 'tower' : 'objective';
      if (type === 'tower') {
        if (isAActive) towersA++; else towersB++;
        timeline.push({ 
          time: `${m}:00`, type: 'tower', 
          event: `Команда ${activeTeam.name} прорывает оборону и сносит башню!`,
          score: `${killsA}:${killsB}`
        });
      } else {
        if (isAActive) objectivesA++; else objectivesB++;
        timeline.push({ 
          time: `${m}:00`, type: 'objective', 
          event: `Захват лесного объекта командой ${activeTeam.name}! Экономическое преимущество растет.`,
          score: `${killsA}:${killsB}`
        });
      }
      const s = scoreboardMap.get(actor.name);
      if (s) s.matchRating += 0.45;
    }
    else if (roll > 0.70) {
      const atkPower = actor.proStats.reflexes + actor.proStats.ganking;
      const defPower = target.proStats.positioning + target.proStats.mapAwareness;
      
      const diff = atkPower - defPower;
      const successChance = 0.45 + (diff / 180);

      if (Math.random() < successChance) {
        const support = heroes.find(h => h.role === 'Support');
        if (support && Math.random() < (support.proStats.communication / 220)) {
           timeline.push({ 
             time: `${m}:00`, type: 'save', 
             event: `Невероятный сейв! ${support.name} вытаскивает ${actor.name} из-под удара.`,
             score: `${killsA}:${killsB}`
           });
           const ss = scoreboardMap.get(support.name);
           if (ss) ss.matchRating += 0.6;
        } else {
          const s = scoreboardMap.get(actor.name);
          const st = scoreboardMap.get(target.name);
          if (s && st) {
            s.kills++; st.deaths++;
            s.matchRating += 0.85;
            st.matchRating -= 0.65;
            if (isAActive) killsA++; else killsB++;

            timeline.push({ 
              time: `${m}:00`, type: 'kill', 
              event: `${actor.name} ликвидирует ${target.name} точным выпадом!`, 
              score: `${killsA}:${killsB}` 
            });

            heroes.filter(h => h.name !== actor.name).slice(0, 2).forEach(ah => {
              const sa = scoreboardMap.get(ah.name);
              if (sa) { sa.assists++; sa.matchRating += 0.4; }
            });
          }
        }
      }
    }

    if (isLate && roll > 0.94 && actor.proStats.tiltResistance < 45) {
      timeline.push({ 
        time: `${m}:00`, type: 'tilt', 
        event: `Ошибка концентрации! ${actor.name} теряет позицию из-за усталости.`, 
        score: `${killsA}:${killsB}` 
      });
      const s = scoreboardMap.get(actor.name);
      if (s) s.matchRating -= 0.55;
    }
  }

  const scoreboard = Array.from(scoreboardMap.values()).map(s => ({
    ...s,
    matchRating: Math.min(10, Math.max(1, s.matchRating + (s.cs / 250))),
    kdaRatio: ((s.kills + s.assists) / Math.max(1, s.deaths)).toFixed(2)
  }));

  const mvp = [...scoreboard].sort((a, b) => b.matchRating - a.matchRating)[0]?.name || "None";

  return {
    scoreA: finalWinner === 'A' ? 1 : 0,
    scoreB: finalWinner === 'B' ? 1 : 0,
    duration: `${duration}:00`, mvp,
    matchSummary: finalWinner === 'A' ? `Доминирование ${input.teamA.name} на всех участках карты.` : `Команда ${input.teamB.name} переиграла оппонента тактически.`,
    towersA, towersB, objectivesA, objectivesB,
    timeline: timeline.slice(0, 45),
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
