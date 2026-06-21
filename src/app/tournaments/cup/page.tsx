
'use client';

/**
 * @fileOverview Терминал Кубка v41.5. Прямое отображение сетки без промежуточных кнопок.
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { useGameState } from '@/app/lib/store';
import { 
  ChevronLeft, Trophy, Swords, Loader2, Medal
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import Link from 'next/link';
import { doc } from 'firebase/firestore';
import { LoadingScreen } from '@/components/game/LoadingScreen';
import { cn } from '@/lib/utils';

export default function PyramidCupPage() {
  const { user, isUserLoading } = useUser();
  const router = useRouter();
  const db = useFirestore();
  const { language, isLoaded, selectedLeagueId, activeSeasonNumber, isDataReady } = useGameState();
  
  const [activeRound, setActiveRound] = useState('r1');

  const cupDocId = `cup_s${activeSeasonNumber}_l${selectedLeagueId}`;
  const cupRef = useMemoFirebase(() => selectedLeagueId ? doc(db, 'cup_pyramid_v1', cupDocId) : null, [db, cupDocId, selectedLeagueId]);
  const { data: cupData, isLoading: isCupLoading } = useDoc(cupRef);

  useEffect(() => {
    if (!isUserLoading && !user) router.push('/auth/login');
  }, [user, isUserLoading, router]);

  if (isUserLoading || !isLoaded || !user || !isDataReady) return <LoadingScreen />;

  const t = {
    en: {
      title: "PYRAMID CUP",
      subtitle: "Full Tournament Bracket",
      round: "Round",
      final: "Final",
      waiting: "TBD",
      noGrid: "Bracket Pending",
      noGridDesc: "Syncing data with league server v41...",
    },
    ru: {
      title: "КУБОК ПИРАМИДЫ",
      subtitle: "Полная сетка турнира",
      round: "Раунд",
      final: "Финал",
      waiting: "TBD",
      noGrid: "Сетка формируется",
      noGridDesc: "Синхронизация данных с сервером лиги v41...",
    }
  }[language as 'en' | 'ru'] || { title: "Cup" };

  const matches = cupData?.rounds?.[activeRound] || [];

  return (
    <div className="max-w-md mx-auto px-4 pt-8 pb-24">
      <header className="mb-6 flex items-center gap-4">
        <Link href="/">
          <Button variant="ghost" size="icon" className="rounded-full border border-white/5 bg-secondary/50">
            <ChevronLeft className="w-6 h-6" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-headline font-bold uppercase tracking-tighter text-white flex items-center gap-2 leading-none">
            <Trophy className="w-6 h-6 text-yellow-500" />
            {t.title}
          </h1>
          <p className="text-muted-foreground text-[10px] uppercase tracking-widest mt-1">
            {selectedLeagueId} SEASON {activeSeasonNumber}
          </p>
        </div>
      </header>

      {isCupLoading ? (
        <div className="py-20 text-center opacity-50"><Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" /></div>
      ) : cupData ? (
        <>
          <div className="mb-6 overflow-x-auto scrollbar-hide -mx-4 px-4">
            <div className="flex gap-2 min-w-max">
              {['r1', 'r2', 'r3', 'r4', 'r5'].map((r, i) => (
                <Button
                  key={r}
                  variant={activeRound === r ? "default" : "outline"}
                  size="sm"
                  onClick={() => setActiveRound(r)}
                  className={cn(
                    "h-10 px-6 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all",
                    activeRound === r ? "hero-gradient border-none" : "bg-secondary/20 border-white/5"
                  )}
                >
                  {i === 4 ? t.final : `${t.round} ${i + 1}`}
                </Button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            {matches.length > 0 ? matches.map((m: any, idx: number) => {
              const isMyMatch = m.home?.id === user.uid || m.away?.id === user.uid;
              return (
                <Card key={idx} className={cn("glass-card border-white/5 overflow-hidden", isMyMatch && "border-primary/50 bg-primary/10 shadow-[0_0_15px_rgba(var(--primary),0.1)]")}>
                  <CardContent className="p-3">
                    <div className="grid grid-cols-[1fr_40px_1fr] items-center">
                      <div className="text-right truncate"><p className={cn("text-[10px] font-bold uppercase", m.home?.id === user.uid ? "text-primary" : "text-white")}>{m.home?.name || t.waiting}</p></div>
                      <div className="flex justify-center">{m.scoreA !== null ? <span className="text-sm font-headline font-black">{m.scoreA}:{m.scoreB}</span> : <Swords className="w-3.5 h-3.5 text-accent/40 mx-auto" />}</div>
                      <div className="text-left truncate"><p className={cn("text-[10px] font-bold uppercase", m.away?.id === user.uid ? "text-primary" : "text-white")}>{m.away?.name || t.waiting}</p></div>
                    </div>
                  </CardContent>
                </Card>
              );
            }) : (
              <div className="py-20 text-center opacity-30 border border-dashed border-white/5 rounded-3xl p-10 mt-4 flex flex-col items-center gap-4">
                <Medal className="w-12 h-12" />
                <p className="text-[10px] uppercase font-black tracking-widest">Awaiting Battle Sequence</p>
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="py-20 text-center animate-in fade-in duration-700 flex flex-col items-center">
          <Medal className="w-12 h-12 text-orange-500 mb-4 opacity-50" />
          <h2 className="text-lg font-headline font-bold uppercase text-white mb-2">{t.noGrid}</h2>
          <p className="text-[10px] text-muted-foreground uppercase px-10 italic">"{t.noGridDesc}"</p>
        </div>
      )}
    </div>
  );
}
