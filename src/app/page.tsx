'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@/firebase';
import { useGameState } from './lib/store';
import { 
  Swords, Users, Trophy, TrendingUp, 
  ShoppingCart, Newspaper, Shield, Star, 
  ChevronRight, Wallet, Loader2, CalendarDays,
  Zap
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';

export default function Home() {
  const { user, isUserLoading } = useUser();
  const router = useRouter();
  const { credits, rank, team, strategy, language, isLoaded } = useGameState();

  useEffect(() => {
    if (!isUserLoading && !user) {
      router.push('/auth/login');
    }
  }, [user, isUserLoading, router]);

  if (isUserLoading || !isLoaded || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const translations = {
    en: {
      title: "Command Center",
      subtitle: "Tactical Operations Hub",
      credits: "Credits",
      rank: "Rank",
      teamSize: "Team Size",
      battleBtn: "Enter Battle",
      activeStrat: "Active Strategy",
      navTitle: "Navigation Terminals",
      locked: "Locked",
      menu: [
        { label: 'Battle Simulation', desc: 'Deploy team for automated matches' },
        { label: 'Team Roster', desc: 'Manage your active hero lineup' },
        { label: 'Tournament Tables', desc: 'Pyramid hierarchy and standings' },
        { label: 'Matches', desc: 'Schedule, history and next opponents' },
        { label: 'Marketplace', desc: 'Purchase new heroes and boosts' },
        { label: 'Team Stats', desc: 'Detailed performance analytics' },
        { label: 'Clubhouse', desc: 'Join associations and tournaments' },
        { label: 'News Feed', desc: 'Latest updates from the MOBA world' },
        { label: 'Training Base', desc: 'Improve hero characteristics' },
      ]
    },
    ru: {
      title: "Командный Центр",
      subtitle: "Хаб Тактических Операций",
      credits: "Кредиты",
      rank: "Ранг",
      teamSize: "Состав",
      battleBtn: "В БОЙ",
      activeStrat: "Активная стратегия",
      navTitle: "Тактические Терминалы",
      locked: "Закрыто",
      menu: [
        { label: 'Боевая Симуляция', desc: 'Развертывание команды для матча' },
        { label: 'Ростер Команды', desc: 'Управление активным составом' },
        { label: 'Турнирные таблицы', desc: 'Иерархия пирамиды и положение' },
        { label: 'Матчи', desc: 'Расписание, история и будущие игры' },
        { label: 'Магазин', desc: 'Покупка героев и бонусов' },
        { label: 'Статистика', desc: 'Аналитика эффективности' },
        { label: 'Клуб', desc: 'Ассоциации и турниры' },
        { label: 'Новости', desc: 'События мира MOBA' },
        { label: 'Тренировочная база', desc: 'Повышение характеристик героев' },
      ]
    }
  };

  const t = translations[language as keyof typeof translations] || translations.ru;

  const quickStats = [
    { label: t.credits, value: credits, icon: Wallet, color: 'text-yellow-400' },
    { label: t.rank, value: rank, icon: Star, color: 'text-primary' },
    { label: t.teamSize, value: `${team.length}/5`, icon: Users, color: 'text-accent' },
  ];

  const menuItems = [
    { label: t.menu[1].label, href: '/roster', icon: Users, desc: t.menu[1].desc, active: true },
    { label: t.menu[8].label, href: '/training', icon: Zap, desc: t.menu[8].desc, active: true },
    { label: t.menu[2].label, href: '/rankings', icon: Trophy, desc: t.menu[2].desc, active: true },
    { label: t.menu[3].label, href: '/matches', icon: CalendarDays, desc: t.menu[3].desc, active: true },
    { label: t.menu[4].label, href: '#', icon: ShoppingCart, desc: t.menu[4].desc, active: false },
    { label: t.menu[5].label, href: '#', icon: TrendingUp, desc: t.menu[5].desc, active: false },
    { label: t.menu[6].label, href: '#', icon: Shield, desc: t.menu[6].desc, active: false },
    { label: t.menu[7].label, href: '#', icon: Newspaper, desc: t.menu[7].desc, active: false },
  ];

  return (
    <div className="max-w-md mx-auto px-4 pt-8 pb-12">
      <header className="mb-8">
        <h1 className="text-3xl font-headline font-bold tracking-tighter text-primary uppercase">{t.title}</h1>
        <p className="text-muted-foreground text-sm uppercase tracking-widest">{t.subtitle}</p>
      </header>

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

      <div className="space-y-4 mb-12">
        <Link href="/match" className="block">
          <Button className="w-full h-20 hero-gradient border-none shadow-xl hover:opacity-90 transition-all flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <Swords className="w-6 h-6" />
              <span className="text-xl font-headline font-bold italic uppercase">{t.battleBtn}</span>
            </div>
            <span className="text-[10px] opacity-80 uppercase tracking-widest">{t.activeStrat}: {strategy}</span>
          </Button>
        </Link>
      </div>

      <div className="space-y-4">
        <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-accent px-1">{t.navTitle}</h2>
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
                    <Badge variant="outline" className="text-[8px] uppercase">{t.locked}</Badge>
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
