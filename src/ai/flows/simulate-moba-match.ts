'use server';
/**
 * @fileOverview Архитектурный модуль симуляции матчей Lines of Enmity.
 * 
 * Генерирует данные пошагово: Превью, 2D-Обзор, Итоговая статистика.
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
  name: z.string().describe('Имя героя.'),
  role: z.string().describe('Роль героя.'),
  overallRating: z.number().describe('Общий рейтинг.'),
  proStats: ProStatsSchema.describe('10 ключевых характеристик.'),
  isSub: z.boolean().optional().describe('Флаг запасного игрока.'),
});

const TeamSchema = z.object({
  name: z.string().describe('Название команды.'),
  heroes: z.array(HeroStatsSchema).describe('Состав (Основа + Замены).'),
  strategy: z.string().describe('Тактическая установка.'),
});

const SimulateMobaMatchInputSchema = z.object({
  teamA: TeamSchema,
  teamB: TeamSchema,
  isBo2: z.boolean().default(true),
  isBo3: z.boolean().default(false),
  scoreA: z.number().optional().describe('Принудительный счет для команды А.'),
  scoreB: z.number().optional().describe('Принудительный счет для команды Б.'),
});
export type SimulateMobaMatchInput = z.infer<typeof SimulateMobaMatchInputSchema>;

const SimulateMobaMatchOutputSchema = z.object({
  winner: z.string(),
  scoreA: z.number(),
  scoreB: z.number(),
  duration: z.string(),
  mvp: z.string(),
  matchSummary: z.string(),
  
  // ЭТАП 1: ПРЕВЬЮ
  preview: z.object({
    teamAOrv: z.number(),
    teamBOrv: z.number(),
    keyMatchup: z.string().describe('Описание ключевого противостояния игроков на линии.'),
    winProbabilityA: z.number().describe('Вероятность победы команды А в %.'),
  }),

  // ЭТАП 2: 2D-ОБЗОР (Timeline)
  timeline: z.array(z.object({
    phase: z.enum(['Early', 'Mid', 'Late']),
    time: z.string(),
    event: z.string().describe('Описание события на карте с упоминанием статов.'),
    score: z.string().describe('Текущий счет на момент события.'),
  })),

  // ЭТАП 3: ПОСЛЕМАТЧЕВАЯ СТАТИСТИКА
  postMatch: z.object({
    lineRatings: z.object({
      laning: z.object({ a: z.number(), b: z.number() }),
      teamfight: z.object({ a: z.number(), b: z.number() }),
      macro: z.object({ a: z.number(), b: z.number() }),
      mental: z.object({ a: z.number(), b: z.number() }),
    }),
    scoreboard: z.array(z.object({
      name: z.string(),
      team: z.string(),
      kda: z.string(),
      gpm: z.number(),
    })),
    analysis: z.string().describe('Математический вывод причины победы на основе 10 статов.'),
  }),
  
  // Backward compatibility
  teamStats: z.object({
    teamA: z.object({ kills: z.number(), towersDestroyed: z.number() }),
    teamB: z.object({ kills: z.number(), towersDestroyed: z.number() }),
  }),
  heroPerformance: z.array(z.any()),
});
export type SimulateMobaMatchOutput = z.infer<typeof SimulateMobaMatchOutputSchema>;

/**
 * Процедурный откат. Теперь включает структуру scoreboard.
 */
function generateFallbackSimulation(input: SimulateMobaMatchInput): SimulateMobaMatchOutput {
  const scoreboard = [...input.teamA.heroes, ...input.teamB.heroes].map(h => ({
    name: h.name,
    team: input.teamA.heroes.some(th => th.name === h.name) ? 'A' : 'B',
    kda: "0/0/0",
    gpm: 450
  }));

  const forcedScoreA = input.scoreA !== undefined ? input.scoreA : 1;
  const forcedScoreB = input.scoreB !== undefined ? input.scoreB : 1;
  const winner = forcedScoreA > forcedScoreB ? input.teamA.name : (forcedScoreA < forcedScoreB ? input.teamB.name : "Draw");

  return {
    winner, scoreA: forcedScoreA, scoreB: forcedScoreB, duration: "34:12", 
    mvp: input.teamA.heroes[0]?.name || "Unknown Unit",
    matchSummary: "Fallback simulation active due to AI unavailability.",
    preview: { teamAOrv: 35, teamBOrv: 35, keyMatchup: "Midlane battle", winProbabilityA: 50 },
    timeline: [{ phase: 'Mid', time: '15:00', event: 'Equal trade in jungle', score: `${forcedScoreA}:${forcedScoreB}` }],
    postMatch: {
      lineRatings: { laning: { a: 70, b: 70 }, teamfight: { a: 70, b: 70 }, macro: { a: 70, b: 70 }, mental: { a: 70, b: 70 } },
      scoreboard: scoreboard,
      analysis: "Mathematical parity (Fallback Engine)."
    },
    teamStats: { teamA: { kills: 15, towersDestroyed: 7 }, teamB: { kills: 15, towersDestroyed: 7 } },
    heroPerformance: scoreboard.map(s => ({ heroName: s.name, kills: 0, deaths: 0, assists: 0 }))
  };
}

