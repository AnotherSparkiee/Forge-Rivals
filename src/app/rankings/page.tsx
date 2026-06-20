
'use client';

/**
 * @fileOverview Страница рейтингов v33. 
 * Внедрена клиентская сортировка для гарантированного отображения данных без индексов Firestore.
 */

import { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useGameState } from '../lib/store';
import { 
  Trophy, Medal, ChevronLeft, ChevronRight, 
  Shield, Globe, Layers, Crown, Swords, Zap, Loader2, Calendar, User, AlertCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { LEAGUES, MAX_LEVELS } from '../lib/leagues-data';
import { Badge } from '@/components/ui/badge';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, limit } from 'firebase/firestore';
import { LoadingScreen } from '@/components/game/LoadingScreen';
import { getGlobalSeasonInfo } from '../lib/time-utils';

type RankingTab = 'menu' | 'my_league' | 'my_pyramid' | 'all_pyramids' | 'pyramid_cup' | 'champions_league';

export default function RankingsPage() {
  const { user, isUserLoading } = useUser();
  const router = useRouter();
  const { 
    leagueLevel, groupId, isLoaded, language, 
    selectedLeagueId
  } = useGameState();
  const db = useFirestore();
  
  const [activeTab, setActiveTab] = useState<RankingTab>('menu');
  const [navLeague, setNavLeague] = useState<string | null>(null);
  const [navLevel, setNavLevel] = useState<number | null>(null);
  const [navGroup, setNavGroup] = useState<number | null>(null);
  const [activeRound, setActiveRound] = useState(1);

  const seasonInfo = useMemo(() => getGlobalSeasonInfo(), []);
  const activeSeasonNumber = Number(seasonInfo.activeSeasonNumber);

  const contextLeagueId = navLeague || selectedLeagueId || "ALPHA";
  const contextLevel = Number(navLevel || leagueLevel);
  const contextGroup = Number(navGroup || groupId);

  // Teams Query: Fetching without complex orderBy to avoid index issues
  const teamsQuery = useMemoFirebase(() => {
    if (isUserLoading || !user || !contextLeagueId) return null;
    try {
      const seasonId = `season_${activeSeasonNumber}`;
      const prefixedGroupId = `${seasonId}_league_${contextLeagueId}_group_${contextGroup}`;
      
      // We fetch all teams in the sub-collection and sort locally
      return collection(db, 'leagues_v2', contextLeagueId, 'divisions', String(contextLevel), 'groups', prefixedGroupId, 'teams');
    } catch (e) {
      console.error("Teams query error", e);
      return null;
    }
  }, [db, contextLeagueId, contextLevel, contextGroup, activeSeasonNumber, isUserLoading, user]);

  const { data: rawTeams, isLoading: isTeamsLoading } = useCollection(teamsQuery);

  const standings = useMemo(() => {
    if (!rawTeams) return [];
    return rawTeams.map(t => ({
      id: t.id,
      name: t.displayName || t.name || "Unknown",
      wins: Number(t.wins || 0),
      draws: Number(t.draws || 0),
      losses: Number(t.losses || 0),
      points: Number(t.points || 0),
      played: Number(t.wins || 0) + Number(t.draws || 0) + Number(t.losses || 0)
    })).sort((a, b) => b.points - a.points || b.wins - a.wins || a.name.localeCompare(b.name));
  }, [rawTeams]);

  // Cup Query: Ensure types match
  const cupQuery = useMemoFirebase(() => {
    if (activeTab !== 'pyramid_cup' || !contextLeagueId) return null;
    return query(
      collection(db, 'cup_matches'),
      where('leagueId', '==', String(contextLeagueId)),
      where('seasonNumber', '==', Number(activeSeasonNumber)),
      where('round', '==', Number(activeRound)),
      limit(100)
    );
  }, [db, contextLeagueId, activeRound, activeTab, activeSeasonNumber]);

  const { data: cupMatches, isLoading: isCupLoading } = useCollection(cupQuery);

  const t = {
    en: {
      title: "RANKINGS HUB", subtitle: "Global Competitive Terminals",
      pts: "PTS", winLoss: "W-D-L", back: "Back",
      selectDiv: "Select Division", selectGroup: "Select Group",
      cl: "CHAMPIONS LEAGUE", cup: "PYRAMID CUP",
      waiting: "TBD",
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
      selectDiv: "Выберите дивизион", selectGroup: "Выберите группу",
      cl: "ЛИГА ЧЕМПИОНОВ", cup: "КУБОК ПИРАМИДЫ",
      waiting: "TBD",
      menu: [
        { id: 'my_league', label: 'Своя таблица', desc: `Дивизион ${leagueLevel}.${groupId}`, icon: Shield, color: 'text-primary' },
        { id: 'champions_league', label: 'Лига Чемпионов', desc: 'Элитный межсерверный блиц', icon: Crown, color: 'text-yellow-500' },
        { id: 'my_pyramid', label: 'Своя пирамида', desc: `Изучить лигу ${selectedLeagueId}`, icon: Layers, color: 'text-accent' },
        { id: 'all_pyramids', label: 'Глобальная структура', desc: 'Все 16 лиг мира', icon: Globe, color: 'text-blue-400' },
        { id: 'pyramid_cup', label: 'Кубок пирамиды', desc: 'Сетка плей-офф', icon: Medal, color: 'text-yellow-500' },
      ]
    }
  }[language as 'en' | 'ru'];

  useEffect(() => {
    if (!isUserLoading && !user) router.push('/');
  }, [user, isUserLoading, router]);

  if (isUserLoading || !isLoaded || !user) return <LoadingScreen />;

  const renderStandings = () => (
    <div className="space-y-4 animate-in fade-in duration-500">
      <div className="flex items-center gap-2 px-1 mb-4 bg-secondary/10 p-2 rounded-xl border border-white/5 overflow-x-auto scrollbar-hide">
        <Button variant="ghost" size="sm" className="h-7 text-[8px] font-black uppercase text-accent" onClick={() => setNavGroup(null)}>DIV {contextLevel}</Button>
        <ChevronRight className="w-3 h-3 text-muted-foreground opacity-30" />
        <Badge className="bg-primary text-primary-foreground text-[8px] font-black uppercase h-6 px-3">GROUP {contextGroup}</Badge>
      </div>
      <div className="space-y-1">
        <div className="grid grid-cols-[30px_1fr_75px_40px] px-4 py-2 text-[8px] font-black text-muted-foreground uppercase tracking-widest border-b border-white/5">
          <span>#</span><span>Team</span><span className="text-center">{t.winLoss}</span><span className="text-right">{t.pts}</span>
        </div>
        <div className="space-y-1 mt-2">
          {isTeamsLoading ? (
             <div className="py-10 text-center opacity-30"><Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" /> <p className="text-[8px] uppercase">Retrieving Data...</p></div>
          ) : standings.length > 0 ? standings.map((entry, i) => (
            <div key={entry.id} className={cn("grid grid-cols-[30px_1fr_75px_40px] items-center p-3 rounded-xl border", entry.id === user?.uid ? "bg-primary/20 border-primary/40" : "bg-secondary/20 border-white/5")}>
              <div className="text-xs font-black italic text-muted-foreground">{i + 1}</div>
              <div className="flex items-center gap-2 truncate">
                <span className={cn("text-[11px] font-bold uppercase truncate text-white", entry.id === user?.uid && "text-primary")}>{entry.name}</span>
              </div>
              <div className="text-center font-mono text-[10px] text-muted-foreground">{entry.wins}-{entry.draws}-{entry.losses}</div>
              <div className="text-right font-headline font-black text-primary italic">{entry.points}</div>
            </div>
          )) : (
            <div className="py-20 text-center opacity-30 flex flex-col items-center gap-4 border-2 border-dashed border-white/5 rounded-3xl p-10">
              <AlertCircle className="w-12 h-12" />
              <p className="text-[10px] uppercase font-black tracking-widest">No ranking data found for this group.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const renderCupBracket = () => (
    <div className="space-y-6 animate-in fade-in">
       <div className="flex gap-2 overflow-x-auto pb-4 scrollbar-hide -mx-4 px-4">
          {[1,2,3,4,5,6,7,8].map(r => (
            <Button key={r} variant={activeRound === r ? "default" : "outline"} size="sm" onClick={() => setActiveRound(r)} className={cn("h-8 rounded-lg px-4 text-[9px] font-black uppercase", activeRound === r && "hero-gradient border-none")}>R{r}</Button>
          ))}
       </div>
       <div className="space-y-2">
          {isCupLoading ? (
            <div className="py-20 text-center opacity-50 flex flex-col items-center gap-4">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <p className="text-[8px] font-black uppercase tracking-widest">Syncing Bracket...</p>
            </div>
          ) : cupMatches && cupMatches.length > 0 ? cupMatches.map(m => (
            <Card key={m.id} className={cn("glass-card border-white/5", (m.homeTeamId === user?.uid || m.awayTeamId === user?.uid) && "border-primary/40 bg-primary/5")}>
               <CardContent className="p-3 flex items-center justify-between gap-4">
                  <span className={cn("flex-1 text-[10px] font-bold uppercase truncate text-right", m.homeTeamId === user?.uid && "text-primary")}>{m.homeTeamName || t.waiting}</span>
                  <div className="px-3 py-1 bg-background/50 rounded border border-white/5 font-headline font-black text-accent text-[10px]">
                    {m.isFinished ? `${m.scoreA}:${m.scoreB}` : "VS"}
                  </div>
                  <span className={cn("flex-1 text-[10px] font-bold uppercase truncate text-left", m.awayTeamId === user?.uid && "text-primary")}>{m.awayTeamName || t.waiting}</span>
               </CardContent>
            </Card>
          )) : (
            <div className="py-20 text-center opacity-30 flex flex-col items-center gap-4 border-2 border-dashed border-white/5 rounded-3xl p-10">
              <AlertCircle className="w-12 h-12" />
              <p className="text-[10px] font-black uppercase tracking-widest">No matches generated for Round {activeRound}</p>
            </div>
          )}
       </div>
    </div>
  );

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
            {activeTab === 'menu' ? t.title : (activeTab === 'pyramid_cup' ? t.cup : t.menu.find(m => m.id === activeTab)?.label)}
          </h1>
          <p className="text-muted-foreground text-[10px] uppercase tracking-widest">{activeTab === 'pyramid_cup' ? `League ${contextLeagueId}` : contextLeagueId}</p>
        </div>
      </header>

      {activeTab === 'menu' && (
        <div className="space-y-2">
          {t.menu.map(item => (
            <Card key={item.id} className="glass-card border-white/5 hover:bg-white/5 cursor-pointer group" onClick={() => { setActiveTab(item.id as RankingTab); if (item.id === 'my_league') { setNavLeague(selectedLeagueId); setNavLevel(leagueLevel); setNavGroup(groupId); } else if (item.id === 'my_pyramid' || item.id === 'pyramid_cup') { setNavLeague(selectedLeagueId); } }}>
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

      {activeTab === 'pyramid_cup' && renderCupBracket()}
      {activeTab === 'champions_league' && <div className="py-20 text-center opacity-40"><Crown className="w-16 h-16 mx-auto mb-4" /><p className="text-[10px] font-black uppercase tracking-widest">Season 1 Start In Progress</p></div>}
      {activeTab === 'all_pyramids' && !navLeague && (<div className="grid grid-cols-2 gap-2">{LEAGUES.map(l => (<Card key={l.id} className="glass-card border-white/5 hover:bg-white/5 cursor-pointer" onClick={() => setNavLeague(l.id)}><CardContent className="p-4 text-center"><p className="text-sm font-headline font-bold text-white italic">{l.id}</p></CardContent></Card>))}</div>)}
      {(activeTab === 'my_pyramid' || (activeTab === 'all_pyramids' && navLeague)) && !navLevel && (<div className="space-y-2">{Array.from({ length: MAX_LEVELS }, (_, i) => i + 1).map(lvl => (<Card key={lvl} className="glass-card border-white/5 cursor-pointer" onClick={() => setNavLevel(lvl)}><CardContent className="p-4 flex justify-between items-center"><span className="text-sm font-bold uppercase">Division {lvl}</span><ChevronRight className="w-4 h-4 text-muted-foreground" /></CardContent></Card>))}</div>)}
      {navLevel && !navGroup && (<div className="grid grid-cols-4 gap-2">{Array.from({ length: Math.pow(2, navLevel - 1) }, (_, i) => i + 1).slice(0, 64).map(g => (<Button key={g} variant="outline" className="h-10 border-white/5 bg-secondary/20 font-bold" onClick={() => setNavGroup(g)}>{g}</Button>))}</div>)}
      {navGroup && renderStandings()}
    </div>
  );
}
