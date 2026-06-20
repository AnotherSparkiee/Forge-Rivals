'use client';

import { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useGameState } from '../lib/store';
import { 
  ChevronLeft, CalendarClock, History, Calendar, CheckSquare, 
  ChevronRight, Clock, Swords, Loader2, Trophy
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { useUser } from '@/firebase';
import { getMoscowTime, getGlobalSeasonInfo } from '../lib/time-utils';
import { LoadingScreen } from '@/components/game/LoadingScreen';

export default function MatchesPage() {
  const { user, isUserLoading } = useUser();
  const router = useRouter();
  const { 
    isLoaded, isDataReady, language, matchHistory, allSeasonMatches, nextMatch,
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

  const filteredMatches = allSeasonMatches
    .filter(m => m.seasonNumber === activeSeasonNumber && (m.homeId === user?.uid || m.awayId === user?.uid))
    .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

  return (
    <div className="max-w-md mx-auto px-4 pt-8 pb-24">
      <header className="mb-6 flex items-center gap-4">
        <Button variant="ghost" size="icon" className="rounded-full" onClick={() => router.push('/')}>
          <ChevronLeft className="w-6 h-6" />
        </Button>
        <div>
          <h1 className="text-2xl font-headline font-bold uppercase tracking-tighter">{t.title}</h1>
          <p className="text-muted-foreground text-[10px] uppercase tracking-widest">Season {activeSeasonNumber} Timeline</p>
        </div>
      </header>

      <div className="space-y-3">
        {filteredMatches.length > 0 ? filteredMatches.map((m) => {
          const isLive = now >= new Date(m.startTime) && now < new Date(new Date(m.startTime).getTime() + 35 * 60000);
          const isFinished = m.isFinished;
          
          return (
            <Card key={m.id} className={cn(
              "glass-card border-white/5 transition-all overflow-hidden",
              isLive && "border-primary/40 bg-primary/5 ring-1 ring-primary/20 shadow-[0_0_15px_rgba(var(--primary),0.1)]"
            )}>
              <CardContent className="p-4">
                <div className="flex justify-between items-center mb-3">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[7px] font-black uppercase border-white/10">ДЕНЬ {m.day}</Badge>
                    {isLive && <Badge className="bg-red-500 animate-pulse text-[7px] font-black uppercase">LIVE</Badge>}
                  </div>
                  <span className="text-[9px] font-mono font-bold text-muted-foreground">
                    {new Date(m.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} MSK
                  </span>
                </div>

                <div className="grid grid-cols-[1fr_40px_1fr] items-center gap-2">
                  <div className="text-right truncate">
                    <p className={cn("text-xs font-bold uppercase", m.homeId === user?.uid ? "text-primary" : "text-white")}>{m.homeName}</p>
                  </div>
                  <div className="flex justify-center">
                    {isFinished ? (
                      <span className="text-sm font-headline font-black italic">{m.scoreA}:{m.scoreB}</span>
                    ) : (
                      <Swords className="w-4 h-4 text-accent/40" />
                    )}
                  </div>
                  <div className="text-left truncate">
                    <p className={cn("text-xs font-bold uppercase", m.awayId === user?.uid ? "text-primary" : "text-white")}>{m.awayName}</p>
                  </div>
                </div>

                {!isFinished && !isLive && (
                  <div className="mt-4 flex items-center justify-center gap-2 bg-background/50 py-1.5 rounded-lg border border-white/5">
                    <Clock className="w-3 h-3 text-primary animate-pulse" />
                    <span className="text-[10px] font-mono font-bold text-primary tabular-nums">{getCountdown(m.startTime)}</span>
                  </div>
                )}
                
                {isFinished && (
                  <Link href={`/match?id=${m.id}`} className="block mt-3">
                    <Button variant="outline" className="w-full h-8 text-[8px] font-black uppercase border-white/10 hover:bg-white/5">
                      СМОТРЕТЬ ОБЗОР <ChevronRight className="w-3 h-3 ml-1" />
                    </Button>
                  </Link>
                )}
              </CardContent>
            </Card>
          );
        }) : (
          <div className="py-20 text-center opacity-30 flex flex-col items-center gap-4">
             <Calendar className="w-12 h-12" />
             <p className="text-xs font-black uppercase tracking-widest">{t.empty}</p>
          </div>
        )}
      </div>
    </div>
  );
}
