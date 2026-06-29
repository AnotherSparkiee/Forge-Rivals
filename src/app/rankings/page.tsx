
'use client';

/**
 * @fileOverview Страница рейтингов v65 (Human Presence Patch). 
 * Исправлено отображение имен реальных игроков в турнирных таблицах.
 */

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useGameState } from '../lib/store';
import { 
  Trophy, ChevronLeft, ChevronRight, 
  Shield, Globe, Layers, Medal, Loader2, AlertTriangle, Swords,
  ArrowUp, ArrowDown, User, Bot
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { LEAGUES, MAX_LEVELS, getStableGroupTeams } from '../lib/leagues-data';
import { Badge } from '@/components/ui/badge';
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import { LoadingScreen } from '@/components/game/LoadingScreen';

type RankingTab = 'menu' | 'my_league' | 'my_pyramid' | 'all_pyramids';

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
    
    // Если данных в БД нет — генерируем базовую структуру (боты)
    const baseTeams = getStableGroupTeams(contextLevel, contextGroup, contextLeagueId);
    
    if (!tableData || !tableData.teamData) {
      return baseTeams.map(t => ({
        ...t, points: 0, wins: 0, draws: 0, losses: 0, diff: 0, matchesPlayed: 0
      }));
    }

    // Сопоставляем данные из teamData документа с актуальной статистикой stats
    const list = (tableData.teamData).map((t: any) => {
      const s = tableData.stats?.[t.id] || { points: 0, wins: 0, draws: 0, losses: 0, diff: 0, matchesPlayed: 0 };
      return { ...t, ...s };
    });

    // Сортировка: Очки -> Разница -> Имя
    return list.sort((a: any, b: any) => b.points - a.points || b.diff - a.diff || a.name.localeCompare(b.name));
  }, [tableData, contextLevel, contextGroup, contextLeagueId, isTableLoading]);

  const t = {
    en: {
      title: "RANKINGS HUB", subtitle: "Global Competitive Terminals",
      pts: "PTS", winLoss: "W-D-L", m: "M", back: "Back",
      syncing: "Syncing world data...",
      promotion: "Promotion Zone", relegation: "Relegation Danger",
      menu: [
        { id: 'my_league', label: 'My Current Table', desc: `Division ${leagueLevel}.${groupId}`, icon: Shield, color: 'text-primary' },
        { id: 'my_pyramid', label: 'My Pyramid', desc: `Explore ${selectedLeagueId}`, icon: Layers, color: 'text-accent' },
        { id: 'all_pyramids', label: 'Global Structure', desc: 'Browse all 16 leagues', icon: Globe, color: 'text-blue-400' },
      ]
    },
    ru: {
      title: "ТАБЛИЦЫ РЕЙТИНГА", subtitle: "Терминалы глобальных соревнований",
      pts: "О", winLoss: "В-Н-П", m: "И", back: "Назад",
      syncing: "Синхронизация данных...",
      promotion: "Зона повышения", relegation: "Зона вылета",
      menu: [
        { id: 'my_league', label: 'Своя таблица', desc: `Дивизион ${leagueLevel}.${groupId}`, icon: Shield, color: 'text-primary' },
        { id: 'my_pyramid', label: 'Своя пирамида', desc: `Изучить лигу ${selectedLeagueId}`, icon: Layers, color: 'text-accent' },
        { id: 'all_pyramids', label: 'Глобальная структура', desc: 'Все 16 лиг мира', icon: Globe, color: 'text-blue-400' },
      ]
    }
  }[language === 'ru' ? 'ru' : 'en'];

  const handleBack = () => {
    if (activeTab === 'my_league') { setActiveTab('menu'); return; }
    if (activeTab === 'my_pyramid' || activeTab === 'all_pyramids') {
      if (navGroup) { setNavGroup(null); return; }
      if (navLevel) { setNavLevel(null); return; }
      if (navLeague) { setNavLeague(null); return; }
      setActiveTab('menu');
      return;
    }
    router.push('/');
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
            {activeTab === 'menu' ? t.title : (isMyLeagueTab ? t.menu[0].label : contextLeagueId)}
          </h1>
          <p className="text-muted-foreground text-[10px] uppercase tracking-widest leading-none mt-1.5 font-black opacity-50">
            {activeTab === 'menu' ? t.subtitle : `DIV ${contextLevel} • GROUP ${contextGroup}`}
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
             <Badge className="bg-primary text-primary-foreground text-[10px] font-black uppercase">DIV {contextLevel} • G {contextGroup}</Badge>
             <span className="text-[10px] font-mono text-muted-foreground">SEASON {activeSeasonNumber}</span>
           </div>
           
           {isTableLoading ? (
             <div className="py-20 text-center opacity-50 flex flex-col items-center gap-4">
               <Loader2 className="w-8 h-8 animate-spin text-primary" />
               <p className="text-[10px] uppercase font-black tracking-widest">{t.syncing}</p>
             </div>
           ) : (
             <div className="space-y-1">
               <div className="grid grid-cols-[24px_1fr_25px_60px_35px] gap-1 px-3 py-2 text-[8px] font-black text-muted-foreground uppercase tracking-widest border-b border-white/5">
                 <span>#</span><span>Team</span><span className="text-center">{t.m}</span><span className="text-center">{t.winLoss}</span><span className="text-right">{t.pts}</span>
               </div>
               {standings.map((entry: any, i: number) => {
                 const pos = i + 1;
                 const isPromotion = pos === 1 && contextLevel > 1;
                 const isRelegation = pos >= 7 && contextLevel < 9;
                 const isMe = entry.id === user?.uid;
                 
                 return (
                  <div key={entry.id} className={cn(
                    "grid grid-cols-[24px_1fr_25px_60px_35px] gap-1 items-center p-2.5 rounded-xl border mb-1 transition-all", 
                    isMe ? "bg-primary/20 border-primary/40 shadow-[0_0_15px_rgba(var(--primary),0.1)]" : "bg-secondary/20 border-white/5",
                    isPromotion && "border-l-4 border-l-green-500",
                    isRelegation && "border-l-4 border-l-red-500"
                  )}>
                    <div className="text-[10px] font-black italic text-muted-foreground">{pos}</div>
                    <div className="truncate flex items-center gap-1.5">
                      {entry.isBot ? <Bot className="w-3 h-3 opacity-30 shrink-0" /> : <User className="w-3 h-3 text-primary shrink-0" />}
                      <span className={cn("text-[10px] font-bold uppercase truncate", isMe ? "text-primary" : "text-white")}>
                        {entry.name}
                      </span>
                    </div>
                    <div className="text-center font-mono text-[9px] text-muted-foreground">{entry.matchesPlayed || 0}</div>
                    <div className="text-center font-mono text-[9px] text-muted-foreground/60">{entry.wins || 0}-{entry.draws || 0}-{entry.losses || 0}</div>
                    <div className="text-right font-headline font-black text-primary italic pr-1">{entry.points || 0}</div>
                  </div>
                 );
               })}
             </div>
           )}

           {!isTableLoading && (
             <div className="p-4 bg-primary/5 rounded-2xl border border-white/5 space-y-2 mt-4">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-green-500" />
                  <p className="text-[8px] font-black text-muted-foreground uppercase tracking-widest">{t.promotion}</p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-red-500" />
                  <p className="text-[8px] font-black text-muted-foreground uppercase tracking-widest">{t.relegation}</p>
                </div>
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
