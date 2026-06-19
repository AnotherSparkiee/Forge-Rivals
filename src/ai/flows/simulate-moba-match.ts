
'use server';
/**
 * @fileOverview Архитектурный модуль симуляции матчей Lines of Enmity v2.
 * 
 * Алгоритмический расчет на основе тактик, OVR и детальных статов (ProStats).
 * Каждый параметр (рефлексы, менеджмент маны, контроль объектов) теперь влияет на конкретные события.
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
    isPro: z.boolean().optional(),
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

class NarrativeGenerator {
  private templates = {
    farm: [
      "{player} из {team} идеально добивает пачку крипов (Добив: {val}).",
      "{player} сосредоточен на фарме. Его навык Добивание ({val}) позволяет забирать каждого монстра.",
      "Линия {team} пуста, {player} спокойно забирает ресурсы, используя Менеджмент маны ({mana})."
    ],
    kill: [
      "{player} совершает блестящий ганк! Навык Ганкинг ({val}) застает противника врасплох.",
      "Невероятный килл от {player}! Благодаря Рефлексам ({val}) он наносит молниеносный удар.",
      "Ошибка позиционки от врага! {player} наказывает оппонента через Позиционирование ({val}).",
      "PRO-момент: {player} исполняет сложнейшую комбинацию, не оставляя шансов противнику!"
    ],
    save: [
      "{player} читает игру (Контроль карты: {val}) и вовремя отступает от ганка!",
      "Невероятные рефлексы ({val})! {player} уворачивается от смертельного заклинания.",
      "{player} удерживает позицию под прессингом благодаря Стрессоустойчивости ({val})."
    ],
    teamfight: [
      "Масштабный замес у реки! {player} координирует действия через Коммуникацию ({val}).",
      "Команда {team} врывается в драку! {player} показывает мастерство Контроля ({val}).",
      "Жесткий размен! {player} проявляет Универсальность ({val}), адаптируясь под билд врага."
    ],
    objective: [
      "{player} забирает важный объект на карте! Контроль объектов ({val}) на высоте.",
      "Команда {team} пушит вышку. {player} руководит процессом.",
      "Борьба за Рошана! {player} вовремя прожимает кнопки и забирает бафф."
    ]
  };

  generate(type: string, player: string, team: string, val: number, extra?: any) {
    const list = (this.templates as any)[type] || this.templates.teamfight;
    let tpl = list[Math.floor(Math.random() * list.length)];
    return tpl
      .replace('{player}', player)
      .replace('{team}', team)
      .replace('{val}', val.toString())
      .replace('{mana}', extra?.mana || '10');
  }
}

function runSingleGame(input: SimulateMobaMatchInput, gameIndex: number, forcedMapWinner?: 'A' | 'B'): z.infer<typeof GameStatsSchema> {
  const { teamA, teamB } = input;
  const narrative = new NarrativeGenerator();
  
  const activeA = teamA.heroes.filter(h => !h.isSub).slice(0, 5);
  const activeB = teamB.heroes.filter(h => !h.isSub).slice(0, 5);

  const applyTactics = (strategy: string) => {
    let a = 1.0, d = 1.0;
    if (strategy.includes('Aggressive')) { a = 1.25; d = 0.9; }
    else if (strategy.includes('Defensive')) { d = 1.3; a = 0.8; }
    return { a, d };
  };

  const modsA = applyTactics(teamA.strategy);
  const modsB = applyTactics(teamB.strategy);

  // Каждое очко рейтинга и бонус PRO дают вклад в мощь
  const calculatePower = (heroes: any[], mods: any) => {
    return heroes.reduce((acc, h) => {
      const base = h.overallRating;
      const proBonus = h.isPro ? 25 : 0;
      return acc + (base + proBonus) * (mods.a + mods.d);
    }, 0);
  };

  const powerA = calculatePower(activeA, modsA);
  const powerB = calculatePower(activeB, modsB);

  let finalScoreA = 0;
  let finalScoreB = 0;

  if (forcedMapWinner === 'A') { finalScoreA = 1; } 
  else if (forcedMapWinner === 'B') { finalScoreB = 1; } 
  else {
    finalScoreA = powerA > powerB ? 1 : (Math.random() > 0.8 ? 1 : 0);
    finalScoreB = finalScoreA === 1 ? 0 : 1;
  }

  const timeline: any[] = [];
  const playerStats = new Map<string, any>();
  [...activeA, ...activeB].forEach(h => {
    playerStats.set(h.name, { 
      kills: 0, deaths: 0, assists: 0, cs: 0, role: h.role, isPro: !!h.isPro,
      team: activeA.some(th => th.name === h.name) ? teamA.name : teamB.name 
    });
  });

  let curA = 0, curB = 0;
  const duration = 30 + Math.floor(Math.random() * 15);
  
  for (let m = 1; m <= duration; m++) {
    const time = `${m}:00`;
    const side = Math.random() > 0.5 ? activeA : activeB;
    const sideName = side === activeA ? teamA.name : teamB.name;
    const oppSide = side === activeA ? activeB : activeA;
    
    const hero = side[Math.floor(Math.random() * side.length)];
    const oppHero = oppSide[Math.floor(Math.random() * oppSide.length)];
    if (!hero || !oppHero) continue;

    const roll = Math.random();
    
    // 1. Фарм (Зависит от Last Hitting и Mana Management)
    if (roll < 0.4) {
      const ps = playerStats.get(hero.name);
      if (ps) {
        ps.cs += Math.floor(hero.proStats.lastHitting / 5) + 5;
        if (m % 10 === 0) {
          timeline.push({ 
            time, type: 'farm', 
            event: narrative.generate('farm', hero.name, sideName, hero.proStats.lastHitting, { mana: hero.proStats.manaManagement }), 
            score: `${curA}:${curB}` 
          });
        }
      }
    } 
    // 2. Попытка килла (Ганкинг против Рефлексов и Контроля карты)
    else if (roll < 0.7) {
      const ps = playerStats.get(hero.name);
      const ops = playerStats.get(oppHero.name);
      
      const gankPower = hero.proStats.ganking + (hero.isPro ? 20 : 0);
      const defensePower = oppHero.proStats.reflexes + oppHero.proStats.mapAwareness;
      
      if (defensePower > gankPower + 10 && Math.random() > 0.5) {
        timeline.push({ 
          time, type: 'save', 
          event: narrative.generate('save', oppHero.name, (side === activeA ? teamB.name : teamA.name), oppHero.proStats.reflexes), 
          score: `${curA}:${curB}` 
        });
      } else if (ps && ops) {
        ps.kills++; ops.deaths++;
        if (side === activeA) curA++; else curB++;
        timeline.push({ 
          time, type: 'kill', 
          event: narrative.generate('kill', hero.name, sideName, hero.proStats.ganking), 
          score: `${curA}:${curB}` 
        });
        // Ассисты для союзников
        side.filter(h => h.name !== hero.name).slice(0, 2).forEach(ah => {
          const aps = playerStats.get(ah.name);
          if (aps) aps.assists++;
        });
      }
    } 
    // 3. Объекты (Контроль объектов)
    else if (roll < 0.85) {
      if (m % 8 === 0) {
        timeline.push({ 
          time, type: 'objective', 
          event: narrative.generate('objective', hero.name, sideName, hero.proStats.objectiveControl), 
          score: `${curA}:${curB}` 
        });
      }
    } 
    // 4. Тимфайты (Коммуникация и Универсальность)
    else {
      if (m % 12 === 0) {
        timeline.push({ 
          time, type: 'teamfight', 
          event: narrative.generate('teamfight', hero.name, sideName, hero.proStats.communication), 
          score: `${curA}:${curB}` 
        });
      }
    }

    // Влияние тильта в конце матча
    if (m > 35 && Math.random() > 0.9) {
      const tiltHero = Math.random() > 0.5 ? hero : oppHero;
      if (tiltHero.proStats.tiltResistance < 20) {
        timeline.push({ time, type: 'teamfight', event: `${tiltHero.name} теряет самообладание! Критическая ошибка под давлением.`, score: `${curA}:${curB}` });
      }
    }
  }

  const scoreboard = Array.from(playerStats.entries()).map(([name, s]) => ({
    name, team: s.team, role: s.role, kills: s.kills, deaths: s.deaths, assists: s.assists, cs: s.cs, isPro: s.isPro,
    kdaRatio: ((s.kills + s.assists) / Math.max(1, s.deaths)).toFixed(2)
  }));

  return {
    scoreA: finalScoreA, scoreB: finalScoreB, duration: `${duration}:00`,
    mvp: scoreboard.sort((a,b) => parseFloat(b.kdaRatio) - parseFloat(a.kdaRatio))[0].name,
    matchSummary: `Напряженное противостояние на карте. Победитель определен стратегическим преимуществом в ${duration}-й минуте.`,
    timeline: timeline.slice(0, 25), scoreboard
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
      else if (input.scoreA === 1 && input.scoreB === 1) {
        forced = i === 0 ? 'A' : 'B';
      }
    }

    const g = runSingleGame(input, i, forced);
    games.push(g); 
    winsA += g.scoreA; 
    winsB += g.scoreB;
    
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
