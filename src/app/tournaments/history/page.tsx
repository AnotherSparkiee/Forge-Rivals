
'use client';

import { useGameState } from '@/app/lib/store';
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ChevronLeft, History, Trophy, Calendar, AlertCircle, Ban, Clock, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { LoadingScreen } from '@/components/game/LoadingScreen';

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
    start: language === 'ru' ? "НАЧАЛО" : "START",
    end: language === 'ru' ? "КОНЕЦ" : "END"
  };

  const history = profile?.tournamentHistory || [];

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

      {history.length > 0 ? (
        <div className="space-y-3">
          {history.map((record: any, idx: number) => {
            const isDQ = record.status === 'abandoned';
            const startDate = new Date(record.startDate);
            const endDate = new Date(record.endDate);
            
            return (
              <Card key={idx} className={cn(
                "glass-card border-white/5 overflow-hidden transition-all hover:bg-white/5",
                isDQ ? "border-red-500/20 bg-red-500/5" : "border-primary/20 bg-primary/5"
              )}>
                <CardContent className="p-4">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "p-2.5 rounded-xl border",
                        isDQ ? "bg-red-500/20 border-red-500/30 text-red-400" : "bg-primary/20 border-primary/30 text-primary"
                      )}>
                        {isDQ ? <Ban className="w-5 h-5" /> : <Trophy className="w-5 h-5" />}
                      </div>
                      <div>
                        <h3 className="text-sm font-bold uppercase leading-tight">{record.tournamentName}</h3>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={cn(
                            "text-[8px] font-black px-1.5 py-0.5 rounded uppercase tracking-widest",
                            isDQ ? "bg-red-500/20 text-red-400" : "bg-accent/20 text-accent"
                          )}>
                            {isDQ ? t.dq : t.finished}
                          </span>
                          <span className="text-[8px] text-muted-foreground font-bold uppercase flex items-center gap-1">
                            <Calendar className="w-2 h-2" />
                            {startDate.toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    </div>
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
                        {t.end} <ArrowRight className="w-2 h-2 text-primary" />
                      </p>
                      <p className="text-xs font-mono font-bold text-foreground">
                        {endDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
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
