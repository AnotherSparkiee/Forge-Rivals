'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useGameState } from '../lib/store';
import { 
  Trophy, ChevronLeft, ChevronRight, 
  Shield, Globe, Layers, RefreshCw,
  ShieldAlert, ArrowUp, X
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { 
  MAX_LEVELS, 
  getGroupsCountInLevel, 
  LEAGUES
} from '../lib/leagues-data';
import { Badge } from '@/components/ui/badge';
import { LoadingScreen } from '@/components/game/LoadingScreen';
import { useUser, useFirestore, useDoc, useMemoFirebase, useCollection } from '@/firebase';
import { doc, collection, query, where } from 'firebase/firestore';

type RankingTab = 'menu' | 'my_league' | 'my_pyramid' | 'all_pyramids' | 'cup';

export default function RankingsPage() {
  const router = useRouter();
  const { user } = useUser();
  const db = useFirestore();
  const { isLoaded, language, seasonNumber } = useGameState();
  
  const [activeTab, setActiveTab] = useState<RankingTab>('menu');
  const [navLeague, setNavLeague] = useState<string | null>(null);
  const [navLevel, setNavLevel] = useState<number | null>(null);
  const [navGroup, setNavGroup] = useState<number | null>(null);

  const userProfileRef = useMemoFirebase(() => {
    if (!db || !user?.uid) return null;
    return doc(db, 'players_v12', user.uid);
  }, [db, user?.uid]);

  const { data: profile, isLoading: isProfileLoading } = useDoc(userProfileRef);

  const contextLeagueId = String(navLeague || profile?.selectedLeagueId || "ALPHA");
  const contextLevel = Number(navLevel || profile?.leagueLevel || 9);
  const contextGroup = Number(navGroup || profile?.groupId || 1);

  const tableId = `table_S${seasonNumber}_L${contextLeagueId}_V${contextLevel}_G${contextGroup}`;
  const tableRef = useMemoFirebase(() => {
    if (!db || !isLoaded) return null;
    return doc(db, 'league_tables_v1', tableId);
  }, [db, tableId, isLoaded]);

  const { data: tableData, isLoading: isTableLoading } = useDoc(tableRef);

  const groupPlayersQuery = useMemoFirebase(() => {
    if (!db) return null;
    return query(collection(db, 'players_v12'), 
      where('selectedLeagueId', '==', contextLeagueId),
      where('leagueLevel', '==', contextLevel),
      where('groupId', '==', contextGroup)
    );
  }, [db, contextLeagueId, contextLevel, contextGroup]);

  const { data: groupPlayers } = useCollection(groupPlayersQuery);

  const logoMap = useMemo(() => {
    const map: Record<string, string> = {};
    if (groupPlayers) {
      groupPlayers.forEach(p => {
        if (p.clubLogo) map[p.id] = p.clubLogo;
      });
    }
    return map;
  }, [groupPlayers]);

  const standings = useMemo(() => {
    if (!tableData?.stats) return [];
    
    return Object.values(tableData.stats).sort((a: any, b: any) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.wins !== a.wins) return b.wins - a.wins;
      return b.diff - a.diff;
    });
  }, [tableData]);

  const t = {
    en: {
      title: "RANKINGS HUB", subtitle: "Global Competitive Terminals",
      pts: "PTS", winLoss: "W-D-L", m: "M", back: "Back", team: "TEAM",
      loading: "Syncing League Data...",
      noTable: "SECTOR NOT INITIALIZED",
      noTableDesc: "This division sector is currently empty. No managers have deployed here yet.",
      promotion: "PROMOTION",
      relegation: "RELEGATION",
      menu: [
        { id: 'my_league', label: 'League Standings', desc: `Division ${profile?.leagueLevel || '...'}.${profile?.groupId || '...'}`, icon: Shield, color: 'text-primary' },
        { id: 'my_pyramid', label: 'League Pyramid', desc: `Explore ${profile?.selectedLeagueId || 'ALPHA'}`, icon: Layers, color: 'text-accent' },
        { id: 'all_pyramids', label: 'Global Map', desc: 'Browse all active leagues', icon: Globe, color: 'text-blue-400' },
        { id: 'cup', label: 'Pyramid Cup', desc: 'Elimination grid', icon: Trophy, color: 'text-yellow-500', href: '/tournaments/cup' },
      ]
    },
    ru: {
      title: "ТАБЛИЦЫ РЕЙТИНГА", subtitle: "Терминалы глобальных соревнований",
      pts: "О", winLoss: "В-Н-П", m: "И", back: "Назад", team: "КОМАНДА",
      loading: "Синхронизация данных...",
      noTable: "СЕКТОР НЕ ИНИЦИАЛИЗИРОВАН",
      noTableDesc: "Данный сектор дивизиона пока пуст. В нем нет ни одного активного менеджера.",
      promotion: "ПОВЫШЕНИЕ",
      relegation: "ВЫЛЕТ",
      menu: [
        { id: 'my_league', label: 'Таблица Лиги', desc: `Дивизион ${profile?.leagueLevel || '...'}.${profile?.groupId || '...'}`, icon: Shield, color: 'text-primary' },
        { id: 'my_pyramid', label: 'Пирамида Лиги', desc: `Изучить лигу ${profile?.selectedLeagueId || 'ALPHA'}`, icon: Layers, color: 'text-accent' },
        { id: 'all_pyramids', label: 'Карта мира', desc: 'Все активные лиги мира', icon: Globe, color: 'text-blue-400' },
        { id: 'cup', label: 'Кубок Пирамиды', desc: 'Сетка турнира', icon: Trophy, color: 'text-yellow-500', href: '/tournaments/cup' },
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

  if (!isLoaded || (isProfileLoading && activeTab === 'my_league')) return <LoadingScreen />;

  return (
    <div className="max-w-md mx-auto px-4 pt-8 pb-24">
      <header className="mb-8 flex items-center gap-4">
        <Button variant="ghost" size="icon" className="rounded-full border border-white/5 bg-secondary/50" onClick={handleBack}>
          <ChevronLeft className="w-6 h-6" />
        </Button>
        <div>
          <h1 className="text-2xl font-headline font-bold uppercase tracking-tighter text-white leading-none">
            {activeTab === 'menu' ? t.title : contextLeagueId}
          </h1>
          <p className="text-muted-foreground text-[10px] uppercase tracking-widest font-black opacity-50 mt-1.5">
            {activeTab === 'menu' ? t.subtitle : `ДИВИЗИОН ${contextLevel} • ГРУППА ${contextGroup}`}
          </p>
        </div>
      </header>

      {activeTab === 'menu' && (
        <div className="space-y-2">
          {t.menu.map(item => (
            <Card key={item.id} className="glass-card border-white/5 hover:bg-white/5 transition-all cursor-pointer group" onClick={() => {
              if (item.href) { router.push(item.href); return; }
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
           <div className="flex items-center justify-end px-1">
             <div className="flex items-center gap-3 text-[7px] font-black uppercase tracking-widest">
                <div className="flex items-center gap-1 text-green-400">
                  <div className="w-2.5 h-2.5 rounded-full border border-green-400 flex items-center justify-center"><ArrowUp className="w-1.5 h-1.5" /></div>
                  {t.promotion}
                </div>
                <div className="flex items-center gap-1 text-red-400">
                  <div className="w-2.5 h-2.5 rounded-full border border-red-400 flex items-center justify-center"><X className="w-1.5 h-1.5" /></div>
                  {t.relegation}
                </div>
             </div>
           </div>

           {isTableLoading ? (
             <div className="py-20 flex flex-col items-center justify-center space-y-4 opacity-50">
                <RefreshCw className="w-10 h-10 text-primary animate-spin" />
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-primary">{t.loading}</p>
             </div>
           ) : standings.length > 0 ? (
             <div className="space-y-1">
               <div className="grid grid-cols-[24px_1fr_25px_60px_35px] gap-1 px-3 py-2 text-[8px] font-black text-muted-foreground uppercase tracking-widest border-b border-white/5">
                 <span>#</span><span>{t.team}</span><span className="text-center">{t.m}</span><span className="text-center">{t.winLoss}</span><span className="text-right">{t.pts}</span>
               </div>
               {standings.map((entry: any, i: number) => {
                 const pos = i + 1;
                 const isMe = entry.id === user?.uid;
                 const clubLogo = logoMap[entry.id] || entry.clubLogo;
                 
                 const isChampionZone = pos === 1;
                 const isRelegationZone = pos >= 7;

                 return (
                  <div key={entry.id} className={cn(
                    "grid grid-cols-[24px_1fr_25px_60px_35px] gap-1 items-center p-2.5 rounded-xl border mb-1 transition-all", 
                    isMe ? "bg-primary/20 border-primary/40 shadow-[0_0_15px_rgba(var(--primary),0.1)] z-10" : 
                    isChampionZone ? "bg-green-500/10 border-green-500/20" :
                    isRelegationZone ? "bg-red-500/10 border-red-500/20" :
                    "bg-secondary/20 border-white/5"
                  )}>
                    <div className={cn(
                      "text-[10px] font-black italic",
                      isChampionZone ? "text-green-400" :
                      isRelegationZone ? "text-red-400" :
                      "text-muted-foreground"
                    )}>{pos}</div>
                    
                    <div className="truncate flex items-center gap-2 min-w-0">
                       {clubLogo ? (
                         <img src={clubLogo} alt="" className="w-6 h-6 object-contain shrink-0" />
                       ) : entry.isBot ? (
                         <img src="https://i.postimg.cc/8cpvcNZ9/logo-lote.png" alt="Bot" className="w-7 h-7 object-contain shrink-0 drop-shadow-[0_0_10px_rgba(var(--primary),0.3)]" />
                       ) : (
                         <Shield className="w-4 h-4 text-primary/30 shrink-0" />
                       )}
                      <span className={cn(
                        "text-[10px] font-bold uppercase truncate", 
                        isMe ? "text-primary font-black" : "text-white/90"
                      )}>
                        {entry.name}
                      </span>
                    </div>
                    
                    <div className="text-center font-mono text-[9px] text-muted-foreground">{entry.matchesPlayed}</div>
                    <div className="text-center font-mono text-[9px] text-muted-foreground/60">{entry.wins}-{entry.draws}-{entry.losses}</div>
                    <div className="text-right pr-1">
                      <span className="text-lg font-headline font-black text-primary italic leading-none">{entry.points}</span>
                    </div>
                  </div>
                 );
               })}
             </div>
           ) : (
             <div className="py-20 text-center opacity-30 border border-dashed border-white/10 rounded-3xl p-10 flex flex-col items-center gap-4">
                <ShieldAlert className="w-12 h-12 text-muted-foreground" />
                <div className="space-y-1">
                  <p className="text-sm font-bold uppercase text-white">{t.noTable}</p>
                  <p className="text-[9px] uppercase font-black tracking-widest max-w-[200px] leading-relaxed">
                    {t.noTableDesc}
                  </p>
                </div>
             </div>
           )}
        </div>
      )}

      {activeTab === 'all_pyramids' && !navLeague && (
        <div className="grid grid-cols-1 gap-2">
          {LEAGUES.map(l => (
            <Card key={l.id} className="glass-card border-white/5 hover:bg-white/5 transition-all cursor-pointer group" onClick={() => setNavLeague(l.id)}>
              <CardContent className="p-4 text-center">
                <p className="text-sm font-headline font-bold text-white italic tracking-widest group-hover:text-primary transition-colors">{l.id}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {(activeTab === 'my_pyramid' || (activeTab === 'all_pyramids' && navLeague)) && !navLevel && (
        <div className="space-y-2">
          {Array.from({ length: MAX_LEVELS }, (_, i) => i + 1).map(lvl => (
            <Card key={lvl} className="glass-card border-white/5 hover:bg-white/5 transition-all cursor-pointer group" onClick={() => setNavLevel(lvl)}>
              <CardContent className="p-4 flex justify-between items-center">
                <span className="text-sm font-bold uppercase group-hover:text-white transition-colors">Дивизион {lvl}</span>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-[8px] bg-white/5 font-black uppercase">{getGroupsCountInLevel(lvl)} ГРУППА</Badge>
                  <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-all" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {navLevel && !navGroup && (
        <div className="grid grid-cols-4 gap-2 h-[50vh] overflow-y-auto pr-2 scrollbar-hide">
          {Array.from({ length: getGroupsCountInLevel(navLevel) }, (_, i) => i + 1).map(g => (
            <Button key={g} variant="outline" className="h-10 border-white/5 text-[10px] font-bold hover:bg-primary/10 hover:text-primary" onClick={() => setNavGroup(g)}>
              {g}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}
