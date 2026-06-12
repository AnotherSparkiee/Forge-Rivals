
'use server';
/**
 * @fileOverview Архитектурный модуль симуляции матчей Lines of Enmity.
 * 
 * Алгоритмический расчет на основе тактик, OVR и статов.
 * Поддержка Bo1/Bo2/Bo3, KDA, CS и текстовой трансляции.
 * Поддержка принудительного результата для синхронизации лиги.
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
  proStats: ProStatsSchema,
  isSub: z.boolean().optional(),
});

const TeamSchema = z.object({
  name: z.string(),
  heroes: z.array(HeroStatsSchema),
  strategy: z.string().describe('Агрессивный, Сбалансированный_Атака, Сбалансированный_Защита, Сдержанный, Быстрый_Штурм, Быстрый_Пуш'),
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
  })),
});

const SimulateMobaMatchOutputSchema = z.object({
  winner: z.string(),
  seriesScore: z.string(),
  games: z.array(GameStatsSchema),
  aggregateStats: z.array(z.object({
    name: z.string(),
    totalKills: z.number(),
    avgKda: z.string(),
    totalCs: z.number(),
  })),
});
export type SimulateMobaMatchOutput = z.infer<typeof SimulateMobaMatchOutputSchema>;

/**
 * Вспомогательный класс для генерации текста по шаблонам.
 */
class NarrativeGenerator {
  private templates = {
    farm: [
      "{player} из {team} идеально добивает пачку крипов (Добив: {val}).",
      "{player} сосредоточен на фарме. Его навык Добивание ({val}) позволяет забирать каждого монстра.",
      "Линия {team} пуста, {player} спокойно забирает ресурсы."
    ],
    kill: [
      "{player} совершает блестящий ганк! Навык Ганкинг ({val}) застает противника врасплох.",
      "Невероятный килл от {player}! Благодаря Рефлексам ({val}) он уворачивается от заклинания и наносит ответный удар.",
      "Ошибка позиционки от врага! {player} наказывает оппонента, используя Позиционирование ({val})."
    ],
    teamfight: [
      "Масштабный замес у реки! {player} координирует действия через Коммуникацию ({val}).",
      "Команда {team} врывается в драку! {player} показывает мастерство Контроля ({val}).",
      "Жесткий размен! {player} удерживает позицию благодаря Стрессоустойчивости ({val})."
    ],
    objective: [
      "{player} забирает важный объект на карте! Контроль объектов ({val}) на высоте.",
      "Команда {team} пушит вышку. {player} руководит процессом.",
      "Борьба за Рошана! {player} вовремя прожимает кнопки и забирает бафф."
    ]
  };

  generate(type: 'farm' | 'kill' | 'teamfight' | 'objective', player: string, team: string, val: number) {
    const list = this.templates[type];
    const tpl = list[Math.floor(Math.random() * list.length)];
    return tpl.replace('{player}', player).replace('{team}', team).replace('{val}', val.toString());
  }
}

/**
 * Ядро симуляции одного матча.
 */
