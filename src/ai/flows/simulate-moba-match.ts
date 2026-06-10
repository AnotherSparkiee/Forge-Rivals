
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
      "{player} из {team} идеально добивает пачку крипов, используя навык Добивание ({val}).",
      "{player} сосредоточен на фарме. Его навык Добивание ({val}) позволяет забирать каждого монстра.",
      "Линия {team} пуста, {player} спокойно забирает ресурсы (Добив: {val})."
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
      "Команда {team} пушит вышку. {player} руководит процессом (Объекты: {val}).",
      "Борьба за Рошана! {player} вовремя прожимает кнопки (Рефлексы: {val}) и забирает бафф."
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
  
  const getPower = (team: any) => team.heroes.slice(0, 5).reduce((acc: number, h: any) => acc + h.overallRating, 0);
  const getAvgStat = (team: any, stat: keyof typeof ProStatsSchema._type) => 
    team.heroes.slice(0, 5).reduce((acc: number, h: any) => acc + h.proStats[stat], 0) / 5;

  const logs: string[] = [];

  const applyTactics = (team: any, enemy: any) => {
    let a = 1.0, d = 1.0;
    const strat = team.strategy;
    if (strat === 'Агрессивный' || strat === 'Aggressive Play') {
      a = 1.25; d = 1.15;
      if (getAvgStat(team, 'tiltResistance') < 50) { a *= 0.8; logs.push(`${team.name} тильтанула от собственной агрессии.`); }
    } else if (strat === 'Сбалансированный_Атака' || strat === 'Side Pressure') {
      a = 1.15; d = 0.85;
    } else if (strat === 'Сбалансированный_Защита' || strat === 'Balanced Play') {
      d = 1.15; a = 0.85;
    } else if (strat === 'Сдержанный' || strat === 'Defensive Play') {
      if (getAvgStat(team, 'objectiveControl') > getAvgStat(enemy, 'objectiveControl')) a *= 0.75; else d *= 0.70;
    } else if (strat === 'Быстрый_Штурм' || strat === 'Fast Pace') {
      const power = getAvgStat(team, 'versatility') + getAvgStat(team, 'ganking');
      const oppPower = getAvgStat(enemy, 'versatility') + getAvgStat(enemy, 'ganking');
      if (power > oppPower) a *= 1.30; else a *= 0.80;
    } else if (strat === 'Быстрый_Пуш') {
      if (getAvgStat(team, 'objectiveControl') > getAvgStat(enemy, 'objectiveControl')) a *= 1.20; else d *= 0.75;
    }
    return { a, d };
  };

  const modsA = applyTactics(teamA, teamB);
  const modsB = applyTactics(teamB, teamA);

  const basePowerA = getPower(teamA);
  const basePowerB = getPower(teamB);

  const finalPowerA = (basePowerA * modsA.a + basePowerA * modsA.d) * (0.85 + Math.random() * 0.3);
  const finalPowerB = (basePowerB * modsB.a + basePowerB * modsB.d) * (0.85 + Math.random() * 0.3);

  let scoreA = forcedScoreA !== undefined ? forcedScoreA : (finalPowerA > finalPowerB ? 1 : 0);
  let scoreB = forcedScoreB !== undefined ? forcedScoreB : (finalPowerB > finalPowerA ? 1 : 0);

  const timeline: any[] = [];
  const playerStats = new Map<string, any>();
  [...teamA.heroes.slice(0, 5), ...teamB.heroes.slice(0, 5)].forEach(h => {
    playerStats.set(h.name, { kills: 0, deaths: 0, assists: 0, cs: 0, team: teamA.heroes.some(th => th.name === h.name) ? teamA.name : teamB.name });
  });

  let currentScoreA = 0;
  let currentScoreB = 0;

  const durationMins = 35 + Math.floor(Math.random() * 10);
  for (let m = 1; m <= durationMins; m++) {
    const time = `${m}:00`;
    const side = Math.random() > 0.5 ? teamA : teamB;
    const oppSide = side === teamA ? teamB : teamA;
    const hero = side.heroes[Math.floor(Math.random() * 5)];
    const oppHero = oppSide.heroes[Math.floor(Math.random() * 5)];
    
    const rand = Math.random();
    if (rand < 0.4) {
      const ps = playerStats.get(hero.name);
      ps.cs += 5 + Math.floor(hero.proStats.lastHitting / 10);
      if (m % 10 === 0) timeline.push({ time, type: 'farm', event: narrative.generate('farm', hero.name, side.name, hero.proStats.lastHitting), score: `${currentScoreA}:${currentScoreB}` });
    } else if (rand < 0.7) {
      const ps = playerStats.get(hero.name);
      const ops = playerStats.get(oppHero.name);
      ps.kills++; ops.deaths++;
      if (side === teamA) currentScoreA++; else currentScoreB++;
      const assistHero = side.heroes.find(h => h.name !== hero.name);
      if (assistHero) playerStats.get(assistHero.name).assists++;
      timeline.push({ time, type: 'kill', event: narrative.generate('kill', hero.name, side.name, hero.proStats.ganking), score: `${currentScoreA}:${currentScoreB}` });
    } else if (rand < 0.9) {
      timeline.push({ time, type: 'objective', event: narrative.generate('objective', hero.name, side.name, hero.proStats.objectiveControl), score: `${currentScoreA}:${currentScoreB}` });
    } else {
      timeline.push({ time, type: 'teamfight', event: narrative.generate('teamfight', hero.name, side.name, hero.proStats.communication), score: `${currentScoreA}:${currentScoreB}` });
    }
  }

  const scoreboard = Array.from(playerStats.entries()).map(([name, s]) => ({
    name,
    team: s.team,
    kills: s.kills,
    deaths: s.deaths,
    assists: s.assists,
    cs: s.cs,
    kdaRatio: ((s.kills + s.assists) / Math.max(1, s.deaths)).toFixed(2)
  }));

  return {
    scoreA,
    scoreB,
    duration: `${durationMins}:12`,
    mvp: scoreboard.sort((a, b) => parseFloat(b.kdaRatio) - parseFloat(a.kdaRatio))[0].name,
    matchSummary: logs.length > 0 ? logs.join(' ') : "Дисциплинированная игра обеих команд.",
    timeline: timeline.slice(0, 10),
    scoreboard
  };
}

