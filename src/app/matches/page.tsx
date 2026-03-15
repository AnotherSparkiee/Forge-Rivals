'use client';

import { useState } from 'react';
import { useGameState } from '../lib/store';
import { 
  ChevronLeft, CalendarDays, UserSearch, CalendarClock, 
  History, Calendar, CheckSquare, ChevronRight, Shield,
  Loader2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';

type MatchTab = 
  | 'menu'
  | 'next_opponent' 
  | 'my_future' 
  | 'my_played' 
  | 'league_calendar' 
  | 'league_played';

export default function MatchesPage() {
  const { isLoaded, language, leagueLevel, divisionSubId } = useGameState();
  const { user, isUserLoading } = useUser();
  const db = useFirestore();
  const [activeTab, setActiveTab] = useState<MatchTab>('menu');

  const userRef = useMemoFirebase(() => user ? doc(db, 'users', user.uid) : null, [db, user]);
  const { data: profile, isLoading: isProfileLoading } = useDoc(userRef);

  const labels = {
    en: {
      title: "OPERATIONAL MATCHES",
      subtitle: "Tactical Schedule & History",
      menuTitle: "Match Terminals",
      backToMenu: "Back to Menu",
      status: "Operational Status",
      tabs: {
        next_opponent: { label: "Next Opponent", desc: "Detailed brief on your next rival", icon: UserSearch },
        my_future: { label: "My Future", desc: "Upcoming matches for your team", icon: CalendarClock },
        my_played: { label: "My Played", desc: "History of your previous encounters", icon: History },
        league_calendar: { label: "League Calendar", desc: "Full season schedule of the group", icon: Calendar },
        league_played: { label: "Played in League", desc: "All results from your current league", icon: CheckSquare }
      }
    },
    ru: {
      title: "СПИСОК МАТЧЕЙ",
      subtitle: "Расписание и История",
      menuTitle: "Тактические Терминалы",
      backToMenu: "В меню",
      status: "Статус операций",
      tabs: {
        next_opponent: { label: "Следующий соперник", desc: "Досье на вашего ближайшего врага", icon: UserSearch },
        my_future: { label: "Свои будущие", desc: "Предстоящие игры вашей команды", icon: CalendarClock },
        my_played: { label: "Свои сыгранные", desc: "История ваших прошлых сражений", icon: History },
        league_calendar: { label: "Календарь лиги", desc: "Полное расписание сезона в группе", icon: Calendar },
        league_played: { label: "Сыгранные в лиге", desc: "Все результаты вашей текущей лиги", icon: CheckSquare }
      }
    }
  };

  const t = labels[language as keyof typeof labels] || labels.ru;

  if (!isLoaded || isUserLoading || isProfileLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (activeTab === 'menu') {
    return (
      <div className="max-w-md mx-auto px-4 pt-8 pb-20">
        <header className="mb-6 flex items-center gap-4">
          <Link href="/">
            <Button variant="ghost" size="icon" className="rounded-full">
              <ChevronLeft className="w-6 h-6" />
            </Button>
          </Link>
          <div className="flex-1">
            <h1 className="text-2xl font-headline font-bold flex items-center gap-2 uppercase tracking-tighter">
              <CalendarDays className="text-primary w-5 h-5" />
              {t.title}
            </h1>
            <p className="text-muted-foreground text-[10px] uppercase tracking-widest">
              {t.subtitle} | Div {leagueLevel}.{divisionSubId}
            </p>
          </div>
        </header>

        <div className="space-y-4">
          <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-accent px-1">{t.menuTitle}</h2>
          <div className="space-y-2">
            {(Object.entries(t.tabs) as [MatchTab, any][]).map(([tabId, tabData]) => (
              <Card 
                key={tabId} 
                className="glass-card hover:bg-white/5 transition-colors border-white/5 cursor-pointer"
                onClick={() => setActiveTab(tabId)}
              >
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="p-2 rounded-lg bg-secondary/50">
                      <tabData.icon className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold uppercase">{tabData.label}</h3>
                      <p className="text-[10px] text-muted-foreground">{tabData.desc}</p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto px-4 pt-8 pb-20">
      <header className="mb-6 flex items-center gap-4">
        <Button variant="ghost" size="icon" className="rounded-full" onClick={() => setActiveTab('menu')}>
          <ChevronLeft className="w-6 h-6" />
        </Button>
        <div className="flex-1">
          <h1 className="text-xl font-headline font-bold uppercase">
            {t.tabs[activeTab as keyof typeof t.tabs].label}
          </h1>
          <p className="text-muted-foreground text-[10px] uppercase tracking-widest">
            {t.subtitle} | {t.backToMenu}
          </p>
        </div>
      </header>

      <div className="flex flex-col items-center justify-center py-12 text-center space-y-4 animate-in zoom-in duration-300">
        <div className="w-16 h-16 rounded-full bg-secondary/50 flex items-center justify-center">
          <Shield className="w-8 h-8 text-primary opacity-50" />
        </div>
        <div>
          <h3 className="text-lg font-headline font-bold uppercase tracking-widest text-accent">
            {t.tabs[activeTab as keyof typeof t.tabs].label}
          </h3>
          <p className="text-xs text-muted-foreground uppercase tracking-widest mt-1">Данные синхронизируются с сервером лиги</p>
        </div>
        <Badge variant="outline" className="text-[10px] border-primary/20 text-primary">СЕЗОН 2024: АКТИВЕН</Badge>
      </div>
      
      <Button 
        variant="outline" 
        className="w-full mt-8 border-white/10"
        onClick={() => setActiveTab('menu')}
      >
        {t.backToMenu}
      </Button>
    </div>
  );
}
