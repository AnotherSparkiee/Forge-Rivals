'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@/firebase';
import { useGameState } from '../lib/store';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { 
  Trophy, Medal, Swords, UserPlus, 
  Search, History, Gamepad2, ChevronLeft, 
  ChevronRight 
} from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { LoadingScreen } from '@/components/game/LoadingScreen';

export default function TournamentsPage() {
  const { user, isUserLoading } = useUser();
  const router = useRouter();
  const { language, isLoaded } = useGameState();

  useEffect(() => {
    if (!isUserLoading && !user) {
      router.push('/auth/login');
    }
  }, [user, isUserLoading, router]);

  if (isUserLoading || !isLoaded || !user) {
    return <LoadingScreen />;
  }

  const translations = {
    en: {
      title: "TOURNAMENT HUB",
      subtitle: "Global Competitions & Friendly Matches",
      locked: "Locked",
      menu: [
        { label: 'Schedule Friendly', desc: 'Invite another manager for a practice match', icon: UserPlus, active: false },
        { label: 'Open Friendlies', desc: 'Find managers looking for practice', icon: Search, active: false },
        { label: 'CW Basket', desc: 'Clan War match-making and coordination', icon: Swords, active: false },
        { label: 'Open Tournaments', desc: 'Active championships and qualifiers', icon: Trophy, active: false },
        { label: 'Tournament History', desc: 'Review your past championship results', icon: History, active: false },
        { label: 'Trial Match', desc: 'Test your lineup against AI training models', icon: Gamepad2, active: false },
      ]
    },
    ru: {
      title: "ТУРНИРНЫЙ ХАБ",
      subtitle: "Глобальные соревнования и товарищеские игры",
      locked: "Закрыто",
      menu: [
        { label: 'Назначить тов. Матч', desc: 'Пригласить другого менеджера на игру', icon: UserPlus, active: false },
        { label: 'Открытые тов. Матчи', desc: 'Поиск менеджеров для тренировки', icon: Search, active: false },
        { label: 'КВ корзина', desc: 'Координация и подбор клановых войн', icon: Swords, active: false },
        { label: 'Открытые турниры', desc: 'Активные чемпионаты и квалификации', icon: Trophy, active: false },
        { label: 'История турниров', desc: 'Результаты ваших прошлых соревнований', icon: History, active: false },
        { label: 'Пробный матч', desc: 'Тест состава против тренировочного ИИ', icon: Gamepad2, active: false },
      ]
    }
  };

  const t = translations[language as keyof typeof translations] || translations.ru;

  return (
    <div className="max-w-md mx-auto px-4 pt-8 pb-20">
      <header className="mb-6 flex items-center gap-4">
        <Link href="/">
          <Button variant="ghost" size="icon" className="rounded-full">
            <ChevronLeft className="w-6 h-6" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-headline font-bold uppercase tracking-tighter flex items-center gap-2">
            <Medal className="w-6 h-6 text-primary" />
            {t.title}
          </h1>
          <p className="text-muted-foreground text-[10px] uppercase tracking-widest">{t.subtitle}</p>
        </div>
      </header>

      <div className="space-y-2">
        {t.menu.map((item) => (
          <Link 
            key={item.label} 
            href={item.active ? '#' : '#'} 
            className={cn("block", !item.active && "cursor-not-allowed")}
          >
            <Card 
              className={cn(
                "glass-card border-white/5 transition-all",
                item.active ? "hover:bg-white/5 cursor-pointer" : "opacity-60"
              )}
            >
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-2 rounded-lg bg-secondary/50">
                    <item.icon className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold uppercase">{item.label}</h3>
                    <p className="text-[10px] text-muted-foreground leading-tight max-w-[200px]">{item.desc}</p>
                  </div>
                </div>
                {item.active ? (
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                ) : (
                  <Badge variant="outline" className="text-[8px] uppercase">{t.locked}</Badge>
                )}
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
