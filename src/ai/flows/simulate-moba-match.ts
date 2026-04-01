
'use server';
/**
 * @fileOverview A MOBA match simulation AI agent.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const HeroStatsSchema = z.object({
  name: z.string().describe('The name of the hero.'),
  role: z
    .string()
    .describe(
      'The primary role of the hero (e.g., Tank, Carry, Support, Midlaner, Jungler).'
    ),
  baseStats: z
    .object({
      attack: z.number().describe('Hero basic attack power.'),
      defense: z.number().describe('Hero basic defense rating.'),
      health: z.number().describe('Hero maximum health points.'),
      abilityPower: z.number().describe('Hero ability power for spell damage.'),
      speed: z.number().describe('Hero movement speed.'),
    })
    .describe('Base statistics for the hero.'),
  abilitiesFocus: z
    .string()
    .describe(
      'The strategic focus for this hero\'s abilities (e.g., "Aggressive", "Defensive", "Utility", "Burst Damage", "Sustain").'
    ),
});

const TeamSchema = z.object({
  name: z.string().describe('The name of the team.'),
  heroes: z.array(HeroStatsSchema).describe('The roster of heroes for this team.'),
  strategy: z
    .string()
    .describe('A description of the overall team strategy.'),
});

const SimulateMobaMatchInputSchema = z.object({
  teamA: TeamSchema.describe('Details for Team A.'),
  teamB: TeamSchema.describe('Details for Team B.'),
  includeRandomEvents: z
    .boolean()
    .default(true)
    .describe(
      'Whether to include random in-game events that can influence the match outcome.'
    ),
  isBo2: z.boolean().default(true).describe('Whether this is a Best of 2 series (result MUST be 2:0, 1:1, or 0:2).'),
  isBo3: z.boolean().default(false).describe('Whether this is a Best of 3 series (result MUST be 2:0, 2:1, 1:2, or 0:2). No Draws allowed.'),
  scoreA: z.number().optional().describe('Force score for Team A.'),
  scoreB: z.number().optional().describe('Force score for Team B.'),
});
export type SimulateMobaMatchInput = z.infer<typeof SimulateMobaMatchInputSchema>;

const MatchTeamStatsSchema = z
  .object({
    kills: z.number().describe('Total kills achieved by the team.'),
    deaths: z.number().describe('Total deaths suffered by the team.'),
    assists: z.number().describe('Total assists achieved by the team.'),
    towersDestroyed: z.number().describe('Number of enemy towers destroyed.'),
    objectivesTaken: z
      .array(z.string())
      .describe('List of major objectives taken (e.g., "Dragon", "Baron", "Rosh").'),
  })
  .describe('Summary statistics for a team in the match.');

const HeroMatchPerformanceSchema = z
  .object({
    heroName: z.string().describe('The name of the hero.'),
    teamName: z
      .string()
      .describe('The name of the team this hero belongs to.'),
    kills: z.number().describe('Kills achieved by this hero.'),
    deaths: z.number().describe('Deaths suffered by this hero.'),
    assists: z.number().describe('Assists achieved by this hero.'),
    damageDealt: z.number().describe('Total damage dealt by this hero.'),
    damageTaken: z.number().describe('Total damage taken by this hero.'),
    healingDone: z
      .number()
      .optional()
      .describe('Total healing done by this hero, if applicable.'),
  })
  .describe('Detailed performance statistics for a single hero in the match.');

const SimulateMobaMatchOutputSchema = z.object({
  winner: z.string().describe('The name of the winning team.'),
  scoreA: z.number().describe('Score for Team A.'),
  scoreB: z.number().describe('Score for Team B.'),
  matchSummary: z
    .string()
    .describe(
      'A narrative summary of the match, highlighting key moments and reasons for victory/defeat.'
    ),
  teamStats: z
    .object({
      teamA: MatchTeamStatsSchema,
      teamB: MatchTeamStatsSchema,
    })
    .describe('Overall statistics for both teams.'),
  heroPerformance: z
    .array(HeroMatchPerformanceSchema)
    .describe('Detailed performance statistics for each hero in the match.'),
});
export type SimulateMobaMatchOutput = z.infer<
  typeof SimulateMobaMatchOutputSchema
>;

/**
 * Procedural fallback for match simulation when AI quota is exhausted.
 */
