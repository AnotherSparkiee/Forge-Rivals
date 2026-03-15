'use client';

import { useGameState } from './lib/store';
import { 
  Swords, Users, Trophy, TrendingUp, 
  ShoppingCart, Newspaper, Shield, Star, 
  ChevronRight, Wallet, Target
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';

export default function Home() {
  const { credits, rank, team, strategy, isLoaded } = useGameState();

  if (!isLoaded) return null;

  const quickStats = [
    { label: 'Credits', value: credits, icon: Wallet, color: 'text-yellow-400' },
    { label: 'Rank', value: rank, icon: Star, color: 'text-primary' },
    { label: 'Team Size', value: `${team.length}/5`, icon: Users, color: 'text-accent' },
  ];

  const menuItems = [
    { label: 'Battle Simulation', href: '/match', icon: Swords, desc: 'Deploy team for automated matches', active: true },
    { label: 'Team Roster', href: '/roster', icon: Users, desc: 'Manage your active hero lineup', active: true },
    { label: 'Leaderboards', href: '/rankings', icon: Trophy, desc: 'Check your standing in the league', active: true },
    { label: 'Marketplace', href: '#', icon: ShoppingCart, desc: 'Purchase new heroes and boosts', active: false },
    { label: 'Team Stats', href: '#', icon: TrendingUp, desc: 'Detailed performance analytics', active: false },
    { label: 'Clubhouse', href: '#', icon: Shield, desc: 'Join associations and tournaments', active: false },
    { label: 'News Feed', href: '#', icon: Newspaper, desc: 'Latest updates from the MOBA world', active: false },
  ];

  return (
    <div className="max-w-md mx-auto px-4 pt-8 pb-12">
      <header className="mb-8">
        <h1 className="text-3xl font-headline font-bold tracking-tighter text-primary">COMMAND CENTER</h1>
        <p className="text-muted-foreground text-sm uppercase tracking-widest">Manager Hub Alpha-1</p>
      </header>

      {/* Quick Stats Grid */}
      <div className="grid grid-cols-3 gap-3 mb-8">
        {quickStats.map((stat) => (
          <Card key={stat.label} className="glass-card">
            <CardContent className="p-3 flex flex-col items-center">
              <stat.icon className={`w-4 h-4 mb-1 ${stat.color}`} />
              <span className="text-lg font-bold font-headline">{stat.value}</span>
              <span className="text-[8px] uppercase text-muted-foreground">{stat.label}</span>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Primary Action */}
      <Link href="/match" className="block mb-8">
        <Button className="w-full h-20 hero-gradient border-none shadow-xl hover:opacity-90 transition-all flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <Swords className="w-6 h-6" />
            <span className="text-xl font-headline font-bold italic">ENTER BATTLE</span>
          </div>
          <span className="text-[10px] opacity-80 uppercase tracking-widest">Current Strategy: {strategy}</span>
        </Button>
      </Link>

      {/* Hub Navigation */}
      <div className="space-y-4">
        <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-accent px-1">Navigation Terminals</h2>
        <div className="space-y-2">
          {menuItems.map((item) => (
            <Link 
              key={item.label} 
              href={item.active ? item.href : '#'} 
              className={item.active ? 'block' : 'block cursor-not-allowed opacity-60'}
            >
              <Card className="glass-card hover:bg-white/5 transition-colors border-white/5">
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="p-2 rounded-lg bg-secondary/50">
                      <item.icon className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold uppercase">{item.label}</h3>
                      <p className="text-[10px] text-muted-foreground">{item.desc}</p>
                    </div>
                  </div>
                  {item.active ? (
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  ) : (
                    <Badge variant="outline" className="text-[8px] uppercase">Coming Soon</Badge>
                  )}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
