
'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useGameState } from '../lib/store';
import { 
  Trophy, Medal, ChevronLeft, ChevronRight, 
  Crown, Shield, Globe, Layers, Loader2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import Link from 'next/link';
import { getGroupStandings, LEAGUES } from '../lib/leagues-data';
import { Badge } from '@/components/ui/badge';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import { LoadingScreen } from '@/components/game/LoadingScreen';
import { getGlobalSeasonInfo } from '../lib/time-utils';

type RankingTab = 'menu' | 'my_league' | 'my_pyramid' | 'all_pyramids' | 'pyramid_cup';

export default function RankingsPage() {
  const { user, isUserLoading } = useUser();
  const router = useRouter();
  const { 
    leagueLevel, groupId, isLoaded, language, 
    seasonDay, selectedLeagueId, groupMatches, seasonNumber
  } = useGameState();
  const db = useFirestore();
  
  const [activeTab, setActiveTab] = useState<RankingTab>('menu');
  const [navLeague, setNavLeague] = useState<string | null>(null);
  const [navLevel, setNavLevel] = useState<number | null>(null);
  const [navGroup, setNavGroup] = useState<number | null>(null);

  const contextLeagueId = navLeague || selectedLeagueId || "ALPHA";
  const contextLevel = navLevel || leagueLevel;
  const contextGroup = navGroup || groupId;

  const playersQuery = useMemoFirebase(() => {
    return query(
      collection(db, 'players_v10'), 
      where('selectedLeagueId', '==', contextLeagueId),
      where('leagueLevel', '==', contextLevel),
      where('groupId', '==', contextGroup)
    );
  }, [db, contextLeagueId, contextLevel, contextGroup]);

  const { data: contextPlayers, isLoading: isPlayersLoading } = useCollection(playersQuery);
  const seasonInfo = useMemo(() => getGlobalSeasonInfo(), [isLoaded]);

  const standings = useMemo(() => {
    if (!isLoaded) return [];
    return getGroupStandings(
      contextLevel,
      contextGroup,
      contextLeagueId,
      seasonNumber,
      seasonDay,
      contextPlayers || [],
      groupMatches || [],
      seasonInfo.isTransitionPhase
    );
  }, [isLoaded, contextPlayers, contextLevel, contextGroup, contextLeagueId, groupMatches, seasonNumber, seasonDay, seasonInfo.isTransitionPhase]);

  if (isUserLoading || !isLoaded) return <LoadingScreen />;

  const translations = {
    en: {
      title: "RANKINGS HUB",
      subtitle: "Global Competitive Terminals",
      pts: "PTS",
      winLoss: "W-D-L",
      back: "Back",
      division: "Division",
      group: "Group",
      menu: [
        { id: 'my_league', label: 'My League', desc: `Division ${leagueLevel}.${groupId}`, icon: Shield, color: 'text-primary' },
        { id: 'my_pyramid', label: 'My Pyramid', desc: `Structure of ${selectedLeagueId}`, icon: Layers, color: 'text-accent' },
        { id: 'all_pyramids', label: 'All Pyramids', desc: 'Global 16-league data', icon: Globe, color: 'text-blue-400' },
        { id: 'pyramid_cup', label: 'Pyramid Cup', desc: 'Knockout tournament', icon: Medal, color: 'text-yellow-500' },
      ]
    },
    ru: {
      title: "ТАБЛИЦЫ РЕЙТИНГА",
      subtitle: "Терминалы глобальных соревнований",
      pts: "ОЧК",
      winLoss: "В-Н-П",
      back: "Назад",
      division: "Дивизион",
      group: "Группа",
      menu: [
        { id: 'my_league', label: 'Своя лига', desc: `Дивизион ${leagueLevel}.${groupId}`, icon: Shield, color: 'text-primary' },
        { id: 'my_pyramid', label: 'Своя пирамида', desc: `Структура лиги ${selectedLeagueId}`, icon: Layers, color: 'text-accent' },
        { id: 'all_pyramids', label: 'Все пирамиды', desc: 'Данные всех 16 лиг', icon: Globe, color: 'text-blue-400' },
        { id: 'pyramid_cup', label: 'Кубок пирамиды', desc: 'Турнир на выбывание', icon: Medal, color: 'text-yellow-500' },
      ]
    }
  };

  const t = translations[language as 'en' | 'ru'] || translations.ru;

  const renderTable = (showBreadcrumbs = false) => (
    <div className="space-y-4 animate-in fade-in duration-500">
      {showBreadcrumbs && (
        <div className="flex items-center gap-2 px-1 mb-4 overflow-x-auto scrollbar-hide">
          <Button variant="ghost" size="sm" className="h-6 text-[8px] font-black uppercase tracking-widest text-muted-foreground" onClick={() => setNavGroup(null)}>
            {contextLeagueId} / DIV {contextLevel}
          </Button>
          <ChevronRight className="w-3 h-3 text-muted-foreground" />
          <Badge className="bg-primary text-primary-foreground text-[8px] font-black uppercase">GROUP {contextGroup}</Badge>
        </div>
      )}

      <div className="space-y-1">
        <div className="grid grid-cols-[30px_1fr_75px_40px] items-center px-4 py-2 text-[8px] font-black text-muted-foreground uppercase tracking-widest">
          <span>#</span>
          <span>Team</span>
          <span className="text-center">{t.winLoss}</span>
          <span className="text-right">{t.pts}</span>
        </div>

        {isPlayersLoading ? (
          <div className="py-20 text-center opacity-50"><Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" /></div>
        ) : standings.length > 0 ? standings.map((entry, i) => (
          <div 
            key={entry.id} 
            className={cn(
              "grid grid-cols-[30px_1fr_75px_40px] items-center p-3 rounded-xl border transition-all",
              entry.id === user?.uid ? "bg-primary/20 border-primary/40" : "bg-secondary/20 border-white/5",
              i < 2 && entry.id !== user?.uid && "border-green-500/10",
              i >= 6 && entry.id !== user?.uid && "border-red-500/10"
            )}
          >
            <div className={cn("text-xs font-black italic", i < 2 ? "text-green-400" : (i >= 6 ? "text-red-400" : "text-muted-foreground"))}>{i + 1}</div>
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-[11px] font-bold uppercase truncate text-white">{entry.name}</span>
              {entry.id === user?.uid && <Badge className="text-[6px] h-3 px-1 bg-primary text-primary-foreground font-black">YOU</Badge>}
            </div>
            <div className="text-center font-mono text-[10px] font-bold text-muted-foreground">
              {entry.wins}-{entry.draws}-{entry.losses}
            </div>
            <div className="text-right font-headline font-black text-primary italic">{entry.points}</div>
          </div>
        )) : (
          <div className="py-20 text-center opacity-30 text-[10px] uppercase font-black">Pre-Season: Standing Nodes Offline</div>
        )}
      </div>
    </div>
  );

  return (
    <div className="max-w-md mx-auto px-4 pt-8 pb-24">
      <header className="mb-8 flex items-center gap-4">
        <Button variant="ghost" size="icon" className="rounded-full border border-white/5" onClick={() => activeTab === 'menu' ? router.push('/') : setActiveTab('menu')}>
          <ChevronLeft className="w-6 h-6" />
        </Button>
        <div>
          <h1 className="text-2xl font-headline font-bold uppercase tracking-tighter text-white">
            {activeTab === 'menu' ? t.title : (t.menu.find(m => m.id === activeTab)?.label || t.title)}
          </h1>
          <p className="text-muted-foreground text-[10px] uppercase tracking-widest">{activeTab === 'menu' ? t.subtitle : t.back}</p>
        </div>
      </header>

      {activeTab === 'menu' ? (
        <div className="space-y-2">
          {t.menu.map((item) => (
            <Card key={item.id} className="glass-card border-white/5 hover:bg-white/5 cursor-pointer group" onClick={() => setActiveTab(item.id as RankingTab)}>
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={cn("p-2.5 rounded-xl bg-secondary/50", item.color)}><item.icon className="w-5 h-5" /></div>
                  <div><h3 className="text-sm font-bold uppercase group-hover:text-white transition-colors">{item.label}</h3><p className="text-[10px] text-muted-foreground leading-tight">{item.desc}</p></div>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : activeTab === 'my_league' ? renderTable() : (
        <div className="py-20 text-center opacity-30 animate-in fade-in">
          <Layers className="w-12 h-12 mx-auto mb-4" />
          <p className="text-[10px] uppercase font-black">Global Data Sync in Progress...</p>
        </div>
      )}
    </div>
  );
}
