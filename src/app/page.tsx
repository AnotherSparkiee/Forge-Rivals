'use client';

import { useGameState } from './lib/store';
import { BottomNav } from '@/components/game/BottomNav';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Coins, Trophy, Swords, Shield, Zap } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default function Home() {
  const { credits, rank, team, isLoaded } = useGameState();

  if (!isLoaded) return null;

  return (
    <div className="max-w-md mx-auto px-4 pt-8">
      <header className="flex justify-between items-end mb-8">
        <div>
          <h1 className="text-3xl font-headline font-bold text-foreground">MOBA TACTICS</h1>
          <p className="text-muted-foreground text-sm">Manager Online</p>
        </div>
        <div className="flex items-center gap-2 bg-secondary/50 px-3 py-1 rounded-full border border-white/5">
          <Coins className="w-4 h-4 text-yellow-500" />
          <span className="font-bold text-sm">{credits}</span>
        </div>
      </header>

      <section className="space-y-4 mb-8">
        <Card className="glass-card overflow-hidden">
          <div className="hero-gradient h-2" />
          <CardHeader className="pb-2">
            <CardTitle className="flex justify-between items-center text-lg font-headline">
              Current Rank
              <span className="text-accent text-2xl">#{rank}</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 mb-2">
              <Trophy className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium">Diamond League Progress</span>
            </div>
            <Progress value={65} className="h-2" />
          </CardContent>
        </Card>

        <div className="grid grid-cols-2 gap-4">
          <Link href="/match" className="block">
            <Button className="w-full h-24 flex-col gap-2 hero-gradient border-none hover:opacity-90 transition-opacity">
              <Swords className="w-8 h-8" />
              <span className="font-headline font-bold uppercase tracking-widest text-xs">Queue Match</span>
            </Button>
          </Link>
          <Link href="/roster" className="block">
            <Button variant="secondary" className="w-full h-24 flex-col gap-2 glass-card">
              <Shield className="w-8 h-8 text-accent" />
              <span className="font-headline font-bold uppercase tracking-widest text-xs">Manage Team</span>
            </Button>
          </Link>
        </div>
      </section>

      <section className="space-y-4 mb-8">
        <h2 className="text-lg font-headline font-bold flex items-center gap-2">
          <Zap className="w-5 h-5 text-primary" />
          Active Roster
        </h2>
        <div className="grid grid-cols-5 gap-2">
          {team.map((hero) => (
            <div key={hero.id} className="aspect-[2/3] rounded-lg overflow-hidden border border-white/10 relative group bg-muted">
              <img 
                src={hero.image} 
                alt={hero.name} 
                className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all"
              />
              <div className="absolute bottom-0 left-0 right-0 bg-black/60 p-1">
                <p className="text-[8px] truncate font-bold uppercase">{hero.name}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-headline font-bold">Recent Intelligence</h2>
        <Card className="glass-card">
          <CardContent className="p-4 text-sm text-muted-foreground italic">
            "The enemy meta is shifting towards heavy sustain. Consider recruiting Aura Bloom to counter burst strategies."
          </CardContent>
        </Card>
      </section>

      <BottomNav />
    </div>
  );
}