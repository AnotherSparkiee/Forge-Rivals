
'use client';

import { useState } from 'react';
import { useGameState } from '../lib/store';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Swords, Loader2, Trophy, Skull, Crosshair, Play, ChevronLeft } from 'lucide-react';
import { simulateMobaMatch, SimulateMobaMatchOutput } from '@/ai/flows/simulate-moba-match';
import { INITIAL_HEROES } from '../lib/moba-data';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import Link from 'next/link';

export default function MatchPage() {
  const { team, strategy, recordMatch, isLoaded } = useGameState();
  const [isSimulating, setIsSimulating] = useState(false);
  const [matchResult, setMatchResult] = useState<SimulateMobaMatchOutput | null>(null);

  if (!isLoaded) return null;

  const runSimulation = async () => {
    setIsSimulating(true);
    setMatchResult(null);
    try {
      const opponentTeam = {
        name: "Shadow Realm Challengers",
        strategy: "All-in Aggression",
        heroes: INITIAL_HEROES.map(h => ({
          ...h,
          baseStats: { ...h.baseStats, attack: h.baseStats.attack + 5 }
        }))
      };

      const result = await simulateMobaMatch({
        teamA: {
          name: "My Team",
          strategy: strategy,
          heroes: team
        },
        teamB: opponentTeam,
        includeRandomEvents: true
      });

      setMatchResult(result);
      recordMatch(result.winner, result);
    } catch (error) {
      console.error(error);
    } finally {
      setIsSimulating(false);
    }
  };

  const isWin = matchResult && matchResult.scoreA === 1 && matchResult.scoreB === 0;
  const isDraw = matchResult && matchResult.scoreA === 1 && matchResult.scoreB === 1;

  return (
    <div className="max-w-md mx-auto px-4 pt-8 pb-12">
      <header className="mb-6 flex items-center gap-4">
        <Link href="/">
          <Button variant="ghost" size="icon" className="rounded-full">
            <ChevronLeft className="w-6 h-6" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-headline font-bold">WAR ROOM</h1>
          <p className="text-muted-foreground text-sm">Deploy your team for simulation.</p>
        </div>
      </header>

      {!matchResult && !isSimulating && (
        <div className="space-y-6">
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="text-base uppercase tracking-wider font-headline text-accent">Deployment Preview</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                {team.map((hero) => (
                  <div key={hero.id} className="w-16 flex-shrink-0">
                    <div className="aspect-[3/4] rounded-md overflow-hidden bg-muted mb-1">
                      <img src={hero.image} alt={hero.name} className="w-full h-full object-cover" />
                    </div>
                    <p className="text-[8px] truncate font-bold uppercase text-center">{hero.name}</p>
                  </div>
                ))}
              </div>
              <div className="mt-4 pt-4 border-t border-white/5 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-muted-foreground">Team Strategy</span>
                  <Badge variant="secondary" className="text-[10px]">{strategy}</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-muted-foreground">Match Type</span>
                  <span className="text-xs font-bold text-primary">Competitive League</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Button 
            onClick={runSimulation} 
            disabled={team.length === 0}
            className="w-full h-16 hero-gradient font-headline font-bold text-lg border-none shadow-lg hover:opacity-90 transition-all"
          >
            <Swords className="mr-2 w-6 h-6" />
            START SIMULATION
          </Button>
        </div>
      )}

      {isSimulating && (
        <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-6">
          <div className="relative">
            <Loader2 className="w-20 h-20 text-primary animate-spin" />
            <Swords className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 text-accent animate-pulse" />
          </div>
          <div className="text-center space-y-2">
            <h2 className="text-xl font-headline font-bold animate-pulse text-accent">CALCULATING OUTCOME...</h2>
            <p className="text-sm text-muted-foreground italic">"Analyzing jungle pathing and teamfight synergies"</p>
          </div>
        </div>
      )}

      {matchResult && (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className={cn(
            "rounded-xl p-6 text-center mb-6 border",
            isWin ? "bg-primary/10 border-primary/50" : isDraw ? "bg-accent/10 border-accent/20" : "bg-destructive/10 border-destructive/50"
          )}>
            <Trophy className={cn("w-16 h-16 mx-auto mb-3", isWin ? "text-primary" : isDraw ? "text-accent" : "text-muted-foreground")} />
            <h2 className="text-3xl font-headline font-bold mb-1">
              {isWin ? "VICTORY" : isDraw ? "DRAW" : "DEFEAT"}
            </h2>
            <p className="text-sm opacity-80 uppercase tracking-widest">
              {isWin ? "+200 Credits | +25 Rank" : isDraw ? "+100 Credits | +5 Rank" : "+50 Credits | -15 Rank"}
            </p>
          </div>

          <Card className="glass-card mb-6">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-headline uppercase text-accent">Match Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-relaxed text-muted-foreground">{matchResult.matchSummary}</p>
            </CardContent>
          </Card>

          <div className="grid grid-cols-2 gap-4 mb-6">
            <Card className="bg-secondary/20">
              <CardContent className="p-4 flex flex-col items-center">
                <Skull className="w-6 h-6 text-red-400 mb-2" />
                <span className="text-2xl font-bold">{matchResult.teamStats.teamA.kills}</span>
                <span className="text-[10px] text-muted-foreground uppercase">Kills</span>
              </CardContent>
            </Card>
            <Card className="bg-secondary/20">
              <CardContent className="p-4 flex flex-col items-center">
                <Crosshair className="w-6 h-6 text-blue-400 mb-2" />
                <span className="text-2xl font-bold">{matchResult.teamStats.teamA.towersDestroyed}</span>
                <span className="text-[10px] text-muted-foreground uppercase">Towers</span>
              </CardContent>
            </Card>
          </div>

          <Button onClick={() => setMatchResult(null)} variant="outline" className="w-full mb-8">
            RETURN TO COMMAND
          </Button>
        </div>
      )}
    </div>
  );
}
