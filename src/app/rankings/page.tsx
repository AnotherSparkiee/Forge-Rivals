
'use client';

import { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useGameState } from '../lib/store';
import { 
  Trophy, Medal, ChevronLeft, ChevronRight, 
  Shield, Globe, Layers, LayoutGrid,
  MapPin, Home, Info, Search, List
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
type ViewDepth = 'leagues' | 'divisions' | 'groups' | 'table';

export default function RankingsPage() {
  const { user, isUserLoading } = useUser();
  const router = useRouter();
  const { 
    leagueLevel, groupId, isLoaded, language, 
    selectedLeagueId, seasonNumber
  } = useGameState();
  const db = useFirestore();
  
  const [activeTab, setActiveTab] = useState<RankingTab>('menu');
  const [navLeague, setNavLeague] = useState<string | null>(null);
  const [navLevel, setNavLevel] = useState<number | null>(null);
  const [navGroup, setNavGroup] = useState<number | null>(null);

  // Determine context
  const contextLeagueId = navLeague || selectedLeagueId || "ALPHA";
  const contextLevel = navLevel || leagueLevel;
  const contextGroup = navGroup || groupId;

  // Fetch players for the entire league being viewed
  const playersQuery = useMemoFirebase(() => {
    return query(
      collection(db, 'players_v10'), 
      where('selectedLeagueId', '==', contextLeagueId)
    );
  }, [db, contextLeagueId]);

  const { data: allLeaguePlayers, isLoading: isPlayersLoading } = useCollection(playersQuery);

  // Fetch matches for the specific group being viewed to get real-time standings
  const matchesQuery = useMemoFirebase(() => {
    if (!navGroup && activeTab !== 'my_league') return null;
    return query(
      collection(db, 'matches_v1'),
      where('leagueId', '==', contextLeagueId),
      where('divisionId', '==', contextLevel),
      where('groupId', '==', contextGroup),
      where('seasonNumber', '==', seasonNumber)
    );
  }, [db, contextLeagueId, contextLevel, contextGroup, seasonNumber, navGroup, activeTab]);

  const { data: groupMatches, isLoading: isMatchesLoading } = useCollection(matchesQuery);

  const standings = useMemo(() => {
    if (!isLoaded) return [];
    return getGroupStandings(
      contextLevel,
      contextGroup,
      contextLeagueId,
      seasonNumber,
      allLeaguePlayers || [],
      groupMatches || []
    );
  }, [isLoaded, allLeaguePlayers, contextLevel, contextGroup, contextLeagueId, groupMatches, seasonNumber]);

  useEffect(() => {
    if (activeTab === 'my_league') {
      setNavLeague(selectedLeagueId);
      setNavLevel(leagueLevel);
      setNavGroup(groupId);
    }
  }, [activeTab, selectedLeagueId, leagueLevel, groupId]);

  if (isUserLoading || !isLoaded) return <LoadingScreen />;

  const translations = {
    en: {
      title: "RANKINGS HUB",
      subtitle: "Global Competitive Terminals",
      pts: "PTS", winLoss: "W-D-L", back: "Back",
      division: "Division", group: "Group", league: "League",
      selectLeague: "Select League", selectDiv: "Select Division", selectGroup: "Select Group",
      noPlayers: "Empty Group",
      menu: [
        { id: 'my_league', label: 'My Current Table', desc: `Division ${leagueLevel}.${groupId}`, icon: Shield, color: 'text-primary' },
        { id: 'my_pyramid', label: 'My Pyramid', desc: `Explore ${selectedLeagueId}`, icon: Layers, color: 'text-accent' },
        { id: 'all_pyramids', label: 'Global Structure', desc: 'Browse all 16 leagues', icon: Globe, color: 'text-blue-400' },
        { id: 'pyramid_cup', label: 'Pyramid Cup', desc: 'Knockout Stage', icon: Medal, color: 'text-yellow-500' },
      ]
    },
    ru: {
      title: "ТАБЛИЦЫ РЕЙТИНГА",
      subtitle: "Терминалы глобальных соревнований",
      pts: "ОЧК", winLoss: "В-Н-П", back: "Назад",
      division: "Дивизион", group: "Группа", league: "Лига",
      selectLeague: "Выберите лигу", selectDiv: "Выберите дивизион", selectGroup: "Выберите группу",
      noPlayers: "Пустая группа",
      menu: [
        { id: 'my_league', label: 'Своя таблица', desc: `Дивизион ${leagueLevel}.${groupId}`, icon: Shield, color: 'text-primary' },
        { id: 'my_pyramid', label: 'Своя пирамида', desc: `Изучить лигу ${selectedLeagueId}`, icon: Layers, color: 'text-accent' },
        { id: 'all_pyramids', label: 'Глобальная структура', desc: 'Все 16 лиг мира', icon: Globe, color: 'text-blue-400' },
        { id: 'pyramid_cup', label: 'Кубок пирамиды', desc: 'Сетка плей-офф', icon: Medal, color: 'text-yellow-500' },
      ]
    }
  };

  const t = translations[language as 'en' | 'ru'] || translations.ru;

  const resetNav = () => {
    setNavLeague(null);
    setNavLevel(null);
    setNavGroup(null);
    setActiveTab('menu');
  };

  const renderStandings = () => (
    <div className="space-y-4 animate-in fade-in duration-500">
      <div className="flex items-center gap-2 px-1 mb-4 overflow-x-auto scrollbar-hide bg-secondary/10 p-2 rounded-xl border border-white/5">
        <Button variant="ghost" size="sm" className="h-7 text-[8px] font-black uppercase text-accent hover:text-white" onClick={() => { setNavGroup(null); setNavLevel(null); }}>
          {contextLeagueId}
        </Button>
        <ChevronRight className="w-3 h-3 text-muted-foreground opacity-30" />
        <Button variant="ghost" size="sm" className="h-7 text-[8px] font-black uppercase text-muted-foreground hover:text-white" onClick={() => setNavGroup(null)}>
          DIV {contextLevel}
        </Button>
        <ChevronRight className="w-3 h-3 text-muted-foreground opacity-30" />
        <Badge className="bg-primary text-primary-foreground text-[8px] font-black uppercase h-6 px-3">GROUP {contextGroup}</Badge>
      </div>

      <div className="space-y-1">
        <div className="grid grid-cols-[30px_1fr_75px_40px] items-center px-4 py-2 text-[8px] font-black text-muted-foreground uppercase tracking-widest border-b border-white/5">
          <span>#</span>
          <span>Team</span>
          <span className="text-center">{t.winLoss}</span>
          <span className="text-right">{t.pts}</span>
        </div>

        <div className="space-y-1 mt-2">
          {standings.map((entry, i) => (
            <div 
              key={entry.id} 
              className={cn(
                "grid grid-cols-[30px_1fr_75px_40px] items-center p-3 rounded-xl border transition-all",
                entry.id === user?.uid ? "bg-primary/20 border-primary/40 shadow-[0_0_15px_rgba(var(--primary),0.1)]" : "bg-secondary/20 border-white/5",
                i < 2 && "border-green-500/10",
                i >= 6 && "border-red-500/10"
              )}
            >
              <div className={cn("text-xs font-black italic", i < 2 ? "text-green-400" : (i >= 6 ? "text-red-400" : "text-muted-foreground"))}>{i + 1}</div>
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-[11px] font-bold uppercase truncate text-white">{entry.name}</span>
                {entry.id === user?.uid && <Badge className="text-[6px] h-3 px-1 bg-primary text-primary-foreground font-black">YOU</Badge>}
              </div>
              <div className="text-center font-mono text-[10px] font-bold text-muted-foreground">
                {entry.wins}-{entry.draws || 0}-{entry.losses}
              </div>
              <div className="text-right font-headline font-black text-primary italic">{entry.points}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderGroupPicker = () => {
    const groupsInDiv = Math.pow(2, contextLevel - 1);
    const groups = Array.from({ length: groupsInDiv }, (_, i) => i + 1);

    return (
      <div className="space-y-6 animate-in slide-in-from-right-4 duration-500">
        <div className="flex items-center gap-2 mb-4 bg-secondary/10 p-2 rounded-xl border border-white/5">
          <Button variant="ghost" size="sm" className="h-7 text-[8px] font-black uppercase text-accent" onClick={() => setNavLevel(null)}>
            {contextLeagueId}
          </Button>
          <ChevronRight className="w-3 h-3 text-muted-foreground opacity-30" />
          <Badge variant="outline" className="text-[8px] font-black uppercase h-6 px-3 border-white/10">DIV {contextLevel}</Badge>
        </div>

        <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground px-1 mb-4">{t.selectGroup}</h3>
        
        <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
          {groups.map((g) => (
            <Button 
              key={g} 
              variant="outline" 
              className={cn(
                "h-12 border-white/5 bg-secondary/20 font-headline font-bold text-sm",
                contextLevel === leagueLevel && groupId === g && "border-primary/50 text-primary bg-primary/5"
              )}
              onClick={() => setNavGroup(g)}
            >
              {g}
            </Button>
          ))}
        </div>
      </div>
    );
  };

  const renderDivisionPicker = () => (
    <div className="space-y-4 animate-in slide-in-from-right-4 duration-500">
      <div className="flex items-center gap-2 mb-4 bg-secondary/10 p-2 rounded-xl border border-white/5">
        <Button variant="ghost" size="sm" className="h-7 text-[8px] font-black uppercase text-accent" onClick={() => setNavLeague(null)}>
          {contextLeagueId}
        </Button>
      </div>
      
      <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground px-1 mb-4">{t.selectDiv}</h3>
      
      <div className="grid gap-2">
        {Array.from({ length: MAX_LEVELS }, (_, i) => i + 1).map((lvl) => {
          const numGroups = Math.pow(2, lvl - 1);
          const isMyLevel = lvl === leagueLevel && contextLeagueId === selectedLeagueId;
          
          return (
            <Card key={lvl} className={cn(
              "glass-card border-white/5 hover:border-primary/30 cursor-pointer transition-all group",
              isMyLevel && "border-primary/40 bg-primary/5"
            )} onClick={() => setNavLevel(lvl)}>
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={cn(
                    "w-10 h-10 rounded-xl flex items-center justify-center border transition-all",
                    isMyLevel ? "bg-primary/20 border-primary/30 text-primary" : "bg-secondary/50 border-white/5 text-muted-foreground"
                  )}>
                    <span className="text-lg font-headline font-bold italic">{lvl}</span>
                  </div>
                  <div>
                    <h3 className="text-sm font-bold uppercase tracking-tight">Division {lvl}</h3>
                    <p className="text-[8px] text-muted-foreground uppercase font-black tracking-widest">{numGroups} Tactical Groups</p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-transform group-hover:translate-x-1" />
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );

  const renderLeaguePicker = () => (
    <div className="space-y-4 animate-in fade-in duration-500">
      <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-accent px-1 mb-4">{t.selectLeague}</h3>
      <div className="grid grid-cols-2 gap-2">
        {LEAGUES.map(l => (
          <Card 
            key={l.id} 
            className={cn(
              "glass-card border-white/5 cursor-pointer transition-all hover:border-primary/30",
              selectedLeagueId === l.id && "border-primary/40 bg-primary/5 shadow-[0_0_15px_rgba(var(--primary),0.1)]"
            )}
            onClick={() => setNavLeague(l.id)}
          >
            <CardContent className="p-4 text-center">
              <p className="text-sm font-headline font-bold text-white italic">{l.id}</p>
              <p className="text-[7px] text-muted-foreground uppercase font-black mt-1">Starts: {l.startTime} MSK</p>
              {selectedLeagueId === l.id && <Badge className="mt-2 bg-primary text-primary-foreground text-[6px] h-3 px-1 uppercase">CURRENT</Badge>}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );

  return (
    <div className="max-w-md mx-auto px-4 pt-8 pb-24">
      <header className="mb-8 flex items-center gap-4">
        <Button variant="ghost" size="icon" className="rounded-full border border-white/5" onClick={activeTab === 'menu' ? () => router.push('/') : resetNav}>
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
            <Card key={item.id} className="glass-card border-white/5 hover:bg-white/5 cursor-pointer group transition-all" onClick={() => {
              setActiveTab(item.id as RankingTab);
              if (item.id === 'my_pyramid') setNavLeague(selectedLeagueId);
            }}>
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={cn("p-2.5 rounded-xl bg-secondary/50", item.color)}><item.icon className="w-5 h-5" /></div>
                  <div><h3 className="text-sm font-bold uppercase group-hover:text-white transition-colors">{item.label}</h3><p className="text-[10px] text-muted-foreground leading-tight">{item.desc}</p></div>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-transform group-hover:translate-x-1" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : activeTab === 'pyramid_cup' ? (
        <div className="py-20 text-center opacity-30 animate-in fade-in">
          <Medal className="w-12 h-12 mx-auto mb-4" />
          <p className="text-[10px] uppercase font-black tracking-widest">Global Cup Data Sync in Progress...</p>
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
