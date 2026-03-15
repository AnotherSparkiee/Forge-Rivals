'use client';

import { useGameState } from '../lib/store';
import { Trophy, Medal, Star, ChevronLeft, ArrowUpCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import Link from 'next/link';
import { getMockGroupTeams } from '../lib/leagues-data';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';

export default function RankingsPage() {
  const { rank, leagueLevel, divisionSubId, groupId, isLoaded, language, promoteLeague } = useGameState();
  const { toast } = useToast();

  const labels = {
    en: {
      title: "LEADERBOARDS",
      subtitle: "Pyramid Hierarchy",
      winRate: "Win Rate",
      points: "Points",
      stats: "Stats",
      promote: "Promote",
      promoteSuccess: "Promotion Success!",
      promoteDesc: "You have moved to a higher division!",
      standing: "Current Group Standings",
      canPromote: "Rank 1: Eligible for Promotion!"
    },
    ru: {
      title: "ТАБЛИЦА ЛИДЕРОВ",
      subtitle: "Иерархия Пирамиды",
      winRate: "Победы",
      points: "Очки",
      stats: "Статистика",
      promote: "Повысить",
      promoteSuccess: "Повышение!",
      promoteDesc: "Вы перешли в дивизион уровнем выше!",
      standing: "Текущая Таблица Группы",
      canPromote: "1 Место: Доступно повышение!"
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

      <div className="space-y-2 mb-8">
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
    </div>
  );
}
