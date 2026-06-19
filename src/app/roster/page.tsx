
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
  ChevronLeft, ChevronRight, Shield
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
        { label: 'Squad', desc: 'Manage your active hero lineup', icon: Users, href: '/roster/squad', active: true, color: 'text-primary' },
        { label: 'Team Synergy', desc: 'Cohesion based on official matches', icon: LinkIcon, href: '/roster/synergy', active: true, color: 'text-accent' },
        { label: 'Tactics', desc: 'Strategic positioning and roles', icon: Swords, href: '/roster/tactics', active: true, color: 'text-red-400' },
        { label: 'Training', desc: 'Select skills to improve after matches', icon: Dumbbell, href: '/roster/training', active: true, color: 'text-green-400' },
        { label: 'Daily Training', desc: '24-hour intensive cycle', icon: Clock, href: '/roster/daily-training', active: true, color: 'text-orange-400' },
        { label: 'Contracts', desc: 'Financial agreements and tenure', icon: Scroll, href: '/roster/contracts', active: true, color: 'text-yellow-400' },
        { label: 'Player Stats', desc: 'Individual performance metrics', icon: BarChart3, href: '/roster/stats', active: true, color: 'text-blue-400' },
        { label: 'Recover Fatigue', desc: 'Squad-wide stamina restoration', icon: HeartPulse, href: '/roster/fatigue', active: true, color: 'text-red-500' },
      ]
    },
    ru: {
      title: "ТЕРМИНАЛ РОСТЕРА",
      subtitle: "Хаб управления персоналом",
      locked: "Закрыто",
      menu: [
        { label: 'Состав', desc: 'Управление активным составом', icon: Users, href: '/roster/squad', active: true, color: 'text-primary' },
        { label: 'Сыгранность состава', desc: 'Взаимодействие в официальных играх', icon: LinkIcon, href: '/roster/synergy', active: true, color: 'text-accent' },
        { label: 'Тактика', desc: 'Стратегические роли и позиции', icon: Swords, href: '/roster/tactics', active: true, color: 'text-red-400' },
        { label: 'Тренировки', desc: 'Выбор навыков для прокачки после игр', icon: Dumbbell, href: '/roster/training', active: true, color: 'text-green-400' },
        { label: 'Тренировка за сутки', desc: '24-часовой цикл подготовки', icon: Clock, href: '/roster/daily-training', active: true, color: 'text-orange-400' },
        { label: 'Контракты', desc: 'Финансовые соглашения и сроки', icon: Scroll, href: '/roster/contracts', active: true, color: 'text-yellow-400' },
        { label: 'Статистика игроков', desc: 'Индивидуальные метрики игроков', icon: BarChart3, href: '/roster/stats', active: true, color: 'text-blue-400' },
        { label: 'Снять усталость', desc: 'Массовое восстановление выносливости состава', icon: HeartPulse, href: '/roster/fatigue', active: true, color: 'text-red-500' },
      ]
    }
  };

  const t = translations[language as keyof typeof translations] || translations.ru;

  return (
    <div className="max-w-md mx-auto px-4 pt-8 pb-4">
      <header className="mb-8 flex items-center gap-4">
        <Link href="/">
          <Button variant="ghost" size="icon" className="rounded-full bg-secondary/50 border border-white/5">
            <ChevronLeft className="w-6 h-6" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-headline font-bold uppercase tracking-tighter flex items-center gap-2">
            <Shield className="w-6 h-6 text-primary" />
            {t.title}
          </h1>
          <p className="text-muted-foreground text-[10px] uppercase tracking-widest font-black opacity-50">{t.subtitle}</p>
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
                "glass-card border-white/5 transition-all group overflow-hidden",
                item.active ? "hover:bg-white/5 cursor-pointer" : "opacity-60"
              )}
            >
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-2.5 rounded-xl bg-secondary/50 border border-white/5 group-hover:bg-primary/10 transition-colors shadow-inner">
                    <item.icon className={cn("w-5 h-5", item.active ? item.color : "text-muted-foreground")} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold uppercase group-hover:text-white transition-colors">{item.label}</h3>
                    <p className="text-[10px] text-muted-foreground font-medium">{item.desc}</p>
                  </div>
                </div>
                {item.active ? (
                  <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-all" />
                ) : (
                  <Badge variant="outline" className="text-[8px] uppercase border-white/10 opacity-50">{t.locked}</Badge>
                )}
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
