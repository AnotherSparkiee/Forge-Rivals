
'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useGameState } from '../lib/store';
import { 
  Trophy, Medal, ChevronLeft, ChevronRight, 
  LayoutDashboard, Search, Crown, Shield, 
  ArrowUp, ArrowDown, Activity
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import Link from 'next/link';
import { getMockGroupTeams } from '../lib/leagues-data';
import { Badge } from '@/components/ui/badge';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, limit } from 'firebase/firestore';
import { LoadingScreen } from '@/components/game/LoadingScreen';

type RankingTab = 'menu' | 'my_league' | 'pyramid_cup';

export default function RankingsPage() {
  const { user } = useUser();
  const router = useRouter();
  const { 
    rank, leagueLevel, groupId, isLoaded, language, 
    seasonDay, selectedLeagueId, displayName
  } = useGameState();
  const db = useFirestore();
  
  const [activeTab, setActiveTab] = useState<RankingTab>('menu');

  const teamsQuery = useMemoFirebase(() => {
    return query(collection(db, 'players_v10'), where('selectedLeagueId', '==', selectedLeagueId));
  }, [db, selectedLeagueId]);

  const { data: allPlayers, isLoading: isPlayersLoading } = useCollection(teamsQuery);

  const groupStandings = useMemo(() => {
    if (!isLoaded || !allPlayers) return [];
    return getMockGroupTeams(rank, displayName, leagueLevel, 1, groupId, selectedLeagueId || "ALPHA", allPlayers, user?.uid, seasonDay);
  }, [isLoaded, allPlayers, rank, displayName, leagueLevel, groupId, selectedLeagueId, user?.uid, seasonDay]);

  if (!isLoaded || isPlayersLoading) return <LoadingScreen />;

  const translations = {
    en: {
      title: "RANKINGS HUB",
      subtitle: "Global Competitive Terminals",
      my_league: "My League",
      pyramid_cup: "Pyramid Cup",
      promotion: "PROMOTION",
      relegation: "RELEGATION",
      pts: "PTS",
      winLoss: "W-L",
      back: "Back",
      menu: [
        { id: 'my_league', label: 'My League', desc: `Division ${leagueLevel}.${groupId}`, icon: Trophy, color: 'text-primary' },
        { id: 'pyramid_cup', label: 'Pyramid Cup', desc: 'Global knockout tournament', icon: Medal, color: 'text-accent' },
      ]
    },
    ru: {
      title: "ТАБЛИЦЫ РЕЙТИНГА",
      subtitle: "Терминалы глобальных соревнований",
      my_league: "Своя лига",
      pyramid_cup: "Кубок пирамиды",
      promotion: "ПОВЫШЕНИЕ",
      relegation: "ВЫЛЕТ",
      pts: "ОЧК",
      winLoss: "В-П",
      back: "Назад",
      menu: [
        { id: 'my_league', label: 'Своя лига', desc: `Дивизион ${leagueLevel}.${groupId}`, icon: Trophy, color: 'text-primary' },
        { id: 'pyramid_cup', label: 'Кубок пирамиды', desc: 'Глобальный турнир на выбывание', icon: Medal, color: 'text-accent' },
      ]
    }
  };

  const t = translations[language as 'en' | 'ru'] || translations.ru;

  const renderContent = () => {
    switch (activeTab) {
      case 'my_league':
        return (
          <div className="space-y-4 animate-in fade-in duration-500">
            <header className="flex items-center justify-between px-1">
              <h3 className="text-[10px] font-black uppercase text-accent tracking-widest flex items-center gap-2">
                <Shield className="w-3.5 h-3.5" /> DIVISION {leagueLevel}.{groupId}
              </h3>
            </header>

            <div className="space-y-1">
              <div className="grid grid-cols-[30px_1fr_60px_40px] items-center px-4 py-2 text-[8px] font-black text-muted-foreground uppercase tracking-widest">
                <span>#</span>
                <span>Team</span>
                <span className="text-center">{t.winLoss}</span>
                <span className="text-right">{t.pts}</span>
              </div>

              {groupStandings.map((entry, i) => {
                const isPromo = i < 2;
                const isRel = i >= 6;
                return (
                  <div 
                    key={entry.id} 
                    className={cn(
                      "grid grid-cols-[30px_1fr_60px_40px] items-center p-3 rounded-xl border transition-all",
                      entry.isMe ? "bg-primary/20 border-primary/40 ring-1 ring-primary/20 scale-[1.02] z-10" : "bg-secondary/20 border-white/5",
                      isPromo && !entry.isMe && "border-green-500/10",
                      isRel && !entry.isMe && "border-red-500/10 opacity-80"
                    )}
                  >
                    <div className={cn("text-xs font-black italic", isPromo ? "text-green-400" : (isRel ? "text-red-400" : "text-muted-foreground"))}>
                      {i + 1}
                    </div>
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-[11px] font-bold uppercase truncate text-white">{entry.name}</span>
                      {entry.isMe && <Badge className="text-[6px] h-3 px-1 bg-primary text-primary-foreground font-black">YOU</Badge>}
                    </div>
                    <div className="text-center font-mono text-[10px] font-bold text-muted-foreground">
                      {entry.wins}-{entry.losses}
                    </div>
                    <div className="text-right font-headline font-black text-primary italic">
                      {entry.points}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="grid grid-cols-2 gap-2 mt-4 px-1">
              <div className="flex items-center gap-2 text-[8px] font-black text-green-400 uppercase tracking-widest">
                <ArrowUp className="w-2.5 h-2.5" /> {t.promotion} (1-2)
              </div>
              <div className="flex items-center gap-2 text-[8px] font-black text-red-400 uppercase tracking-widest justify-end">
                <ArrowDown className="w-2.5 h-2.5" /> {t.relegation} (7-8)
              </div>
            </div>
          </div>
        );

      case 'pyramid_cup':
        return (
          <div className="py-20 text-center opacity-30 animate-in fade-in duration-500">
            <Medal className="w-16 h-16 mx-auto mb-4" />
            <h2 className="text-xl font-headline font-bold uppercase text-white">{t.pyramid_cup}</h2>
            <p className="text-[10px] uppercase font-bold tracking-widest mt-2">Coming soon in next season update</p>
          </div>
        );

      default: return null;
    }
  };

  return (
    <div className="max-w-md mx-auto px-4 pt-8 pb-24">
      <header className="mb-8 flex items-center gap-4">
        {activeTab === 'menu' ? (
          <Link href="/"><Button variant="ghost" size="icon" className="rounded-full border border-white/5"><ChevronLeft className="w-6 h-6" /></Button></Link>
        ) : (
          <Button variant="ghost" size="icon" className="rounded-full border border-white/5" onClick={() => setActiveTab('menu')}><ChevronLeft className="w-6 h-6" /></Button>
        )}
        <div>
          <h1 className="text-2xl font-headline font-bold uppercase tracking-tighter text-white">
            {activeTab === 'menu' ? t.title : (translations as any)[language === 'ru' ? 'ru' : 'en'][activeTab].label}
          </h1>
          <p className="text-muted-foreground text-[10px] uppercase tracking-widest">{activeTab === 'menu' ? t.subtitle : t.back}</p>
        </div>
      </header>

      {activeTab === 'menu' ? (
        <div className="space-y-2">
          {t.menu.map((item) => (
            <Card 
              key={item.id} 
              className="glass-card border-white/5 hover:bg-white/5 transition-all cursor-pointer group" 
              onClick={() => setActiveTab(item.id as RankingTab)}
            >
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={cn("p-2.5 rounded-xl bg-secondary/50", item.color)}>
                    <item.icon className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold uppercase group-hover:text-white transition-colors">{item.label}</h3>
                    <p className="text-[10px] text-muted-foreground leading-tight">{item.desc}</p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : renderContent()}
    </div>
  );
}
