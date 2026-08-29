'use client';

/**
 * @fileOverview ЦЕНТР ОТЧЕТОВ МАТЧЕЙ v1.6.
 * Обновлен для работы с игроками v12.
 */

import { useGameState } from '@/app/lib/store';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { useRouter } from 'next/navigation';
import { useState, useMemo, useEffect } from 'react';
import { LoadingScreen } from '@/components/game/LoadingScreen';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  ChevronLeft, Tv, Trophy, Swords, 
  Clock, ChevronRight, FileText, Bell, CheckCircle2, Trash2,
  Shield
} from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { collection, query, where } from 'firebase/firestore';

export default function ReportsPage() {
  const { user, isUserLoading } = useUser();
  const db = useFirestore();
  const router = useRouter();
  const { toast } = useToast();
  const { 
    language, isLoaded, isDataReady, matchHistory, 
    allSeasonMatches, lastSeenMatchDay, deleteMatchHistoryEntry, clearMatchHistory,
    clubLogo: myClubLogo, rank, selectedLeagueId, leagueLevel, groupId
  } = useGameState();

  useEffect(() => {
    if (!isUserLoading && !user) router.push('/auth/login');
  }, [user, isUserLoading, router]);

  // Загрузка участников группы для разрешения имен (v12)
  const groupPlayersQuery = useMemoFirebase(() => {
    if (!db || !selectedLeagueId) return null;
    return query(collection(db, 'players_v12'), 
      where('selectedLeagueId', '==', selectedLeagueId),
      where('leagueLevel', '==', leagueLevel),
      where('groupId', '==', groupId)
    );
  }, [db, selectedLeagueId, leagueLevel, groupId]);

  const { data: groupPlayers } = useCollection(groupPlayersQuery);

  const nameMap = useMemo(() => {
    const names: Record<number, string> = {};
    const logos: Record<number, string> = {};
    if (groupPlayers) {
      groupPlayers.forEach(p => {
        names[p.rank] = p.clubName || p.displayName;
        logos[p.rank] = p.clubLogo;
      });
    }
    return { names, logos };
  }, [groupPlayers]);

  // Сбор всех завершенных отчетов
  const allReports = useMemo(() => {
    if (!user || !rank) return [];

    // 1. Из истории (дружеские, турниры)
    const historyReports = (matchHistory || []).map(m => ({
      ...m,
      isUnread: m.seen === false,
      source: 'history'
    }));

    // 2. Из текущего сезона лиги
    const leagueReports = (allSeasonMatches || [])
      .filter(m => (Number(m.homeRank) === rank || Number(m.awayRank) === rank) && m.isFinished)
      .map(m => {
        // Разрешаем имена для лиги
        const hRank = Number(m.homeRank);
        const aRank = Number(m.awayRank);
        
        const botHome = `BOT_ALPHA_L${leagueLevel}_G${groupId}_R${hRank}`;
        const botAway = `BOT_ALPHA_L${leagueLevel}_G${groupId}_R${aRank}`;

        const hName = nameMap.names[hRank] || botHome;
        const aName = nameMap.names[aRank] || botAway;
        const hLogo = nameMap.logos[hRank] || null;
        const aLogo = nameMap.logos[aRank] || null;

        return {
          ...m,
          homeName: hName,
          awayName: aName,
          homeLogo: hLogo,
          awayLogo: aLogo,
          isUnread: Number(m.day) > (lastSeenMatchDay || 0),
          source: 'league'
        };
      });

    // Объединяем
    const combined = [...historyReports, ...leagueReports];
    
    // Дедупликация по ID
    const uniqueMap = new Map();
    combined.forEach(report => {
      if (report.id) {
        if (!uniqueMap.has(report.id) || report.source === 'history') {
          uniqueMap.set(report.id, report);
        }
      }
    });

    return Array.from(uniqueMap.values()).sort((a, b) => {
      const timeA = a.playedAt ? new Date(a.playedAt).getTime() : (a.startTime ? new Date(a.startTime).getTime() : 0);
      const timeB = b.playedAt ? new Date(b.playedAt).getTime() : (b.startTime ? new Date(b.startTime).getTime() : 0);
      return timeB - timeA;
    });
  }, [matchHistory, allSeasonMatches, user, lastSeenMatchDay, rank, nameMap, groupId, leagueLevel]);

  if (isUserLoading || !isLoaded || !isDataReady) return <LoadingScreen />;

  const t = {
    ru: {
      title: "ОБЗОР МАТЧЕЙ",
      subtitle: "Центр тактических отчетов",
      unread: "НОВЫЙ",
      empty: "ОТЧЕТОВ НЕ ОБНАРУЖЕНО",
      emptyDesc: "Завершите матч лиги или турнира, чтобы получить отчет.",
      view: "ПРОСМОТРЕТЬ",
      clearAll: "ОЧИСТИТЬ ВСЁ",
      league: "Лига",
      tournament: "Турнир",
      friendly: "Товарищеский",
      deleted: "Отчет удален",
      cleared: "История отчетов очищена"
    },
    en: {
      title: "MATCH OVERVIEW",
      subtitle: "Tactical Reports Hub",
      unread: "NEW",
      empty: "NO REPORTS FOUND",
      emptyDesc: "Complete a league or tournament match to receive a report.",
      view: "REVIEW REPORT",
      clearAll: "CLEAR ALL",
      league: "League",
      tournament: "Tournament",
      friendly: "Friendly",
      deleted: "Report deleted",
      cleared: "Reports history cleared"
    }
  }[language === 'ru' ? 'ru' : 'en'];

  const handleDeleteEntry = (e: React.MouseEvent, id: string, source: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (source === 'history') {
      deleteMatchHistoryEntry(id);
      toast({ title: t.deleted });
    } else {
      toast({ title: language === 'ru' ? "Матчи лиги нельзя удалить" : "League matches are permanent", variant: "destructive" });
    }
  };

  const handleClearAll = () => {
    clearMatchHistory();
    toast({ title: t.cleared });
  };

  return (
    <div className="max-w-md mx-auto px-4 pt-8 pb-32">
      <header className="mb-8 flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/">
            <Button variant="ghost" size="icon" className="rounded-full bg-secondary/50 border border-white/5">
              <ChevronLeft className="w-6 h-6" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-headline font-bold uppercase tracking-tighter text-white flex items-center gap-2">
              <Tv className="w-6 h-6 text-primary" />
              {t.title}
            </h1>
            <p className="text-muted-foreground text-[10px] uppercase tracking-widest font-black opacity-50">{t.subtitle}</p>
          </div>
        </div>
        
        {allReports.some(r => r.source === 'history') && (
          <Button variant="ghost" size="icon" className="text-red-400 hover:text-red-300 hover:bg-red-400/10" onClick={handleClearAll}>
            <Trash2 className="w-5 h-5" />
          </Button>
        )}
      </header>

      <div className="space-y-3">
        {allReports.length > 0 ? (
          allReports.map((report, idx) => {
            const isMeHome = Number(report.homeRank) === rank || report.homeId === user?.uid;
            const isMeAway = Number(report.awayRank) === rank || report.awayId === user?.uid;
            const typeLabel = (t as any)[report.type] || report.type || t.league;
            
            const homeLogo = isMeHome ? myClubLogo : report.homeLogo;
            const awayLogo = isMeAway ? myClubLogo : report.awayLogo;

            return (
              <Card key={`${report.id || 'idx'}-${idx}`} className={cn(
                "glass-card border-white/5 transition-all overflow-hidden group",
                report.isUnread && "border-primary/40 bg-primary/5 ring-1 ring-primary/10 shadow-[0_0_15px_rgba(var(--primary),0.1)]"
              )}>
                <CardContent className="p-4">
                  <div className="flex justify-between items-center mb-3">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[7px] font-black h-4 px-2 border-white/10 uppercase tracking-widest">
                        {typeLabel}
                      </Badge>
                      {report.isUnread && (
                        <Badge className="bg-primary text-primary-foreground text-[7px] font-black h-4 px-2 animate-pulse">
                          {t.unread}
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-[8px] font-mono font-bold text-muted-foreground">
                        {new Date(report.playedAt || report.startTime).toLocaleString([], { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                      </span>
                      {report.source === 'history' && (
                        <button onClick={(e) => handleDeleteEntry(e, report.id, report.source)} className="text-muted-foreground/30 hover:text-red-400 transition-colors">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-[1fr_50px_1fr] items-center gap-3 mb-4">
                    <div className="flex flex-col items-center gap-2 text-center min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-secondary/50 border border-white/5 flex items-center justify-center overflow-hidden p-1.5 shrink-0">
                        {homeLogo ? <img src={homeLogo} alt="" className="w-full h-full object-contain" /> : <Shield className="w-5 h-5 text-muted-foreground/40" />}
                      </div>
                      <p className={cn(
                        "text-[10px] font-bold uppercase tracking-tight truncate w-full px-1",
                        isMeHome ? "text-primary font-black" : "text-white"
                      )}>
                        {report.homeName}
                      </p>
                    </div>

                    <div className="flex justify-center shrink-0">
                      <span className="text-xl font-headline font-black italic text-white">
                        {report.scoreA}:{report.scoreB}
                      </span>
                    </div>

                    <div className="flex flex-col items-center gap-2 text-center min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-secondary/50 border border-white/5 flex items-center justify-center overflow-hidden p-1.5 shrink-0">
                        {awayLogo ? <img src={awayLogo} alt="" className="w-full h-full object-contain" /> : <Shield className="w-5 h-5 text-muted-foreground/40" />}
                      </div>
                      <p className={cn(
                        "text-[10px] font-bold uppercase tracking-tight truncate w-full px-1",
                        isMeAway ? "text-primary font-black" : "text-white"
                      )}>
                        {report.awayName}
                      </p>
                    </div>
                  </div>

                  <Link href={`/match?id=${report.id}`}>
                    <Button 
                      variant={report.isUnread ? "default" : "outline"} 
                      className={cn(
                        "w-full h-10 text-[9px] font-black uppercase tracking-[0.2em] transition-all",
                        report.isUnread ? "hero-gradient shadow-lg" : "border-white/10 text-muted-foreground"
                      )}
                    >
                      {t.view} <ChevronRight className="w-3.5 h-3.5 ml-2" />
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            );
          })
        ) : (
          <div className="py-20 text-center opacity-30 border border-dashed border-white/5 rounded-3xl p-10 flex flex-col items-center gap-4">
            <FileText className="w-12 h-12" />
            <div className="space-y-1">
              <p className="text-sm font-bold uppercase text-white">{t.empty}</p>
              <p className="text-[9px] uppercase font-black tracking-widest max-w-[200px] leading-relaxed">
                {t.emptyDesc}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
