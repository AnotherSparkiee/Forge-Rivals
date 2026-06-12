
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
import { getMockGroupTeams, LEAGUES } from '../lib/leagues-data';
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
    rank, leagueLevel, groupId, isLoaded, language, 
    seasonDay, selectedLeagueId, displayName
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
    const effectiveDay = seasonInfo.isTransitionPhase ? 0 : seasonDay;
    
    return getMockGroupTeams(
      rank, 
      displayName, 
      contextLevel, 
      1, 
      contextGroup, 
      contextLeagueId, 
      contextPlayers || [], 
      user?.uid, 
      effectiveDay
    );
  }, [isLoaded, contextPlayers, rank, displayName, contextLevel, contextGroup, contextLeagueId, user?.uid, seasonDay, seasonInfo]);

  if (isUserLoading || !isLoaded) return <LoadingScreen />;

  const translations = {
    en: {
      title: "RANKINGS HUB",
      subtitle: "Global Competitive Terminals",
      my_league: "My League",
      my_pyramid: "My Pyramid",
      all_pyramids: "All Pyramids",
      pyramid_cup: "Pyramid Cup",
      pts: "PTS",
      winLoss: "W-D-L",
      back: "Back",
      division: "Division",
      group: "Group",
      groups: "Groups",
      teams: "Teams",
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
      my_league: "Своя лига",
      my_pyramid: "Своя пирамида",
      all_pyramids: "Все пирамиды",
      pyramid_cup: "Кубок пирамиды",
      pts: "ОЧК",
      winLoss: "В-Н-П",
      back: "Назад",
      division: "Дивизион",
      group: "Группа",
      groups: "Групп",
      teams: "Команд",
      menu: [
        { id: 'my_league', label: 'Своя лига', desc: `Дивизион ${leagueLevel}.${groupId}`, icon: Shield, color: 'text-primary' },
        { id: 'my_pyramid', label: 'Своя пирамида', desc: `Структура лиги ${selectedLeagueId}`, icon: Layers, color: 'text-accent' },
        { id: 'all_pyramids', label: 'Все пирамиды', desc: 'Данные всех 16 лиг', icon: Globe, color: 'text-blue-400' },
        { id: 'pyramid_cup', label: 'Кубок пирамиды', desc: 'Турнир на выбывание', icon: Medal, color: 'text-yellow-500' },
      ]
    }
  };

  const t = translations[language as 'en' | 'ru'] || translations.ru;

  const resetDeepNav = () => {
    setNavLeague(null);
    setNavLevel(null);
    setNavGroup(null);
  };

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
        ) : standings.map((entry, i) => (
          <div 
            key={entry.id} 
            className={cn(
              "grid grid-cols-[30px_1fr_75px_40px] items-center p-3 rounded-xl border transition-all",
              entry.isMe ? "bg-primary/20 border-primary/40 ring-1 ring-primary/20" : "bg-secondary/20 border-white/5",
              i < 2 && !entry.isMe && "border-green-500/10",
              i >= 6 && !entry.isMe && "border-red-500/10"
            )}
          >
            <div className={cn("text-xs font-black italic", i < 2 ? "text-green-400" : (i >= 6 ? "text-red-400" : "text-muted-foreground"))}>{i + 1}</div>
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-[11px] font-bold uppercase truncate text-white">{entry.name}</span>
              {entry.isMe && <Badge className="text-[6px] h-3 px-1 bg-primary text-primary-foreground font-black">YOU</Badge>}
            </div>
            <div className="text-center font-mono text-[10px] font-bold text-muted-foreground">
              {entry.wins}-{entry.draws}-{entry.losses}
            </div>
            <div className="text-right font-headline font-black text-primary italic">{entry.points}</div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderContent = () => {
    switch (activeTab) {
      case 'my_league':
        return renderTable();

      case 'my_pyramid':
        if (navGroup !== null) return renderTable(true);
        if (navLevel !== null) {
          const groupCount = Math.pow(2, navLevel - 1); 
          return (
            <div className="space-y-4 animate-in fade-in duration-500">
               <Button variant="ghost" size="sm" className="h-8 text-[10px] font-black uppercase text-primary" onClick={() => setNavLevel(null)}>
                 <ChevronLeft className="w-4 h-4 mr-1" /> {t.back}
               </Button>
               <h3 className="text-[10px] font-black uppercase text-accent tracking-widest px-1">
                 {t.division} {navLevel} / {groupCount} {t.groups}
               </h3>
               <div className="grid grid-cols-2 gap-2">
                 {Array.from({ length: Math.min(groupCount, 64) }).map((_, i) => (
                   <Card key={i} className="glass-card border-white/5 hover:bg-white/5 cursor-pointer" onClick={() => setNavGroup(i + 1)}>
                     <CardContent className="p-4 flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase">{t.group} {i + 1}</span>
                        <ChevronRight className="w-3 h-3 text-muted-foreground" />
                     </CardContent>
                   </Card>
                 ))}
                 {groupCount > 64 && <div className="col-span-2 py-4 text-center opacity-40 text-[8px] uppercase font-black">Showing first 64 groups</div>}
               </div>
            </div>
          );
        }
        return (
          <div className="space-y-3 animate-in fade-in duration-500">
            {Array.from({ length: 9 }).map((_, i) => {
              const lvl = i + 1;
              const gCount = Math.pow(2, lvl - 1);
              return (
                <Card key={lvl} className={cn(
                  "glass-card border-white/5 hover:border-primary/30 transition-all cursor-pointer",
                  lvl === leagueLevel && "border-primary/40 bg-primary/5"
                )} onClick={() => setNavLevel(lvl)}>
                  <CardContent className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="p-2.5 rounded-xl bg-secondary/50 text-primary">
                        <span className="text-sm font-black italic">{lvl}</span>
                      </div>
                      <div>
                        <h3 className="text-sm font-bold uppercase">{t.division} {lvl}</h3>
                        <p className="text-[9px] text-muted-foreground uppercase font-black tracking-widest">{gCount} {t.groups} / {gCount * 8} {t.teams}</p>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  </CardContent>
                </Card>
              );
            })}
          </div>
        );

      case 'all_pyramids':
        if (navGroup !== null) return renderTable(true);
        if (navLevel !== null) {
           const groupCount = Math.pow(2, navLevel - 1);
           return (
             <div className="space-y-4 animate-in fade-in duration-500">
                <Button variant="ghost" size="sm" className="h-8 text-[10px] font-black uppercase text-primary" onClick={() => setNavLevel(null)}>
                  <ChevronLeft className="w-4 h-4 mr-1" /> {t.back}
                </Button>
                <h3 className="text-[10px] font-black uppercase text-accent tracking-widest px-1">
                  {navLeague} / {t.division} {navLevel}
                </h3>
                <div className="grid grid-cols-2 gap-2">
                  {Array.from({ length: Math.min(groupCount, 64) }).map((_, i) => (
                    <Card key={i} className="glass-card border-white/5 hover:bg-white/5 cursor-pointer" onClick={() => setNavGroup(i + 1)}>
                      <CardContent className="p-4 flex items-center justify-between">
                         <span className="text-[10px] font-bold uppercase">{t.group} {i + 1}</span>
                         <ChevronRight className="w-3 h-3 text-muted-foreground" />
                      </CardContent>
                    </Card>
                  ))}
                </div>
             </div>
           );
        }
        if (navLeague !== null) {
          return (
            <div className="space-y-3 animate-in fade-in duration-500">
               <Button variant="ghost" size="sm" className="h-8 text-[10px] font-black uppercase text-primary" onClick={() => setNavLeague(null)}>
                 <ChevronLeft className="w-4 h-4 mr-1" /> {t.back}
               </Button>
               <h3 className="text-[10px] font-black uppercase text-accent tracking-widest px-1">{navLeague} / Select Level</h3>
               {Array.from({ length: 9 }).map((_, i) => (
                 <Card key={i+1} className="glass-card border-white/5 hover:bg-white/5 cursor-pointer" onClick={() => setNavLevel(i + 1)}>
                   <CardContent className="p-4 flex items-center justify-between">
                     <span className="text-sm font-bold uppercase">{t.division} {i + 1}</span>
                     <ChevronRight className="w-4 h-4 text-muted-foreground" />
                   </CardContent>
                 </Card>
               ))}
            </div>
          );
        }
        return (
          <div className="grid grid-cols-2 gap-2 animate-in fade-in duration-500">
            {LEAGUES.map((l) => (
              <Card key={l.id} className="glass-card border-white/5 hover:border-primary/30 transition-all cursor-pointer" onClick={() => setNavLeague(l.id)}>
                <CardContent className="p-4 text-center">
                   <h3 className="text-sm font-black italic text-primary">{l.id}</h3>
                   <p className="text-[8px] text-muted-foreground uppercase font-bold mt-1 tracking-widest">{l.startTime} MSK</p>
                </CardContent>
              </Card>
            ))}
          </div>
        );

      case 'pyramid_cup':
        return (
          <div className="py-20 text-center opacity-30 animate-in fade-in duration-500">
            <div className="w-20 h-20 rounded-full border-2 border-dashed border-muted-foreground mx-auto mb-6 flex items-center justify-center">
              <Medal className="w-10 h-10" />
            </div>
            <h2 className="text-xl font-headline font-bold uppercase text-white">{t.pyramid_cup}</h2>
            <p className="text-[10px] uppercase font-bold tracking-widest mt-2 max-w-[250px] mx-auto">Coming soon in next season update</p>
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
          <Button variant="ghost" size="icon" className="rounded-full border border-white/5" onClick={() => { setActiveTab('menu'); resetDeepNav(); }}><ChevronLeft className="w-6 h-6" /></Button>
        )}
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
