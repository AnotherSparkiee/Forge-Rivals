
'use client';

import { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useGameState } from '../lib/store';
import { 
  ChevronLeft, CalendarClock, History, Swords, 
  ChevronRight, Clock, Trophy, Target, ShieldCheck,
  LayoutList, ListChecks, Calendar
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
    title: language === 'ru' ? "МАТЧ-ЦЕНТР" : "MATCH CENTER",
    back: language === 'ru' ? "Назад" : "Back",
    tabs: {
      next: language === 'ru' ? "Ближайший" : "Next",
      myFuture: language === 'ru' ? "Мои (Буд.)" : "My Future",
      myHistory: language === 'ru' ? "Мои (Итоги)" : "My Played",
      leagueFuture: language === 'ru' ? "Лига (Буд.)" : "League",
      leagueHistory: language === 'ru' ? "Лига (Итоги)" : "Results"
    },
    nextMatch: language === 'ru' ? "СЛЕДУЮЩИЙ СОПЕРНИК" : "NEXT ENGAGEMENT",
    empty: language === 'ru' ? "МАТЧЕЙ НЕ ОБНАРУЖЕНО" : "NO MATCHES DETECTED",
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

  const renderEmpty = (title: string) => (
    <div className="py-20 text-center opacity-30 flex flex-col items-center gap-4">
      <ShieldCheck className="w-12 h-12" />
      <p className="text-[10px] uppercase font-black tracking-widest">{title}</p>
    </div>
  );

  return (
    <div className="max-w-md mx-auto px-4 pt-8 pb-32">
      <header className="mb-6 flex items-center gap-4">
        <Button variant="ghost" size="icon" className="rounded-full" onClick={() => router.push('/')}>
          <ChevronLeft className="w-6 h-6" />
        </Button>
        <div>
          <h1 className="text-2xl font-headline font-bold uppercase tracking-tighter">{t.title}</h1>
          <p className="text-muted-foreground text-[10px] uppercase tracking-widest font-black opacity-50">Season {activeSeasonNumber} Terminals</p>
        </div>
      </header>

      <Tabs defaultValue="next" className="w-full">
        <div className="overflow-x-auto scrollbar-hide -mx-4 px-4 mb-8">
          <TabsList className="bg-secondary/20 h-12 p-1 rounded-xl w-max flex gap-1">
            <TabsTrigger value="next" className="text-[9px] font-black uppercase px-4 rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <Target className="w-3 h-3 mr-1.5" /> {t.tabs.next}
            </TabsTrigger>
            <TabsTrigger value="myFuture" className="text-[9px] font-black uppercase px-4 rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <CalendarClock className="w-3 h-3 mr-1.5" /> {t.tabs.myFuture}
            </TabsTrigger>
            <TabsTrigger value="myHistory" className="text-[9px] font-black uppercase px-4 rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <History className="w-3 h-3 mr-1.5" /> {t.tabs.myHistory}
            </TabsTrigger>
            <TabsTrigger value="leagueFuture" className="text-[9px] font-black uppercase px-4 rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <LayoutList className="w-3 h-3 mr-1.5" /> {t.tabs.leagueFuture}
            </TabsTrigger>
            <TabsTrigger value="leagueHistory" className="text-[9px] font-black uppercase px-4 rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <ListChecks className="w-3 h-3 mr-1.5" /> {t.tabs.leagueHistory}
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="next" className="animate-in fade-in slide-in-from-bottom-2 duration-300 outline-none">
          {currentNextMatch ? (
            <section className="space-y-4">
              <h2 className="text-[9px] font-black uppercase tracking-[0.2em] text-primary flex items-center gap-2 px-1">
                <Target className="w-3.5 h-3.5" /> {t.nextMatch}
              </h2>
              <Card className="glass-card border-primary/30 bg-primary/5 shadow-2xl shadow-primary/10 overflow-hidden">
                 <div className="bg-primary/10 px-6 py-2 border-b border-primary/20 flex justify-between items-center">
                   <Badge className="bg-primary text-primary-foreground font-black text-[8px] uppercase tracking-widest">ROUND {currentNextMatch.day}</Badge>
                   <div className="flex items-center gap-2 text-primary font-mono text-[10px] font-bold uppercase tracking-widest">
                     <Clock className="w-3 h-3 animate-pulse" />
                     {getCountdown(currentNextMatch.startTime)}
                   </div>
                 </div>
                 <CardContent className="p-8">
                   <div className="grid grid-cols-[1fr_60px_1fr] items-center gap-4">
                      <div className="text-center space-y-3">
                         <div className="w-16 h-16 rounded-2xl bg-secondary/50 border border-white/10 flex items-center justify-center mx-auto text-3xl shadow-xl">🛡️</div>
                         <p className="text-xs font-headline font-bold uppercase italic text-white truncate">{currentNextMatch.homeName}</p>
                         <p className="text-[7px] font-black text-muted-foreground uppercase tracking-widest">HOME OPS</p>
                      </div>
                      <div className="flex items-center justify-center flex-col gap-2">
                        <Swords className="w-8 h-8 text-accent opacity-50" />
                        <span className="text-[8px] font-black text-accent uppercase">VS</span>
                      </div>
                      <div className="text-center space-y-3">
                         <div className="w-16 h-16 rounded-2xl bg-secondary/50 border border-white/10 flex items-center justify-center mx-auto text-3xl shadow-xl">⚔️</div>
                         <p className="text-xs font-headline font-bold uppercase italic text-white truncate">{currentNextMatch.awayName}</p>
                         <p className="text-[7px] font-black text-muted-foreground uppercase tracking-widest">AWAY OPS</p>
                      </div>
                   </div>
                 </CardContent>
                 <div className="bg-background/40 p-4 border-t border-white/5 text-center">
                    <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">
                      Engagement Time: {new Date(currentNextMatch.startTime).toLocaleString()}
                    </p>
                 </div>
              </Card>
            </section>
          ) : renderEmpty(t.empty)}
        </TabsContent>

        <TabsContent value="myFuture" className="animate-in fade-in slide-in-from-bottom-2 duration-300 outline-none">
          <div className="space-y-2">
            {myFuture.length > 0 ? myFuture.map(renderMatchCard) : renderEmpty(t.empty)}
          </div>
        </TabsContent>

        <TabsContent value="myHistory" className="animate-in fade-in slide-in-from-bottom-2 duration-300 outline-none">
          <div className="space-y-2">
            {myHistory.length > 0 ? myHistory.map(renderMatchCard) : renderEmpty(t.empty)}
          </div>
        </TabsContent>

        <TabsContent value="leagueFuture" className="animate-in fade-in slide-in-from-bottom-2 duration-300 outline-none">
          <div className="space-y-2">
            {leagueFuture.length > 0 ? leagueFuture.map(renderMatchCard) : renderEmpty(t.empty)}
          </div>
        </TabsContent>

        <TabsContent value="leagueHistory" className="animate-in fade-in slide-in-from-bottom-2 duration-300 outline-none">
          <div className="space-y-2">
            {leagueHistory.length > 0 ? leagueHistory.map(renderMatchCard) : renderEmpty(t.empty)}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