function generateFallbackSimulation(input: SimulateMobaMatchInput): SimulateMobaMatchOutput {
  let scoreA = 0;
  let scoreB = 0;

  if (input.scoreA !== undefined && input.scoreB !== undefined) {
    scoreA = input.scoreA;
    scoreB = input.scoreB;
  } else if (input.isBo3) {
    // Bo3 logic: random 2:0 or 2:1
    const winA = Math.random() > 0.5;
    const cleanSheet = Math.random() > 0.6;
    if (winA) {
      scoreA = 2;
      scoreB = cleanSheet ? 0 : 1;
    } else {
      scoreB = 2;
      scoreA = cleanSheet ? 0 : 1;
    }
  } else {
    // Bo2 logic
    scoreA = Math.random() > 0.5 ? 2 : 0;
    scoreB = scoreA === 2 ? 0 : (scoreA === 1 ? 1 : 2);
  }
  
  const winner = scoreA > scoreB ? input.teamA.name : (scoreA < scoreB ? input.teamB.name : "Draw");
  const gamesPlayed = scoreA + scoreB;
  
  const genTeamStats = (score: number, opponentScore: number) => ({
    kills: (10 * gamesPlayed) + Math.floor(Math.random() * 15) + (score * 5),
    deaths: (10 * gamesPlayed) + Math.floor(Math.random() * 15) + (opponentScore * 5),
    assists: (20 * gamesPlayed) + Math.floor(Math.random() * 20),
    towersDestroyed: score === 2 ? 11 : (score === 1 ? 7 : Math.floor(Math.random() * 5)),
    objectivesTaken: score >= 1 ? ["Dragon", "Tower"] : ["Tower"]
  });

  const heroPerformance: any[] = [];
  const processHeroes = (heroes: any[], teamName: string) => {
    heroes.forEach(h => {
      heroPerformance.push({
        heroName: h.name,
        teamName: teamName,
        kills: Math.floor(Math.random() * (8 * gamesPlayed)),
        deaths: Math.floor(Math.random() * (6 * gamesPlayed)),
        assists: Math.floor(Math.random() * (12 * gamesPlayed)),
        damageDealt: 15000 + Math.floor(Math.random() * 30000 * gamesPlayed),
        damageTaken: 10000 + Math.floor(Math.random() * 40000 * gamesPlayed),
        healingDone: h.role === 'Support' ? 5000 + Math.floor(Math.random() * 10000 * gamesPlayed) : 0
      });
    });
  };

  processHeroes(input.teamA.heroes, input.teamA.name);
  processHeroes(input.teamB.heroes, input.teamB.name);

  return {
    winner,
    scoreA,
    scoreB,
    matchSummary: `The engagement between ${input.teamA.name} and ${input.teamB.name} was decided by superior tactical positioning. Format: ${input.isBo3 ? "Bo3" : "Bo2"}. (Tactical Fallback Protocol Active)`,
    teamStats: {
      teamA: genTeamStats(scoreA, scoreB),
      teamB: genTeamStats(scoreB, scoreA)
    },
    heroPerformance
  };
}

export async function simulateMobaMatch(
  input: SimulateMobaMatchInput
): Promise<SimulateMobaMatchOutput> {
  try {
    const result = await simulateMobaMatchFlow(input);
    return result;
  } catch (error: any) {
    console.warn("AI Simulation failed (Quota/Error). Triggering fallback logic.", error.message);
    return generateFallbackSimulation(input);
  }
}

const prompt = ai.definePrompt({
  name: 'simulateMobaMatchPrompt',
  input: {schema: SimulateMobaMatchInputSchema},
  output: {schema: SimulateMobaMatchOutputSchema},
  prompt: `You are an expert MOBA match simulator. 

{{#if isBo3}}
Tournament Format: Best of 3 (Bo3). The first team to win 2 maps wins the match.
Result MUST be one of: 2-0, 2-1, 1-2, 0-2. NO DRAWS.
{{else}}
Tournament Format: Best of 2 (Bo2).
Result MUST be one of: 2-0, 1-1, 0-2.
{{/if}}

Consider Team A:
Team Name: {{{teamA.name}}}
Team Strategy: {{{teamA.strategy}}}
Team Heroes:
{{#each teamA.heroes}}
- Hero Name: {{{name}}}
  Role: {{{role}}}
{{/each}}

Consider Team B:
Team Name: {{{teamB.name}}}
Team Strategy: {{{teamB.strategy}}}
Team Heroes:
{{#each teamB.heroes}}
- Hero Name: {{{name}}}
  Role: {{{role}}}
{{/each}}

{{#if scoreA}}
CRITICAL REQUIREMENT: The final score MUST be strictly Team A: {{{scoreA}}} - Team B: {{{scoreB}}}.
Generate a match narrative and statistics that lead to this exact outcome.
{{/if}}

Provide a detailed narrative match summary and precise statistics for both teams and individual heroes based on the required outcome.`,
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
