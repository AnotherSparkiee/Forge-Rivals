
'use client';

import { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useGameState } from '../lib/store';
import { 
  Trophy, Medal, ChevronLeft, ChevronRight, 
  Shield, Globe, Layers, LayoutGrid,
  MapPin, Home, Info, Search, List, Filter
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { getGroupStandings, LEAGUES, MAX_LEVELS } from '../lib/leagues-data';
import { Badge } from '@/components/ui/badge';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import { LoadingScreen } from '@/components/game/LoadingScreen';

type RankingTab = 'menu' | 'my_league' | 'my_pyramid' | 'all_pyramids' | 'pyramid_cup';

export default function RankingsPage() {
  const { user, isUserLoading } = useUser();
  const router = useRouter();
  const { 
    leagueLevel, groupId, isLoaded, language, 
    selectedLeagueId, activeSeasonNumber
  } = useGameState();
  const db = useFirestore();
  
  const [activeTab, setActiveTab] = useState<RankingTab>('menu');
  const [navLeague, setNavLeague] = useState<string | null>(null);
  const [navLevel, setNavLevel] = useState<number | null>(null);
  const [navGroup, setNavGroup] = useState<number | null>(null);

  // Contextual IDs
  const contextLeagueId = navLeague || selectedLeagueId || "ALPHA";
  const contextLevel = navLevel || leagueLevel;
  const contextGroup = navGroup || groupId;

  // Real data for current group view
  const playersQuery = useMemoFirebase(() => {
    return query(
      collection(db, 'players_v10'), 
      where('selectedLeagueId', '==', contextLeagueId),
      where('leagueLevel', '==', Number(contextLevel)),
      where('groupId', '==', Number(contextGroup))
    );
  }, [db, contextLeagueId, contextLevel, contextGroup]);

  const { data: groupPlayers } = useCollection(playersQuery);

  const matchesQuery = useMemoFirebase(() => {
    return query(
      collection(db, 'matches_v1'),
      where('leagueId', '==', contextLeagueId),
      where('divisionId', '==', Number(contextLevel)),
      where('groupId', '==', Number(contextGroup)),
      where('seasonNumber', '==', Number(activeSeasonNumber))
    );
  }, [db, contextLeagueId, contextLevel, contextGroup, activeSeasonNumber]);

  const { data: groupMatches } = useCollection(matchesQuery);

  const standings = useMemo(() => {
    if (!isLoaded) return [];
    return getGroupStandings(
      Number(contextLevel),
      Number(contextGroup),
      contextLeagueId,
      Number(activeSeasonNumber),
      groupPlayers || [],
      groupMatches || []
    );
  }, [isLoaded, groupPlayers, contextLevel, contextGroup, contextLeagueId, groupMatches, activeSeasonNumber]);

  const t = {
    en: {
      title: "RANKINGS HUB", subtitle: "Global Competitive Terminals",
      pts: "PTS", winLoss: "W-D-L", back: "Back",
      selectDiv: "Select Division", selectGroup: "Select Group",
      menu: [
        { id: 'my_league', label: 'My Current Table', desc: `Division ${leagueLevel}.${groupId}`, icon: Shield, color: 'text-primary' },
        { id: 'my_pyramid', label: 'My Pyramid', desc: `Explore ${selectedLeagueId}`, icon: Layers, color: 'text-accent' },
        { id: 'all_pyramids', label: 'Global Structure', desc: 'Browse all 16 leagues', icon: Globe, color: 'text-blue-400' },
        { id: 'pyramid_cup', label: 'Pyramid Cup', desc: 'Knockout Stage', icon: Medal, color: 'text-yellow-500' },
      ]
    },
    ru: {
      title: "ТАБЛИЦЫ РЕЙТИНГА", subtitle: "Терминалы глобальных соревнований",
      pts: "ОЧК", winLoss: "В-Н-П", back: "Назад",
      selectDiv: "Выберите дивизион", selectGroup: "Выберите группу",
      menu: [
        { id: 'my_league', label: 'Своя таблица', desc: `Дивизион ${leagueLevel}.${groupId}`, icon: Shield, color: 'text-primary' },
        { id: 'my_pyramid', label: 'Своя пирамида', desc: `Изучить лигу ${selectedLeagueId}`, icon: Layers, color: 'text-accent' },
        { id: 'all_pyramids', label: 'Глобальная структура', desc: 'Все 16 лиг мира', icon: Globe, color: 'text-blue-400' },
        { id: 'pyramid_cup', label: 'Кубок пирамиды', desc: 'Сетка плей-офф', icon: Medal, color: 'text-yellow-500' },
      ]
    }
  }[language as 'en' | 'ru'];

  if (isUserLoading || !isLoaded) return <LoadingScreen />;

  const renderStandings = () => (
    <div className="space-y-4 animate-in fade-in duration-500">
      <div className="flex items-center gap-2 px-1 mb-4 bg-secondary/10 p-2 rounded-xl border border-white/5 overflow-x-auto scrollbar-hide">
        <Button variant="ghost" size="sm" className="h-7 text-[8px] font-black uppercase text-accent" onClick={() => setNavGroup(null)}>DIV {contextLevel}</Button>
        <ChevronRight className="w-3 h-3 text-muted-foreground opacity-30" />
        <Badge className="bg-primary text-primary-foreground text-[8px] font-black uppercase h-6 px-3">GROUP {contextGroup}</Badge>
      </div>

      <div className="space-y-1">
        <div className="grid grid-cols-[30px_1fr_75px_40px] px-4 py-2 text-[8px] font-black text-muted-foreground uppercase tracking-widest border-b border-white/5">
          <span>#</span><span>Team</span><span className="text-center">{t.winLoss}</span><span className="text-right">{t.pts}</span>
        </div>
        <div className="space-y-1 mt-2">
          {standings.map((entry, i) => (
            <div key={entry.id} className={cn("grid grid-cols-[30px_1fr_75px_40px] items-center p-3 rounded-xl border", entry.id === user?.uid ? "bg-primary/20 border-primary/40" : "bg-secondary/20 border-white/5")}>
              <div className="text-xs font-black italic text-muted-foreground">{i + 1}</div>
              <div className="flex items-center gap-2 truncate">
                <span className="text-[11px] font-bold uppercase truncate text-white">{entry.name}</span>
                {entry.id === user?.uid && <Badge className="text-[6px] h-3 px-1 bg-primary text-primary-foreground">YOU</Badge>}
              </div>
              <div className="text-center font-mono text-[10px] text-muted-foreground">{entry.wins}-{entry.draws}-{entry.losses}</div>
              <div className="text-right font-headline font-black text-primary italic">{entry.points}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderGroupPicker = () => {
    const numGroups = Math.pow(2, contextLevel! - 1);
    return (
      <div className="space-y-4 animate-in slide-in-from-right-4">
        <h3 className="text-[10px] font-black uppercase tracking-widest text-accent px-1">{t.selectGroup}</h3>
        <div className="grid grid-cols-4 gap-2">
          {Array.from({ length: Math.min(numGroups, 64) }, (_, i) => i + 1).map(g => (
            <Button key={g} variant="outline" className={cn("h-12 border-white/5 bg-secondary/20 font-bold", contextGroup === g && "border-primary text-primary")} onClick={() => setNavGroup(g)}>{g}</Button>
          ))}
        </div>
      </div>
    );
  };

  const renderDivisionPicker = () => (
    <div className="space-y-3 animate-in slide-in-from-right-4">
      <h3 className="text-[10px] font-black uppercase tracking-widest text-accent px-1">{t.selectDiv}</h3>
      {Array.from({ length: MAX_LEVELS }, (_, i) => i + 1).map(lvl => (
        <Card key={lvl} className="glass-card border-white/5 hover:bg-white/5 cursor-pointer" onClick={() => setNavLevel(lvl)}>
          <CardContent className="p-4 flex justify-between items-center">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-secondary/50 flex items-center justify-center border border-white/5 font-headline font-bold text-lg italic text-primary">{lvl}</div>
              <span className="text-sm font-bold uppercase tracking-tight">Division {lvl}</span>
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </CardContent>
        </Card>
      ))}
    </div>
  );

  const renderLeaguePicker = () => (
    <div className="grid grid-cols-2 gap-2 animate-in fade-in">
      {LEAGUES.map(l => (
        <Card key={l.id} className="glass-card border-white/5 hover:bg-white/5 cursor-pointer" onClick={() => setNavLeague(l.id)}>
          <CardContent className="p-4 text-center">
            <p className="text-sm font-headline font-bold text-white italic">{l.id}</p>
            <p className="text-[7px] text-muted-foreground uppercase font-black mt-1">Start: {l.startTime} MSK</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );

  return (
    <div className="max-w-md mx-auto px-4 pt-8 pb-24">
      <header className="mb-8 flex items-center gap-4">
        <Button variant="ghost" size="icon" className="rounded-full border border-white/5" onClick={() => { if (navGroup) setNavGroup(null); else if (navLevel) setNavLevel(null); else if (navLeague) setNavLeague(null); else if (activeTab !== 'menu') setActiveTab('menu'); else router.push('/'); }}>
          <ChevronLeft className="w-6 h-6" />
        </Button>
        <div>
          <h1 className="text-2xl font-headline font-bold uppercase tracking-tighter text-white">{activeTab === 'menu' ? t.title : t.menu.find(m => m.id === activeTab)?.label}</h1>
          <p className="text-muted-foreground text-[10px] uppercase tracking-widest">{contextLeagueId} {navLevel ? `> DIV ${navLevel}` : ''}</p>
        </div>
      </header>

      {activeTab === 'menu' ? (
        <div className="space-y-2">
          {t.menu.map(item => (
            <Card key={item.id} className="glass-card border-white/5 hover:bg-white/5 cursor-pointer group" onClick={() => { setActiveTab(item.id as RankingTab); if (item.id === 'my_league') { setNavLeague(selectedLeagueId); setNavLevel(leagueLevel); setNavGroup(groupId); } else if (item.id === 'my_pyramid') { setNavLeague(selectedLeagueId); } }}>
              <CardContent className="p-4 flex justify-between items-center">
                <div className="flex items-center gap-4">
                  <div className={cn("p-2.5 rounded-xl bg-secondary/50", item.color)}><item.icon className="w-5 h-5" /></div>
                  <div><h3 className="text-sm font-bold uppercase group-hover:text-white">{item.label}</h3><p className="text-[10px] text-muted-foreground">{item.desc}</p></div>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <>
          {activeTab === 'all_pyramids' && !navLeague ? renderLeaguePicker() : 
           !navLevel ? renderDivisionPicker() : 
           !navGroup ? renderGroupPicker() : 
           renderStandings()}
        </>
      )}
    </div>
  );
}
