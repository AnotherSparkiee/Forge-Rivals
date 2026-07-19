'use client';

/**
 * @fileOverview МАТЧ-ЦЕНТР v64.
 * Исправлена ошибка дублирования ключей при объединении архива и текущих матчей.
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useGameState } from '../lib/store';
import { 
  ChevronLeft, CalendarClock, History, Swords, 
  ChevronRight, Clock, Target, LayoutList, ListChecks,
  Shield
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { useUser } from '@/firebase';
import { getMoscowTime, isMatchLive, getGlobalSeasonInfo } from '../lib/time-utils';
import { LoadingScreen } from '@/components/game/LoadingScreen';

type MatchView = 'menu' | 'next' | 'my_future' | 'my_history' | 'league_future' | 'league_history';

export default function MatchesPage() {
  const { user, isUserLoading } = useUser();
  const router = useRouter();
  const { 
    isLoaded, isDataReady, language, allSeasonMatches, nextMatch,
    activeSeasonNumber, selectedLeagueId, leagueLevel, groupId,
    matchHistory, clubLogo: myClubLogo
  } = useGameState();
  
  const [view, setView] = useState<MatchView>('menu');
  const [now, setNow] = useState(getMoscowTime());

  useEffect(() => {
    if (!isUserLoading && !user) router.push('/');
    const timer = setInterval(() => setNow(getMoscowTime()), 1000);
    return () => clearInterval(timer);
  }, [user, isUserLoading, router]);

  const groupTableId = `s${activeSeasonNumber}_l${selectedLeagueId}_t${leagueLevel}_g${groupId}`;
  
  const validMatches = useMemo(() => {
    return (allSeasonMatches || []).filter(m => m.tableId === groupTableId);
  }, [allSeasonMatches, groupTableId]);

  const t = {
    ru: {
      title: "МАТЧ-ЦЕНТР",
      subtitle: "Оперативные сводки и расписания",
      backToMenu: "В меню матчей",
      empty: "МАТЧЕЙ НЕ ОБНАРУЖЕНО",
      menu: [
        { id: 'next', label: 'Следующий соперник', desc: 'Ближайшее сражение', icon: Target, color: 'text-primary' },
        { id: 'my_future', label: 'Мои будущие матчи', desc: 'Личный календарь на сезон', icon: CalendarClock, color: 'text-accent' },
        { id: 'my_history', label: 'Мои сыгранные матчи', desc: 'Архив всех сражений клуба', icon: History, color: 'text-green-400' },
        { id: 'league_future', label: 'Календарь лиги', desc: 'Расписание всей группы', icon: LayoutList, color: 'text-blue-400' },
        { id: 'league_history', label: 'Результаты лиги', desc: 'Итоги всех сражений', icon: ListChecks, color: 'text-yellow-500' },
      ]
    },
    en: {
      title: "MATCH CENTER",
      subtitle: "Operational briefings",
      backToMenu: "Back to menu",
      empty: "NO MATCHES DETECTED",
      menu: [
        { id: 'next', label: 'Next Opponent', desc: 'Nearest tactical engagement', icon: Target, color: 'text-primary' },
        { id: 'my_future', label: 'My Future Matches', desc: 'Your personal season schedule', icon: CalendarClock, color: 'text-accent' },
        { id: 'my_history', label: 'My Played Matches', desc: 'Full club battle archive', icon: History, color: 'text-green-400' },
        { id: 'league_future', label: 'League Calendar', desc: 'Schedule of all group teams', icon: LayoutList, color: 'text-blue-400' },
        { id: 'league_history', label: 'League Results', desc: 'Outcomes of all group battles', icon: ListChecks, color: 'text-yellow-500' },
      ]
    }
  }[language === 'ru' ? 'ru' : 'en'];

  const getCountdown = useCallback((startTimeIso: string) => {
    const diff = new Date(startTimeIso).getTime() - now.getTime();
    if (diff <= 0) return '00:00:00';
    const hh = Math.floor(diff / 3600000);
    const mm = Math.floor((diff % 3600000) / 60000);
    const ss = Math.floor((diff % 60000) / 1000);
    return `${String(hh).padStart(2,'0')}:${String(mm).padStart(2,'0')}:${String(ss).padStart(2,'0')}`;
  }, [now]);

  const renderMatchCard = useCallback((m: any, idx: number) => {
    const isLive = isMatchLive(m.startTime || m.playedAt);
    const isFinished = m.isFinished;
    const isMeHome = m.homeId === user?.uid;
    const isMeAway = m.awayId === user?.uid;
    
    const homeLogo = isMeHome ? myClubLogo : m.homeLogo;
    const awayLogo = isMeAway ? myClubLogo : m.awayLogo;

    return (
      <Card key={`${m.id || 'm'}-${idx}`} className={cn(
        "glass-card border-white/5 transition-all overflow-hidden mb-2",
        isLive && "border-primary/40 bg-primary/5"
      )}>
        <CardContent className="p-3">
          <div className="flex justify-between items-center mb-3">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-[7px] font-black h-4 px-1.5 uppercase border-white/10 opacity-70">
                {m.type?.toUpperCase() || (m.tour ? `TOUR ${m.tour}` : 'BATTLE')}
              </Badge>
              {isFinished && m.seen === false && (
                <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              )}
            </div>
            <span className="text-[8px] font-mono font-bold text-muted-foreground">
              {new Date(m.startTime || m.playedAt).toLocaleString([], { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
          
          <div className="grid grid-cols-[1fr_50px_1fr] items-center gap-2">
            <div className="flex flex-col items-center gap-1.5 min-w-0">
               <div className="w-8 h-8 rounded-lg bg-secondary/50 border border-white/5 flex items-center justify-center overflow-hidden p-1 shrink-0">
                 {homeLogo ? <img src={homeLogo} alt="" className="w-full h-full object-contain" /> : <Shield className="w-4 h-4 text-muted-foreground/30" />}
               </div>
               <p className={cn("text-[9px] font-bold uppercase truncate w-full text-center", isMeHome ? "text-primary" : "text-white")}>{m.homeName}</p>
            </div>

            <div className="flex justify-center items-center">
              {isFinished ? (
                <span className="text-sm font-headline font-black italic">{m.scoreA}:{m.scoreB}</span>
              ) : (
                <Swords className="w-4 h-4 text-accent/40" />
              )}
            </div>

            <div className="flex flex-col items-center gap-1.5 min-w-0">
               <div className="w-8 h-8 rounded-lg bg-secondary/50 border border-white/5 flex items-center justify-center overflow-hidden p-1 shrink-0">
                 {awayLogo ? <img src={awayLogo} alt="" className="w-full h-full object-contain" /> : <Shield className="w-4 h-4 text-muted-foreground/30" />}
               </div>
               <p className={cn("text-[9px] font-bold uppercase truncate w-full text-center", isMeAway ? "text-primary" : "text-white")}>{m.awayName}</p>
            </div>
          </div>

          {isFinished && (
            <Link href={`/match?id=${m.id}`} className="block mt-3">
              <Button variant="outline" className="w-full h-8 text-[8px] font-black uppercase tracking-widest border-white/10 hover:bg-primary/10">
                ОБЗОР СРАЖЕНИЯ <ChevronRight className="w-3.5 h-3.5 ml-1" />
              </Button>
            </Link>
          )}
        </CardContent>
      </Card>
    );
  }, [user?.uid, myClubLogo]);

  const renderContent = () => {
    switch(view) {
      case 'next':
        const currentNextMatch = nextMatch?.match;
        return (
          <div className="animate-in fade-in">
            <Button variant="ghost" size="sm" onClick={() => setView('menu')} className="mb-4 h-8 text-[10px] font-bold uppercase text-primary"><ChevronLeft className="w-4 h-4 mr-1" /> {t.backToMenu}</Button>
            {currentNextMatch ? (
              <Card className="glass-card border-primary/30 bg-primary/5 p-8">
                 <div className="grid grid-cols-[1fr_60px_1fr] items-center gap-4">
                    <div className="text-center space-y-3">
                      <div className="w-16 h-16 rounded-2xl bg-secondary/50 flex items-center justify-center mx-auto overflow-hidden p-2">
                        {currentNextMatch.homeId === user?.uid ? 
                          (myClubLogo ? <img src={myClubLogo} alt="" className="w-full h-full object-contain" /> : <Shield className="w-8 h-8 text-muted-foreground/20" />) :
                          (currentNextMatch.homeLogo ? <img src={currentNextMatch.homeLogo} alt="" className="w-full h-full object-contain" /> : <Shield className="w-8 h-8 text-muted-foreground/20" />)
                        }
                      </div>
                      <p className="text-[10px] font-bold uppercase text-white truncate">{currentNextMatch.homeName}</p>
                    </div>
                    <div className="text-center"><Swords className="w-8 h-8 text-accent opacity-50 mx-auto" /><p className="text-[10px] font-mono font-bold text-primary mt-2">{getCountdown(currentNextMatch.startTime)}</p></div>
                    <div className="text-center space-y-3">
                      <div className="w-16 h-16 rounded-2xl bg-secondary/50 flex items-center justify-center mx-auto overflow-hidden p-2">
                        {currentNextMatch.awayId === user?.uid ? 
                          (myClubLogo ? <img src={myClubLogo} alt="" className="w-full h-full object-contain" /> : <Shield className="w-8 h-8 text-muted-foreground/20" />) :
                          (currentNextMatch.awayLogo ? <img src={currentNextMatch.awayLogo} alt="" className="w-full h-full object-contain" /> : <Shield className="w-8 h-8 text-muted-foreground/20" />)
                        }
                      </div>
                      <p className="text-[10px] font-bold uppercase text-white truncate">{currentNextMatch.awayName}</p>
                    </div>
                 </div>
              </Card>
            ) : <div className="py-20 text-center opacity-30 uppercase font-black text-[10px]">{t.empty}</div>}
          </div>
        );
      case 'my_future':
        const myFuture = validMatches.filter(m => (m.homeId === user?.uid || m.awayId === user?.uid) && !m.isFinished).sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
        return (
          <div className="animate-in fade-in">
            <Button variant="ghost" size="sm" onClick={() => setView('menu')} className="mb-4 h-8 text-[10px] font-bold uppercase text-primary"><ChevronLeft className="w-4 h-4 mr-1" /> {t.backToMenu}</Button>
            {myFuture.length > 0 ? myFuture.map((m, i) => renderMatchCard(m, i)) : <div className="py-20 text-center opacity-30 text-[10px] font-bold uppercase">{t.empty}</div>}
          </div>
        );
      case 'my_history':
        // Объединяем матчи лиги и матчи из архива (КВ, Турниры, Пробные)
        const leagueHistory = validMatches.filter(m => (m.homeId === user?.uid || m.awayId === user?.uid) && m.isFinished);
        
        // Дедупликация по ID для устранения ошибки дублирования ключей
        const uniqueHistoryMap = new Map();
        [...leagueHistory, ...matchHistory].forEach(m => {
          if (m.id) {
            if (!uniqueHistoryMap.has(m.id) || leagueHistory.some(lh => lh.id === m.id)) {
               uniqueHistoryMap.set(m.id, m);
            }
          }
        });

        const unifiedHistory = Array.from(uniqueHistoryMap.values()).sort((a, b) => {
          const timeA = new Date(a.startTime || a.playedAt).getTime();
          const timeB = new Date(b.startTime || b.playedAt).getTime();
          return timeB - timeA; // Новые сверху
        });

        return (
          <div className="animate-in fade-in">
            <Button variant="ghost" size="icon" onClick={() => setView('menu')} className="mb-4 h-8 w-8 text-primary"><ChevronLeft className="w-4 h-4" /></Button>
            {unifiedHistory.length > 0 ? unifiedHistory.map((m, i) => renderMatchCard(m, i)) : <div className="py-20 text-center opacity-30 text-[10px] font-bold uppercase">{t.empty}</div>}
          </div>
        );
      case 'league_future':
        const lFuture = validMatches.filter(m => !m.isFinished).sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
        return (
          <div className="animate-in fade-in">
            <Button variant="ghost" size="sm" onClick={() => setView('menu')} className="mb-4 h-8 text-[10px] font-bold uppercase text-primary"><ChevronLeft className="w-4 h-4 mr-1" /> {t.backToMenu}</Button>
            {lFuture.length > 0 ? lFuture.map((m, i) => renderMatchCard(m, i)) : <div className="py-20 text-center opacity-30 text-[10px] font-bold uppercase">{t.empty}</div>}
          </div>
        );
      case 'league_history':
        const lHistory = validMatches.filter(m => m.isFinished).sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
        return (
          <div className="animate-in fade-in">
            <Button variant="ghost" size="sm" onClick={() => setView('menu')} className="mb-4 h-8 text-[10px] font-bold uppercase text-primary"><ChevronLeft className="w-4 h-4 mr-1" /> {t.backToMenu}</Button>
            {lHistory.length > 0 ? lHistory.map((m, i) => renderMatchCard(m, i)) : <div className="py-20 text-center opacity-30 text-[10px] font-bold uppercase">{t.empty}</div>}
          </div>
        );
      default:
        return (
          <div className="space-y-2 animate-in fade-in">
            {t.menu.map((item) => (
              <Card key={item.id} className="glass-card border-white/5 hover:bg-white/5 transition-all cursor-pointer active:scale-[0.98]" onClick={() => setView(item.id as MatchView)}>
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={cn("p-2.5 rounded-xl bg-secondary/50", item.color)}><item.icon className="w-5 h-5" /></div>
                    <div><h3 className="text-sm font-bold uppercase">{item.label}</h3><p className="text-[10px] text-muted-foreground">{item.desc}</p></div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </CardContent>
              </Card>
            ))}
          </div>
        );
    }
  };

  if (isUserLoading || !isLoaded || !isDataReady) return <LoadingScreen />;

  return (
    <div className="max-w-md mx-auto px-4 pt-8 pb-32">
      <header className="mb-6 flex items-center gap-4">
        <Button variant="ghost" size="icon" className="rounded-full" onClick={() => view === 'menu' ? router.push('/') : setView('menu')}><ChevronLeft className="w-6 h-6" /></Button>
        <div><h1 className="text-2xl font-headline font-bold uppercase tracking-tighter">{t.title}</h1><p className="text-muted-foreground text-[10px] uppercase tracking-widest">Active Operations Cycle</p></div>
      </header>
      {renderContent()}
    </div>
  );
}
