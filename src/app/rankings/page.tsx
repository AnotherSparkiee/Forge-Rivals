'use client';

import { useState } from 'react';
import { useGameState } from '../lib/store';
import { Trophy, Medal, Star, ChevronLeft, ArrowUpCircle, Users, Target, Shield, Zap, Swords } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import Link from 'next/link';
import { getMockGroupTeams } from '../lib/leagues-data';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';

type RankingTab = 
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
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<RankingTab>('my_league');

  const labels = {
    en: {
      title: "LEADERBOARDS",
      subtitle: "Pyramid Hierarchy",
      promote: "Promote",
      promoteSuccess: "Promotion Success!",
      promoteDesc: "You have moved to a higher division!",
      canPromote: "Rank 1: Eligible for Promotion!",
      tabs: {
        my_league: "My League",
        champions_cup: "Champions Cup",
        masters_cup: "Masters Cup",
        my_pyramid: "My Pyramid",
        pyramid_cup: "Pyramid Cup",
        friendly: "Friendly Tournament",
        pyramids_list: "Pyramids",
        pyramids_rating: "Pyramid Rating",
        kda_leaders: "Top KDA Players"
      }
    },
    ru: {
      title: "ТАБЛИЦА ЛИДЕРОВ",
      subtitle: "Иерархия Пирамиды",
      promote: "Повысить",
      promoteSuccess: "Повышение!",
      promoteDesc: "Вы перешли в дивизион уровнем выше!",
      canPromote: "1 Место: Доступно повышение!",
      tabs: {
        my_league: "Своя лига",
        champions_cup: "Кубок чемпионов",
        masters_cup: "Кубок Мастеров",
        my_pyramid: "Своя пирамида",
        pyramid_cup: "Кубок пирамиды",
        friendly: "Товарищеский турнир",
        pyramids_list: "Пирамиды",
        pyramids_rating: "Рейтинг пирамид",
        kda_leaders: "Игроки с лучшим КДА"
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

  if (!isLoaded) return null;

  const renderContent = () => {
    if (activeTab === 'my_league') {
      return (
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
                    {entry.name}
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
    }

    // Default "In Development" or Mock view for other tabs
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center space-y-4 animate-in zoom-in duration-300">
        <div className="w-16 h-16 rounded-full bg-secondary/50 flex items-center justify-center">
          <Shield className="w-8 h-8 text-primary opacity-50" />
        </div>
        <div>
          <h3 className="text-lg font-headline font-bold uppercase tracking-widest text-accent">
            {t.tabs[activeTab as keyof typeof t.tabs]}
          </h3>
          <p className="text-xs text-muted-foreground uppercase tracking-widest mt-1">Ожидание формирования турнирной сетки</p>
        </div>
        <Badge variant="outline" className="text-[10px] border-primary/20 text-primary">СЕЗОН 2024: ФАЗА 1</Badge>
      </div>
    );
  };

  return (
    <div className="max-w-md mx-auto px-4 pt-8 pb-12">
      <header className="mb-6 flex items-center gap-4">
        <Link href="/">
          <Button variant="ghost" size="icon" className="rounded-full">
            <ChevronLeft className="w-6 h-6" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-headline font-bold flex items-center gap-2">
            <Trophy className="text-yellow-500 w-5 h-5" />
            {t.title}
          </h1>
          <p className="text-muted-foreground text-[10px] uppercase tracking-widest">
            {t.subtitle} | Div {leagueLevel}.{divisionSubId} | Group {groupId}
          </p>
        </div>
      </header>

      {/* Tabs Navigation */}
      <div className="mb-6">
        <ScrollArea className="w-full whitespace-nowrap">
          <div className="flex gap-2 pb-4">
            {(Object.keys(t.tabs) as RankingTab[]).map((tabId) => (
              <Button
                key={tabId}
                variant={activeTab === tabId ? 'default' : 'secondary'}
                size="sm"
                onClick={() => setActiveTab(tabId)}
                className={cn(
                  "rounded-full text-[10px] h-8 px-4 font-bold uppercase tracking-tighter transition-all",
                  activeTab === tabId ? "hero-gradient border-none shadow-md" : "bg-secondary/40 border-white/5"
                )}
              >
                {t.tabs[tabId]}
              </Button>
            ))}
          </div>
          <ScrollBar orientation="horizontal" className="hidden" />
        </ScrollArea>
      </div>

      {activeTab === 'my_league' && isPlayerFirst && leagueLevel > 1 && (
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

      {renderContent()}
    </div>
  );
}
