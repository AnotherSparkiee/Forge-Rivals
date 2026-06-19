
'use client';

import { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useGameState } from '../lib/store';
import { 
  ChevronLeft, UserSearch, CalendarClock, 
  History, Calendar, CheckSquare, ChevronRight,
  Clock, Swords, Loader2, ShieldAlert, User, Trophy, Medal
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { getMoscowTime, getSeasonDateLabel, getGlobalSeasonInfo } from '../lib/time-utils';
import { LoadingScreen } from '@/components/game/LoadingScreen';
import { collection, query, where, limit } from 'firebase/firestore';

type MatchTab = 
  | 'menu'
  | 'next_opponent' 
  | 'my_future' 
  | 'my_played' 
  | 'league_calendar' 
  | 'league_played'
  | 'cup_matches';

export default function MatchesPage() {
  const { user, isUserLoading } = useUser();
  const db = useFirestore();
  const router = useRouter();
  const { 
    isLoaded, isDataReady, language, leagueLevel, groupId, 
    matchHistory, allSeasonMatches, nextMatch: centralNextMatch,
    activeSeasonNumber, selectedLeagueId
  } = useGameState();
  
  const [activeTab, setActiveTab] = useState<MatchTab>('menu');
  const [now, setNow] = useState(getMoscowTime());

  const seasonInfo = useMemo(() => getGlobalSeasonInfo(), []);

  useEffect(() => {
    if (!isUserLoading && !user) router.push('/auth/register');
    const timer = setInterval(() => setNow(getMoscowTime()), 1000);
    return () => clearInterval(timer);
  }, [user, isUserLoading, router]);

  const calendarDays = useMemo(() => {
    if (!isDataReady) return [];
    // ФИЛЬТР ВЕРСИИ 32 (Актуальная версия для Сезона 1)
    const filtered = allSeasonMatches.filter(m => m.seasonNumber === activeSeasonNumber && m.version === 32);
    const dayGroups: Record<number, any[]> = {};
    filtered.forEach(m => {
      if (!dayGroups[m.day]) dayGroups[m.day] = [];
      dayGroups[m.day].push(m);
    });
    return Object.entries(dayGroups).map(([day, matches]) => ({ day: Number(day), matches })).sort((a, b) => a.day - b.day);
  }, [allSeasonMatches, isDataReady, activeSeasonNumber]);

  const myMatches = useMemo(() => {
    if (!user || !isDataReady) return [];
    return allSeasonMatches.filter(m => 
      (m.homeId === user.uid || m.awayId === user.uid) && 
      m.seasonNumber === activeSeasonNumber &&
      m.version === 32
    );
  }, [allSeasonMatches, user, isDataReady, activeSeasonNumber]);

  const getCountdown = (startTimeIso: string) => {
    const target = new Date(startTimeIso).getTime();
    const diff = target - now.getTime();
    if (diff <= 0) return '00:00:00';
    const hh = Math.floor(diff / 3600000);
    const mm = Math.floor((diff % 3600000) / 60000);
    const ss = Math.floor((diff % 60000) / 1000);
    return `${String(hh).padStart(2,'0')}:${String(mm).padStart(2,'0')}:${String(ss).padStart(2,'0')}`;
  };

  const t = {
    title: language === 'ru' ? "СПИСОК МАТЧЕЙ" : "OPERATIONAL MATCHES",
    subtitle: language === 'ru' ? "Расписание и История" : "Tactical Schedule & History",
    back: language === 'ru' ? "Назад" : "Back",
    awaiting: language === 'ru' ? "ОЖИДАНИЕ ГЕНЕРАЦИИ..." : "AWAITING DEPLOYMENT...",
    offseasonDesc: language === 'ru' ? "Сетка матчей Сезона 1 будет сформирована 19 июня в 16:00." : "Season 1 match grid will be established on June 19, 16:00 MSK.",
    noHistory: language === 'ru' ? "История пуста" : "No combat records",
    tourTypes: { trial: "TRIAL", friendly: "FRIENDLY", basket: "BASKET", league: "LEAGUE", cup: "CUP" },
    tourTypesRu: { trial: "ПРОБНЫЙ", friendly: "ТОВАРИЩЕСКИЙ", basket: "КОРЗИНА", league: "ЛИГА", cup: "КУБОК" },
    tabs: {
      next_opponent: { label: language === 'ru' ? "Следующий соперник" : "Next Opponent", icon: UserSearch },
      my_future: { label: language === 'ru' ? "Мои будущие" : "My Future", icon: CalendarClock },
      my_played: { label: language === 'ru' ? "Мои сыгранные" : "My Played", icon: History },
      league_calendar: { label: language === 'ru' ? "Календарь лиги" : "League Calendar", icon: Calendar },
      league_played: { label: language === 'ru' ? "Сыгранные в лиге" : "Played in League", icon: CheckSquare }
    }
  };

  if (isUserLoading || !isLoaded || !isDataReady) return <LoadingScreen />;

  const renderEmptyState = () => (
    <div className="py-20 text-center animate-in fade-in duration-700">
      <div className="w-20 h-20 rounded-full bg-secondary/50 border-2 border-dashed border-white/10 flex items-center justify-center mx-auto mb-6">
        <Clock className="w-10 h-10 text-muted-foreground opacity-30 animate-pulse" />
      </div>
      <h2 className="text-xl font-headline font-bold uppercase text-white">{t.awaiting}</h2>
      <p className="text-[10px] text-muted-foreground mt-4 px-10 italic leading-relaxed uppercase tracking-widest">
        {t.offseasonDesc}
      </p>
    </div>
  );

  return (
    <div className="max-w-md mx-auto px-4 pt-8 pb-24">
      <header className="mb-6 flex items-center gap-4">
        <Button variant="ghost" size="icon" className="rounded-full" onClick={() => activeTab === 'menu' ? router.push('/') : setActiveTab('menu')}><ChevronLeft className="w-6 h-6" /></Button>
        <div><h1 className="text-2xl font-headline font-bold uppercase tracking-tighter">{activeTab === 'menu' ? t.title : (t.tabs as any)[activeTab]?.label}</h1><p className="text-muted-foreground text-[10px] uppercase tracking-widest">{t.back}</p></div>
      </header>

      {activeTab === 'menu' ? (
        <div className="space-y-2">
          {Object.entries(t.tabs).map(([id, data]) => (
            <Card key={id} className="glass-card hover:bg-white/5 cursor-pointer transition-all border-white/5" onClick={() => setActiveTab(id as any)}>
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-2.5 rounded-xl bg-secondary/50"><data.icon className="w-5 h-5 text-primary" /></div>
                  <h3 className="text-sm font-bold uppercase">{data.label}</h3>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : activeTab === 'next_opponent' ? (
        <div className="space-y-6">
           {centralNextMatch ? (
             <Card className="glass-card border-primary/20 bg-primary/5 p-6 flex flex-col items-center gap-4">
                <p className="text-[10px] font-black text-muted-foreground uppercase">{language === 'ru' ? 'ДО МАТЧА' : 'TIME TO BATTLE'}</p>
                <p className="text-4xl font-headline font-bold text-primary">{getCountdown(centralNextMatch.match.startTime)}</p>
                <div className="w-20 h-20 rounded-full bg-secondary/50 border-2 border-primary flex items-center justify-center"><User className="w-10 h-10 text-primary" /></div>
                <h3 className="text-xl font-headline font-bold uppercase italic">{centralNextMatch.opponentName}</h3>
             </Card>
           ) : renderEmptyState()}
        </div>
      ) : activeTab === 'my_future' ? (
        <div className="space-y-4">
           {myMatches.filter(m => !m.isFinished).length > 0 ? myMatches.filter(m => !m.isFinished).map(m => (
             <div key={m.id} className="bg-secondary/20 p-3 rounded-xl border border-white/5 flex justify-between items-center text-[10px] font-bold uppercase">
               <span>DAY {m.day}</span>
               <span className={cn(m.homeId === user?.uid && "text-primary")}>{m.homeName}</span>
               <span className="text-accent">VS</span>
               <span className={cn(m.awayId === user?.uid && "text-primary")}>{m.awayName}</span>
             </div>
           )) : renderEmptyState()}
        </div>
      ) : activeTab === 'my_played' ? (
        <div className="space-y-2">
          {[...matchHistory].reverse().map((m) => {
            const isWin = (m.scoreA > m.scoreB);
            const isDraw = m.scoreA === m.scoreB;
            const tourTypeLabel = language === 'ru' ? (t.tourTypesRu[m.type as keyof typeof t.tourTypesRu] || m.type) : (t.tourTypes[m.type as keyof typeof t.tourTypes] || m.type);
            
            return (
              <Link key={m.id} href={`/match?id=${m.id}`}>
                <Card className={cn(
                  "glass-card border-white/5 hover:bg-white/5 transition-all overflow-hidden",
                  !m.seen && "border-primary/40 bg-primary/5 shadow-[0_0_15px_rgba(var(--primary),0.1)]"
                )}>
                  <CardContent className="p-3 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "w-10 h-10 rounded-lg flex items-center justify-center border",
                        isWin ? "bg-green-500/10 border-green-500/30 text-green-400" : (isDraw ? "bg-accent/10 border-accent/30 text-accent" : "bg-red-500/10 border-red-500/30 text-red-400")
                      )}>
                        {isWin ? <Trophy className="w-5 h-5" /> : <Medal className="w-5 h-5" />}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                           <Badge variant="outline" className="text-[6px] h-3 px-1 border-white/10 uppercase font-black">{tourTypeLabel}</Badge>
                           <span className="text-[8px] text-muted-foreground font-mono">{new Date(m.playedAt).toLocaleDateString()}</span>
                        </div>
                        <h4 className="text-[11px] font-bold uppercase truncate mt-0.5">vs {m.opponentName}</h4>
                      </div>
                    </div>
                    <div className="flex flex-col items-end">
                      <div className="text-lg font-headline font-black italic tracking-tighter">
                        <span className={cn(isWin && "text-primary")}>{m.scoreA}</span>
                        <span className="opacity-20 mx-1">:</span>
                        <span>{m.scoreB}</span>
                      </div>
                      {!m.seen && <span className="text-[6px] font-black text-primary uppercase animate-pulse">NEW RESULT</span>}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
          {matchHistory.length === 0 && (
            <div className="py-20 text-center opacity-30 flex flex-col items-center gap-4">
               <History className="w-12 h-12" />
               <p className="text-xs font-black uppercase tracking-widest">{t.noHistory}</p>
            </div>
          )}
        </div>
      ) : (
        <div className="py-20 text-center opacity-30 text-[10px] font-black uppercase tracking-widest">Protocol Active</div>
      )}
    </div>
  );
}
