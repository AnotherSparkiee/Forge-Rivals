
'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useGameState } from '../lib/store';
import { 
  Trophy, Medal, ChevronLeft, ChevronRight, 
  Crown, Shield, Globe, Layers, Loader2, Home, 
  MapPin, Filter, Search, LayoutGrid
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { getGroupStandings, LEAGUES, MAX_LEVELS } from '../lib/leagues-data';
import { Badge } from '@/components/ui/badge';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, limit } from 'firebase/firestore';
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

  // We need to fetch ALL players who might be in the pyramid we are browsing
  // For performance, we limit this when browsing ALL, but for "My Pyramid" it's essential
  const playersQuery = useMemoFirebase(() => {
    return query(
      collection(db, 'players_v10'), 
      where('selectedLeagueId', '==', contextLeagueId)
    );
  }, [db, contextLeagueId]);

  const { data: allLeaguePlayers, isLoading: isPlayersLoading } = useCollection(playersQuery);

  // We also need all matches for the league we are browsing to calculate standings correctly
  const matchesQuery = useMemoFirebase(() => {
    return query(
      collection(db, 'matches_v1'),
      where('leagueId', '==', contextLeagueId),
      where('seasonNumber', '==', seasonNumber)
    );
  }, [db, contextLeagueId, seasonNumber]);

  const { data: allLeagueMatches } = useCollection(matchesQuery);

  const standings = useMemo(() => {
    if (!isLoaded) return [];
    return getGroupStandings(
      contextLevel,
      contextGroup,
      contextLeagueId,
      seasonNumber,
      allLeaguePlayers || [],
      allLeagueMatches || []
    );
  }, [isLoaded, allLeaguePlayers, contextLevel, contextGroup, contextLeagueId, allLeagueMatches, seasonNumber]);

  if (isUserLoading || !isLoaded) return <LoadingScreen />;

  const translations = {
    en: {
      title: "RANKINGS HUB",
      subtitle: "Global Competitive Terminals",
      pts: "PTS", winLoss: "W-N-P", back: "Back",
      division: "Division", group: "Group", league: "League",
      viewGroup: "Inspect Group",
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
      pts: "ОЧК", winLoss: "В-Н-П", back: "Назад",
      division: "Дивизион", group: "Группа", league: "Лига",
      viewGroup: "Обзор группы",
      menu: [
        { id: 'my_league', label: 'Своя лига', desc: `Дивизион ${leagueLevel}.${groupId}`, icon: Shield, color: 'text-primary' },
        { id: 'my_pyramid', label: 'Своя пирамида', desc: `Структура лиги ${selectedLeagueId}`, icon: Layers, color: 'text-accent' },
        { id: 'all_pyramids', label: 'Все пирамиды', desc: 'Данные всех 16 лиг', icon: Globe, color: 'text-blue-400' },
        { id: 'pyramid_cup', label: 'Кубок пирамиды', desc: 'Турнир на выбывание', icon: Medal, color: 'text-yellow-500' },
      ]
    }
  };

  const t = translations[language as 'en' | 'ru'] || translations.ru;

  const renderTable = () => (
    <div className="space-y-4 animate-in fade-in duration-500">
      <div className="flex items-center gap-2 px-1 mb-4 overflow-x-auto scrollbar-hide bg-secondary/10 p-2 rounded-xl border border-white/5">
        <Button variant="ghost" size="sm" className="h-7 text-[8px] font-black uppercase text-accent hover:text-white" onClick={() => setActiveTab('my_pyramid')}>
          {contextLeagueId}
        </Button>
        <ChevronRight className="w-3 h-3 text-muted-foreground opacity-30" />
        <Badge variant="outline" className="text-[8px] font-black uppercase h-6 px-3 border-white/10">DIV {contextLevel}</Badge>
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

  const renderPyramid = () => (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between px-1 bg-secondary/10 p-3 rounded-2xl border border-white/5">
        <div className="flex items-center gap-3">
          <Globe className="w-5 h-5 text-accent" />
          <div>
            <h2 className="text-xs font-black uppercase text-white tracking-widest">{t.league}: {contextLeagueId}</h2>
            <p className="text-[8px] text-muted-foreground uppercase font-bold mt-0.5">Hierarchical Operational Node</p>
          </div>
        </div>
        <Badge variant="outline" className="text-[8px] uppercase border-white/10 opacity-60">Structure View</Badge>
      </div>

      <div className="grid gap-2">
        {Array.from({ length: MAX_LEVELS }, (_, i) => i + 1).map((lvl) => {
          const numGroups = Math.pow(2, lvl - 1);
          const isCurrentLevel = contextLevel === lvl;
          
          return (
            <Card key={lvl} className={cn(
              "glass-card border-white/5 overflow-hidden group transition-all",
              isCurrentLevel ? "border-primary/40 bg-primary/5" : "hover:bg-white/5"
            )}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className={cn(
                      "w-10 h-10 rounded-xl flex items-center justify-center border transition-all group-hover:scale-110",
                      isCurrentLevel ? "bg-primary/20 border-primary/30 text-primary" : "bg-secondary/50 border-white/5 text-muted-foreground"
                    )}>
                      <span className="text-lg font-headline font-bold italic">{lvl}</span>
                    </div>
                    <div>
                      <h3 className="text-sm font-bold uppercase tracking-tight">Division {lvl}</h3>
                      <p className="text-[9px] text-muted-foreground uppercase font-black tracking-tighter">{numGroups} Tactical Groups</p>
                    </div>
                  </div>
                  
                  <div className="flex flex-wrap gap-1 justify-end max-w-[160px]">
                    {Array.from({ length: Math.min(16, numGroups) }, (_, g) => g + 1).map((groupNum) => (
                      <Button 
                        key={groupNum} 
                        variant="ghost" 
                        size="sm" 
                        className={cn(
                          "h-6 w-6 p-0 text-[10px] font-bold rounded-lg border",
                          contextLevel === lvl && contextGroup === groupNum 
                            ? "bg-primary text-primary-foreground border-primary shadow-[0_0_10px_rgba(var(--primary),0.3)]" 
                            : "bg-secondary/50 border-white/5 text-muted-foreground hover:bg-white/10"
                        )}
                        onClick={() => {
                          setNavLevel(lvl);
                          setNavGroup(groupNum);
                          setActiveTab('my_league');
                        }}
                      >
                        {groupNum}
                      </Button>
                    ))}
                    {numGroups > 16 && (
                      <div className="h-6 px-1 flex items-center bg-secondary/30 rounded-lg border border-white/5">
                        <LayoutGrid className="w-3 h-3 text-muted-foreground/50" />
                        <span className="text-[7px] font-black text-muted-foreground/50 ml-1">+{numGroups - 16}</span>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="max-w-md mx-auto px-4 pt-8 pb-24">
      <header className="mb-8 flex items-center gap-4">
        <Button variant="ghost" size="icon" className="rounded-full border border-white/5" onClick={() => activeTab === 'menu' ? router.push('/') : (navGroup ? setNavGroup(null) : setActiveTab('menu'))}>
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
            <Card key={item.id} className="glass-card border-white/5 hover:bg-white/5 cursor-pointer group transition-all" onClick={() => setActiveTab(item.id as RankingTab)}>
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
      ) : activeTab === 'my_league' ? renderTable() : activeTab === 'my_pyramid' ? renderPyramid() : activeTab === 'all_pyramids' ? (
        <div className="space-y-4 animate-in fade-in duration-500">
           <div className="flex items-center gap-2 px-1 mb-2">
             <Globe className="w-4 h-4 text-accent" />
             <h2 className="text-xs font-black uppercase text-accent tracking-[0.2em]">Global Transmission Channels</h2>
           </div>
           <div className="grid grid-cols-2 gap-2">
             {LEAGUES.map(l => (
               <Card 
                key={l.id} 
                className={cn(
                  "glass-card border-white/5 cursor-pointer transition-all hover:border-primary/30",
                  contextLeagueId === l.id && "border-primary/40 bg-primary/5"
                )}
                onClick={() => { setNavLeague(l.id); setNavLevel(null); setNavGroup(null); setActiveTab('my_pyramid'); }}
               >
                 <CardContent className="p-4 text-center">
                    <p className="text-sm font-headline font-bold text-white italic">{l.id}</p>
                    <p className="text-[7px] text-muted-foreground uppercase font-black mt-1">Operational: {l.startTime}</p>
                 </CardContent>
               </Card>
             ))}
           </div>
        </div>
      ) : (
        <div className="py-20 text-center opacity-30 animate-in fade-in">
          <div className="w-16 h-16 rounded-full bg-secondary/50 border-2 border-dashed border-white/10 flex items-center justify-center mx-auto mb-6">
            <Medal className="w-8 h-8" />
          </div>
          <p className="text-[10px] uppercase font-black tracking-widest">Global Cup Data Sync in Progress...</p>
        </div>
      )}
    </div>
  );
}
