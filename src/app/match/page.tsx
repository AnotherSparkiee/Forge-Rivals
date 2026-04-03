
'use client';

import { useState, useEffect, useMemo, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { useGameState } from '../lib/store';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { 
  ChevronLeft, Timer, User, Star, Check, X, 
  Swords, Skull, Crosshair, FileText, Activity,
  Trophy, Users, Signal
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn, formatCurrency } from '@/lib/utils';
import Link from 'next/link';
import { LoadingScreen } from '@/components/game/LoadingScreen';
import { doc } from 'firebase/firestore';
import { COUNTRIES } from '../lib/countries-data';

function MatchContent() {
  const { user, isUserLoading } = useUser();
  const router = useRouter();
  const searchParams = useSearchParams();
  const db = useFirestore();
  const { 
    language, isLoaded, lastSeenMatchDay, markMatchAsSeen, 
    matchHistory, arena, credits
  } = useGameState();

  const matchId = searchParams.get('id');

  const userRef = useMemoFirebase(() => user ? doc(db, 'players_v5', user.uid) : null, [db, user]);
  const { data: profile } = useDoc(userRef);

  useEffect(() => {
    if (!isUserLoading && !user) {
      router.push('/auth/login');
    }
  }, [user, isUserLoading, router]);

  const currentResult = useMemo(() => {
    if (matchId) {
      return matchHistory.find(m => m.id === matchId) || null;
    }
    return [...matchHistory]
      .filter(m => m.day > lastSeenMatchDay)
      .sort((a, b) => a.day - b.day)[0] || (matchHistory.length > 0 ? matchHistory[0] : null);
  }, [matchHistory, lastSeenMatchDay, matchId]);

  const isHistoricalViewing = !!matchId;

  if (isUserLoading || !isLoaded || !user) {
    return <LoadingScreen />;
  }

  const handleAcknowledgeMatch = () => {
    if (currentResult && !isHistoricalViewing) {
      markMatchAsSeen(currentResult.day);
      router.push('/');
    } else {
      router.push('/matches');
    }
  };

  const userCountry = COUNTRIES.find(c => c.name === profile?.country);
  const myFlag = userCountry?.flag || '🏳️';

  const labels = {
    en: {
      reportTitle: "TACTICAL AFTER-ACTION REPORT",
      league: "Regional League",
      friendly: "Friendly Engagement",
      tournament: "Pyramid Cup",
      basket: "CW Basket Match",
      round: "Matchday",
      summary: "Operational Analysis",
      mvp: "UNIT MVP",
      duration: "TIME ELAPSED",
      accept: "CONFIRM",
      back: "EXIT",
      noHistory: "No mission logs detected.",
      kills: "Eliminations",
      towers: "Structures",
      spectators: "Audience",
      connection: "Link Quality"
    },
    ru: {
      reportTitle: "ТАКТИЧЕСКИЙ ОТЧЕТ ПОСЛЕ БОЯ",
      league: "Региональная Лига",
      friendly: "Товарищеский Бой",
      tournament: "Кубок Пирамиды",
      basket: "КВ Корзина",
      round: "Игровой день",
      summary: "Оперативный анализ",
      mvp: "ЛУЧШИЙ ИГРОК",
      duration: "ВРЕМЯ ОПЕРАЦИИ",
      accept: "ПОДТВЕРДИТЬ",
      back: "ВЫЙТИ",
      noHistory: "Логи миссий не обнаружены.",
      kills: "Убийства",
      towers: "Объекты",
      spectators: "Зрители",
      connection: "Качество связи"
    }
  };

  const t = labels[language as keyof typeof labels] || labels.ru;

  const spectators = currentResult?.type === 'league' ? arena.capacity : Math.floor(Math.random() * 5000) + 1000;

  const getMatchTime = (iso: string) => {
    if (!iso) return "--.--.---- --:--";
    const d = new Date(iso);
    return d.toLocaleString(language === 'ru' ? 'ru-RU' : 'en-US', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  };

  return (
    <div className="min-h-screen bg-background text-foreground pb-32">
      {/* Background Grid Overlay */}
      <div className="fixed inset-0 pointer-events-none opacity-5 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:30px_30px]"></div>

      <div className="max-w-md mx-auto relative z-10 px-4 pt-6">
        {!currentResult ? (
          <div className="py-20 text-center space-y-6">
            <Activity className="w-16 h-16 mx-auto opacity-20 text-primary" />
            <p className="text-xs font-black uppercase tracking-[0.3em] text-muted-foreground">{t.noHistory}</p>
            <Button variant="outline" className="border-white/10" onClick={() => router.back()}>
              {t.back}
            </Button>
          </div>
        ) : (
          <div className="space-y-6">
            
            {/* TOP HEADER */}
            <div className="text-center space-y-1">
              <Badge variant="outline" className="bg-primary/5 border-primary/20 text-primary text-[8px] font-black uppercase tracking-[0.2em] px-3">
                {currentResult.type === 'league' ? t.league : 
                 currentResult.type === 'tournament' ? t.tournament : 
                 currentResult.type === 'basket' ? t.basket : t.friendly}
              </Badge>
              <h1 className="text-sm font-headline font-bold text-white uppercase tracking-tighter pt-2">
                {t.reportTitle}
              </h1>
              <p className="text-[10px] font-mono text-muted-foreground uppercase opacity-60">
                {getMatchTime(currentResult.playedAt)} | {t.round} {currentResult.day > 0 ? currentResult.day : 'Final'}
              </p>
            </div>

            {/* MAIN SCOREBOARD */}
            <Card className="glass-card border-primary/20 bg-gradient-to-b from-primary/10 to-transparent overflow-hidden">
              <CardContent className="p-0">
                <div className="grid grid-cols-3 items-center p-8">
                  {/* TEAM A */}
                  <div className="flex flex-col items-center gap-3 text-center min-w-0">
                    <div className="w-14 h-14 rounded-2xl bg-secondary/50 border border-white/5 flex items-center justify-center shadow-xl">
                      <span className="text-3xl">{myFlag}</span>
                    </div>
                    <p className="text-[10px] font-headline font-bold uppercase truncate w-full text-white">
                      {profile?.displayName || "MY TEAM"}
                    </p>
                  </div>

                  {/* SCORE */}
                  <div className="flex flex-col items-center justify-center gap-1">
                    <div className="flex items-center gap-4 text-5xl font-headline font-black italic tracking-tighter">
                      <span className={cn(currentResult.scoreA > currentResult.scoreB ? "text-primary drop-shadow-[0_0_15px_rgba(var(--primary),0.5)]" : "text-white")}>
                        {currentResult.scoreA}
                      </span>
                      <span className="text-muted-foreground/30 font-light">:</span>
                      <span className={cn(currentResult.scoreB > currentResult.scoreA ? "text-primary drop-shadow-[0_0_15px_rgba(var(--primary),0.5)]" : "text-white")}>
                        {currentResult.scoreB}
                      </span>
                    </div>
                    <Badge className={cn(
                      "mt-4 text-[8px] font-black tracking-widest",
                      currentResult.scoreA > currentResult.scoreB ? "bg-green-500/20 text-green-400" : (currentResult.scoreA === currentResult.scoreB ? "bg-accent/20 text-accent" : "bg-red-500/20 text-red-400")
                    )}>
                      {currentResult.scoreA > currentResult.scoreB ? "VICTORY" : (currentResult.scoreA === currentResult.scoreB ? "DRAW" : "DEFEAT")}
                    </Badge>
                  </div>

                  {/* TEAM B */}
                  <div className="flex flex-col items-center gap-3 text-center min-w-0">
                    <div className="w-14 h-14 rounded-2xl bg-secondary/50 border border-white/5 flex items-center justify-center shadow-xl">
                      <span className="text-3xl">🏳️</span>
                    </div>
                    <p className="text-[10px] font-headline font-bold uppercase truncate w-full text-white">
                      {currentResult.opponentName}
                    </p>
                  </div>
                </div>

                <div className="border-t border-white/5 bg-black/20 grid grid-cols-2 divide-x divide-white/5">
                  <div className="p-3 flex items-center justify-center gap-2">
                    <Users className="w-3.5 h-3.5 text-accent" />
                    <span className="text-[9px] font-black uppercase text-muted-foreground">{t.spectators}: <span className="text-white">{spectators.toLocaleString()}</span></span>
                  </div>
                  <div className="p-3 flex items-center justify-center gap-2">
                    <Signal className="w-3.5 h-3.5 text-primary" />
                    <span className="text-[9px] font-black uppercase text-muted-foreground">{t.connection}: <span className="text-white">LINK_OK</span></span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* STATS GRID */}
            <div className="grid grid-cols-2 gap-3">
              <Card className="glass-card bg-secondary/20 border-white/5">
                <CardContent className="p-4 flex flex-col items-center gap-1 text-center">
                  <p className="text-[8px] font-black text-muted-foreground uppercase tracking-widest">{t.mvp}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="p-1.5 rounded-lg bg-yellow-500/10">
                      <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                    </div>
                    <span className="text-xs font-bold text-white uppercase truncate max-w-[100px]">{currentResult.mvp || 'UNKNOWN'}</span>
                  </div>
                </CardContent>
              </Card>
              <Card className="glass-card bg-secondary/20 border-white/5">
                <CardContent className="p-4 flex flex-col items-center gap-1 text-center">
                  <p className="text-[8px] font-black text-muted-foreground uppercase tracking-widest">{t.duration}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="p-1.5 rounded-lg bg-primary/10">
                      <Timer className="w-4 h-4 text-primary" />
                    </div>
                    <span className="text-sm font-mono font-bold text-white">{currentResult.duration || '34:12'}</span>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* COMBAT STATS */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-secondary/30 rounded-xl p-4 border border-white/5 flex items-center justify-between">
                <div className="flex flex-col">
                  <span className="text-[8px] font-black text-red-400 uppercase tracking-widest">{t.kills}</span>
                  <span className="text-2xl font-headline font-black italic">{currentResult.teamStats?.teamA?.kills || 0}</span>
                </div>
                <Skull className="w-6 h-6 text-red-400/20" />
              </div>
              <div className="bg-secondary/30 rounded-xl p-4 border border-white/5 flex items-center justify-between">
                <div className="flex flex-col">
                  <span className="text-[8px] font-black text-accent uppercase tracking-widest">{t.towers}</span>
                  <span className="text-2xl font-headline font-black italic">{currentResult.teamStats?.teamA?.towersDestroyed || 0}</span>
                </div>
                <Crosshair className="w-6 h-6 text-accent/20" />
              </div>
            </div>

            {/* AI DATA DECRYPTION */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 px-1">
                <FileText className="w-4 h-4 text-primary" />
                <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">{t.summary}</h3>
              </div>
              <Card className="glass-card border-primary/10 bg-primary/5 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-0.5 bg-primary/20 animate-pulse"></div>
                <CardContent className="p-6">
                  <div className="max-h-[30vh] overflow-y-auto scrollbar-hide">
                    <p className="text-xs leading-relaxed text-blue-100 italic whitespace-pre-wrap font-medium opacity-80">
                      {currentResult.matchSummary}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </div>

      {/* FIXED ACTION FOOTER */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-background/90 backdrop-blur-xl border-t border-white/10 h-24 flex items-center shadow-[0_-15px_40px_rgba(0,0,0,0.6)]">
        <div className="w-full max-w-lg mx-auto px-6 flex items-center justify-between gap-4">
          
          <div className="flex-1 flex flex-col gap-1">
            <p className="text-[8px] font-black text-muted-foreground uppercase tracking-widest">MISSION EARNINGS</p>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
              <span className="text-lg font-headline font-bold text-white tracking-tight">€ {formatCurrency(credits)}</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button 
              onClick={() => router.back()}
              variant="outline"
              className="h-12 px-6 border-white/10 hover:bg-white/5 font-black text-[10px] uppercase tracking-widest"
            >
              {t.back}
            </Button>
            <Button 
              onClick={handleAcknowledgeMatch}
              className="h-12 px-8 hero-gradient border-none font-black text-[10px] uppercase tracking-widest shadow-lg shadow-primary/20"
            >
              <Check className="w-4 h-4 mr-2" />
              {t.accept}
            </Button>
          </div>

        </div>
      </div>
    </div>
  );
}

export default function MatchPage() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <MatchContent />
    </Suspense>
  );
}
