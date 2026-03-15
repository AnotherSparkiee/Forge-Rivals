'use client';

import { useGameState } from '../lib/store';
import { BottomNav } from '@/components/game/BottomNav';
import { Trophy, Medal, Star } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function RankingsPage() {
  const { rank, isLoaded } = useGameState();

  const mockRankings = [
    { name: "LegendaryPro", rank: 2500, winRate: "78%" },
    { name: "MobaKing42", rank: 2450, winRate: "72%" },
    { name: "TacticalGenius", rank: 2300, winRate: "75%" },
    { name: "VoidWalker", rank: 2100, winRate: "68%" },
    { name: "ShadowStriker", rank: 1950, winRate: "65%" },
    { name: "You", rank: rank, winRate: "54%", isPlayer: true },
    { name: "NoviceManager", rank: 900, winRate: "42%" },
    { name: "TrainingBot1", rank: 850, winRate: "38%" },
  ].sort((a, b) => b.rank - a.rank);

  if (!isLoaded) return null;

  return (
    <div className="max-w-md mx-auto px-4 pt-8">
      <header className="mb-6">
        <h1 className="text-2xl font-headline font-bold flex items-center gap-2">
          <Trophy className="text-yellow-500" />
          LEADERBOARDS
        </h1>
        <p className="text-muted-foreground text-sm">Top managers in the Diamond League.</p>
      </header>

      <div className="space-y-3 mb-8">
        {mockRankings.map((entry, i) => {
          const isTop3 = i < 3;
          return (
            <div 
              key={entry.name} 
              className={cn(
                "flex items-center gap-4 p-4 rounded-xl border transition-all",
                entry.isPlayer ? "bg-primary/20 border-primary/50 shadow-lg shadow-primary/10" : "bg-secondary/20 border-white/5",
                isTop3 && !entry.isPlayer ? "border-yellow-500/30" : ""
              )}
            >
              <div className="w-8 text-center font-headline font-bold text-lg italic">
                {isTop3 ? (
                  <Medal className={cn(
                    "w-6 h-6 mx-auto",
                    i === 0 ? "text-yellow-500" : i === 1 ? "text-gray-400" : "text-amber-600"
                  )} />
                ) : i + 1}
              </div>
              <div className="flex-1">
                <p className={cn("font-bold text-sm uppercase flex items-center gap-2", entry.isPlayer && "text-primary")}>
                  {entry.name}
                  {entry.isPlayer && <Star className="w-3 h-3 fill-current" />}
                </p>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Win Rate: {entry.winRate}</p>
              </div>
              <div className="text-right">
                <p className="text-xl font-headline font-bold text-accent">{entry.rank}</p>
                <p className="text-[8px] text-muted-foreground uppercase">Points</p>
              </div>
            </div>
          );
        })}
      </div>

      <BottomNav />
    </div>
  );
}