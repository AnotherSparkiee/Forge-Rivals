
'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import { useGameState } from './lib/store';
import { BottomNav } from '@/components/game/BottomNav';
import { Card, CardContent } from '@/components/ui/card';
import { 
  Swords, Users, UserPlus, TrendingUp, 
  Briefcase, Binoculars, Trophy, Calendar, 
  BarChart3, Medal, Heart, Star, 
  MessageSquare, UserCheck, User, Shield, 
  ShoppingCart, Newspaper, Settings, Search,
  Coins, Loader2, Globe, Sparkles
} from 'lucide-react';
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
import { cn } from '@/lib/utils';

const GRID_ITEMS = [
  { label: 'ОБЗОР МАТЧА', icon: Swords, href: '/match', color: 'text-red-400', active: true },
  { label: 'СОСТАВ', icon: Users, href: '/roster', color: 'text-blue-400', active: true },
  { label: 'ТРАНСФЕРЫ', icon: UserPlus, href: '#', color: 'text-yellow-400' },
  { label: 'РАЗВИТИЕ', icon: TrendingUp, href: '#', color: 'text-green-400' },
  { label: 'ПЕРСОНАЛ', icon: Briefcase, href: '#', color: 'text-purple-400' },
  { label: 'ТАЛАНТЫ', icon: Binoculars, href: '#', color: 'text-sky-400' },
  { label: 'ТАБЛИЦЫ', icon: Trophy, href: '/rankings', color: 'text-orange-400', active: true },
  { label: 'РАСПИСАНИЕ', icon: Calendar, href: '#', color: 'text-indigo-400' },
  { label: 'ФИНАНСЫ', icon: BarChart3, href: '#', color: 'text-emerald-400' },
  { label: 'ТУРНИРЫ', icon: Medal, href: '#', color: 'text-yellow-300' },
  { label: 'ФАН БАЗА', icon: Heart, href: '#', color: 'text-pink-400' },
  { label: 'ТОП СЕЗОНА', icon: Star, href: '#', color: 'text-amber-400' },
  { label: 'ЧАТЫ', icon: MessageSquare, href: '#', color: 'text-cyan-400' },
  { label: 'ДРУЗЬЯ', icon: UserCheck, href: '#', color: 'text-rose-400' },
  { label: 'О СЕБЕ', icon: User, href: '/profile', color: 'text-white', active: true },
  { label: 'АССОЦИАЦИИ', icon: Shield, href: '#', color: 'text-violet-400' },
  { label: 'МАГАЗИН', icon: ShoppingCart, href: '#', color: 'text-lime-400' },
  { label: 'НОВОСТИ', icon: Newspaper, href: '#', color: 'text-teal-400' },
  { label: 'СИСТЕМА', icon: Settings, href: '/profile', color: 'text-slate-400', active: true },
  { label: 'ПОИСК', icon: Search, href: '#', color: 'text-blue-300' },
];

function HubContent() {
  const { user, isUserLoading } = useUser();
  const db = useFirestore();
  const { credits, isLoaded } = useGameState();
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
    if (searchParams.get('welcome') === 'true') {
      setShowWelcome(true);
      router.replace('/');
    }
  }, [searchParams, router]);

  if (isUserLoading || isProfileLoading || !isLoaded || !user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center space-y-4 bg-background text-foreground">
        <Loader2 className="w-12 h-12 text-primary animate-spin" />
        <p className="text-muted-foreground animate-pulse font-headline uppercase tracking-widest text-center px-4">Установка нейролинка с хабом...</p>
      </div>
    );
  }

  const league = LEAGUES.find(l => l.id === profile?.selectedLeagueId);

  return (
    <div className="max-w-md mx-auto px-4 pt-6 pb-24 min-h-screen bg-background text-foreground">
      {/* Шапка */}
      <header className="flex justify-between items-center mb-6">
        <div className="flex flex-col">
          <h1 className="text-xl font-headline font-bold uppercase tracking-tighter text-primary">HUD: {profile?.username}</h1>
          <div className="flex items-center gap-2">
            <Globe className="w-3 h-3 text-accent" />
            <p className="text-[10px] uppercase text-muted-foreground tracking-widest">{profile?.country} | {league?.id}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 bg-secondary/40 px-3 py-1.5 rounded-full border border-white/10">
          <Coins className="w-4 h-4 text-yellow-500" />
          <span className="font-bold text-sm tabular-nums">{credits}</span>
        </div>
      </header>

      {/* Сетка меню 4x5 */}
      <div className="grid grid-cols-4 gap-3 mb-8">
        {GRID_ITEMS.map((item, index) => (
          <Link 
            key={index} 
            href={item.href} 
            className={cn(
              "group relative flex flex-col items-center justify-center aspect-square rounded-xl border border-white/5 bg-card/40 transition-all duration-300",
              item.active ? "hover:bg-primary/10 hover:border-primary/50 active:scale-95 cursor-pointer" : "opacity-40 cursor-not-allowed grayscale"
            )}
          >
            <item.icon className={cn("w-6 h-6 mb-1.5 transition-transform duration-300 group-hover:scale-110", item.color)} />
            <span className="text-[7px] font-headline font-bold text-center tracking-tighter uppercase leading-none px-1 h-4 flex items-center">
              {item.label}
            </span>
            {item.active && (
              <div className="absolute top-1 right-1 w-1 h-1 rounded-full bg-primary animate-pulse" />
            )}
          </Link>
        ))}
      </div>

      {/* Информационная панель */}
      <Card className="glass-card overflow-hidden mb-6 border-primary/20">
        <div className="hero-gradient h-1 opacity-50" />
        <CardContent className="p-4 space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-headline">Оперативный статус</span>
            <span className="text-[10px] text-accent font-bold uppercase">В норме</span>
          </div>
          <div className="text-[11px] leading-relaxed text-muted-foreground italic">
            "Лига {league?.name} ожидает начала операций в {league?.startTime}. Проверьте готовность ростера."
          </div>
        </CardContent>
      </Card>

      {/* Модальное окно приветствия */}
      <Dialog open={showWelcome} onOpenChange={setShowWelcome}>
        <DialogContent className="glass-card border-primary/50 max-w-[90vw] rounded-2xl bg-card/90">
          <DialogHeader className="flex flex-col items-center gap-4 py-4">
            <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center animate-bounce">
              <Sparkles className="w-8 h-8 text-primary" />
            </div>
            <DialogTitle className="text-2xl font-headline font-bold text-center uppercase tracking-tighter">
              Инициализация завершена
            </DialogTitle>
            <DialogDescription className="text-center text-sm leading-relaxed space-y-4">
              <span className="block text-primary font-bold uppercase text-lg mb-2">
                Приветствуем, Командир {profile?.username}!
              </span>
              <span className="block italic">
                "Нейролинк с региональным узлом {profile?.country} успешно установлен. Все системы управления ростером в норме."
              </span>
              <span className="block">
                Ваша команда зачислена в <strong className="text-accent">{league?.name}</strong>. Время начала операций: <strong className="text-accent">{league?.startTime}</strong>.
              </span>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => setShowWelcome(false)} className="w-full hero-gradient font-headline font-bold h-12">
              ПРИНЯТЬ КОМАНДОВАНИЕ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <BottomNav />
    </div>
  );
}

export default function Home() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    }>
      <HubContent />
    </Suspense>
  );
}
