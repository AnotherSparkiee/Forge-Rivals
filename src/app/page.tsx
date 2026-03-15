
'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import { useGameState } from './lib/store';
import { BottomNav } from '@/components/game/BottomNav';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Coins, Trophy, Swords, Shield, Zap, Loader2, Clock, Globe, Award, Sparkles } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { LEAGUES } from './lib/leagues-data';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

export default function Home() {
  const { user, isUserLoading } = useUser();
  const db = useFirestore();
  const { credits, rank, team, isLoaded } = useGameState();
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const [showWelcome, setShowWelcome] = useState(false);

  const userRef = useMemoFirebase(() => user ? doc(db, 'user_profiles', user.uid) : null, [db, user]);
  const { data: profile, isLoading: isProfileLoading } = useDoc(userRef);

  useEffect(() => {
    if (!isUserLoading && !user) {
      router.push('/auth/login');
    }
  }, [user, isUserLoading, router]);

  useEffect(() => {
    if (profile && (!profile.selectedLeagueId || !profile.country) && !isProfileLoading) {
      router.push('/setup');
    }
  }, [profile, isProfileLoading, router]);

  useEffect(() => {
    // Если в URL есть welcome=true, показываем попап
    if (searchParams.get('welcome') === 'true') {
      setShowWelcome(true);
      // Очищаем URL от параметра, чтобы при обновлении попап не вылезал снова
      router.replace('/');
    }
  }, [searchParams, router]);

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
    <div className="max-w-md mx-auto px-4 pt-8 pb-24">
      <header className="flex justify-between items-end mb-8">
        <div>
          <h1 className="text-3xl font-headline font-bold text-foreground tracking-tighter uppercase">Командный Центр</h1>
          <div className="flex items-center gap-2 mt-1">
            <Globe className="w-3 h-3 text-accent" />
            <p className="text-muted-foreground text-[10px] uppercase tracking-tighter italic">Тактический HUD: {profile?.country || 'Глобальный'}</p>
          </div>
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
              <span className="text-[10px] text-muted-foreground uppercase">Регион: {profile?.country}</span>
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

      {/* Модальное окно приветствия */}
      <Dialog open={showWelcome} onOpenChange={setShowWelcome}>
        <DialogContent className="glass-card border-primary/50 max-w-[90vw] rounded-2xl">
          <DialogHeader className="flex flex-col items-center gap-4 py-4">
            <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center animate-bounce">
              <Sparkles className="w-8 h-8 text-primary" />
            </div>
            <DialogTitle className="text-2xl font-headline font-bold text-center uppercase tracking-tighter">
              Инициализация завершена
            </DialogTitle>
            <DialogDescription className="text-center text-sm leading-relaxed space-y-4">
              <span className="block text-primary font-bold uppercase text-lg mb-2">
                Приветствуем, Командир {profile?.username || user?.email?.split('@')[0]}!
              </span>
              <span className="block italic">
                "Поздравляем вас с началом карьеры нового командующего! Нейролинк с региональным узлом {profile?.country} успешно установлен. Все системы управления ростером в норме."
              </span>
              <span className="block">
                Ваша команда зачислена в <strong className="text-accent">{league?.name}</strong>. Время начала боевых операций: <strong className="text-accent">{league?.startTime}</strong>.
              </span>
              <span className="block font-bold text-primary uppercase pt-2">
                Удачи на полях сражений!
              </span>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => setShowWelcome(false)} className="w-full hero-gradient font-headline font-bold">
              ПРИНЯТЬ КОМАНДОВАНИЕ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <BottomNav />
    </div>
  );
}
