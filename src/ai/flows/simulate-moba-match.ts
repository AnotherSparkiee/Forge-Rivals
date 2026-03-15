
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
  isBo2: z.boolean().default(true).describe('Whether this is a Best of 2 series (can result in 1:0, 1:1, 0:1).'),
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
  winner: z.string().describe('The name of the winning team (or "Draw").'),
  scoreA: z.number().describe('Score for Team A (strictly 1 or 0).'),
  scoreB: z.number().describe('Score for Team B (strictly 1 or 0).'),
  matchSummary: z
    .string()
    .describe(
      'A narrative summary of the match, highlighting key moments and reasons for victory/defeat/draw.'
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

export async function simulateMobaMatch(
  input: SimulateMobaMatchInput
): Promise<SimulateMobaMatchOutput> {
  return simulateMobaMatchFlow(input);
}

const prompt = ai.definePrompt({
  name: 'simulateMobaMatchPrompt',
  input: {schema: SimulateMobaMatchInputSchema},
  output: {schema: SimulateMobaMatchOutputSchema},
  prompt: `You are an expert MOBA match simulator. Your task is to simulate a match between two teams.

Consider the following input for Team A:
Team Name: {{{teamA.name}}}
Team Strategy: {{{teamA.strategy}}}
Team Heroes:
{{#each teamA.heroes}}
- Hero Name: {{{name}}}
  Role: {{{role}}}
{{/each}}

Consider the following input for Team B:
Team Name: {{{teamB.name}}}
Team Strategy: {{{teamB.strategy}}}
Team Heroes:
{{#each teamB.heroes}}
- Hero Name: {{{name}}}
  Role: {{{role}}}
{{/each}}

You MUST return a score of strictly 1-0, 1-1, or 0-1.
- 1-0: Team A wins.
- 1-1: Draw, teams are equal in performance.
- 0-1: Team B wins.

Provide a detailed narrative match summary and precise statistics for both teams and individual heroes.`,
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
