'use client';

/**
 * @fileOverview Страница рейтингов v42. Изолированная навигация и мгновенное отображение данных.
 */

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useGameState } from '../lib/store';
import { 
  Trophy, ChevronLeft, ChevronRight, 
  Shield, Globe, Layers, Medal, Loader2, AlertTriangle, Swords
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { LEAGUES, MAX_LEVELS } from '../lib/leagues-data';
import { Badge } from '@/components/ui/badge';
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import { LoadingScreen } from '@/components/game/LoadingScreen';

type RankingTab = 'menu' | 'my_league' | 'my_pyramid' | 'all_pyramids' | 'pyramid_cup';

export default function RankingsPage() {
  const { user, isUserLoading } = useUser();
  const router = useRouter();
  const { 
    leagueLevel, groupId, isLoaded, language, 
    selectedLeagueId, activeSeasonNumber, isDataReady
  } = useGameState();
  const db = useFirestore();
  
  const [activeTab, setActiveTab] = useState<RankingTab>('menu');
  
  const [navLeague, setNavLeague] = useState<string | null>(null);
  const [navLevel, setNavLevel] = useState<number | null>(null);
  const [navGroup, setNavGroup] = useState<number | null>(null);

  const isMyLeagueTab = activeTab === 'my_league';
  const contextLeagueId = isMyLeagueTab ? String(selectedLeagueId || "ALPHA") : String(navLeague || selectedLeagueId || "ALPHA");
  const contextLevel = isMyLeagueTab ? String(leagueLevel || 9) : String(navLevel || leagueLevel || 9);
  const contextGroup = isMyLeagueTab ? String(groupId || 1) : String(navGroup || groupId || 1);

  // Используем v42 для синхронизации с AutoMatchManager
  const tableId = `s${activeSeasonNumber}_l${contextLeagueId}_t${contextLevel}_g${contextGroup}`;
  const tableRef = useMemoFirebase(() => doc(db, 'league_tables_v1', tableId), [db, tableId]);
  const { data: tableData, isLoading: isTableLoading } = useDoc(tableRef);

  const [activeRound, setActiveRound] = useState('r1');
  const cupDocId = `cup_s${activeSeasonNumber}_l${contextLeagueId}`;
  const cupRef = useMemoFirebase(() => doc(db, 'cup_pyramid_v1', cupDocId), [db, cupDocId]);
  const { data: cupData, isLoading: isCupLoading } = useDoc(cupRef);

  const standings = useMemo(() => {
    // Мгновенно формируем список из teamData, чтобы не ждать stats
    if (!tableData || !tableData.teamData) return [];
    
    const list = tableData.teamData.map((t: any) => {
      const s = tableData.stats?.[t.id] || { points: 0, matchesPlayed: 0, wins: 0, draws: 0, losses: 0, diff: 0 };
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
      waiting: "TBD", round: "Round", final: "Final",
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
      waiting: "TBD", round: "Раунд", final: "Финал",
      menu: [
        { id: 'my_league', label: 'Своя таблица', desc: `Дивизион ${leagueLevel}.${groupId}`, icon: Shield, color: 'text-primary' },
        { id: 'my_pyramid', label: 'Своя пирамида', desc: `Изучить лигу ${selectedLeagueId}`, icon: Layers, color: 'text-accent' },
        { id: 'all_pyramids', label: 'Глобальная структура', desc: 'Все 16 лиг мира', icon: Globe, color: 'text-blue-400' },
        { id: 'pyramid_cup', label: 'Кубок пирамиды', desc: 'Сетка плей-офф', icon: Medal, color: 'text-yellow-500' },
      ]
    }
  }[language === 'ru' ? 'ru' : 'en'];

  const handleBack = () => {
    // Вкладка "Своя таблица" и "Кубок" просто возвращают в меню
    if (activeTab === 'my_league' || activeTab === 'pyramid_cup' || activeTab === 'my_pyramid') {
      setActiveTab('menu');
      return;
    }

    if (activeTab === 'menu') {
      router.push('/');
      return;
    }

    // Навигация поиска
    if (navGroup) setNavGroup(null);
    else if (navLevel) setNavLevel(null);
    else if (navLeague) setNavLeague(null);
    else setActiveTab('menu');
  };

  if (isUserLoading || !isLoaded || !user || !isDataReady) return <LoadingScreen />;

  return (
    <div className="max-w-md mx-auto px-4 pt-8 pb-24">
      <header className="mb-8 flex items-center gap-4">
        <Button variant="ghost" size="icon" className="rounded-full border border-white/5 bg-secondary/50" onClick={handleBack}>
          <ChevronLeft className="w-6 h-6" />
        </Button>
        <div>
          <h1 className="text-2xl font-headline font-bold uppercase tracking-tighter text-white">
            {activeTab === 'menu' ? t.title : t.menu.find(m => m.id === activeTab)?.label}
          </h1>
          <p className="text-muted-foreground text-[10px] uppercase tracking-widest leading-none mt-1">
            {activeTab === 'menu' ? t.subtitle : `${contextLeagueId} • DIV ${contextLevel}`}
          </p>
        </div>
      </header>

      {activeTab === 'menu' && (
        <div className="space-y-2">
          {t.menu.map(item => (
            <Card key={item.id} className="glass-card border-white/5 hover:bg-white/5 transition-all cursor-pointer group" onClick={() => setActiveTab(item.id as RankingTab)}>
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
        <div className="space-y-4 animate-in fade-in duration-500">
           <div className="flex items-center justify-between px-1">
             <Badge className="bg-primary text-primary-foreground text-[10px] font-black uppercase">GROUP {contextGroup}</Badge>
             <span className="text-[10px] font-mono text-muted-foreground">SEASON {activeSeasonNumber}</span>
           </div>

           <div className="space-y-1">
             <div className="grid grid-cols-[30px_1fr_80px_40px] px-4 py-2 text-[8px] font-black text-muted-foreground uppercase tracking-widest border-b border-white/5">
               <span>#</span><span>Team</span><span className="text-center">{t.winLoss}</span><span className="text-right">{t.pts}</span>
             </div>
             
             {isTableLoading ? (
               <div className="py-20 text-center opacity-30"><Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" /></div>
             ) : standings.length > 0 ? standings.map((entry: any, i: number) => (
               <div key={entry.id} className={cn("grid grid-cols-[30px_1fr_80px_40px] items-center p-3 rounded-xl border mb-1 transition-all", entry.id === user?.uid ? "bg-primary/20 border-primary/40 shadow-[0_0_15px_rgba(var(--primary),0.1)]" : "bg-secondary/20 border-white/5")}>
                 <div className="text-xs font-black italic text-muted-foreground">{i + 1}</div>
                 <div className="truncate"><span className={cn("text-[11px] font-bold uppercase text-white", entry.id === user?.uid && "text-primary")}>{entry.name}</span></div>
                 <div className="text-center font-mono text-[10px] text-muted-foreground">{entry.wins}-{entry.draws}-{entry.losses}</div>
                 <div className="text-right font-headline font-black text-primary italic">{entry.points}</div>
               </div>
             )) : (
               <div className="py-20 text-center opacity-30 border border-dashed border-white/5 rounded-2xl p-10 mt-4 flex flex-col items-center">
                 <AlertTriangle className="w-12 h-12 mb-4 text-orange-500" />
                 <p className="text-[10px] font-black uppercase">Syncing Terminal...</p>
                 <p className="text-[8px] text-muted-foreground mt-2 italic">Awaiting connection to league server v42</p>
               </div>
             )}
           </div>
        </div>
      )}

      {activeTab === 'pyramid_cup' && (
        <div className="space-y-6 animate-in fade-in duration-500">
           {isCupLoading ? (
             <div className="py-20 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" /></div>
           ) : cupData && (cupData.rounds?.r1?.length > 0) ? (
             <>
               <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-2 -mx-4 px-4">
                 {['r1', 'r2', 'r3', 'r4', 'r5'].map((r, i) => (
                   <Button key={r} variant={activeRound === r ? "default" : "outline"} size="sm" onClick={() => setActiveRound(r)} className={cn("h-10 px-6 rounded-xl font-black text-[10px] uppercase tracking-widest whitespace-nowrap", activeRound === r ? "hero-gradient border-none" : "bg-secondary/20 border-white/5")}>
                     {i === 4 ? t.final : `${t.round} ${i + 1}`}
                   </Button>
                 ))}
               </div>
               <div className="space-y-2">
                 {(cupData.rounds?.[activeRound] || []).length > 0 ? (cupData.rounds?.[activeRound] || []).map((m: any, idx: number) => (
                   <Card key={idx} className={cn("glass-card border-white/5", (m.home?.id === user.uid || m.away?.id === user.uid) && "border-primary/50 bg-primary/10")}>
                     <CardContent className="p-3">
                       <div className="grid grid-cols-[1fr_40px_1fr] items-center text-[10px] font-bold uppercase">
                         <div className="text-right truncate"><span className={m.home?.id === user.uid ? "text-primary" : "text-white"}>{m.home?.name || t.waiting}</span></div>
                         <div className="text-center">{m.scoreA !== null ? `${m.scoreA}:${m.scoreB}` : <Swords className="w-3.5 h-3.5 text-accent/40 mx-auto" />}</div>
                         <div className="text-left truncate"><span className={m.away?.id === user.uid ? "text-primary" : "text-white"}>{m.away?.name || t.waiting}</span></div>
                       </div>
                     </CardContent>
                   </Card>
                 )) : <div className="py-20 text-center opacity-30 text-[10px] font-black uppercase">Awaiting round start...</div>}
               </div>
             </>
           ) : (
             <div className="py-20 text-center opacity-30 border border-dashed border-white/5 rounded-2xl p-10 flex flex-col items-center">
               <Medal className="w-12 h-12 mb-4" />
               <p className="text-[10px] font-black uppercase">Cup Data Missing</p>
               <p className="text-[8px] text-muted-foreground mt-2 italic">Initialization in progress v42</p>
             </div>
           )}
        </div>
      )}

      {activeTab === 'all_pyramids' && !navLeague && (
        <div className="grid grid-cols-2 gap-2 animate-in slide-in-from-bottom-4">
          {LEAGUES.map(l => (
            <Card key={l.id} className="glass-card border-white/5 hover:bg-white/5 cursor-pointer active:scale-95 transition-all" onClick={() => setNavLeague(l.id)}>
              <CardContent className="p-4 text-center">
                <p className="text-sm font-headline font-bold text-white italic tracking-widest">{l.id}</p>
                <p className="text-[8px] text-muted-foreground uppercase mt-1">Start: {l.startTime}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {(activeTab === 'my_pyramid' || (activeTab === 'all_pyramids' && navLeague)) && !navLevel && (
        <div className="space-y-2 animate-in slide-in-from-right-4">
          {Array.from({ length: MAX_LEVELS }, (_, i) => i + 1).map(lvl => (
            <Card key={lvl} className="glass-card border-white/5 hover:bg-white/5 transition-all cursor-pointer transition-all" onClick={() => setNavLevel(lvl)}>
              <CardContent className="p-4 flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-secondary/50 flex items-center justify-center border border-white/5"><span className="text-xs font-headline font-bold text-primary">{lvl}</span></div>
                  <span className="text-sm font-bold uppercase">Division {lvl}</span>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {navLevel && !navGroup && (
        <div className="grid grid-cols-4 gap-2 animate-in zoom-in-95 max-h-[60vh] overflow-y-auto scrollbar-hide pb-10">
          {Array.from({ length: Math.pow(2, navLevel - 1) }, (_, i) => i + 1).slice(0, 512).map(g => (
            <Button key={g} variant="outline" className="h-10 border-white/5 bg-secondary/20 font-bold hover:bg-primary/20 hover:text-primary transition-all" onClick={() => setNavGroup(g)}>
              {g}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}
