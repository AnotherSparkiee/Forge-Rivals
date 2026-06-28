'use client';

/**
 * @fileOverview Страница рейтингов v60. 
 * Поддержка динамической пирамиды и отображение участников.
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
import { LEAGUES, MAX_LEVELS, getStableGroupTeams } from '../lib/leagues-data';
import { Badge } from '@/components/ui/badge';
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import { LoadingScreen } from '@/components/game/LoadingScreen';
import { getLeagueCupParticipants, getWinnerOfBranch } from '../lib/cup-utils';

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
  const contextLevel = isMyLeagueTab ? Number(leagueLevel || 9) : Number(navLevel || leagueLevel || 9);
  const contextGroup = isMyLeagueTab ? Number(navGroup || (isMyLeagueTab ? groupId : 1) || 1) : Number(navGroup || 1);

  const tableId = `s${activeSeasonNumber || 1}_l${contextLeagueId}_t${contextLevel}_g${contextGroup}`;
  const tableRef = useMemoFirebase(() => doc(db, 'league_tables_v1', tableId), [db, tableId]);
  const { data: tableData, isLoading: isTableLoading } = useDoc(tableRef);

  const standings = useMemo(() => {
    if (isTableLoading) return [];
    if (!tableData) {
      return getStableGroupTeams(contextLevel, contextGroup, contextLeagueId).map(t => ({
        ...t, points: 0, wins: 0, draws: 0, losses: 0, diff: 0
      }));
    }
    const list = (tableData.teamData || []).map((t: any) => {
      const s = tableData.stats?.[t.id] || { points: 0, wins: 0, draws: 0, losses: 0, diff: 0 };
      return { ...t, ...s };
    });
    return list.sort((a: any, b: any) => b.points - a.points || b.diff - a.diff || a.name.localeCompare(b.name));
  }, [tableData, contextLevel, contextGroup, contextLeagueId, isTableLoading]);

  const t = {
    en: {
      title: "RANKINGS HUB", subtitle: "Global Competitive Terminals",
      pts: "PTS", winLoss: "W-D-L", back: "Back",
      waiting: "TBD", round: "Round", final: "Final",
      promotion: "Promotion Zone", relegation: "Relegation Danger",
      syncing: "Syncing world data...",
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
      promotion: "Зона повышения", relegation: "Зона вылета",
      syncing: "Синхронизация данных...",
      menu: [
        { id: 'my_league', label: 'Своя таблица', desc: `Дивизион ${leagueLevel}.${groupId}`, icon: Shield, color: 'text-primary' },
        { id: 'my_pyramid', label: 'Своя пирамида', desc: `Изучить лигу ${selectedLeagueId}`, icon: Layers, color: 'text-accent' },
        { id: 'all_pyramids', label: 'Глобальная структура', desc: 'Все 16 лиг мира', icon: Globe, color: 'text-blue-400' },
        { id: 'pyramid_cup', label: 'Кубок пирамиды', desc: 'Сетка плей-офф', icon: Medal, color: 'text-yellow-500' },
      ]
    }
  }[language === 'ru' ? 'ru' : 'en'];

  const handleBack = () => {
    if (activeTab === 'my_league' || activeTab === 'pyramid_cup') {
      setActiveTab('menu');
      return;
    }
    if (activeTab === 'my_pyramid' || activeTab === 'all_pyramids') {
      if (navGroup) { setNavGroup(null); return; }
      if (navLevel) { setNavLevel(null); return; }
      if (navLeague) { setNavLeague(null); return; }
      setActiveTab('menu');
      return;
    }
    if (activeTab === 'menu') {
      router.push('/');
      return;
    }
  };

  if (isUserLoading || !isLoaded || !user || !isDataReady) return <LoadingScreen />;

  return (
    <div className="max-w-md mx-auto px-4 pt-8 pb-24">
      <header className="mb-8 flex items-center gap-4">
        <Button variant="ghost" size="icon" className="rounded-full border border-white/5 bg-secondary/50" onClick={handleBack}>
          <ChevronLeft className="w-6 h-6" />
        </Button>
        <div>
          <h1 className="text-2xl font-headline font-bold uppercase tracking-tighter text-white leading-none">
            {activeTab === 'menu' ? t.title : t.menu.find(m => m.id === activeTab)?.label}
          </h1>
          <p className="text-muted-foreground text-[10px] uppercase tracking-widest leading-none mt-1.5 font-black opacity-50">
            {activeTab === 'menu' ? t.subtitle : `${contextLeagueId} • DIV ${contextLevel}`}
          </p>
        </div>
      </header>

      {activeTab === 'menu' && (
        <div className="space-y-2">
          {t.menu.map(item => (
            <Card key={item.id} className="glass-card border-white/5 hover:bg-white/5 transition-all cursor-pointer group" onClick={() => {
              setActiveTab(item.id as RankingTab);
              setNavLeague(null); setNavLevel(null); setNavGroup(null);
            }}>
              <CardContent className="p-4 flex justify-between items-center">
                <div className="flex items-center gap-4">
                  <div className={cn("p-2.5 rounded-xl bg-secondary/50", item.color)}><item.icon className="w-5 h-5" /></div>
                  <div><h3 className="text-sm font-bold uppercase group-hover:text-white transition-colors">{item.label}</h3><p className="text-[10px] text-muted-foreground">{item.desc}</p></div>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-all" />
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
           
           {isTableLoading ? (
             <div className="py-20 text-center opacity-50 flex flex-col items-center gap-4">
               <Loader2 className="w-8 h-8 animate-spin text-primary" />
               <p className="text-[10px] uppercase font-black tracking-widest">{t.syncing}</p>
             </div>
           ) : (
             <div className="space-y-1">
               <div className="grid grid-cols-[30px_1fr_80px_40px] px-4 py-2 text-[8px] font-black text-muted-foreground uppercase tracking-widest border-b border-white/5">
                 <span>#</span><span>Team</span><span className="text-center">{t.winLoss}</span><span className="text-right">{t.pts}</span>
               </div>
               {standings.map((entry: any, i: number) => {
                 const pos = i + 1;
                 const isPromotion = pos === 1 && contextLevel > 1;
                 const isRelegation = pos >= 7 && contextLevel < 9;
                 const isMe = entry.id === user?.uid;
                 
                 return (
                  <div key={entry.id} className={cn(
                    "grid grid-cols-[30px_1fr_80px_40px] items-center p-3 rounded-xl border mb-1 transition-all", 
                    isMe ? "bg-primary/20 border-primary/40 shadow-[0_0_15px_rgba(var(--primary),0.1)]" : "bg-secondary/20 border-white/5",
                    isPromotion && "border-l-4 border-l-green-500",
                    isRelegation && "border-l-4 border-l-red-500"
                  )}>
                    <div className="text-xs font-black italic text-muted-foreground">{pos}</div>
                    <div className="truncate flex flex-col">
                      <span className={cn("text-[11px] font-bold uppercase", isMe ? "text-primary" : "text-white")}>
                        {entry.isBot ? `🤖 ${entry.name}` : entry.name}
                      </span>
                      {isPromotion && <span className="text-[6px] text-green-400 font-black uppercase tracking-tighter">PROMOTION</span>}
                      {isRelegation && <span className="text-[6px] text-red-400 font-black uppercase tracking-tighter">RELEGATION</span>}
                    </div>
                    <div className="text-center font-mono text-[10px] text-muted-foreground">{entry.wins || 0}-{entry.draws || 0}-{entry.losses || 0}</div>
                    <div className="text-right font-headline font-black text-primary italic">{entry.points || 0}</div>
                  </div>
                 );
               })}
             </div>
           )}

           {!isTableLoading && (
             <div className="p-4 bg-primary/5 rounded-2xl border border-white/5 space-y-2 mt-4">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-green-500 rounded-full shadow-[0_0_5px_rgba(34,197,94,0.5)]" />
                  <p className="text-[8px] font-black text-muted-foreground uppercase tracking-widest">{t.promotion}: 1st Place</p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-red-500 rounded-full shadow-[0_0_5px_rgba(239,68,68,0.5)]" />
                  <p className="text-[8px] font-black text-muted-foreground uppercase tracking-widest">{t.relegation}: 7th & 8th Places</p>
                </div>
             </div>
           )}
        </div>
      )}
      
      {activeTab === 'pyramid_cup' && (
        <div className="animate-in fade-in duration-500 py-20 text-center opacity-40 flex flex-col items-center gap-4 border-2 border-dashed border-white/5 rounded-3xl">
           <Medal className="w-16 h-16 text-yellow-500" />
           <h2 className="text-xl font-headline font-bold uppercase text-white">{t.menu[3].label}</h2>
           <p className="text-[10px] uppercase font-bold tracking-widest leading-relaxed px-10 italic">
             "Full cup visualization is synchronized with official match reporting sequences."
           </p>
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
            <Card key={lvl} className="glass-card border-white/5 hover:bg-white/5 transition-all cursor-pointer" onClick={() => setNavLevel(lvl)}>
              <CardContent className="p-4 flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-secondary/50 flex items-center justify-center border border-white/5"><span className="text-xs font-headline font-bold text-primary">{lvl}</span></div>
                  <span className="text-sm font-bold uppercase">Division {lvl}</span>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-all" />
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
