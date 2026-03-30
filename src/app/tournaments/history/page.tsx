
'use client';

import { useGameState } from '@/app/lib/store';
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { 
  ChevronLeft, History, Trophy, Calendar, AlertCircle, 
  Ban, Clock, ArrowRight, Activity, ChevronRight 
} from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { LoadingScreen } from '@/components/game/LoadingScreen';
import { getMoscowTime } from '@/app/lib/time-utils';

export default function TournamentHistoryPage() {
  const { user, isUserLoading } = useUser();
  const db = useFirestore();
  const { language, isLoaded } = useGameState();

  const userRef = useMemoFirebase(() => user ? doc(db, 'players_v5', user.uid) : null, [db, user]);
  const { data: profile, isLoading: isProfileLoading } = useDoc(userRef);

  if (isUserLoading || !isLoaded || isProfileLoading) {
    return <LoadingScreen />;
  }

  const t = {
    title: language === 'ru' ? "ИСТОРИЯ ТУРНИРОВ" : "TOURNAMENT HISTORY",
    subtitle: language === 'ru' ? "Архив ваших боевых заслуг" : "Archive of your combat achievements",
    noHistory: language === 'ru' ? "История пуста" : "No history yet",
    noHistoryDesc: language === 'ru' ? "Вы еще не завершили ни одного турнира." : "You haven't completed any tournaments yet.",
    dq: language === 'ru' ? "ДИСКВАЛИФИКАЦИЯ" : "DISQUALIFIED",
    finished: language === 'ru' ? "ЗАВЕРШЕНО" : "FINISHED",
    active: language === 'ru' ? "АКТИВЕН" : "ACTIVE",
    start: language === 'ru' ? "НАЧАЛО" : "START",
    end: language === 'ru' ? "КОНЕЦ" : "END",
    viewLive: language === 'ru' ? "СМОТРЕТЬ" : "VIEW LIVE"
  };

  // Logic to determine if a tournament should be displayed as ACTIVE even if not yet in DB history
  const mskNow = getMoscowTime();
  const isIronGlobeActiveTime = mskNow.getHours() > 20 || (mskNow.getHours() === 20 && mskNow.getMinutes() >= 50);
  
  const rawHistory = profile?.tournamentHistory || [];
  let displayHistory = [...rawHistory];

  // If user is registered for Iron Globe and registration is closed, ensure it shows up in history
  if (profile?.tournaments?.includes('iron-globe') && isIronGlobeActiveTime) {
    const alreadyHasActive = displayHistory.some(h => h.tournamentId === 'iron-globe' && h.status === 'active');
    if (!alreadyHasActive) {
      const startTime = new Date(mskNow);
      startTime.setHours(21, 5, 0, 0);
      
      displayHistory.push({
        tournamentId: 'iron-globe',
        tournamentName: language === 'ru' ? "Чугунный Глобус" : "Cast Iron Globe",
        result: language === 'ru' ? "В процессе" : "In Progress",
        startDate: startTime.toISOString(),
        status: 'active'
      });
    }
  }

  return (
    <div className="max-w-md mx-auto px-4 pt-8 pb-24">
      <header className="mb-6 flex items-center gap-4">
        <Link href="/tournaments">
          <Button variant="ghost" size="icon" className="rounded-full">
            <ChevronLeft className="w-6 h-6" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-headline font-bold uppercase tracking-tighter">{t.title}</h1>
          <p className="text-muted-foreground text-[10px] uppercase tracking-widest">{t.subtitle}</p>
        </div>
      </header>

      {displayHistory.length > 0 ? (
        <div className="space-y-3">
          {displayHistory.map((record: any, idx: number) => {
            const isDQ = record.status === 'abandoned';
            const isActive = record.status === 'active';
            const startDate = new Date(record.startDate);
            const endDate = record.endDate ? new Date(record.endDate) : null;
            
            const href = record.tournamentId === 'iron-globe' ? '/tournaments/iron-globe' : '#';
            
            return (
              <Link key={`${record.tournamentId}-${idx}`} href={href} className="block group">
                <Card className={cn(
                  "glass-card border-white/5 overflow-hidden transition-all group-hover:bg-white/5",
                  isDQ ? "border-red-500/20 bg-red-500/5" : (isActive ? "border-primary/40 bg-primary/10 shadow-[0_0_15px_rgba(var(--primary),0.1)]" : "border-primary/20 bg-primary/5")
                )}>
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "p-2.5 rounded-xl border",
                          isDQ ? "bg-red-500/20 border-red-500/30 text-red-400" : (isActive ? "bg-primary/30 border-primary/50 text-white animate-pulse" : "bg-primary/20 border-primary/30 text-primary")
                        )}>
                          {isDQ ? <Ban className="w-5 h-5" /> : (isActive ? <Activity className="w-5 h-5" /> : <Trophy className="w-5 h-5" />)}
                        </div>
                        <div>
                          <h3 className="text-sm font-bold uppercase leading-tight">{record.tournamentName}</h3>
                          <div className="flex items-center gap-2 mt-1">
                            <span className={cn(
                              "text-[8px] font-black px-1.5 py-0.5 rounded uppercase tracking-widest",
                              isDQ ? "bg-red-500/20 text-red-400" : (isActive ? "bg-blue-500/40 text-white" : "bg-accent/20 text-accent")
                            )}>
                              {isDQ ? t.dq : (isActive ? t.active : t.finished)}
                            </span>
                            <span className="text-[8px] text-muted-foreground font-bold uppercase flex items-center gap-1">
                              <Calendar className="w-2 h-2" />
                              {startDate.toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                      </div>
                      {isActive && (
                        <div className="flex items-center gap-1 text-[8px] font-black text-primary animate-pulse">
                          {t.viewLive} <ChevronRight className="w-2 h-2" />
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-4 pt-3 border-t border-white/5 bg-black/20 -mx-4 px-4 pb-1">
                      <div className="space-y-1">
                        <p className="text-[7px] uppercase text-muted-foreground font-black tracking-widest flex items-center gap-1">
                          <Clock className="w-2 h-2" /> {t.start}
                        </p>
                        <p className="text-xs font-mono font-bold text-foreground">
                          {startDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                      <div className="space-y-1 text-right">
                        <p className="text-[7px] uppercase text-muted-foreground font-black tracking-widest flex items-center gap-1 justify-end">
                          {isActive ? (language === 'ru' ? 'В ЭФИРЕ' : 'LIVE') : t.end} {!isActive && <ArrowRight className="w-2 h-2 text-primary" />}
                        </p>
                        <p className="text-xs font-mono font-bold text-foreground">
                          {endDate ? endDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          }).reverse()}
        </div>
      ) : (
        <div className="py-20 flex flex-col items-center justify-center text-center opacity-30">
          <div className="w-20 h-20 rounded-full border-2 border-dashed border-muted-foreground flex items-center justify-center mb-6">
            <History className="w-10 h-10" />
          </div>
          <h2 className="text-xl font-headline font-bold uppercase tracking-tight">{t.noHistory}</h2>
          <p className="text-[10px] uppercase font-bold tracking-[0.2em] mt-2 max-w-[200px]">
            {t.noHistoryDesc}
          </p>
        </div>
      )}
    </div>
  );
}
