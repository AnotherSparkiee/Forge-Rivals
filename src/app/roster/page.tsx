'use client';

import { useGameState } from '../lib/store';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Sword, Shield, Activity, Sparkles, Plus, Check, ChevronLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Hero } from '../lib/moba-data';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';

export default function RosterPage() {
  const { ownedHeroes, team, setTeam, isLoaded } = useGameState();
  const { toast } = useToast();

  if (!isLoaded) return null;

  const toggleTeamMember = (hero: Hero) => {
    const isAlreadyIn = team.find(h => h.id === hero.id);
    if (isAlreadyIn) {
      if (team.length <= 1) {
        toast({ title: "Minimun 1 hero required", variant: "destructive" });
        return;
      }
      setTeam(team.filter(h => h.id !== hero.id));
    } else {
      if (team.length >= 5) {
        toast({ title: "Maximum 5 heroes allowed", variant: "destructive" });
        return;
      }
      setTeam([...team, hero]);
    }
  };

  return (
    <div className="max-w-md mx-auto px-4 pt-8 pb-12">
      <header className="mb-6 flex items-center gap-4">
        <Link href="/">
          <Button variant="ghost" size="icon" className="rounded-full">
            <ChevronLeft className="w-6 h-6" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-headline font-bold">TEAM ROSTER</h1>
          <p className="text-muted-foreground text-sm">Select up to 5 heroes for your active lineup.</p>
        </div>
      </header>

      <div className="flex items-center justify-between mb-4 bg-secondary/30 p-3 rounded-lg border border-white/5">
        <span className="text-sm font-medium">Active Lineup</span>
        <span className="text-primary font-bold">{team.length} / 5</span>
      </div>

      <div className="grid grid-cols-1 gap-4 mb-8">
        {ownedHeroes.map((hero) => {
          const isActive = !!team.find(h => h.id === hero.id);
          return (
            <Card 
              key={hero.id} 
              className={cn(
                "glass-card transition-all cursor-pointer",
                isActive ? "border-primary/50 bg-primary/5" : "hover:border-white/20"
              )}
              onClick={() => toggleTeamMember(hero)}
            >
              <CardContent className="p-3 flex gap-4">
                <div className="w-20 h-28 rounded-md overflow-hidden bg-muted flex-shrink-0">
                  <img src={hero.image} alt={hero.name} className="w-full h-full object-cover" />
                </div>
                <div className="flex-1 min-w-0 flex flex-col justify-between py-1">
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <h3 className="font-bold text-base truncate">{hero.name}</h3>
                      <Badge variant={isActive ? "default" : "secondary"} className="text-[10px] h-5">
                        {hero.role}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                      <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                        <Sword className="w-3 h-3 text-red-400" /> ATK: {hero.baseStats.attack}
                      </div>
                      <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                        <Shield className="w-3 h-3 text-blue-400" /> DEF: {hero.baseStats.defense}
                      </div>
                      <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                        <Activity className="w-3 h-3 text-green-400" /> HP: {hero.baseStats.health}
                      </div>
                      <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                        <Sparkles className="w-3 h-3 text-accent" /> AP: {hero.baseStats.abilityPower}
                      </div>
                    </div>
                  </div>
                  <div className="flex justify-between items-center mt-2">
                    <p className="text-[10px] text-muted-foreground italic truncate max-w-[120px]">
                      Focus: {hero.abilitiesFocus}
                    </p>
                    <div className={cn(
                      "w-6 h-6 rounded-full flex items-center justify-center border",
                      isActive ? "bg-primary border-primary text-primary-foreground" : "border-muted text-muted-foreground"
                    )}>
                      {isActive ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
