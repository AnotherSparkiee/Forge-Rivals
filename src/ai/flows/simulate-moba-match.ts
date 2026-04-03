
'use server';
/**
 * @fileOverview Продвинутый математический симулятор MOBA-матчей.
 * 
 * Логика учитывает 10 характеристик игроков, фазы игры, механику тильта и замен.
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
  role: z.string().describe('Роль героя (Carry, Support и т.д.).'),
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
  matchSummary: z.string().describe('Полный отчет: Анализ, Хронология, Статистика, MVP, Вердикт.'),
  teamStats: z.object({
    teamA: z.object({ kills: z.number(), towersDestroyed: z.number() }),
    teamB: z.object({ kills: z.number(), towersDestroyed: z.number() }),
  }),
  duration: z.string().describe('Длительность матча (например, "34:12").'),
  mvp: z.string().describe('MVP матча.'),
  heroPerformance: z.array(z.object({
    heroName: z.string(),
    kills: z.number(),
    deaths: z.number(),
    assists: z.number(),
  })),
});
export type SimulateMobaMatchOutput = z.infer<typeof SimulateMobaMatchOutputSchema>;

/**
 * Процедурный откат на случай сбоя ИИ.
 */
function generateFallbackSimulation(input: SimulateMobaMatchInput): SimulateMobaMatchOutput {
  const scoreA = input.scoreA ?? 1;
  const scoreB = input.scoreB ?? 1;
  const winner = scoreA > scoreB ? input.teamA.name : (scoreA < scoreB ? input.teamB.name : "Draw");
  
  return {
    winner,
    scoreA,
    scoreB,
    matchSummary: `Матч между ${input.teamA.name} и ${input.teamB.name} завершился со счетом ${scoreA}:${scoreB}. (Активирован протокол экстренной симуляции)`,
    teamStats: {
      teamA: { kills: 15, towersDestroyed: 7 },
      teamB: { kills: 15, towersDestroyed: 7 }
    },
    duration: "32:00",
    mvp: input.teamA.heroes[0].name,
    heroPerformance: []
  };
}

export async function simulateMobaMatch(input: SimulateMobaMatchInput): Promise<SimulateMobaMatchOutput> {
  try {
    const {output} = await simulateMobaMatchFlow(input);
    return output!;
  } catch (error: any) {
    console.warn("AI Simulation failed. Fallback active.", error.message);
    return generateFallbackSimulation(input);
  }
}

const prompt = ai.definePrompt({
  name: 'simulateMobaMatchPrompt',
  input: {schema: SimulateMobaMatchInputSchema},
  output: {schema: SimulateMobaMatchOutputSchema},
  prompt: `Действуй как продвинутый математический симулятор MOBA-матчей. Твоя задача — провести детальный расчет игры между двумя командами.

ДАННЫЕ КОМАНД:
Команда А: {{{teamA.name}}}
Стратегия: {{{teamA.strategy}}}
Герои Команды А:
{{#each teamA.heroes}}
- {{{name}}} ({{{role}}}), OVR: {{{overallRating}}}, Sub: {{#if isSub}}Да{{else}}Нет{{/if}}
  Статы: Добив: {{{proStats.lastHitting}}}, Карта: {{{proStats.mapAwareness}}}, Позиционка: {{{proStats.positioning}}}, Рефлексы: {{{proStats.reflexes}}}, Мана: {{{proStats.manaManagement}}}, Объекты: {{{proStats.objectiveControl}}}, Коммуникация: {{{proStats.communication}}}, Стрессоустойчивость: {{{proStats.tiltResistance}}}, Универсальность: {{{proStats.versatility}}}, Ганкинг: {{{proStats.ganking}}}
{{/each}}

Команда Б: {{{teamB.name}}}
Стратегия: {{{teamB.strategy}}}
Герои Команды Б:
{{#each teamB.heroes}}
- {{{name}}} ({{{role}}}), OVR: {{{overallRating}}}, Sub: {{#if isSub}}Да{{else}}Нет{{/if}}
  Статы: Добив: {{{proStats.lastHitting}}}, Карта: {{{proStats.mapAwareness}}}, Позиционка: {{{proStats.positioning}}}, Рефлексы: {{{proStats.reflexes}}}, Мана: {{{proStats.manaManagement}}}, Объекты: {{{proStats.objectiveControl}}}, Коммуникация: {{{proStats.communication}}}, Стрессоустойчивость: {{{proStats.tiltResistance}}}, Универсальность: {{{proStats.versatility}}}, Ганкинг: {{{proStats.ganking}}}
{{/each}}

ПРАВИЛА РАСЧЕТА:
1. Early Game (0–12 мин): Приоритет — Добив крипов, Менеджмент маны и Рефлексы. Победитель получает преимущество по золоту.
2. Mid Game (12–25 мин): Приоритет — Ганкинг, Контроль карты и Коммуникация. Решается судьба вышек.
3. Late Game (25+ мин): Приоритет — Позиционка, Рефлексы, Стрессоустойчивость и Объекты.
4. Механика Тильта: Если разница по золоту критическая, игроки с низкой Стрессоустойчивостью получают -10% ко всем характеристикам.
5. Механика Банов: Если Универсальность < 60, игрок играет на 10% слабее своего рейтинга.
6. Механика Замен: Наличие Sub в составе дает штраф -15% к Коммуникации всей команды.

ТРЕБОВАНИЯ К СЧЕТУ:
{{#if scoreA}}
ФИНАЛЬНЫЙ СЧЕТ ДОЛЖЕН БЫТЬ СТРОГО: {{{teamA.name}}} {{{scoreA}}} - {{{teamB.name}}} {{{scoreB}}}.
{{else}}
Рассчитай результат на основе математической модели (Bo2 или Bo3 формат).
{{/if}}

СТРУКТУРА ОТЧЕТА (поле matchSummary):
1. Анализ составов: Сравнение сильных и слабых сторон.
2. Хронология матча: 4-5 ключевых событий с привязкой к характеристикам.
3. Вердикт: Математическая причина победы.

Заполни все поля выходной схемы корректно.`,
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
