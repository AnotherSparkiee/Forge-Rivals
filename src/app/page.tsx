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
  Loader2, Sparkles
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
  { label: 'ОБЗОР МАТЧА', icon: Swords, color: 'text-red-400' },
  { label: 'СОСТАВ', icon: Users, color: 'text-blue-400' },
  { label: 'ТРАНСФЕРЫ', icon: UserPlus, color: 'text-yellow-400' },
  { label: 'РАЗВИТИЕ', icon: TrendingUp, color: 'text-green-400' },
  { label: 'ПЕРСОНАЛ', icon: Briefcase, color: 'text-purple-400' },
  { label: 'ТАЛАНТЫ', icon: Binoculars, color: 'text-sky-400' },
  { label: 'ТАБЛИЦЫ', icon: Trophy, color: 'text-orange-400' },
  { label: 'РАСПИСАНИЕ', icon: Calendar, color: 'text-indigo-400' },
  { label: 'ФИНАНСЫ', icon: BarChart3, color: 'text-emerald-400' },
  { label: 'ТУРНИРЫ', icon: Medal, color: 'text-yellow-300' },
  { label: 'ФАН БАЗА', icon: Heart, color: 'text-pink-400' },
  { label: 'ТОП СЕЗОНА', icon: Star, color: 'text-amber-400' },
  { label: 'ЧАТЫ', icon: MessageSquare, color: 'text-cyan-400' },
  { label: 'ДРУЗЬЯ', icon: UserCheck, color: 'text-rose-400' },
  { label: 'О СЕБЕ', icon: User, color: 'text-white' },
  { label: 'АССОЦИАЦИИ', icon: Shield, color: 'text-violet-400' },
  { label: 'МАГАЗИН', icon: ShoppingCart, color: 'text-lime-400' },
  { label: 'НОВОСТИ', icon: Newspaper, color: 'text-teal-400' },
  { label: 'СИСТЕМА', icon: Settings, color: 'text-slate-400' },
  { label: 'ПОИСК', icon: Search, color: 'text-blue-300' },
];

function HubContent() {
  const { user, isUserLoading } = useUser();
  const db = useFirestore();
  const { isLoaded } = useGameState();
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
      <div className="fixed inset-0 flex flex-col items-center justify-center space-y-4 bg-background text-foreground z-[999]">
        <Loader2 className="w-12 h-12 text-primary animate-spin" />
        <p className="text-muted-foreground animate-pulse font-headline uppercase tracking-widest text-center px-4">Синхронизация систем...</p>
      </div>
    );
  }

  const league = LEAGUES.find(l => l.id === profile?.selectedLeagueId);

  return (
    <div className="fixed inset-0 h-dvh w-full overflow-hidden flex flex-col bg-background text-foreground select-none">
      <main className="h-full w-full p-1">
        <div className="grid grid-cols-4 grid-rows-5 gap-1 h-full w-full">
          {GRID_ITEMS.map((item, index) => {
            const Icon = item.icon;
            return (
              <div 
                key={index} 
                className="relative rounded-md border border-white/5 bg-card/40 flex flex-col items-center justify-center p-1 text-center"
              >
                <Icon className={cn("w-6 h-6 mb-1 shrink-0", item.color)} />
                <span className="text-[8px] font-headline font-bold tracking-tighter uppercase leading-tight max-w-full break-words line-clamp-2 px-1">
                  {item.label}
                </span>
              </div>
            );
          })}
        </div>
      </main>

      <Dialog open={showWelcome} onOpenChange={setShowWelcome}>
        <DialogContent className="glass-card border-primary/50 max-w-[90vw] rounded-2xl bg-card/95">
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
    <Suspense fallback={null}>
      <HubContent />
    </Suspense>
  );
}
