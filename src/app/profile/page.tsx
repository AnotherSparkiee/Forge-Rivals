'use client';

import { useGameState } from '../lib/store';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { User, Settings, ShieldCheck, History, LogOut, ChevronRight, Mail, ChevronLeft } from 'lucide-react';
import Link from 'next/link';

export default function ProfilePage() {
  const { credits, rank, ownedHeroes, matchHistory, isLoaded } = useGameState();

  if (!isLoaded) return null;

  return (
    <div className="max-w-md mx-auto px-4 pt-8 pb-12">
      <header className="flex flex-col items-center mb-8 relative">
        <Link href="/" className="absolute left-0 top-0">
          <Button variant="ghost" size="icon" className="rounded-full">
            <ChevronLeft className="w-6 h-6" />
          </Button>
        </Link>
        <div className="w-24 h-24 rounded-full border-4 border-primary/20 p-1 mb-4 bg-secondary">
          <div className="w-full h-full rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center">
            <User className="w-12 h-12 text-primary-foreground" />
          </div>
        </div>
        <h1 className="text-2xl font-headline font-bold">LEGENDARY MANAGER</h1>
        <p className="text-muted-foreground text-sm flex items-center gap-1">
          <Mail className="w-3 h-3" /> manager@moba-tactics.online
        </p>
      </header>

      <div className="grid grid-cols-2 gap-4 mb-8">
        <Card className="glass-card text-center">
          <CardContent className="p-4">
            <p className="text-2xl font-headline font-bold text-primary">{ownedHeroes.length}</p>
            <p className="text-[10px] text-muted-foreground uppercase">Heroes Owned</p>
          </CardContent>
        </Card>
        <Card className="glass-card text-center">
          <CardContent className="p-4">
            <p className="text-2xl font-headline font-bold text-accent">{rank}</p>
            <p className="text-[10px] text-muted-foreground uppercase">Current MMR</p>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4 mb-8">
        <h2 className="text-sm font-headline font-bold text-accent uppercase tracking-widest px-1">Settings & Security</h2>
        <div className="bg-secondary/20 rounded-xl border border-white/5 divide-y divide-white/5">
          <div className="flex items-center justify-between p-4 hover:bg-white/5 transition-colors cursor-pointer">
            <div className="flex items-center gap-3">
              <Settings className="w-5 h-5 text-muted-foreground" />
              <span className="text-sm">Account Preferences</span>
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </div>
          <div className="flex items-center justify-between p-4 hover:bg-white/5 transition-colors cursor-pointer">
            <div className="flex items-center gap-3">
              <ShieldCheck className="w-5 h-5 text-muted-foreground" />
              <span className="text-sm">Security & 2FA</span>
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </div>
          <div className="flex items-center justify-between p-4 hover:bg-white/5 transition-colors cursor-pointer">
            <div className="flex items-center gap-3">
              <History className="w-5 h-5 text-muted-foreground" />
              <span className="text-sm">Purchase History</span>
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </div>
        </div>
      </div>

      <Button variant="destructive" className="w-full mb-8 flex items-center gap-2">
        <LogOut className="w-4 h-4" /> LOG OUT
      </Button>
    </div>
  );
}
