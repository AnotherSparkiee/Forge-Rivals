'use client';

import { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUser, useFirestore, useCollection, useMemoFirebase, useDoc } from '@/firebase';
import { useGameState } from '@/app/lib/store';
import { 
  ChevronLeft, Trophy, Shield, Swords, 
  Loader2, Calendar, User,
  AlertTriangle, RefreshCw, Info
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { collection, query, where, doc, limit } from 'firebase/firestore';
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

  const cupQuery = useMemoFirebase(() => {
    if (!selectedLeagueId) return null;
    const sNum = activeSeasonNumber || 1;
    return query(
      collection(db, 'cup_matches'),
      where('leagueId', '==', selectedLeagueId),
      where('seasonNumber', '==', Number(sNum)),
      where('round', '==', Number(activeRound)),
      limit(100) 
    );
  }, [db, selectedLeagueId, activeSeasonNumber, activeRound]);

  const { data: matches, isLoading: isMatchesLoading } = useCollection(cupQuery);

  useEffect(() => {
    if (!isUserLoading && !user) {
      router.push('/auth/login');
    }
  }, [user, isUserLoading, router]);

  const handleInitialize = async () => {
    setIsInitializing(true);
    try {
      await generatePyramidCup();
      toast({ title: language === 'ru' ? "Раунд 1 сгенерирован!" : "Round 1 Generated!" });
    } catch (e) {
      toast({ variant: "destructive", title: "Generation failed" });
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
      final: "Grand Final",
      waiting: "WAITING...",
      bye: "BYES (DIV 1)",
      yourMatch: "YOUR ENGAGEMENT",
      noMatches: "Next round will be generated once the current one finishes.",
      initialize: "INITIATE SEASON 1 (ROUND 1)",
      loading: "Synchronizing Bracket...",
      home: "HOME",
      away: "AWAY",
      formatInfo: "Dynamic seeding: each round is sorted Strong-vs-Weak. Div 1 joins in Round 2."
    },
    ru: {
      title: "КУБОК ПИРАМИДЫ",
      subtitle: "Динамический национальный турнир",
      round: "Раунд",
      final: "Гранд-Финал",
      waiting: "ОЖИДАНИЕ...",
      bye: "ПРОПУСК (ДИВ 1)",
      yourMatch: "ВАШ МАТЧ",
      noMatches: "Следующий раунд будет создан после завершения всех игр текущего.",
      initialize: "ИНИЦИИРОВАТЬ СЕЗОН 1 (РАУНД 1)",
      loading: "Синхронизация сетки...",
      home: "ДОМА",
      away: "В ГОСТЯХ",
      formatInfo: "Динамический посев: каждый раунд сортируется заново (сильный против слабого). Див 1 вступает в R2."
    }
  }[language as 'en' | 'ru'] || { title: "CUP" };

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

      {matches && matches.length > 0 && (
        <Card className="glass-card mb-6 border-primary/20 bg-primary/5">
          <CardContent className="p-4 flex gap-4">
            <Info className="w-5 h-5 text-primary shrink-0" />
            <p className="text-[9px] text-muted-foreground leading-relaxed italic uppercase font-bold tracking-tight">
              {t.formatInfo}
            </p>
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {isMatchesLoading ? (
          <div className="py-20 text-center opacity-50 flex flex-col items-center gap-4">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-[10px] font-black uppercase tracking-widest">{t.loading}</p>
          </div>
        ) : matches && matches.length > 0 ? (
          matches.map((m) => {
            const isMyMatch = m.homeTeamId === user?.uid || m.awayTeamId === user?.uid;
            
            return (
              <Card 
                key={m.cupMatchId} 
                className={cn(
                  "glass-card border-white/5 overflow-hidden transition-all",
                  isMyMatch && "border-primary/40 bg-primary/10 ring-1 ring-primary/20",
                  m.status === 'finished' && "opacity-80"
                )}
              >
                <CardContent className="p-0">
                  {isMyMatch && (
                    <div className="bg-primary/20 px-3 py-1 text-center">
                      <p className="text-[7px] font-black text-primary uppercase tracking-[0.3em]">{t.yourMatch}</p>
                    </div>
                  )}
                  
                  <div className="grid grid-cols-[1fr_50px_1fr] items-center p-4">
                    <div className="text-right space-y-2">
                      <div className="flex justify-end">
                        <div className="w-10 h-10 rounded-xl bg-secondary/50 border border-white/10 flex items-center justify-center">
                          <Shield className="w-6 h-6 text-muted-foreground opacity-30" />
                        </div>
                      </div>
                      <div>
                        <p className="text-[7px] font-black text-muted-foreground uppercase mb-0.5">{t.home}</p>
                        <p className={cn(
                          "text-[11px] font-headline font-bold uppercase truncate italic",
                          m.homeTeamId === user?.uid ? "text-primary" : "text-white"
                        )}>
                          {m.homeTeamId ? 'TEAM ' + m.homeTeamId.slice(0, 5) : t.waiting}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-col items-center justify-center gap-1">
                      {m.status === 'finished' ? (
                        <p className="text-xl font-headline font-black italic text-primary">{m.scoreA}:{m.scoreB}</p>
                      ) : (
                        <div className="bg-background/60 p-1.5 rounded-lg border border-white/5">
                          <Swords className="w-4 h-4 text-accent" />
                        </div>
                      )}
                    </div>

                    <div className="text-left space-y-2">
                      <div className="flex justify-start">
                        <div className="w-10 h-10 rounded-xl bg-secondary/50 border border-white/10 flex items-center justify-center">
                          <Shield className="w-6 h-6 text-muted-foreground opacity-30" />
                        </div>
                      </div>
                      <div>
                        <p className="text-[7px] font-black text-muted-foreground uppercase mb-0.5">{t.away}</p>
                        <p className={cn(
                          "text-[11px] font-headline font-bold uppercase truncate italic",
                          m.awayTeamId === user?.uid ? "text-primary" : "text-white"
                        )}>
                          {m.awayTeamId ? 'TEAM ' + m.awayTeamId.slice(0, 5) : (activeRound === 1 ? t.bye : t.waiting)}
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        ) : (
          <div className="py-12 text-center animate-in fade-in duration-700 flex flex-col items-center">
            {activeRound === 1 ? (
              <>
                <AlertTriangle className="w-12 h-12 text-orange-500 mb-4 opacity-50" />
                <h2 className="text-lg font-headline font-bold uppercase text-white mb-2">{language === 'ru' ? 'КУБОК НЕ НАЧАТ' : 'CUP NOT STARTED'}</h2>
                <Button 
                  className="h-14 px-8 hero-gradient font-black text-xs uppercase tracking-widest shadow-xl mt-6" 
                  onClick={handleInitialize}
                  disabled={isInitializing}
                >
                  {isInitializing ? <RefreshCw className="w-5 h-5 animate-spin mr-2" /> : <RefreshCw className="w-5 h-5 mr-2" />}
                  {t.initialize}
                </Button>
              </>
            ) : (
              <div className="opacity-40 space-y-4">
                <Calendar className="w-12 h-12 mx-auto" />
                <p className="text-[10px] font-black uppercase tracking-[0.2em] px-10 leading-relaxed">
                  {t.noMatches}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
