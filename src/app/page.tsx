'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import { useGameState } from './lib/store';
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
      <div className="h-screen flex flex-col items-center justify-center space-y-4 bg-background text-foreground">
        <Loader2 className="w-12 h-12 text-primary animate-spin" />
        <p className="text-muted-foreground animate-pulse font-headline uppercase tracking-widest text-center px-4">Синхронизация систем...</p>
      </div>
    );
  }

  const league = LEAGUES.find(l => l.id === profile?.selectedLeagueId);

  return (
    <div className="max-w-md mx-auto h-screen overflow-hidden flex flex-col bg-background text-foreground">
      {/* Шапка */}
      <header className="flex justify-between items-center p-4 shrink-0">
        <div className="flex flex-col">
          <h1 className="text-lg font-headline font-bold uppercase tracking-tighter text-primary">HUD: {profile?.username}</h1>
          <div className="flex items-center gap-2">
            <Globe className="w-3 h-3 text-accent" />
            <p className="text-[10px] uppercase text-muted-foreground tracking-widest">{profile?.country} | {league?.id}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 bg-secondary/40 px-3 py-1 rounded-full border border-white/10">
          <Coins className="w-3.5 h-3.5 text-yellow-500" />
          <span className="font-bold text-xs tabular-nums">{credits}</span>
        </div>
      </header>

      {/* Сетка меню 4x5 */}
      <div className="flex-1 px-4 pb-4">
        <div className="grid grid-cols-4 gap-1.5 h-full">
          {GRID_ITEMS.map((item, index) => {
            const Icon = item.icon;
            const isLink = item.active;
            const Content = (
              <>
                <Icon className={cn("w-5 h-5 mb-1 shrink-0", item.color)} />
                <span className="text-[7px] font-headline font-bold text-center tracking-tighter uppercase leading-tight px-0.5 overflow-hidden">
                  {item.label}
                </span>
                {item.active && (
                  <div className="absolute top-1 right-1 w-1 h-1 rounded-full bg-primary shadow-[0_0_6px_hsl(var(--primary))]" />
                )}
              </>
            );

            const baseClass = cn(
              "relative flex flex-col items-center justify-center rounded-lg border transition-colors duration-200",
              item.active 
                ? "bg-card/60 border-white/10 hover:bg-primary/10 hover:border-primary/50 cursor-pointer shadow-sm" 
                : "bg-black/20 border-white/5 opacity-40 cursor-not-allowed grayscale"
            );

            return isLink ? (
              <Link key={index} href={item.href} className={baseClass}>
                {Content}
              </Link>
            ) : (
              <div key={index} className={baseClass}>
                {Content}
              </div>
            );
          })}
        </div>
      </div>

      {/* Модальное окно приветствия */}
      <Dialog open={showWelcome} onOpenChange={setShowWelcome}>
        <DialogContent className="glass-card border-primary/50 max-w-[90vw] rounded-2xl bg-card/90">
          <DialogHeader className="flex flex-col items-center gap-4 py-4">
            <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center">
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
    </div>
  );
}

export default function Home() {
  return (
    <Suspense fallback={
      <div className="h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    }>
      <HubContent />
    </Suspense>
  );
}
