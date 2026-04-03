
'use client';

import { useState, useEffect, useMemo, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useUser } from '@/firebase';
import { useGameState } from '../lib/store';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Swords, Trophy, Skull, Crosshair, ChevronLeft, CalendarClock, ShieldAlert, Timer, User, Star } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { LoadingScreen } from '@/components/game/LoadingScreen';

function MatchContent() {
  const { user, isUserLoading } = useUser();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { language, isLoaded, lastSeenMatchDay, markMatchAsSeen, matchHistory } = useGameState();

  const matchId = searchParams.get('id');

  useEffect(() => {
    if (!isUserLoading && !user) {
      router.push('/auth/login');
    }
  }, [user, isUserLoading, router]);

  // If a specific match ID is provided, find it in history.
  // Otherwise, find the oldest unseen match.
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
    }
  };

  const labels = {
    en: {
      title: isHistoricalViewing ? "MATCH REPLAY" : "MATCH REVIEW",
      subtitle: isHistoricalViewing ? "Historical data retrieval" : "Tactical match analytics",
      lastReport: isHistoricalViewing ? "ARCHIVED RECORD" : (currentResult && currentResult.day > lastSeenMatchDay ? "PENDING TRANSMISSION" : "LATEST MATCH REPORT"),
      noHistory: "No match reports found.",
      noHistoryDesc: "Synchronize with league server to receive tactical data.",
      summary: "Strategic Analysis",
      victory: "VICTORY",
      draw: "DRAW",
      defeat: "DEFEAT",
      return: "RETURN TO HUB",
      nextReport: "VIEW NEXT REPORT",
      viewAll: "ALL REPORTS VIEWED",
      closeReplay: "CLOSE REPLAY",
      mvp: "MVP OF THE MATCH",
      duration: "MATCH DURATION"
    },
    ru: {
      title: isHistoricalViewing ? "ПЕРЕСМОТР МАТЧА" : "ОБЗОР МАТЧЕЙ",
      subtitle: isHistoricalViewing ? "Просмотр архивных данных" : "Тактическая аналитика игр",
      lastReport: isHistoricalViewing ? "АРХИВНАЯ ЗАПИСЬ" : (currentResult && currentResult.day > lastSeenMatchDay ? "ОЖИДАЮЩАЯ ПЕРЕДАЧА" : "ОТЧЕТ ПОСЛЕДНЕГО МАТЧА"),
      noHistory: "Отчеты не найдены.",
      noHistoryDesc: "Дождитесь синхронизации с сервером лиги для получения данных.",
      summary: "Стратегический анализ",
      victory: "ПОБЕДА",
      draw: "НИЧЬЯ",
      defeat: "ПОРАЖЕНИЕ",
      return: "В ГЛАВНЫЙ ХАБ",
      nextReport: "СЛЕДУЮЩИЙ ОТЧЕТ",
      viewAll: "ВСЕ ОТЧЕТЫ ПРОСМОТРЕНЫ",
      closeReplay: "ЗАКРЫТЬ ПОВТОР",
      mvp: "MVP МАТЧА",
      duration: "ДЛИТЕЛЬНОСТЬ"
    }
  };

  const t = labels[language as keyof typeof labels] || labels.ru;

  return (
    <div className="max-w-md mx-auto px-4 pt-8 pb-12">
      <header className="mb-6 flex items-center gap-4">
        <Link href={isHistoricalViewing ? "/matches" : "/"}>
          <Button variant="ghost" size="icon" className="rounded-full">
            <ChevronLeft className="w-6 h-6" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-headline font-bold uppercase tracking-tighter">{t.title}</h1>
          <p className="text-muted-foreground text-[10px] uppercase tracking-widest">{t.subtitle}</p>
        </div>
      </header>

      {/* NO MATCHES VIEW */}
      {!currentResult && (
        <div className="flex flex-col items-center justify-center py-20 text-center space-y-4 animate-in fade-in duration-500">
          <ShieldAlert className="w-16 h-16 text-muted-foreground opacity-20" />
          <div>
            <h2 className="text-xl font-headline font-bold uppercase">{t.noHistory}</h2>
            <p className="text-xs text-muted-foreground mt-2 max-w-[200px] mx-auto leading-relaxed">
              {t.noHistoryDesc}
            </p>
          </div>
          <Link href="/" className="pt-4">
            <Button variant="outline" className="text-[10px] font-bold uppercase border-white/10 px-8">
              {t.return}
            </Button>
          </Link>
        </div>
      )}

      {/* REPORT VIEW */}
      {currentResult && (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="flex items-center justify-between mb-4 px-1">
            <div className="flex flex-col">
              <h2 className={cn(
                "text-xs font-bold uppercase tracking-widest flex items-center gap-2",
                !isHistoricalViewing && currentResult.day > lastSeenMatchDay ? "text-red-400" : "text-accent"
              )}>
                <CalendarClock className="w-4 h-4" /> {t.lastReport}
              </h2>
              <p className="text-[8px] text-muted-foreground uppercase font-bold mt-1">
                {currentResult.type === 'friendly' ? 
                  (language === 'ru' ? 'ТОВАРИЩЕСКИЙ МАТЧ' : 'FRIENDLY MATCH') : 
                  (language === 'ru' ? `День сезона: ${currentResult.day}` : `Season Day: ${currentResult.day}`)}
              </p>
            </div>
            {isHistoricalViewing && (
              <Badge variant="outline" className="text-[8px] border-accent/20 text-accent font-mono">
                ID: {currentResult.id.slice(-8).toUpperCase()}
              </Badge>
            )}
          </div>

          <div className={cn(
            "rounded-xl p-6 text-center mb-6 border transition-all",
            currentResult.scoreA > currentResult.scoreB ? "bg-primary/10 border-primary/50" : (currentResult.scoreA === currentResult.scoreB ? "bg-accent/10 border-accent/20" : "bg-destructive/10 border-destructive/50")
          )}>
            <Trophy className={cn("w-16 h-16 mx-auto mb-3", currentResult.scoreA > currentResult.scoreB ? "text-primary" : "text-muted-foreground")} />
            <h2 className="text-3xl font-headline font-bold mb-1">
              {currentResult.scoreA > currentResult.scoreB ? t.victory : (currentResult.scoreA === currentResult.scoreB ? t.draw : t.defeat)}
            </h2>
            <div className="flex items-center justify-center gap-4 text-3xl font-headline font-bold my-2">
              <span className={cn(currentResult.scoreA > currentResult.scoreB && "text-primary")}>{currentResult.scoreA}</span>
              <span className="opacity-30">:</span>
              <span className={cn(currentResult.scoreB > currentResult.scoreA && "text-red-400")}>{currentResult.scoreB}</span>
            </div>
            <p className="text-[10px] opacity-80 uppercase tracking-widest font-bold">
              {currentResult.winner === "Draw" ? "Equal Performance" : `${currentResult.winner} DOMINATION`}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-6">
            <Card className="glass-card border-accent/20 bg-accent/5">
              <CardContent className="p-4 flex flex-col items-center gap-1">
                <p className="text-[8px] font-black text-muted-foreground uppercase tracking-widest">{t.mvp}</p>
                <div className="flex items-center gap-2 mt-1">
                  <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
                  <span className="text-xs font-bold text-white uppercase truncate max-w-[120px]">{currentResult.mvp || 'UNKNOWN'}</span>
                </div>
              </CardContent>
            </Card>
            <Card className="glass-card border-primary/20 bg-primary/5">
              <CardContent className="p-4 flex flex-col items-center gap-1">
                <p className="text-[8px] font-black text-muted-foreground uppercase tracking-widest">{t.duration}</p>
                <div className="flex items-center gap-2 mt-1 text-primary">
                  <Timer className="w-3 h-3" />
                  <span className="text-xs font-mono font-bold">{currentResult.duration || '??:??'}</span>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="glass-card mb-6">
            <CardHeader className="pb-2">
              <CardTitle className="text-[10px] font-bold uppercase text-accent tracking-widest">{t.summary}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="max-h-[30vh] overflow-y-auto pr-2 scrollbar-hide">
                <p className="text-xs leading-relaxed text-muted-foreground whitespace-pre-wrap">{currentResult.matchSummary}</p>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-2 gap-4 mb-8">
            <Card className="bg-secondary/20 border-white/5">
              <CardContent className="p-4 flex flex-col items-center">
                <Skull className="w-5 h-5 text-red-400 mb-2" />
                <span className="text-xl font-bold">{currentResult.teamStats?.teamA?.kills || 0}</span>
                <span className="text-[8px] text-muted-foreground uppercase font-bold">Kills</span>
              </CardContent>
            </Card>
            <Card className="bg-secondary/20 border-white/5">
              <CardContent className="p-4 flex flex-col items-center">
                <Crosshair className="w-5 h-5 text-blue-400 mb-2" />
                <span className="text-xl font-bold">{currentResult.teamStats?.teamA?.towersDestroyed || 0}</span>
                <span className="text-[8px] text-muted-foreground uppercase font-bold">Towers</span>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-3">
            {!isHistoricalViewing && currentResult.day > lastSeenMatchDay ? (
              <Button 
                onClick={handleAcknowledgeMatch}
                className="w-full h-14 hero-gradient font-bold uppercase text-sm tracking-widest shadow-lg"
              >
                {t.nextReport}
              </Button>
            ) : isHistoricalViewing ? (
              <Link href="/matches">
                <Button className="w-full h-14 hero-gradient font-bold uppercase text-sm tracking-widest shadow-lg">
                  {t.closeReplay}
                </Button>
              </Link>
            ) : (
              <div className="p-4 bg-primary/5 rounded-lg border border-primary/20 text-center mb-2">
                <span className="text-[10px] font-bold text-primary uppercase tracking-widest">{t.viewAll}</span>
              </div>
            )}
            
            {!isHistoricalViewing && (
              <Link href="/">
                <Button variant="outline" className="w-full text-[10px] font-bold uppercase border-white/5 h-10">
                  {t.return}
                </Button>
              </Link>
            )}
          </div>
        </div>
      )}
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
