
'use client';

import { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { useGameState } from '@/app/lib/store';
import { 
  ChevronLeft, Trophy, Shield, Swords, 
  Loader2, Info, RefreshCw, AlertTriangle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { collection, query, where, limit, orderBy } from 'firebase/firestore';
import { LoadingScreen } from '@/components/game/LoadingScreen';
import { cn } from '@/lib/utils';
import { generatePyramidCup } from '@/app/actions/cup-engine';
import { useToast } from '@/hooks/use-toast';

const MAX_CUP_ROUNDS = 12;

export default function PyramidCupPage() {
  const { user, isUserLoading } = useUser();
  const router = useRouter();
  const db = useFirestore();
  const { toast } = useToast();
  const { language, isLoaded, selectedLeagueId, activeSeasonNumber } = useGameState();
  
  const [activeRound, setActiveRound] = useState(1);
  const [isInitializing, setIsInitializing] = useState(false);

  // ГИБКИЙ ЗАПРОС: Ищем по leagueId, раунду и текущему сезону.
  const cupQuery = useMemoFirebase(() => {
    if (!selectedLeagueId) return null;
    return query(
      collection(db, 'cup_matches'),
      where('leagueId', '==', selectedLeagueId),
      where('round', '==', Number(activeRound)),
      where('seasonNumber', '==', Number(activeSeasonNumber)),
      limit(200)
    );
  }, [db, selectedLeagueId, activeRound, activeSeasonNumber]);

  const { data: rawMatches, isLoading: isMatchesLoading } = useCollection(cupQuery);

  const matches = useMemo(() => {
    if (!rawMatches) return [];
    return [...rawMatches].sort((a, b) => {
      const numA = parseInt(a.cupMatchId?.split('match_')[1] || '0');
      const numB = parseInt(b.cupMatchId?.split('match_')[1] || '0');
      return numA - numB;
    });
  }, [rawMatches]);

  useEffect(() => {
    if (!isUserLoading && !user) {
      router.push('/auth/login');
    }
  }, [user, isUserLoading, router]);

  const handleInitialize = async () => {
    setIsInitializing(true);
    try {
      await generatePyramidCup(activeSeasonNumber);
      toast({ title: language === 'ru' ? "Сетка сгенерирована!" : "Bracket Generated!" });
    } catch (e) {
      console.error(e);
      toast({ variant: "destructive", title: "Error" });
    } finally {
      setIsInitializing(false);
    }
  };

  if (isUserLoading || !isLoaded || !user) {
    return <LoadingScreen />;
  }

  const t = {
    en: {
      title: "PYRAMID CUP",
      subtitle: "Dynamic National Knockout Stage",
      round: "Round",
      final: "Final",
      waiting: "TBD",
      yourMatch: "YOUR ENGAGEMENT",
      initialize: "INITIALIZE TOURNAMENT BRACKET",
      loading: "Scanning Frequencies...",
      empty: "Tournament bracket not detected.",
      formatInfo: "Universal Data Sync v11. TBD Auto-win mode active."
    },
    ru: {
      title: "КУБОК ПИРАМИДЫ",
      subtitle: "Динамический национальный турнир",
      round: "Раунд",
      final: "Финал",
      waiting: "TBD",
      yourMatch: "ВАШ МАТЧ",
      initialize: "ПРИНУДИТЕЛЬНО СОЗДАТЬ СЕТКУ",
      loading: "Сканирование эфира...",
      empty: "Сетка турнира не обнаружена.",
      formatInfo: "Синхронизация v11. Режим авто-победы TBD включен."
    }
  }[language as 'en' | 'ru'];

  return (
    <div className="max-w-md mx-auto px-4 pt-8 pb-24">
      <header className="mb-6 flex items-center gap-4">
        <Link href="/tournaments">
          <Button variant="ghost" size="icon" className="rounded-full border border-white/5">
            <ChevronLeft className="w-6 h-6" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-headline font-bold uppercase tracking-tighter text-white flex items-center gap-2">
            <Trophy className="w-6 h-6 text-yellow-500" />
            {t.title}
          </h1>
          <p className="text-muted-foreground text-[10px] uppercase tracking-widest">{t.subtitle}</p>
        </div>
      </header>

      <div className="mb-8 overflow-x-auto scrollbar-hide -mx-4 px-4 py-2">
        <div className="flex gap-2 min-w-max">
          {Array.from({ length: MAX_CUP_ROUNDS }, (_, i) => i + 1).map((r) => (
            <Button
              key={r}
              variant={activeRound === r ? "default" : "outline"}
              size="sm"
              onClick={() => setActiveRound(r)}
              className={cn(
                "h-10 px-6 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all",
                activeRound === r ? "hero-gradient border-none shadow-lg shadow-primary/20" : "bg-secondary/20 border-white/5 text-muted-foreground"
              )}
            >
              {r === MAX_CUP_ROUNDS ? t.final : `${t.round} ${r}`}
            </Button>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        {isMatchesLoading ? (
          <div className="py-20 text-center opacity-50 flex flex-col items-center gap-4">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-[10px] font-black uppercase tracking-widest">{t.loading}</p>
          </div>
        ) : matches.length > 0 ? (
          <>
            <Card className="glass-card mb-4 border-accent/20 bg-accent/5">
              <CardContent className="p-3 flex gap-3">
                <Info className="w-4 h-4 text-accent shrink-0" />
                <p className="text-[8px] text-muted-foreground font-black uppercase leading-tight">{t.formatInfo}</p>
              </CardContent>
            </Card>
            
            {matches.map((m) => {
              const isMyMatch = m.homeTeamId === user?.uid || m.awayTeamId === user?.uid;
              const isFinished = m.status === 'finished' || m.isFinished;
              const homeName = m.homeTeamName || m.homeTeamId?.slice(0, 8) || t.waiting;
              const awayName = m.awayTeamName || m.awayTeamId?.slice(0, 8) || t.waiting;
              
              return (
                <Card 
                  key={m.cupMatchId} 
                  className={cn(
                    "glass-card border-white/5 overflow-hidden transition-all",
                    isMyMatch && "border-primary/40 bg-primary/10 ring-1 ring-primary/20",
                    isFinished && "opacity-80"
                  )}
                >
                  <CardContent className="p-4">
                    {isMyMatch && <p className="text-[7px] font-black text-primary uppercase text-center mb-3 tracking-[0.2em]">{t.yourMatch}</p>}
                    <div className="grid grid-cols-[1fr_50px_1fr] items-center">
                      <div className="text-right">
                        <p className={cn("text-[10px] font-bold uppercase truncate", m.homeTeamId === user?.uid ? "text-primary" : "text-white")}>
                          {homeName}
                        </p>
                        <span className="text-[7px] text-muted-foreground uppercase font-black">HOME</span>
                      </div>
                      <div className="flex flex-col items-center">
                        {isFinished ? (
                          <span className="text-sm font-headline font-black text-primary">{m.scoreA || 0}:{m.scoreB || 0}</span>
                        ) : (
                          <Swords className="w-4 h-4 text-accent" />
                        )}
                      </div>
                      <div className="text-left">
                        <p className={cn("text-[10px] font-bold uppercase truncate", m.awayTeamId === user?.uid ? "text-primary" : "text-white")}>
                          {awayName}
                        </p>
                        <span className="text-[7px] text-muted-foreground uppercase font-black">AWAY</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </>
        ) : (
          <div className="py-20 text-center animate-in fade-in duration-700 flex flex-col items-center">
            <AlertTriangle className="w-12 h-12 text-orange-500 mb-4 opacity-50" />
            <h2 className="text-lg font-headline font-bold uppercase text-white mb-2">{t.empty}</h2>
            <Button 
              className="h-14 px-8 hero-gradient font-black text-xs uppercase tracking-widest shadow-xl mt-6" 
              onClick={handleInitialize}
              disabled={isInitializing}
            >
              {isInitializing ? <RefreshCw className="w-5 h-5 animate-spin mr-2" /> : <RefreshCw className="w-5 h-5 mr-2" />}
              {t.initialize}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
