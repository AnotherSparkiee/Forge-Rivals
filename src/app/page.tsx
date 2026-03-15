
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import { useGameState } from './lib/store';
import { BottomNav } from '@/components/game/BottomNav';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Coins, Trophy, Swords, Shield, Zap, Loader2, Clock } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { LEAGUES } from './lib/leagues-data';

export default function Home() {
  const { user, isUserLoading } = useUser();
  const db = useFirestore();
  const { credits, rank, team, isLoaded } = useGameState();
  const router = useRouter();

  const userRef = useMemoFirebase(() => user ? doc(db, 'user_profiles', user.uid) : null, [db, user]);
  const { data: profile, isLoading: isProfileLoading } = useDoc(userRef);

  useEffect(() => {
    if (!isUserLoading && !user) {
      router.push('/auth/login');
    }
  }, [user, isUserLoading, router]);

  useEffect(() => {
    if (profile && !profile.selectedLeagueId && !isProfileLoading) {
      router.push('/setup');
    }
  }, [profile, isProfileLoading, router]);

  if (isUserLoading || isProfileLoading || !isLoaded || !user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center space-y-4">
        <Loader2 className="w-12 h-12 text-primary animate-spin" />
        <p className="text-muted-foreground animate-pulse font-headline uppercase tracking-widest text-center px-4">Установка нейролинка с хабом...</p>
      </div>
    );
  }

  const league = LEAGUES.find(l => l.id === profile?.selectedLeagueId);

  return (
    <div className="max-w-md mx-auto px-4 pt-8">
      <header className="flex justify-between items-end mb-8">
        <div>
          <h1 className="text-3xl font-headline font-bold text-foreground tracking-tighter uppercase">Командный Центр</h1>
          <p className="text-muted-foreground text-xs uppercase tracking-tighter italic">Тактический HUD: Активен</p>
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
            <div className="flex justify-between items-center">
              <span className="text-xs text-muted-foreground uppercase tracking-widest">Текущий Ранг</span>
              <span className="text-accent text-xl font-headline font-bold">#{rank}</span>
            </div>
            <CardTitle className="text-lg font-headline flex items-center gap-2">
              <Trophy className="w-5 h-5 text-yellow-500" />
              {league?.name || 'Лига не выбрана'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-primary" />
                <span className="text-xs font-medium">Время игры: {league?.startTime}</span>
              </div>
              <span className="text-[10px] text-muted-foreground uppercase">Прогресс до Diamond</span>
            </div>
            <Progress value={65} className="h-2" />
          </CardContent>
        </Card>

        <div className="grid grid-cols-2 gap-4">
          <Link href="/match" className="block">
            <Button className="w-full h-24 flex-col gap-2 hero-gradient border-none hover:opacity-90 transition-all shadow-lg shadow-primary/20">
              <Swords className="w-8 h-8" />
              <span className="font-headline font-bold uppercase tracking-widest text-[10px]">Встать в очередь</span>
            </Button>
          </Link>
          <Link href="/roster" className="block">
            <Button variant="secondary" className="w-full h-24 flex-col gap-2 glass-card hover:bg-white/5">
              <Shield className="w-8 h-8 text-accent" />
              <span className="font-headline font-bold uppercase tracking-widest text-[10px]">Управление</span>
            </Button>
          </Link>
        </div>
      </section>

      <section className="space-y-4 mb-8">
        <h2 className="text-sm font-headline font-bold flex items-center gap-2 uppercase tracking-widest text-accent">
          <Zap className="w-4 h-4 text-primary" />
          Активный Ростер
        </h2>
        <div className="grid grid-cols-5 gap-2">
          {team.map((hero) => (
            <div key={hero.id} className="aspect-[2/3] rounded-lg overflow-hidden border border-white/10 relative group bg-muted/20">
              <img 
                src={hero.image} 
                alt={hero.name} 
                className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all"
              />
              <div className="absolute bottom-0 left-0 right-0 bg-black/60 p-1">
                <p className="text-[8px] truncate font-bold uppercase text-center">{hero.name}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-sm font-headline font-bold uppercase tracking-widest text-accent">Сводка разведки</h2>
        <Card className="glass-card">
          <CardContent className="p-4 text-xs text-muted-foreground italic leading-relaxed">
            "Добро пожаловать, Командир {profile?.username || user?.email?.split('@')[0]}. Нейролинк стабилен. Ваша команда ожидает приказов для участия в Лиге {league?.id}."
          </CardContent>
        </Card>
      </section>

      <div className="h-24" />
      <BottomNav />
    </div>
  );
}
