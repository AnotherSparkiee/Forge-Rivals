'use client';

import { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUser, useFirestore, useCollection, useMemoFirebase, useDoc } from '@/firebase';
import { useGameState } from '@/app/lib/store';
import { 
  ChevronLeft, Trophy, Shield, Swords, 
  Loader2, Target, Calendar, User,
  ChevronRight, Medal, Star, Timer, Info
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { collection, query, where, doc, orderBy, limit } from 'firebase/firestore';
import { LoadingScreen } from '@/components/game/LoadingScreen';
import { cn } from '@/lib/utils';

const TOTAL_ROUNDS = 12;

export default function PyramidCupPage() {
  const { user, isUserLoading } = useUser();
  const router = useRouter();
  const db = useFirestore();
  const { language, isLoaded, selectedLeagueId, activeSeasonNumber } = useGameState();
  
  const [activeRound, setActiveRound] = useState(1);

  // 1. Подгружаем все матчи текущей лиги для выбранного раунда
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

  // 2. Подгружаем профиль игрока для подсветки его матчей
  const userRef = useMemoFirebase(() => user ? doc(db, 'players_v10', user.uid) : null, [db, user]);
  const { data: profile } = useDoc(userRef);

  useEffect(() => {
    if (!isUserLoading && !user) {
      router.push('/auth/login');
    }
  }, [user, isUserLoading, router]);

  if (isUserLoading || !isLoaded || !user) {
    return <LoadingScreen />;
  }

  const t = {
    en: {
      title: "PYRAMID CUP",
      subtitle: "National Single-Elimination Tournament",
      round: "Round",
      final: "Grand Final",
      waiting: "WAITING...",
      bye: "BYE (DIV 1)",
      yourMatch: "YOUR ENGAGEMENT",
      noMatches: "No matches found for this round.",
      loading: "Synchronizing Bracket...",
      home: "HOME",
      away: "AWAY",
      formatInfo: "Stronger teams play away. Division 1 enters at Round 2."
    },
    ru: {
      title: "КУБОК ПИРАМИДЫ",
      subtitle: "Национальный турнир на выбывание",
      round: "Раунд",
      final: "Гранд-Финал",
      waiting: "ОЖИДАНИЕ...",
      bye: "ПРОПУСК (ДИВ 1)",
      yourMatch: "ВАШ МАТЧ",
      noMatches: "Матчи для этого раунда не найдены.",
      loading: "Синхронизация сетки...",
      home: "ДОМА",
      away: "В ГОСТЯХ",
      formatInfo: "Сильные команды играют в гостях. Див 1 вступает со 2-го раунда."
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

      {/* ROUND SELECTOR */}
      <div className="mb-8 overflow-x-auto scrollbar-hide -mx-4 px-4 py-2">
        <div className="flex gap-2 min-w-max">
          {Array.from({ length: TOTAL_ROUNDS }, (_, i) => i + 1).map((r) => (
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
              {r === TOTAL_ROUNDS ? t.final : `${t.round} ${r}`}
            </Button>
          ))}
        </div>
      </div>

      {/* INFO CARD */}
      <Card className="glass-card mb-6 border-primary/20 bg-primary/5">
        <CardContent className="p-4 flex gap-4">
          <Info className="w-5 h-5 text-primary shrink-0" />
          <p className="text-[9px] text-muted-foreground leading-relaxed italic uppercase font-bold tracking-tight">
            {t.formatInfo}
          </p>
        </CardContent>
      </Card>

      {/* MATCH LIST */}
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
                  isMyMatch && "border-primary/40 bg-primary/10 ring-1 ring-primary/20 shadow-[0_0_20px_rgba(var(--primary),0.1)]",
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
                    {/* HOME TEAM */}
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

                    {/* VS / SCORE */}
                    <div className="flex flex-col items-center justify-center gap-1">
                      {m.status === 'finished' ? (
                        <p className="text-xl font-headline font-black italic text-primary">{m.scoreA}:{m.scoreB}</p>
                      ) : (
                        <div className="bg-background/60 p-1.5 rounded-lg border border-white/5">
                          <Swords className="w-4 h-4 text-accent" />
                        </div>
                      )}
                    </div>

                    {/* AWAY TEAM */}
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

                  <div className="bg-black/20 px-4 py-2 border-t border-white/5 flex justify-between items-center">
                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-3 h-3 text-muted-foreground" />
                      <span className="text-[9px] font-mono font-bold text-muted-foreground">
                        {new Date(m.date).toLocaleDateString()}
                      </span>
                    </div>
                    {m.winnerId && (
                      <Badge className="bg-green-600/20 text-green-400 text-[8px] font-black h-4 px-2 border-none">
                        WINNER SECURED
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })
        ) : (
          <div className="py-20 text-center opacity-30 flex flex-col items-center gap-4 border-2 border-dashed border-white/5 rounded-3xl p-10">
            <Medal className="w-16 h-16" />
            <p className="text-xs font-black uppercase tracking-widest">Нет матчей в Раунде {activeRound}</p>
          </div>
        )}
      </div>
    </div>
  );
}
