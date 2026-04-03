
'use client';

import { useState, useEffect, useMemo, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { useGameState } from '../lib/store';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { 
  ChevronLeft, CalendarClock, ShieldAlert, Timer, 
  User, Star, Check, X, Users, Signal, Swords,
  Skull, Crosshair, FileText
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
    matchHistory, arena, credits, crystals
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
      reportTitle: "MATCH REPORT",
      league: "League",
      friendly: "Friendly Match",
      tournament: "Pyramid Cup",
      basket: "CW Basket",
      round: "Matchday",
      spectators: "Spectators",
      people: "ppl",
      summary: "Strategic Analysis",
      stats: "In-Game Statistics",
      mvp: "MVP OF THE MATCH",
      duration: "DURATION",
      accept: "ACCEPT",
      back: "BACK",
      noHistory: "No records found.",
      connection: "Connection Quality",
      excellent: "Excellent"
    },
    ru: {
      reportTitle: "ОТЧЕТ О МАТЧЕ",
      league: "Лига",
      friendly: "Тов. матч",
      tournament: "Кубок Пирамиды",
      basket: "КВ Корзина",
      round: "Тур",
      spectators: "Зрители",
      people: "чел.",
      summary: "Стратегический анализ",
      stats: "Игровая статистика",
      mvp: "MVP МАТЧА",
      duration: "ДЛИТЕЛЬНОСТЬ",
      accept: "ПРИНЯТЬ",
      back: "НАЗАД",
      noHistory: "Отчеты не найдены.",
      connection: "Качество связи",
      excellent: "Отличное"
    }
  };

  const t = labels[language as keyof typeof labels] || labels.ru;

  // Mock spectator count based on arena capacity or random for friendlies
  const spectators = currentResult?.type === 'league' ? arena.capacity : Math.floor(Math.random() * 5000) + 1000;

  const getMatchTime = (iso: string) => {
    if (!iso) return "2024-01-01 00:00:00";
    const d = new Date(iso);
    return d.toISOString().replace('T', ' ').split('.')[0];
  };

  return (
    <div className="min-h-screen bg-[#0d1f14] text-[#e0e7d8] pb-32">
      {/* Background Grid Overlay */}
      <div className="fixed inset-0 pointer-events-none opacity-10 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:20px_20px]"></div>

      {/* HEADER BAR */}
      <div className="bg-[#1a472a] border-b-2 border-[#2d5a3d] py-3 text-center shadow-lg relative z-10">
        <h1 className="text-lg font-headline font-bold text-[#f0f4e8] tracking-widest uppercase">
          {t.reportTitle}
        </h1>
      </div>

      <div className="max-w-md mx-auto relative z-10">
        {!currentResult ? (
          <div className="py-20 text-center space-y-4">
            <ShieldAlert className="w-16 h-16 mx-auto opacity-20" />
            <p className="text-sm font-bold uppercase tracking-widest">{t.noHistory}</p>
            <Button variant="outline" className="border-white/10" onClick={() => router.back()}>GO BACK</Button>
          </div>
        ) : (
          <div className="space-y-0.5 mt-1">
            
            {/* DATE & TIME ROW */}
            <div className="bg-[#122b19] border-y border-[#2d5a3d]/30 py-2 text-center">
              <p className="text-xs font-mono font-bold text-[#a8c69f] tracking-tighter">
                {getMatchTime(currentResult.playedAt)}
              </p>
            </div>

            {/* COMPETITION ROW */}
            <div className="bg-[#122b19] py-2 text-center">
              <p className="text-sm font-bold text-[#f0f4e8] uppercase tracking-wide">
                {currentResult.type === 'league' ? t.league : 
                 currentResult.type === 'tournament' ? t.tournament : 
                 currentResult.type === 'basket' ? t.basket : t.friendly}
              </p>
            </div>

            {/* ROUND ROW */}
            <div className="bg-[#122b19] border-b border-[#2d5a3d]/30 py-2 text-center">
              <p className="text-xs font-bold text-[#a8c69f] uppercase tracking-widest">
                {currentResult.day > 0 ? `${currentResult.day}-${language === 'ru' ? 'й' : ''} ${t.round}` : "Final Phase"}
              </p>
            </div>

            {/* TEAMS & SCORE BLOCK */}
            <div className="bg-[#163521] py-8 border-b border-[#2d5a3d]/50 px-6 flex flex-col gap-6 items-center">
              <div className="w-full flex items-center justify-between">
                {/* Team A */}
                <div className="flex-1 flex flex-col items-center gap-2 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{myFlag}</span>
                    <span className="text-sm font-headline font-bold text-white truncate max-w-[120px] uppercase">
                      {profile?.displayName || "MY TEAM"}
                    </span>
                  </div>
                </div>

                {/* BIG SCORE */}
                <div className="px-4 flex items-center gap-4 text-5xl font-headline font-black italic text-[#f0f4e8]">
                  <span className={cn(currentResult.scoreA > currentResult.scoreB && "text-yellow-400")}>{currentResult.scoreA}</span>
                  <span className="opacity-20">:</span>
                  <span className={cn(currentResult.scoreB > currentResult.scoreA && "text-yellow-400")}>{currentResult.scoreB}</span>
                </div>

                {/* Team B */}
                <div className="flex-1 flex flex-col items-center gap-2 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-headline font-bold text-white truncate max-w-[120px] uppercase">
                      {currentResult.opponentName}
                    </span>
                    <span className="text-xl">🏳️</span>
                  </div>
                </div>
              </div>
              
              <div className="w-full flex justify-center">
                <Badge variant="outline" className="border-[#2d5a3d] text-[#a8c69f] text-[9px] font-black uppercase px-4 py-1 bg-black/20">
                  {currentResult.scoreA > currentResult.scoreB ? "VICTORY" : (currentResult.scoreA === currentResult.scoreB ? "DRAW" : "DEFEAT")}
                </Badge>
              </div>
            </div>

            {/* STATS STRIP (Weather / Spectators) */}
            <div className="bg-[#122b19] border-b border-[#2d5a3d]/30 py-3 flex items-center justify-center gap-8">
              <div className="flex items-center gap-2">
                <Signal className="w-4 h-4 text-yellow-500" />
                <p className="text-[10px] font-bold text-[#a8c69f] uppercase tracking-tighter">
                  {t.connection}: <span className="text-white">{t.excellent}</span>
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-blue-400" />
                <p className="text-[10px] font-bold text-[#a8c69f] uppercase tracking-tighter">
                  {t.spectators}: <span className="text-white">{spectators.toLocaleString()} {t.people}</span>
                </p>
              </div>
            </div>

            {/* MVP & DURATION ROW */}
            <div className="grid grid-cols-2 gap-px bg-[#2d5a3d]/20 border-b border-[#2d5a3d]/30">
              <div className="bg-[#122b19] p-4 flex flex-col items-center gap-1 border-r border-[#2d5a3d]/20">
                <p className="text-[8px] font-black text-[#a8c69f] uppercase tracking-[0.2em]">{t.mvp}</p>
                <div className="flex items-center gap-2 mt-1">
                  <Star className="w-3.5 h-3.5 text-yellow-500 fill-yellow-500" />
                  <span className="text-xs font-bold text-white uppercase truncate max-w-[140px]">{currentResult.mvp || 'UNKNOWN'}</span>
                </div>
              </div>
              <div className="bg-[#122b19] p-4 flex flex-col items-center gap-1">
                <p className="text-[8px] font-black text-[#a8c69f] uppercase tracking-[0.2em]">{t.duration}</p>
                <div className="flex items-center gap-2 mt-1">
                  <Timer className="w-3.5 h-3.5 text-blue-400" />
                  <span className="text-sm font-mono font-bold text-white">{currentResult.duration || '34:12'}</span>
                </div>
              </div>
            </div>

            {/* AI SUMMARY BOX */}
            <div className="p-4 space-y-4">
              <div className="flex items-center gap-2 px-1">
                <FileText className="w-4 h-4 text-yellow-500" />
                <h3 className="text-[10px] font-black uppercase tracking-widest text-[#a8c69f]">{t.summary}</h3>
              </div>
              <Card className="bg-[#122b19] border-[#2d5a3d]/30 rounded-xl overflow-hidden shadow-2xl">
                <CardContent className="p-5">
                  <div className="max-h-[40vh] overflow-y-auto scrollbar-hide pr-2">
                    <p className="text-sm leading-relaxed text-[#d1d9c9] italic whitespace-pre-wrap font-medium">
                      {currentResult.matchSummary}
                    </p>
                  </div>
                </CardContent>
              </Card>

              <div className="grid grid-cols-2 gap-3 mt-4">
                <div className="bg-[#122b19] p-4 rounded-xl border border-[#2d5a3d]/30 flex flex-col items-center">
                  <Skull className="w-5 h-5 text-red-400 mb-2" />
                  <span className="text-2xl font-headline font-black italic">{currentResult.teamStats?.teamA?.kills || 0}</span>
                  <span className="text-[8px] text-[#a8c69f] uppercase font-black tracking-widest">Team Kills</span>
                </div>
                <div className="bg-[#122b19] p-4 rounded-xl border border-[#2d5a3d]/30 flex flex-col items-center">
                  <Crosshair className="w-5 h-5 text-blue-400 mb-2" />
                  <span className="text-2xl font-headline font-black italic">{currentResult.teamStats?.teamA?.towersDestroyed || 0}</span>
                  <span className="text-[8px] text-[#a8c69f] uppercase font-black tracking-widest">Objectives</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* FIXED FOOTER BAR */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-[#163521] border-t-2 border-[#2d5a3d] h-20 shadow-[0_-10px_30px_rgba(0,0,0,0.5)] flex items-center">
        <div className="w-full max-w-lg mx-auto px-4 grid grid-cols-3 items-center">
          
          {/* Accept Button */}
          <div className="flex justify-start">
            <button 
              onClick={handleAcknowledgeMatch}
              className="flex flex-col items-center gap-1 group active:scale-95 transition-all"
            >
              <div className="w-10 h-10 rounded-xl bg-green-600/20 border border-green-500/50 flex items-center justify-center shadow-[0_0_15px_rgba(34,197,94,0.2)]">
                <Check className="w-6 h-6 text-green-400" />
              </div>
              <span className="text-[8px] font-black tracking-[0.2em] text-[#a8c69f] uppercase">
                {t.accept}
              </span>
            </button>
          </div>

          {/* Center Stats */}
          <div className="flex flex-col items-center justify-center gap-1">
            <div className="bg-black/40 px-3 py-1 rounded border border-[#2d5a3d]/50 flex items-center gap-2">
              <span className="text-yellow-500 font-bold text-[10px]">€</span>
              <span className="text-xs font-mono font-bold text-white tracking-tighter">
                {formatCurrency(credits)}
              </span>
            </div>
            <div className="bg-black/40 px-3 py-1 rounded border border-[#2d5a3d]/50 flex items-center gap-2">
              <Timer className="w-3 h-3 text-blue-400" />
              <span className="text-[10px] font-mono font-bold text-[#a8c69f]">
                {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
            </div>
          </div>

          {/* Back/Close Button */}
          <div className="flex justify-end">
            <button 
              onClick={() => router.back()}
              className="flex flex-col items-center gap-1 group active:scale-95 transition-all"
            >
              <div className="w-10 h-10 rounded-xl bg-red-600/20 border border-red-500/50 flex items-center justify-center shadow-[0_0_15px_rgba(239,68,68,0.2)]">
                <X className="w-6 h-6 text-red-400" />
              </div>
              <span className="text-[8px] font-black tracking-[0.2em] text-[#a8c69f] uppercase">
                {t.back}
              </span>
            </button>
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
