'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useGameState } from '../lib/store';
import { 
  Trophy, ChevronLeft, ChevronRight, 
  Shield, Globe, Layers, Medal, Loader2,
  Bot, RefreshCw, ArrowUpCircle, ArrowDownCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { 
  MAX_LEVELS, 
  getStableGroupTeams, 
  getGroupsCountInLevel, 
  getMatchResult,
  generateSeasonCalendar
} from '../lib/leagues-data';
import { isMatchOverdue } from '../lib/time-utils';
import { Badge } from '@/components/ui/badge';
import { LoadingScreen } from '@/components/game/LoadingScreen';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';

type RankingTab = 'menu' | 'my_league' | 'my_pyramid' | 'all_pyramids' | 'cup';

export default function RankingsPage() {
  const router = useRouter();
  const db = useFirestore();
  const { 
    leagueLevel, groupId, isLoaded, language, id: userId,
    selectedLeagueId, isDataReady, seasonNumber
  } = useGameState();
  
  const [activeTab, setActiveTab] = useState<RankingTab>('menu');
  const [navLeague, setNavLeague] = useState<string | null>(null);
  const [navLevel, setNavLevel] = useState<number | null>(null);
  const [navGroup, setNavGroup] = useState<number | null>(null);

  const contextLeagueId = String(navLeague || selectedLeagueId || "ALPHA");
  const contextLevel = Number(navLevel || leagueLevel || 9);
  const contextGroup = Number(navGroup || groupId || 1);

  // 1. Запрос реальных игроков
  const groupPlayersQuery = useMemoFirebase(() => {
    if (!db) return null;
    return query(
      collection(db, 'players_v11'),
      where('selectedLeagueId', '==', contextLeagueId),
      where('leagueLevel', '==', contextLevel),
      where('groupId', '==', contextGroup)
    );
  }, [db, contextLeagueId, contextLevel, contextGroup]);

  const { data: groupRealPlayers, isLoading: isPlayersLoading } = useCollection(groupPlayersQuery);

  // 2. Запрос зафиксированных матчей (Слот-ориентированных)
  const groupMatchesQuery = useMemoFirebase(() => {
    if (!db) return null;
    return query(
      collection(db, 'matches_v11'),
      where('leagueId', '==', contextLeagueId),
      where('level', '==', contextLevel),
      where('groupId', '==', contextGroup),
      where('season', '==', seasonNumber)
    );
  }, [db, contextLeagueId, contextLevel, contextGroup, seasonNumber]);

  const { data: fixedMatches, isLoading: isMatchesLoading } = useCollection(groupMatchesQuery);

  // 3. Расчет таблицы
  const standings = useMemo(() => {
    if (!isLoaded || isPlayersLoading) return [];

    const finalRealPlayers = groupRealPlayers || [];
    const teams = getStableGroupTeams(contextLevel, contextGroup, contextLeagueId, finalRealPlayers);
    const groupCalendar = generateSeasonCalendar(teams, seasonNumber, contextLeagueId);

    return teams.map((t) => {
      let wins = 0, draws = 0, losses = 0, pts = 0, played = 0;
      
      const teamMatches = groupCalendar.filter(m => m.homeRank === t.rank || m.awayRank === t.rank);

      teamMatches.forEach(m => {
        // Поиск по рангам слотов
        const fixed = fixedMatches?.find(fm => 
          (fm.homeRank === m.homeRank && fm.awayRank === m.awayRank && fm.tour === m.tour)
        );

        if (fixed) {
          played++;
          const isHome = fixed.homeRank === t.rank;
          const myScore = isHome ? fixed.scoreA : fixed.scoreB;
          const oppScore = isHome ? fixed.scoreB : fixed.scoreA;

          if (myScore > oppScore) { wins++; pts += 3; }
          else if (myScore === oppScore) { draws++; pts += 1; }
          else { losses++; }
        } else if (isMatchOverdue(m.startTime)) {
          played++;
          const [scoreH, scoreA] = getMatchResult(m.homeId, m.awayId, seasonNumber, m.tour);
          const isHome = m.homeRank === t.rank;
          const myScore = isHome ? scoreH : scoreA;
          const oppScore = isHome ? scoreA : scoreH;

          if (myScore > oppScore) { wins++; pts += 3; }
          else if (myScore === oppScore) { draws++; pts += 1; }
          else { losses++; }
        }
      });

      return {
        ...t,
        matchesPlayed: played,
        wins, draws, losses,
        points: pts,
        diff: (wins * 2) - losses
      };
    }).sort((a, b) => b.points - a.points || b.diff - a.diff);
  }, [isLoaded, contextLevel, contextGroup, contextLeagueId, seasonNumber, groupRealPlayers, fixedMatches, isPlayersLoading]);

  const t = {
    en: {
      title: "RANKINGS HUB", subtitle: "Global Competitive Terminals",
      pts: "PTS", winLoss: "W-D-L", m: "M", back: "Back",
      loading: "Syncing League Data...",
      menu: [
        { id: 'my_league', label: 'League Standings', desc: `Division ${leagueLevel}.${groupId}`, icon: Shield, color: 'text-primary' },
        { id: 'my_pyramid', label: 'League Pyramid', desc: `Explore ${selectedLeagueId}`, icon: Layers, color: 'text-accent' },
        { id: 'all_pyramids', label: 'Global Map', desc: 'Browse all 16 leagues', icon: Globe, color: 'text-blue-400' },
        { id: 'cup', label: 'Pyramid Cup', desc: 'National elimination grid', icon: Trophy, color: 'text-yellow-500', href: '/tournaments/cup' },
      ]
    },
    ru: {
      title: "ТАБЛИЦЫ РЕЙТИНГА", subtitle: "Терминалы глобальных соревнований",
      pts: "О", winLoss: "В-Н-П", m: "И", back: "Назад",
      loading: "Синхронизация данных...",
      menu: [
        { id: 'my_league', label: 'Таблица Лиги', desc: `Дивизион ${leagueLevel}.${groupId}`, icon: Shield, color: 'text-primary' },
        { id: 'my_pyramid', label: 'Пирамида Лиги', desc: `Изучить лигу ${selectedLeagueId}`, icon: Layers, color: 'text-accent' },
        { id: 'all_pyramids', label: 'Карта мира', desc: 'Все лиги мира', icon: Globe, color: 'text-blue-400' },
        { id: 'cup', label: 'Кубок Пирамиды', desc: 'Сетка национального турнира', icon: Trophy, color: 'text-yellow-500', href: '/tournaments/cup' },
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

  if (!isLoaded || !isDataReady) return <LoadingScreen />;

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
            {activeTab === 'menu' ? t.subtitle : `DIV ${contextLevel} • GROUP ${contextGroup}`}
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
           {isPlayersLoading ? (
             <div className="py-20 flex flex-col items-center justify-center space-y-4 opacity-50">
                <div className="relative">
                   <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full animate-pulse" />
                   <RefreshCw className="w-10 h-10 text-primary animate-spin" />
                </div>
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-primary">{t.loading}</p>
             </div>
           ) : (
             <>
               <div className="flex items-center justify-between px-1">
                 <Badge className="bg-primary text-primary-foreground text-[10px] font-black uppercase italic">DIV {contextLevel} • G {contextGroup}</Badge>
                 {isMatchesLoading && <Loader2 className="w-3 h-3 animate-spin text-primary opacity-50" />}
                 <div className="flex gap-2">
                    <div className="flex items-center gap-1 text-[7px] font-black uppercase text-green-400">
                      <ArrowUpCircle className="w-2.5 h-2.5" /> {language === 'ru' ? 'ПОВЫШЕНИЕ' : 'PROMOTION'}
                    </div>
                    <div className="flex items-center gap-1 text-[7px] font-black uppercase text-red-400">
                      <ArrowDownCircle className="w-2.5 h-2.5" /> {language === 'ru' ? 'ВЫЛЕТ' : 'RELEGATION'}
                    </div>
                 </div>
               </div>
               
               <div className="space-y-1">
                 <div className="grid grid-cols-[24px_1fr_25px_60px_35px] gap-1 px-3 py-2 text-[8px] font-black text-muted-foreground uppercase tracking-widest border-b border-white/5">
                   <span>#</span><span>Team</span><span className="text-center">{t.m}</span><span className="text-center">{t.winLoss}</span><span className="text-right">{t.pts}</span>
                 </div>
                 {standings.map((entry: any, i: number) => {
                   const pos = i + 1;
                   const isMe = entry.id === userId;
                   const isPromoZone = pos === 1 && contextLevel > 1;
                   const isRelegationZone = pos >= 7 && contextLevel < MAX_LEVELS;

                   return (
                    <div key={entry.id + i} className={cn(
                      "grid grid-cols-[24px_1fr_25px_60px_35px] gap-1 items-center p-2.5 rounded-xl border mb-1 transition-all", 
                      isMe ? "bg-primary/20 border-primary/40 ring-1 ring-primary/10 shadow-[0_0_10px_rgba(var(--primary),0.05)]" : "bg-secondary/20 border-white/5",
                      isPromoZone && !isMe && "border-green-500/20 bg-green-500/5",
                      isRelegationZone && !isMe && "border-red-500/20 bg-red-500/5"
                    )}>
                      <div className={cn(
                        "text-[10px] font-black italic",
                        isPromoZone ? "text-green-400" : (isRelegationZone ? "text-red-400" : "text-muted-foreground")
                      )}>{pos}</div>
                      <div className="truncate flex items-center gap-1.5 min-w-0">
                        <div className="w-4 h-4 rounded-full bg-secondary overflow-hidden shrink-0">
                           {entry.logo ? <img src={entry.logo} alt="" className="w-full h-full object-contain" /> : <Bot className="w-2.5 h-2.5 opacity-30 mx-auto mt-0.5" />}
                        </div>
                        <span className={cn("text-[10px] font-bold uppercase truncate", isMe ? "text-primary" : "text-white")}>
                          {entry.name}
                        </span>
                      </div>
                      <div className="text-center font-mono text-[9px] text-muted-foreground">{entry.matchesPlayed}</div>
                      <div className="text-center font-mono text-[9px] text-muted-foreground/60">{entry.wins}-{entry.draws}-{entry.losses}</div>
                      <div className="text-right font-headline font-black text-primary italic pr-1">{entry.points}</div>
                    </div>
                   );
                 })}
               </div>
             </>
           )}
        </div>
      )}

      {activeTab === 'all_pyramids' && !navLeague && (
        <div className="grid grid-cols-1 gap-2">
          {LEAGUES.map(l => (
            <Card key={l.id} className="glass-card border-white/5 hover:bg-white/5 cursor-pointer group" onClick={() => setNavLeague(l.id)}>
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
                <span className="text-sm font-bold uppercase group-hover:text-white transition-colors">Division {lvl}</span>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-[8px] bg-white/5 font-black uppercase">{getGroupsCountInLevel(lvl)} GR</Badge>
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
