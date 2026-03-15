'use server';
/**
 * @fileOverview A MOBA match simulation AI agent.
 *
 * - simulateMobaMatch - A function that handles the MOBA match simulation process.
 * - SimulateMobaMatchInput - The input type for the simulateMobaMatch function.
 * - SimulateMobaMatchOutput - The return type for the simulateMobaMatch function.
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
  loser: z.string().describe('The name of the losing team.'),
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

export async function simulateMobaMatch(
  input: SimulateMobaMatchInput
): Promise<SimulateMobaMatchOutput> {
  return simulateMobaMatchFlow(input);
}

const prompt = ai.definePrompt({
  name: 'simulateMobaMatchPrompt',
  input: {schema: SimulateMobaMatchInputSchema},
  output: {schema: SimulateMobaMatchOutputSchema},
  prompt: `You are an expert MOBA (Multiplayer Online Battle Arena) match simulator. Your task is to simulate a single MOBA match between two teams based on their roster, hero stats, strategic focus, and overall team strategy.

Consider the following input for Team A:
Team Name: {{{teamA.name}}}
Team Strategy: {{{teamA.strategy}}}
Team Heroes:
{{#each teamA.heroes}}
- Hero Name: {{{name}}}
  Role: {{{role}}}
  Base Stats: Attack={{baseStats.attack}}, Defense={{baseStats.defense}}, Health={{baseStats.health}}, Ability Power={{baseStats.abilityPower}}, Speed={{baseStats.speed}}
  Abilities Focus: {{{abilitiesFocus}}}
{{/each}}

Consider the following input for Team B:
Team Name: {{{teamB.name}}}
Team Strategy: {{{teamB.strategy}}}
Team Heroes:
{{#each teamB.heroes}}
- Hero Name: {{{name}}}
  Role: {{{role}}}
  Base Stats: Attack={{baseStats.attack}}, Defense={{baseStats.defense}}, Health={{baseStats.health}}, Ability Power={{baseStats.abilityPower}}, Speed={{baseStats.speed}}
  Abilities Focus: {{{abilitiesFocus}}}
{{/each}}

{{#if includeRandomEvents}}
During the simulation, incorporate minor random in-game events that can subtly influence the match, such as a hero getting caught out of position, a crucial ability being mistimed, or an unexpected monster camp steal. These events should be integrated naturally into the match summary without being overly disruptive.
{{else}}
Do not include any random in-game events. Focus purely on the clash of strategies and hero power levels.
{{/if}}

Simulate the match from start to finish, describing key phases like the laning stage, mid-game skirmishes, objective contests (e.g., towers, dragons, barons), and the final team fight.
Determine the winning team based on a holistic consideration of hero matchups, team compositions, strategic execution, hero performance, and any incorporated random events.

Provide a detailed narrative match summary and precise statistics for both teams and individual heroes in the exact JSON format specified in the output schema.`,
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
