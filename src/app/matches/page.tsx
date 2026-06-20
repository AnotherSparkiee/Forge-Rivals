
'use client';

import { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useGameState } from '../lib/store';
import { 
  ChevronLeft, CalendarClock, History, Calendar, CheckSquare, 
  ChevronRight, Clock, Swords, Loader2, Trophy, Target, ShieldCheck,
  LayoutList, ListChecks
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { useUser } from '@/firebase';
import { getMoscowTime, isMatchLive } from '../lib/time-utils';
import { LoadingScreen } from '@/components/game/LoadingScreen';

export default function MatchesPage() {
  const { user, isUserLoading } = useUser();
  const router = useRouter();
  const { 
    isLoaded, isDataReady, language, allSeasonMatches, nextMatch,
    activeSeasonNumber
  } = useGameState();
  
  const [now, setNow] = useState(getMoscowTime());

  useEffect(() => {
    if (!isUserLoading && !user) router.push('/');
    const timer = setInterval(() => setNow(getMoscowTime()), 1000);
    return () => clearInterval(timer);
  }, [user, isUserLoading, router]);

  const t = {
    title: language === 'ru' ? "РАСПИСАНИЕ" : "SCHEDULE",
    back: language === 'ru' ? "Назад" : "Back",
    nextMatch: language === 'ru' ? "СЛЕДУЮЩИЙ СОПЕРНИК" : "NEXT ENGAGEMENT",
    myFuture: language === 'ru' ? "МОИ БУДУЩИЕ" : "MY FUTURE MATCHES",
    myHistory: language === 'ru' ? "МОИ СЫГРАННЫЕ" : "MY OPERATION HISTORY",
    leagueFuture: language === 'ru' ? "КАЛЕНДАРЬ ЛИГИ" : "LEAGUE CALENDAR",
    leagueHistory: language === 'ru' ? "СЫГРАННЫЕ В ЛИГЕ" : "LEAGUE RESULTS",
    empty: language === 'ru' ? "МАТЧЕЙ НЕ ОБНАРУЖЕНО" : "NO MATCHES DETECTED",
    status: { scheduled: "ОЖИДАНИЕ", finished: "ЗАВЕРШЕНО", live: "В ЭФИРЕ" }
  };

  const getCountdown = (startTimeIso: string) => {
    const diff = new Date(startTimeIso).getTime() - now.getTime();
    if (diff <= 0) return '00:00:00';
    const hh = Math.floor(diff / 3600000);
    const mm = Math.floor((diff % 3600000) / 60000);
    const ss = Math.floor((diff % 60000) / 1000);
    return `${String(hh).padStart(2,'0')}:${String(mm).padStart(2,'0')}:${String(ss).padStart(2,'0')}`;
  };

  if (isUserLoading || !isLoaded || !isDataReady) return <LoadingScreen />;

  // Filter logic
  const myMatches = allSeasonMatches.filter(m => m.homeId === user?.uid || m.awayId === user?.uid);
  const leagueMatches = allSeasonMatches.filter(m => m.homeId !== user?.uid && m.awayId !== user?.uid);

  const myFuture = myMatches.filter(m => !m.isFinished).sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
  const myHistory = myMatches.filter(m => m.isFinished).sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
  const leagueFuture = leagueMatches.filter(m => !m.isFinished).sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
  const leagueHistory = leagueMatches.filter(m => m.isFinished).sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());

  const currentNextMatch = nextMatch?.match;

  const renderMatchCard = (m: any) => {
    const isLive = isMatchLive(m.startTime);
    const isFinished = m.isFinished;
    const isMeHome = m.homeId === user?.uid;
    const isMeAway = m.awayId === user?.uid;
    
    return (
      <Card key={m.id} className={cn(
        "glass-card border-white/5 transition-all overflow-hidden mb-2",
        isLive && "border-primary/40 bg-primary/5 ring-1 ring-primary/20"
      )}>
        <CardContent className="p-3">
          <div className="flex justify-between items-center mb-2">
            <div className="flex items-center gap-1.5">
              <Badge variant="outline" className="text-[7px] font-black uppercase border-white/10 h-4">ДЕНЬ {m.day}</Badge>
              {isLive && <Badge className="bg-red-500 animate-pulse text-[7px] font-black uppercase h-4 px-1.5">LIVE</Badge>}
            </div>
            <span className="text-[8px] font-mono font-bold text-muted-foreground">
              {new Date(m.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} MSK
            </span>
          </div>

          <div className="grid grid-cols-[1fr_40px_1fr] items-center gap-2">
            <div className="text-right truncate">
              <p className={cn("text-[10px] font-bold uppercase", isMeHome ? "text-primary" : "text-white")}>{m.homeName}</p>
            </div>
            <div className="flex justify-center">
              {isFinished ? (
                <span className="text-sm font-headline font-black italic">{m.scoreA}:{m.scoreB}</span>
              ) : (
                <Swords className="w-3.5 h-3.5 text-accent/40" />
              )}
            </div>
            <div className="text-left truncate">
              <p className={cn("text-[10px] font-bold uppercase", isMeAway ? "text-primary" : "text-white")}>{m.awayName}</p>
            </div>
          </div>
          
          {isFinished && (
            <Link href={`/match?id=${m.id}`} className="block mt-2">
              <Button variant="outline" className="w-full h-7 text-[7px] font-black uppercase border-white/10 hover:bg-white/5">
                ОБЗОР <ChevronRight className="w-3 h-3 ml-1" />
              </Button>
            </Link>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="max-w-md mx-auto px-4 pt-8 pb-32">
      <header className="mb-6 flex items-center gap-4">
        <Button variant="ghost" size="icon" className="rounded-full" onClick={() => router.push('/')}>
          <ChevronLeft className="w-6 h-6" />
        </Button>
        <div>
          <h1 className="text-2xl font-headline font-bold uppercase tracking-tighter">{t.title}</h1>
          <p className="text-muted-foreground text-[10px] uppercase tracking-widest font-black opacity-50">Season {activeSeasonNumber} Node</p>
        </div>
      </header>

      <div className="space-y-10">
        {/* 1. NEXT MATCH */}
        {currentNextMatch && (
          <section className="space-y-3">
            <h2 className="text-[9px] font-black uppercase tracking-[0.2em] text-primary flex items-center gap-2 px-1">
              <Target className="w-3.5 h-3.5" /> {t.nextMatch}
            </h2>
            <Card className="glass-card border-primary/30 bg-primary/5 shadow-xl shadow-primary/10">
               <CardContent className="p-6">
                 <div className="flex justify-between items-center mb-6">
                   <Badge className="bg-primary text-primary-foreground font-black text-[9px] uppercase tracking-widest">ДЕНЬ {currentNextMatch.day}</Badge>
                   <div className="flex items-center gap-2 text-primary">
                     <Clock className="w-3.5 h-3.5 animate-pulse" />
                     <span className="text-xs font-mono font-bold tabular-nums">{getCountdown(currentNextMatch.startTime)}</span>
                   </div>
                 </div>
                 <div className="grid grid-cols-[1fr_50px_1fr] items-center gap-4">
                    <div className="text-center space-y-2">
                       <div className="w-12 h-12 rounded-2xl bg-secondary/50 border border-white/10 flex items-center justify-center mx-auto text-2xl">🛡️</div>
                       <p className="text-xs font-headline font-bold uppercase italic text-white truncate">{currentNextMatch.homeName}</p>
                    </div>
                    <div className="flex items-center justify-center"><Swords className="w-6 h-6 text-accent" /></div>
                    <div className="text-center space-y-2">
                       <div className="w-12 h-12 rounded-2xl bg-secondary/50 border border-white/10 flex items-center justify-center mx-auto text-2xl">⚔️</div>
                       <p className="text-xs font-headline font-bold uppercase italic text-white truncate">{currentNextMatch.awayName}</p>
                    </div>
                 </div>
               </CardContent>
            </Card>
          </section>
        )}

        {/* 2. MY FUTURE */}
        {myFuture.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-[9px] font-black uppercase tracking-[0.2em] text-accent flex items-center gap-2 px-1">
              <CalendarClock className="w-3.5 h-3.5" /> {t.myFuture}
            </h2>
            <div>{myFuture.map(renderMatchCard)}</div>
          </section>
        )}

        {/* 3. MY HISTORY */}
        {myHistory.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-2 px-1">
              <History className="w-3.5 h-3.5" /> {t.myHistory}
            </h2>
            <div>{myHistory.map(renderMatchCard)}</div>
          </section>
        )}

        {/* 4. LEAGUE CALENDAR */}
        {leagueFuture.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-[9px] font-black uppercase tracking-[0.2em] text-blue-400 flex items-center gap-2 px-1">
              <LayoutList className="w-3.5 h-3.5" /> {t.leagueFuture}
            </h2>
            <div className="opacity-80">{leagueFuture.slice(0, 10).map(renderMatchCard)}</div>
          </section>
        )}

        {/* 5. LEAGUE RESULTS */}
        {leagueHistory.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-[9px] font-black uppercase tracking-[0.2em] text-green-400 flex items-center gap-2 px-1">
              <ListChecks className="w-3.5 h-3.5" /> {t.leagueHistory}
            </h2>
            <div className="opacity-70">{leagueHistory.slice(0, 10).map(renderMatchCard)}</div>
          </section>
        )}

        {allSeasonMatches.length === 0 && (
          <div className="py-20 text-center opacity-30 flex flex-col items-center gap-4">
            <ShieldCheck className="w-16 h-16" />
            <p className="text-xs uppercase font-bold tracking-widest">{t.empty}</p>
          </div>
        )}
      </div>
    </div>
  );
}