function runSingleGame(input: SimulateMobaMatchInput, gameIndex: number, forcedScoreA?: number, forcedScoreB?: number): z.infer<typeof GameStatsSchema> {
  const { teamA, teamB } = input;
  const narrative = new NarrativeGenerator();
  
  const activeA = teamA.heroes.slice(0, 5);
  const activeB = teamB.heroes.slice(0, 5);

  const getAvgStat = (heroes: any[], stat: keyof typeof ProStatsSchema._type) => {
    if (heroes.length === 0) return 0;
    return heroes.reduce((acc: number, h: any) => acc + h.proStats[stat], 0) / heroes.length;
  };

  const applyTactics = (heroes: any[], enemyHeroes: any[], strategy: string) => {
    let a = 1.0, d = 1.0;
    if (strategy === 'Aggressive Play') { a = 1.25; d = 1.15; }
    else if (strategy === 'Defensive Play') { d = 1.25; a = 0.85; }
    return { a, d };
  };

  const modsA = applyTactics(activeA, activeB, teamA.strategy);
  const modsB = applyTactics(activeB, activeA, teamB.strategy);

  const powerA = activeA.reduce((acc, h) => acc + h.overallRating, 0) * (modsA.a + modsA.d);
  const powerB = activeB.reduce((acc, h) => acc + h.overallRating, 0) * (modsB.a + modsB.d);

  let finalScoreA = forcedScoreA !== undefined ? forcedScoreA : (powerA > powerB ? 1 : 0);
  let finalScoreB = forcedScoreB !== undefined ? forcedScoreB : (powerB > powerA ? 1 : 0);

  const timeline: any[] = [];
  const playerStats = new Map<string, any>();
  [...activeA, ...activeB].forEach(h => {
    playerStats.set(h.name, { 
      kills: 0, deaths: 0, assists: 0, cs: 0, role: h.role,
      team: activeA.some(th => th.name === h.name) ? teamA.name : teamB.name 
    });
  });

  let curA = 0, curB = 0;
  const duration = 35 + Math.floor(Math.random() * 10);
  
  for (let m = 1; m <= duration; m++) {
    const time = `${m}:00`;
    const side = Math.random() > 0.5 ? activeA : activeB;
    const sideName = side === activeA ? teamA.name : teamB.name;
    const oppSide = side === activeA ? activeB : activeA;
    
    if (side.length === 0 || oppSide.length === 0) continue;

    const hero = side[Math.floor(Math.random() * side.length)];
    const oppHero = oppSide[Math.floor(Math.random() * oppSide.length)];
    
    const rand = Math.random();
    if (rand < 0.4) {
      const ps = playerStats.get(hero.name);
      if (ps) { ps.cs += 8; if (m % 5 === 0) timeline.push({ time, type: 'farm', event: narrative.generate('farm', hero.name, sideName, hero.proStats.lastHitting), score: `${curA}:${curB}` }); }
    } else if (rand < 0.7) {
      const ps = playerStats.get(hero.name);
      const ops = playerStats.get(oppHero.name);
      if (ps && ops) {
        ps.kills++; ops.deaths++;
        if (side === activeA) curA++; else curB++;
        timeline.push({ time, type: 'kill', event: narrative.generate('kill', hero.name, sideName, hero.proStats.ganking), score: `${curA}:${curB}` });
      }
    } else if (rand < 0.9) {
      timeline.push({ time, type: 'objective', event: narrative.generate('objective', hero.name, sideName, hero.proStats.objectiveControl), score: `${curA}:${curB}` });
    } else {
      timeline.push({ time, type: 'teamfight', event: narrative.generate('teamfight', hero.name, sideName, hero.proStats.communication), score: `${curA}:${curB}` });
    }
  }

  const scoreboard = Array.from(playerStats.entries()).map(([name, s]) => ({
    name, team: s.team, role: s.role, kills: s.kills, deaths: s.deaths, assists: s.assists, cs: s.cs,
    kdaRatio: ((s.kills + s.assists) / Math.max(1, s.deaths)).toFixed(2)
  }));

  return {
    scoreA: finalScoreA, scoreB: finalScoreB, duration: `${duration}:00`,
    mvp: scoreboard.sort((a,b) => parseFloat(b.kdaRatio) - parseFloat(a.kdaRatio))[0].name,
    matchSummary: "Intense competitive match with high strategic value.",
    timeline: timeline.slice(0, 15), scoreboard
  };
}

export async function simulateMobaMatch(input: SimulateMobaMatchInput): Promise<SimulateMobaMatchOutput> {
  const numGames = input.isBo3 ? 3 : (input.isBo2 ? 2 : 1);
  const games: any[] = [];
  let winsA = 0, winsB = 0;

  for (let i = 0; i < numGames; i++) {
    let fA = undefined, fB = undefined;
    if (input.isBo2 && input.scoreA !== undefined) {
      if (input.scoreA === 2) { fA = 1; fB = 0; }
      else if (input.scoreB === 2) { fA = 0; fB = 1; }
      else if (input.scoreA === 1 && input.scoreB === 1) { fA = i === 0 ? 1 : 0; fB = i === 0 ? 0 : 1; }
    }
    const g = runSingleGame(input, i, fA, fB);
    games.push(g); winsA += g.scoreA; winsB += g.scoreB;
    if (input.isBo3 && (winsA === 2 || winsB === 2)) break;
  }

  return {
    winner: winsA > winsB ? input.teamA.name : (winsB > winsA ? input.teamB.name : "Draw"),
    seriesScore: `${winsA}-${winsB}`, games, aggregateStats: []
  };
}

const simulateMobaMatchFlow = ai.defineFlow(
  { name: 'simulateMobaMatchFlow', inputSchema: SimulateMobaMatchInputSchema, outputSchema: SimulateMobaMatchOutputSchema },
  async input => simulateMobaMatch(input)
);
