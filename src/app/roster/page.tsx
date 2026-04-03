'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@/firebase';
import { useGameState } from '../lib/store';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { 
  Users, Link as LinkIcon, Swords, Dumbbell, 
  Clock, Scroll, BarChart3, HeartPulse, 
  ChevronLeft, ChevronRight 
} from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { LoadingScreen } from '@/components/game/LoadingScreen';

export default function RosterPage() {
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
      title: "ROSTER TERMINAL",
      subtitle: "Personnel Management Hub",
      locked: "Locked",
      menu: [
        { label: 'Squad', desc: 'Manage your active hero lineup', icon: Users, href: '/roster/squad', active: true },
        { label: 'Team Synergy', desc: 'Cohesion based on official matches', icon: LinkIcon, href: '/roster/synergy', active: true },
        { label: 'Tactics', desc: 'Strategic positioning and roles', icon: Swords, href: '/roster/tactics', active: true },
        { label: 'Training', desc: 'Select skills to improve after matches', icon: Dumbbell, href: '/roster/training', active: true },
        { label: 'Daily Training', desc: '24-hour intensive cycle', icon: Clock, href: '/roster/daily-training', active: true },
        { label: 'Contracts', desc: 'Financial agreements and tenure', icon: Scroll, href: '/roster/contracts', active: true },
        { label: 'Player Stats', desc: 'Individual performance metrics', icon: BarChart3, href: '/roster/stats', active: true },
        { label: 'Recover Fatigue', desc: 'Instant stamina restoration', icon: HeartPulse, active: false },
      ]
    },
    ru: {
      title: "ТЕРМИНАЛ РОСТЕРА",
      subtitle: "Хаб управления персоналом",
      locked: "Закрыто",
      menu: [
        { label: 'Состав', desc: 'Управление активным составом', icon: Users, href: '/roster/squad', active: true },
        { label: 'Сыгранность состава', desc: 'Взаимодействие в официальных играх', icon: LinkIcon, href: '/roster/synergy', active: true },
        { label: 'Тактика', desc: 'Стратегические роли и позиции', icon: Swords, href: '/roster/tactics', active: true },
        { label: 'Тренировки', desc: 'Выбор навыков для прокачки после игр', icon: Dumbbell, href: '/roster/training', active: true },
        { label: 'Тренировка за сутки', desc: '24-часовой цикл подготовки', icon: Clock, href: '/roster/daily-training', active: true },
        { label: 'Контракты', desc: 'Финансовые соглашения и сроки', icon: Scroll, href: '/roster/contracts', active: true },
        { label: 'Статистика игроков', desc: 'Индивидуальные метрики игроков', icon: BarChart3, href: '/roster/stats', active: true },
        { label: 'Снять усталость', desc: 'Мгновенное восстановление выносливости', icon: HeartPulse, active: false },
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
          <h1 className="text-2xl font-headline font-bold uppercase tracking-tighter">{t.title}</h1>
          <p className="text-muted-foreground text-[10px] uppercase tracking-widest">{t.subtitle}</p>
        </div>
      </header>

      <div className="space-y-2">
        {t.menu.map((item) => (
          <Link 
            key={item.label} 
            href={item.active ? item.href! : '#'} 
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
                    <item.icon className={cn("w-5 h-5", item.active ? "text-primary" : "text-muted-foreground")} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold uppercase">{item.label}</h3>
                    <p className="text-[10px] text-muted-foreground">{item.desc}</p>
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