export async function simulateMobaMatch(input: SimulateMobaMatchInput): Promise<SimulateMobaMatchOutput> {
  try {
    const numGames = input.isBo3 ? 3 : (input.isBo2 ? 2 : 1);
    const games: any[] = [];
    let winsA = 0, winsB = 0;

    for (let i = 0; i < numGames; i++) {
      // Для Bo2 в Лиге мы можем передать вынужденный счет для каждой игры, если он задан.
      // Но обычно scoreA/scoreB в input — это суммарный результат.
      // Если это Bo2, мы распределим forcedScore по играм.
      let forcedA = undefined;
      let forcedB = undefined;

      if (input.isBo2 && input.scoreA !== undefined && input.scoreB !== undefined) {
        if (input.scoreA === 2) { forcedA = 1; forcedB = 0; }
        else if (input.scoreB === 2) { forcedA = 0; forcedB = 1; }
        else if (input.scoreA === 1 && input.scoreB === 1) {
          forcedA = i === 0 ? 1 : 0;
          forcedB = i === 0 ? 0 : 1;
        }
      } else if (!input.isBo2 && input.scoreA !== undefined) {
        forcedA = input.scoreA > input.scoreB! ? 1 : 0;
        forcedB = input.scoreB! > input.scoreA! ? 1 : 0;
      }

      const game = runSingleGame(input, i, forcedA, forcedB);
      games.push(game);
      winsA += game.scoreA;
      winsB += game.scoreB;
      if (input.isBo3 && (winsA === 2 || winsB === 2)) break;
    }

    const winner = winsA > winsB ? input.teamA.name : (winsA < winsB ? input.teamB.name : "Draw");

    const aggMap = new Map<string, any>();
    games.forEach(g => {
      g.scoreboard.forEach((s: any) => {
        const cur = aggMap.get(s.name) || { kills: 0, assists: 0, deaths: 0, cs: 0 };
        aggMap.set(s.name, {
          kills: cur.kills + s.kills,
          assists: cur.assists + s.assists,
          deaths: cur.deaths + s.deaths,
          cs: cur.cs + s.cs
        });
      });
    });

    const aggregateStats = Array.from(aggMap.entries()).map(([name, s]) => ({
      name,
      totalKills: s.kills,
      totalCs: s.cs,
      avgKda: ((s.kills + s.assists) / Math.max(1, s.deaths)).toFixed(2)
    }));

    return {
      winner,
      seriesScore: `${winsA}-${winsB}`,
      games,
      aggregateStats
    };
  } catch (error: any) {
    console.error("Simulation Critical Error", error);
    throw error;
  }
}

const simulateMobaMatchFlow = ai.defineFlow(
  {
    name: 'simulateMobaMatchFlow',
    inputSchema: SimulateMobaMatchInputSchema,
    outputSchema: SimulateMobaMatchOutputSchema,
  },
  async input => {
    return await simulateMobaMatch(input);
  }
);
