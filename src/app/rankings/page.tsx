'use client';

/**
 * @fileOverview Страница рейтингов v63. 
 * Читает из /league_tables_v1. Добавлена надежная обработка пустого состояния.
 */

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useGameState } from '../lib/store';
import { 
  Trophy, ChevronLeft, ChevronRight, 
  Shield, Globe, Layers, Medal, Loader2, AlertTriangle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { LEAGUES, MAX_LEVELS } from '../lib/leagues-data';
import { Badge } from '@/components/ui/badge';
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import { LoadingScreen } from '@/components/game/LoadingScreen';
import Link from 'next/link';

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

  const contextLeagueId = navLeague || selectedLeagueId || "ALPHA";
  const contextLevel = Number(navLevel || leagueLevel || 9);
  const contextGroup = Number(navGroup || groupId || 1);

  const tableId = useMemo(() => {
    return `season_${activeSeasonNumber}_tier_${contextLevel}_group_${contextGroup}_league_${contextLeagueId}`;
  }, [activeSeasonNumber, contextLevel, contextGroup, contextLeagueId]);

  const tableRef = useMemoFirebase(() => doc(db, 'league_tables_v1', tableId), [db, tableId]);
  const { data: tableData, isLoading: isTableLoading } = useDoc(tableRef);

  const standings = useMemo(() => {
    if (!tableData || !tableData.stats || !tableData.teamData) return [];
    
    const list = tableData.teamData.map((t: any) => {
      const s = tableData.stats[t.id] || { points: 0, wins: 0, draws: 0, losses: 0, diff: 0 };
      return {
        id: t.id,
        name: t.name,
        points: Number(s.points || 0),
        wins: Number(s.wins || 0),
        draws: Number(s.draws || 0),
        losses: Number(s.losses || 0),
        diff: Number(s.diff || 0)
      };
    });

    return list.sort((a: any, b: any) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.diff !== a.diff) return b.diff - a.diff;
      return a.name.localeCompare(b.name);
    });
  }, [tableData]);

  const t = {
    en: {
      title: "RANKINGS HUB", subtitle: "Global Competitive Terminals",
      pts: "PTS", winLoss: "W-D-L", back: "Back",
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
      menu: [
        { id: 'my_league', label: 'Своя таблица', desc: `Дивизион ${leagueLevel}.${groupId}`, icon: Shield, color: 'text-primary' },
        { id: 'my_pyramid', label: 'Своя пирамида', desc: `Изучить лигу ${selectedLeagueId}`, icon: Layers, color: 'text-accent' },
        { id: 'all_pyramids', label: 'Глобальная структура', desc: 'Все 16 лиг мира', icon: Globe, color: 'text-blue-400' },
        { id: 'pyramid_cup', label: 'Кубок пирамиды', desc: 'Сетка плей-офф', icon: Medal, color: 'text-yellow-500' },
      ]
    }
  }[language === 'ru' ? 'ru' : 'en'];

  if (isUserLoading || !isLoaded || !user) return <LoadingScreen />;

  return (
    <div className="max-w-md mx-auto px-4 pt-8 pb-24">
      <header className="mb-8 flex items-center gap-4">
        <Button variant="ghost" size="icon" className="rounded-full border border-white/5" onClick={() => { 
          if (navGroup) setNavGroup(null); 
          else if (navLevel) setNavLevel(null); 
          else if (navLeague) setNavLeague(null); 
          else if (activeTab !== 'menu') setActiveTab('menu'); 
          else router.push('/'); 
        }}>
          <ChevronLeft className="w-6 h-6" />
        </Button>
        <div>
          <h1 className="text-2xl font-headline font-bold uppercase tracking-tighter text-white">
            {activeTab === 'menu' ? t.title : (activeTab === 'pyramid_cup' ? "PYRAMID CUP" : t.menu.find(m => m.id === activeTab)?.label)}
          </h1>
          <p className="text-muted-foreground text-[10px] uppercase tracking-widest">{contextLeagueId} DIV {contextLevel}</p>
        </div>
      </header>

      {activeTab === 'menu' && (
        <div className="space-y-2">
          {t.menu.map(item => (
            <Card key={item.id} className="glass-card border-white/5 hover:bg-white/5 cursor-pointer group" onClick={() => { 
              setActiveTab(item.id as RankingTab); 
              if (item.id === 'my_league') { setNavLeague(selectedLeagueId); setNavLevel(leagueLevel); setNavGroup(groupId); }
            }}>
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
      )}

      {(activeTab === 'my_league' || navGroup) && (
        <div className="space-y-4 animate-in fade-in">
           <div className="flex items-center justify-between px-1">
             <Badge className="bg-primary text-primary-foreground text-[10px] font-black uppercase">GROUP {contextGroup}</Badge>
             <span className="text-[10px] font-mono text-muted-foreground">SEASON {activeSeasonNumber}</span>
           </div>

           <div className="space-y-1">
             <div className="grid grid-cols-[30px_1fr_80px_40px] px-4 py-2 text-[8px] font-black text-muted-foreground uppercase tracking-widest border-b border-white/5">
               <span>#</span><span>Team</span><span className="text-center">{t.winLoss}</span><span className="text-right">{t.pts}</span>
             </div>
             
             {isTableLoading ? (
               <div className="py-20 text-center opacity-30"><Loader2 className="w-8 h-8 animate-spin mx-auto" /></div>
             ) : standings.length > 0 ? standings.map((entry: any, i: number) => (
               <div key={entry.id} className={cn("grid grid-cols-[30px_1fr_80px_40px] items-center p-3 rounded-xl border mb-1", entry.id === user?.uid ? "bg-primary/20 border-primary/40" : "bg-secondary/20 border-white/5")}>
                 <div className="text-xs font-black italic text-muted-foreground">{i + 1}</div>
                 <div className="truncate"><span className={cn("text-[11px] font-bold uppercase text-white", entry.id === user?.uid && "text-primary")}>{entry.name}</span></div>
                 <div className="text-center font-mono text-[10px] text-muted-foreground">{entry.wins}-{entry.draws}-{entry.losses}</div>
                 <div className="text-right font-headline font-black text-primary italic">{entry.points}</div>
               </div>
             )) : (
               <div className="py-20 text-center opacity-30 border border-dashed border-white/5 rounded-2xl p-10 mt-4">
                 <AlertTriangle className="w-12 h-12 mx-auto mb-4" />
                 <p className="text-[10px] font-black uppercase">Syncing Arena...</p>
                 <p className="text-[8px] text-muted-foreground mt-2">Initializing tactical coordinates</p>
               </div>
             )}
           </div>
        </div>
      )}

      {activeTab === 'all_pyramids' && !navLeague && (
        <div className="grid grid-cols-2 gap-2">
          {LEAGUES.map(l => (
            <Card key={l.id} className="glass-card border-white/5 hover:bg-white/5 cursor-pointer" onClick={() => setNavLeague(l.id)}>
              <CardContent className="p-4 text-center"><p className="text-sm font-headline font-bold text-white italic">{l.id}</p></CardContent>
            </Card>
          ))}
        </div>
      )}

      {(activeTab === 'my_pyramid' || (activeTab === 'all_pyramids' && navLeague)) && !navLevel && (
        <div className="space-y-2">
          {Array.from({ length: MAX_LEVELS }, (_, i) => i + 1).map(lvl => (
            <Card key={lvl} className="glass-card border-white/5 cursor-pointer" onClick={() => setNavLevel(lvl)}>
              <CardContent className="p-4 flex justify-between items-center"><span className="text-sm font-bold uppercase">Division {lvl}</span><ChevronRight className="w-4 h-4 text-muted-foreground" /></CardContent>
            </Card>
          ))}
        </div>
      )}

      {navLevel && !navGroup && (
        <div className="grid grid-cols-4 gap-2">
          {Array.from({ length: Math.pow(2, navLevel - 1) }, (_, i) => i + 1).slice(0, 64).map(g => (
            <Button key={g} variant="outline" className="h-10 border-white/5 bg-secondary/20 font-bold" onClick={() => setNavGroup(g)}>{g}</Button>
          ))}
        </div>
      )}

      {activeTab === 'pyramid_cup' && (
         <div className="py-20 text-center animate-in fade-in duration-500">
           <Link href="/tournaments/cup">
             <Button className="hero-gradient font-black text-xs uppercase px-10">OPEN CUP TERMINAL</Button>
           </Link>
         </div>
      )}
    </div>
  );
}