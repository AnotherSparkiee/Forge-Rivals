'use client';

/**
 * @fileOverview Страница рейтингов v40. 
 * Переведена на систему /league_tables.
 */

import { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useGameState } from '../lib/store';
import { 
  Trophy, ChevronLeft, ChevronRight, 
  Shield, Globe, Layers, Crown, Loader2, AlertCircle, Medal
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { LEAGUES, MAX_LEVELS } from '../lib/leagues-data';
import { Badge } from '@/components/ui/badge';
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import { LoadingScreen } from '@/components/game/LoadingScreen';

type RankingTab = 'menu' | 'my_league' | 'my_pyramid' | 'all_pyramids' | 'pyramid_cup' | 'champions_league';

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
  const contextLevel = Number(navLevel || leagueLevel);
  const contextGroup = Number(navGroup || groupId);

  // Таблица Лиги
  const tableId = `season_${activeSeasonNumber}_tier_${contextLevel}_group_${contextGroup}_league_${contextLeagueId}`;
  const tableRef = useMemoFirebase(() => doc(db, 'league_tables', tableId), [db, tableId]);
  const { data: tableData, isLoading: isTableLoading } = useDoc(tableRef);

  // Кубок
  const cupId = `season_${activeSeasonNumber}_league_${contextLeagueId}`;
  const cupRef = useMemoFirebase(() => doc(db, 'cup_pyramid', cupId), [db, cupId]);
  const { data: cupData, isLoading: isCupLoading } = useDoc(cupRef);

  const standings = useMemo(() => {
    if (!tableData || !tableData.stats) return [];
    
    return tableData.teamData.map((t: any) => ({
      id: t.id,
      name: t.name,
      ...tableData.stats[t.id]
    })).sort((a: any, b: any) => b.points - a.points || b.diff - a.diff || a.name.localeCompare(b.name));
  }, [tableData]);

  const t = {
    en: {
      title: "RANKINGS HUB", subtitle: "Global Competitive Terminals",
      pts: "PTS", winLoss: "W-D-L", back: "Back",
      menu: [
        { id: 'my_league', label: 'My Current Table', desc: `Division ${leagueLevel}.${groupId}`, icon: Shield, color: 'text-primary' },
        { id: 'champions_league', label: 'Champions League', desc: 'Elite Inter-Server Blitz', icon: Crown, color: 'text-yellow-500' },
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
        { id: 'champions_league', label: 'Лига Чемпионов', desc: 'Элитный межсерверный блиц', icon: Crown, color: 'text-yellow-500' },
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
          <p className="text-muted-foreground text-[10px] uppercase tracking-widest">{contextLeagueId}</p>
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
                 <AlertCircle className="w-12 h-12 mx-auto mb-4" />
                 <p className="text-[10px] font-black uppercase">Table Not Initialized</p>
               </div>
             )}
           </div>
        </div>
      )}

      {activeTab === 'pyramid_cup' && (
        <div className="space-y-4 animate-in fade-in">
           {isCupLoading ? (
             <div className="py-20 text-center opacity-30"><Loader2 className="w-8 h-8 animate-spin mx-auto" /></div>
           ) : cupData?.rounds?.r1 ? (
             <div className="space-y-2">
               <h3 className="text-xs font-black uppercase tracking-widest text-accent mb-4">Round 1 (1/16 Final)</h3>
               {cupData.rounds.r1.map((m: any, idx: number) => (
                 <Card key={idx} className="glass-card border-white/5">
                   <CardContent className="p-3 flex items-center justify-between text-[10px] font-bold uppercase">
                     <span className={cn("flex-1 text-right truncate", m.home.id === user?.uid && "text-primary")}>{m.home.name}</span>
                     <div className="px-3 py-1 bg-background/50 rounded mx-4 text-accent">VS</div>
                     <span className={cn("flex-1 text-left truncate", m.away.id === user?.uid && "text-primary")}>{m.away.name}</span>
                   </CardContent>
                 </Card>
               ))}
             </div>
           ) : (
             <div className="py-20 text-center opacity-30 border border-dashed border-white/5 rounded-2xl p-10">
               <Trophy className="w-12 h-12 mx-auto mb-4" />
               <p className="text-[10px] font-black uppercase">Cup Grid Generating...</p>
             </div>
           )}
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
    </div>
  );
}
