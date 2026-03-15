'use client';

import { useState } from 'react';
import { useGameState } from '../lib/store';
import { 
  Trophy, Medal, Star, ChevronLeft, ArrowUpCircle, 
  Users, Target, Shield, Zap, Swords, ChevronRight,
  LayoutDashboard, TrendingUp, Award, Loader2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import Link from 'next/link';
import { getMockGroupTeams } from '../lib/leagues-data';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';

type RankingTab = 
  | 'menu'
  | 'my_league' 
  | 'champions_cup' 
  | 'masters_cup' 
  | 'my_pyramid' 
  | 'pyramid_cup' 
  | 'friendly' 
  | 'pyramids_list' 
  | 'pyramids_rating' 
  | 'kda_leaders';

export default function RankingsPage() {
  const { rank, leagueLevel, divisionSubId, groupId, isLoaded, language, promoteLeague } = useGameState();
  const { user, isUserLoading } = useUser();
  const db = useFirestore();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<RankingTab>('menu');

  const userRef = useMemoFirebase(() => user ? doc(db, 'users', user.uid) : null, [db, user]);
  const { data: profile, isLoading: isProfileLoading } = useDoc(userRef);

  const labels = {
    en: {
      title: "TOURNAMENT TABLES",
      subtitle: "Pyramid Hierarchy",
      menuTitle: "Tournament Terminals",
      promote: "Promote",
      promoteSuccess: "Promotion Success!",
      promoteDesc: "You have moved to a higher division!",
      canPromote: "Rank 1: Eligible for Promotion!",
      backToMenu: "Back to Menu",
      tabs: {
        my_league: { label: "My League", desc: "Current group rankings", icon: Trophy },
        champions_cup: { label: "Champions Cup", desc: "Top tier elite tournament", icon: Award },
        masters_cup: { label: "Masters Cup", desc: "Professional division cup", icon: Star },
        my_pyramid: { label: "My Pyramid", desc: "Global hierarchy view", icon: LayoutDashboard },
        pyramid_cup: { label: "Pyramid Cup", desc: "Inter-division knockout", icon: Swords },
        friendly: { label: "Friendly Tournament", desc: "Low stakes training matches", icon: Users },
        pyramids_list: { label: "Pyramids", desc: "Active world pyramids", icon: Shield },
        pyramids_rating: { label: "Pyramid Rating", desc: "Global organization ranking", icon: TrendingUp },
        kda_leaders: { label: "Top KDA Players", desc: "Best individual performers", icon: Target }
      }
    },
    ru: {
      title: "ТУРНИРНЫЕ ТАБЛИЦЫ",
      subtitle: "Иерархия Пирамиды",
      menuTitle: "Турнирные Терминалы",
      promote: "Повысить",
      promoteSuccess: "Повышение!",
      promoteDesc: "Вы перешли в дивизион уровнем выше!",
      canPromote: "1 Место: Доступно повышение!",
      backToMenu: "В меню",
      tabs: {
        my_league: { label: "Своя лига", desc: "Рейтинг вашей группы", icon: Trophy },
        champions_cup: { label: "Кубок чемпионов", desc: "Элитный турнир высшей лиги", icon: Award },
        masters_cup: { label: "Кубок Мастеров", desc: "Кубок профессионального дивизиона", icon: Star },
        my_pyramid: { label: "Своя пирамида", desc: "Обзор глобальной иерархии", icon: LayoutDashboard },
        pyramid_cup: { label: "Кубок пирамиды", desc: "Междивизионный плей-офф", icon: Swords },
        friendly: { label: "Товарищеский турнир", desc: "Тренировочные матчи без риска", icon: Users },
        pyramids_list: { label: "Пирамиды", desc: "Список активных миров", icon: Shield },
        pyramids_rating: { label: "Рейтинг пирамид", desc: "Мировой рейтинг организаций", icon: TrendingUp },
        kda_leaders: { label: "Игроки с лучшим КДА", desc: "Лидеры индивидуальной статистики", icon: Target }
      }
    }
  };

  const t = labels[language as keyof typeof labels] || labels.ru;
  const mockRankings = getMockGroupTeams(rank);
  const isPlayerFirst = mockRankings[0]?.isPlayer;

  const handlePromotion = () => {
    if (promoteLeague()) {
      toast({
        title: t.promoteSuccess,
        description: t.promoteDesc,
      });
    }
  };

  if (!isLoaded || isUserLoading || isProfileLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const renderRankingTable = () => (
    <div className="space-y-2 animate-in fade-in duration-300">
      <div className="flex items-center px-4 text-[10px] uppercase font-bold text-muted-foreground mb-1">
        <div className="w-8">#</div>
        <div className="flex-1">Team</div>
        <div className="w-16 text-center">W-L</div>
        <div className="w-16 text-right">Points</div>
      </div>
      {mockRankings.map((entry, i) => {
        const isTop3 = i < 3;
        return (
          <div 
            key={entry.name} 
            className={cn(
              "flex items-center gap-3 p-3 rounded-xl border transition-all",
              entry.isPlayer ? "bg-primary/20 border-primary/50 shadow-lg" : "bg-secondary/20 border-white/5",
              isTop3 && !entry.isPlayer ? "border-yellow-500/10" : ""
            )}
          >
            <div className="w-8 text-center font-headline font-bold text-sm italic">
              {isTop3 ? (
                <Medal className={cn(
                  "w-5 h-5 mx-auto",
                  i === 0 ? "text-yellow-500" : i === 1 ? "text-gray-400" : "text-amber-600"
                )} />
              ) : i + 1}
            </div>
            <div className="flex-1 min-w-0">
              <p className={cn("font-bold text-xs uppercase flex items-center gap-2 truncate", entry.isPlayer && "text-primary")}>
                {entry.isPlayer ? (profile?.displayName || entry.name) : entry.name}
                {entry.isPlayer && <Star className="w-3 h-3 fill-current" />}
              </p>
            </div>
            <div className="w-16 text-center text-[10px] font-mono opacity-70">
              {entry.wins}-{entry.losses || 0}
            </div>
            <div className="w-16 text-right">
              <p className="text-sm font-headline font-bold text-accent">{entry.points}</p>
            </div>
          </div>
        );
      })}
    </div>
  );

  const renderPlaceholder = (title: string) => (
    <div className="flex flex-col items-center justify-center py-12 text-center space-y-4 animate-in zoom-in duration-300">
      <div className="w-16 h-16 rounded-full bg-secondary/50 flex items-center justify-center">
        <Shield className="w-8 h-8 text-primary opacity-50" />
      </div>
      <div>
        <h3 className="text-lg font-headline font-bold uppercase tracking-widest text-accent">
          {title}
        </h3>
        <p className="text-xs text-muted-foreground uppercase tracking-widest mt-1">Ожидание формирования турнирной сетки</p>
      </div>
      <Badge variant="outline" className="text-[10px] border-primary/20 text-primary">СЕЗОН 2024: ФАЗА 1</Badge>
    </div>
  );

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
              <Trophy className="text-yellow-500 w-5 h-5" />
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
            {(Object.entries(t.tabs) as [RankingTab, any][]).map(([tabId, tabData]) => (
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

      {activeTab === 'my_league' && (
        <>
          {isPlayerFirst && leagueLevel > 1 && (
            <div className="mb-6 animate-in zoom-in duration-300">
              <Card className="bg-primary/20 border-primary/50 border-2">
                <CardContent className="p-4 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold text-primary flex items-center gap-2">
                      <ArrowUpCircle className="w-4 h-4" /> {t.canPromote}
                    </p>
                  </div>
                  <Button size="sm" onClick={handlePromotion} className="hero-gradient font-bold h-8 text-[10px]">
                    {t.promote}
                  </Button>
                </CardContent>
              </Card>
            </div>
          )}
          {renderRankingTable()}
        </>
      )}

      {activeTab !== 'my_league' && renderPlaceholder(t.tabs[activeTab as keyof typeof t.tabs].label)}
      
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
