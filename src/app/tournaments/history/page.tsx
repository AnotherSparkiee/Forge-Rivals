
'use client';

import { useGameState } from '@/app/lib/store';
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ChevronLeft, History, Trophy, Calendar, AlertCircle, Ban } from 'lucide-react';
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
    finished: language === 'ru' ? "ЗАВЕРШЕНО" : "FINISHED"
  };

  const history = profile?.tournamentHistory || [];

  return (
    <div className="max-w-md mx-auto px-4 pt-8 pb-24">
      <header className="mb-6 flex items-center gap-4">
        <Link href="/tournaments">
          <Button variant="ghost" size="icon" className="rounded-full"><ChevronLeft className="w-6 h-6" /></Button>
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
            return (
              <Card key={idx} className={cn(
                "glass-card border-white/5 overflow-hidden",
                isDQ ? "border-red-500/20 bg-red-500/5" : "border-primary/20"
              )}>
                <CardContent className="p-4">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center gap-3">
                      <div className={cn("p-2 rounded-lg", isDQ ? "bg-red-500/20" : "bg-primary/20")}>
                        {isDQ ? <Ban className="w-5 h-5 text-red-400" /> : <Trophy className="w-5 h-5 text-primary" />}
                      </div>
                      <div>
                        <h3 className="text-sm font-bold uppercase">{record.tournamentName}</h3>
                        <p className={cn("text-[8px] font-black uppercase tracking-widest", isDQ ? "text-red-400" : "text-accent")}>
                          {isDQ ? t.dq : t.finished}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="flex items-center gap-1 text-[8px] text-muted-foreground font-bold uppercase">
                        <Calendar className="w-2.5 h-2.5" />
                        {new Date(record.startDate).toLocaleDateString()}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 mt-4 pt-3 border-t border-white/5">
                    <div>
                      <p className="text-[7px] uppercase text-muted-foreground font-bold">Начало</p>
                      <p className="text-[10px] font-mono font-bold text-foreground">
                        {new Date(record.startDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[7px] uppercase text-muted-foreground font-bold">Конец</p>
                      <p className="text-[10px] font-mono font-bold text-foreground">
                        {new Date(record.endDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          }).reverse()}
        </div>
      ) : (
        <div className="py-20 text-center opacity-30">
          <History className="w-12 h-12 mx-auto mb-4" />
          <h2 className="text-lg font-headline font-bold uppercase">{t.noHistory}</h2>
          <p className="text-[10px] uppercase font-bold tracking-widest mt-2">{t.noHistoryDesc}</p>
        </div>
      )}
    </div>
  );
}