export async function simulateMobaMatch(input: SimulateMobaMatchInput): Promise<SimulateMobaMatchOutput> {
  try {
    const {output} = await simulateMobaMatchFlow(input);
    if (!output) return generateFallbackSimulation(input);
    return output;
  } catch (error: any) {
    console.error("AI Simulation failed. Fallback active.", error.message);
    return generateFallbackSimulation(input);
  }
}

const prompt = ai.definePrompt({
  name: 'simulateMobaMatchPrompt',
  input: {schema: SimulateMobaMatchInputSchema},
  output: {schema: SimulateMobaMatchOutputSchema},
  prompt: `Действуй как архитектурный модуль симуляции матчей для игры Lines of Enmity. Твоя задача — сгенерировать полные данные для матча, учитывая 10 характеристик игроков. Генерируй данные ПОШАГОВО (Preview, Timeline, PostMatch).

ДАННЫЕ КОМАНД:
Команда А: {{{teamA.name}}} (Стратегия: {{{teamA.strategy}}})
Герои Команды А:
{{#each teamA.heroes}}
- {{{name}}} ({{{role}}}), OVR: {{{overallRating}}}, Sub: {{#if isSub}}Да{{else}}Нет{{/if}}
  Статы: Добив: {{{proStats.lastHitting}}}, Карта: {{{proStats.mapAwareness}}}, Позиционка: {{{proStats.positioning}}}, Рефлексы: {{{proStats.reflexes}}}, Мана: {{{proStats.manaManagement}}}, Объекты: {{{proStats.objectiveControl}}}, Коммуникация: {{{proStats.communication}}}, Стрессоустойчивость: {{{proStats.tiltResistance}}}, Универсальность: {{{proStats.versatility}}}, Ганкинг: {{{proStats.ganking}}}
{{/each}}

Команда Б: {{{teamB.name}}} (Стратегия: {{{teamB.strategy}}})
Герои Команды Б:
{{#each teamB.heroes}}
- {{{name}}} ({{{role}}}), OVR: {{{overallRating}}}, Sub: {{#if isSub}}Да{{else}}Нет{{/if}}
  Статы: Добив: {{{proStats.lastHitting}}}, Карта: {{{proStats.mapAwareness}}}, Позиционка: {{{proStats.positioning}}}, Рефлексы: {{{proStats.reflexes}}}, Мана: {{{proStats.manaManagement}}}, Объекты: {{{proStats.objectiveControl}}}, Коммуникация: {{{proStats.communication}}}, Стрессоустойчивость: {{{proStats.tiltResistance}}}, Универсальность: {{{proStats.versatility}}}, Ганкинг: {{{proStats.ganking}}}
{{/each}}

ЛОГИКА РАСЧЕТА:
1. Используй веса для 10 характеристик.
2. Фазы: Early (Фарм, Мана, Рефлексы), Mid (Ганки, Карта, Коммуникация), Late (Позиционка, Стресс, Объекты).
3. Механика Тильта: Если разница по золоту большая, игроки с низкой Стрессоустойчивостью получают -10% ко всем характеристикам.
4. Механика Банов: Если Универсальность < 60, игрок играет на 10% слабее.
5. Механика Замен: Sub в составе дает штраф -15% к Коммуникации всей команды.

ТРЕБОВАНИЯ К ВЫВОДУ:
{{#if scoreA}}
ФИНАЛЬНЫЙ СЧЕТ ДОЛЖЕН БЫТЬ СТРОГО: {{{teamA.name}}} {{{scoreA}}} - {{{teamB.name}}} {{{scoreB}}}.
{{/if}}

Заполни объект 'preview' (Stage 1), массив 'timeline' (Stage 2: 5-6 событий) и объект 'postMatch' (Stage 3). 
В 'timeline' описывай события на Top, Mid, Bot или Jungle, связывая их с конкретными статами игроков.`,
});

const simulateMobaMatchFlow = ai.defineFlow(
  {
    name: 'simulateMobaMatchFlow',
    inputSchema: SimulateMobaMatchInputSchema,
    outputSchema: SimulateMobaMatchOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
