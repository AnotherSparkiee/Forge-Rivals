
'use client';

import { useState, useEffect, useRef } from 'react';
import { useGameState } from '@/app/lib/store';
import { useUser, useFirestore, useDoc, useCollection, useMemoFirebase } from '@/firebase';
import { doc, collection, query, where } from 'firebase/firestore';
import { isMatchDue, getMoscowDateString, getGlobalSeasonInfo } from '@/app/lib/time-utils';
import { getMockGroupTeams, getSchedule, LEAGUES, getMatchResult } from '@/app/lib/leagues-data';
import { INITIAL_HEROES } from '@/app/lib/moba-data';
import { simulateMobaMatch } from '@/ai/flows/simulate-moba-match';
import { useToast } from '@/hooks/use-toast';
import { 
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Trophy, Skull, Crosshair, Swords, Loader2, ArrowUpCircle, ArrowDownCircle, MinusCircle, Star } from 'lucide-react';
import { cn } from '@/lib/utils';

export function AutoMatchManager() {
  const { 
    isLoaded, language, leagueLevel, divisionSubId, groupId, 
    seasonDay, seasonNumber, lastLeagueMatchDate, recordMatch, team, strategy, rank, seasonStartDate,
    markMatchAsSeen, matchHistory, seasonResults, dismissSeasonResults, setSyncing
  } = useGameState();
  const { user, isUserLoading } = useUser();
  const db = useFirestore();
  const { toast } = useToast();
  
  const [isSimulating, setIsSimulating] = useState(false);
  const [showResultDialog, setShowResultDialog] = useState(false);
  const [currentResult, setCurrentResult] = useState<any | null>(null);
  
  const simulationRef = useRef(false);

  const userRef = useMemoFirebase(() => user ? doc(db, 'players_v3', user.uid) : null, [db, user]);
  const { data: profile } = useDoc(userRef);

  const groupQuery = useMemoFirebase(() => {
    if (!profile?.selectedLeagueId) return null;
    return query(
      collection(db, 'players_v3'),
      where('selectedLeagueId', '==', profile.selectedLeagueId),
      where('leagueLevel', '==', profile.leagueLevel),
      where('groupId', '==', profile.groupId)
    );
  }, [db, profile?.selectedLeagueId, profile?.leagueLevel, profile?.groupId]);

  const { data: groupPlayers } = useCollection(groupQuery);

  useEffect(() => {
    if (isLoaded && seasonDay > 0 && seasonDay <= 14 && !isSimulating && !simulationRef.current && !isUserLoading && profile?.selectedLeagueId && groupPlayers && user) {
      const league = LEAGUES.find(l => l.id === profile.selectedLeagueId);
      const matchTime = league?.startTime || '23:00';
      
      const catchUp = async () => {
        for (let d = 1; d <= seasonDay; d++) {
          const alreadyPlayed = matchHistory.some(m => m.day === d && m.type === 'league' && m.seasonNumber === seasonNumber);
          if (alreadyPlayed) continue;

          const isDue = d < seasonDay || isMatchDue(matchTime, lastLeagueMatchDate);
          
          if (isDue) {
            await triggerAutoMatch(matchTime, d);
            await new Promise(r => setTimeout(r, 1000));
            break; 
          }
        }
      };
      catchUp();
    }
  }, [isLoaded, profile, groupPlayers, lastLeagueMatchDate, isUserLoading, seasonDay, seasonNumber, matchHistory, user, isSimulating]);

  const triggerAutoMatch = async (matchTime: string, targetDay: number) => {
    if (!groupPlayers || !user || !profile || simulationRef.current) return;
    
    simulationRef.current = true;
    setIsSimulating(true);
    setSyncing(true);
    
    try {
      const groupTeams = getMockGroupTeams(
        rank, 
        profile.displayName || "My Team", 
        leagueLevel, 
        divisionSubId, 
        groupId, 
        profile.selectedLeagueId || "ALPHA",
        groupPlayers || [],
        user.uid,
        0
      );
      
      const schedule = getSchedule(groupTeams);
      const todayMatch = schedule[targetDay - 1]?.find((m: any) => m.home.id === user.uid || m.away.id === user.uid);
      
      if (!todayMatch) throw new Error("No match scheduled for this day");

      const opponent = todayMatch.home.id === user.uid ? todayMatch.away : todayMatch.home;
      const opponentName = opponent.name || "Unknown Team";
      
      const [detScoreA, detScoreB] = getMatchResult(todayMatch.home.id, todayMatch.away.id, targetDay);
      
      const forcedScoreA = todayMatch.home.id === user.uid ? detScoreA : detScoreB;
      const forcedScoreB = todayMatch.away.id === user.uid ? detScoreA : detScoreB;

      const botPowerMultiplier = 1.2 + ((10 - leagueLevel) * 0.15); 
      
      const result = await simulateMobaMatch({
        teamA: {
          name: profile.displayName || "My Team",
          strategy: strategy,
          heroes: team
        },
        teamB: {
          name: opponentName,
          strategy: opponent.isPlayer ? "Advanced Elite Tactics" : "Hard Core Execution",
          heroes: INITIAL_HEROES.map(h => ({ 
            ...h, 
            baseStats: { 
              ...h.baseStats, 
              attack: Math.round(h.baseStats.attack * botPowerMultiplier) + 30,
              health: Math.round(h.baseStats.health * botPowerMultiplier) + 300
            } 
          }))
        },
        includeRandomEvents: true,
        isBo2: true,
        scoreA: forcedScoreA,
        scoreB: forcedScoreB
      });
      
      let customPlayedAt = undefined;
      if (targetDay < seasonDay && seasonStartDate) {
        const matchDate = new Date(seasonStartDate);
        matchDate.setDate(matchDate.getDate() + (targetDay - 1));
        const [h, m] = matchTime.split(':').map(Number);
        matchDate.setHours(h, m, 0, 0);
        customPlayedAt = matchDate.toISOString();
      }

      recordMatch(result.winner, result, targetDay, opponentName, 'league', customPlayedAt);
      
      if (targetDay === seasonDay) {
        setCurrentResult({ ...result, day: targetDay, opponentName: opponentName });
        setShowResultDialog(true);
        toast({
          title: language === 'ru' ? "Матч лиги завершен!" : "League Match Completed!",
          description: `${profile.displayName || "My Team"} ${result.scoreA}:${result.scoreB} ${opponentName}`,
        });
      }
    } catch (e: any) {
      console.error("Auto simulation failed", e);
      toast({
        variant: "destructive",
        title: "Simulation Error",
        description: e.message || "Failed to finalize match transmission.",
      });
    } finally {
      setIsSimulating(false);
      simulationRef.current = false;
      setSyncing(false);
    }
  };

  const getDateForDay = (day: number) => {
    if (!seasonStartDate) return "";
    const date = new Date(seasonStartDate);
    date.setDate(date.getDate() + (day - 1));
    return date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
  };

  const t = {
    title: language === 'ru' ? 'ИТОГИ СЕЗОНА' : 'SEASON RESULTS',
    congrats: language === 'ru' ? 'СЕЗОН ЗАВЕРШЕН!' : 'SEASON COMPLETE!',
    pos: language === 'ru' ? 'Ваше место:' : 'Your Place:',
    pts: language === 'ru' ? 'Набрано очков:' : 'Points Scored:',
    promoted: language === 'ru' ? 'ПОВЫШЕНИЕ В КЛАССЕ!' : 'PROMOTED TO HIGHER TIER!',
    demoted: language === 'ru' ? 'ПОНИЖЕНИЕ В КЛАССЕ' : 'RELEGATED TO LOWER TIER',
    stayed: language === 'ru' ? 'ВЫ ОСТАЕТЕСЬ В ДИВИЗИОНЕ' : 'POSITION MAINTAINED',
    descPromoted: language === 'ru' ? 'Поздравляем! Вы переходите в более сильный дивизион.' : 'Congratulations! You are moving to a stronger division.',
    descDemoted: language === 'ru' ? 'К сожалению, ваша команда вылетает в нижний дивизион.' : 'Unfortunately, your team has been relegated.',
    descStayed: language === 'ru' ? 'Вы сохранили прописку в текущем дивизионе на следующий сезон.' : 'You maintained your spot in the current division for next season.',
    next: language === 'ru' ? 'ПОДГОТОВИТЬСЯ К СЛЕДУЮЩЕМУ СЕЗОНУ' : 'PREPARE FOR NEXT SEASON',
    trophyEarned: language === 'ru' ? 'ВЫ ПОЛУЧИЛИ ЭЛИТНЫЙ КУБОК!' : 'YOU EARNED THE ELITE CUP!',
    trophyDesc: language === 'ru' ? 'За победу в 1 дивизионе 1 группе вы награждаетесь легендарным трофеем.' : 'For winning Division 1 Group 1, you are awarded the legendary trophy.'
  };

  return (
    <>
      <Dialog open={showResultDialog} onOpenChange={(open) => {
        setShowResultDialog(open);
        if (!open && currentResult) {
          markMatchAsSeen(currentResult.day);
        }
      }}>
        <DialogContent className="max-w-md p-0 overflow-hidden bg-background border-white/5">
          <DialogHeader className="sr-only">
            <DialogTitle>{language === 'ru' ? 'Результат матча' : 'Match Result'}</DialogTitle>
          </DialogHeader>
          <div className={cn(
            "p-6 text-center border-b",
            currentResult?.scoreA > currentResult?.scoreB ? "bg-primary/10 border-primary/20" : currentResult?.scoreA === currentResult?.scoreB ? "bg-accent/10 border-accent/20" : "bg-destructive/10 border-destructive/20"
          )}>
            <Trophy className={cn("w-16 h-16 mx-auto mb-3", currentResult?.scoreA > currentResult?.scoreB ? "text-primary" : currentResult?.scoreA === currentResult?.scoreB ? "text-accent" : "text-muted-foreground")} />
            <h2 className="text-3xl font-headline font-bold mb-1 uppercase">
              {currentResult?.scoreA > currentResult?.scoreB ? (language === 'ru' ? 'ПОБЕДА' : 'VICTORY') : currentResult?.scoreA === currentResult?.scoreB ? (language === 'ru' ? 'НИЧЬЯ' : 'DRAW') : (language === 'ru' ? 'ПОРАЖЕНИЕ' : 'DEFEAT')}
            </h2>
            <div className="flex items-center justify-center gap-4 text-2xl font-headline font-bold mt-2">
              <span>{currentResult?.scoreA}</span>
              <span className="opacity-30">:</span>
              <span>{currentResult?.scoreB}</span>
            </div>
            <p className="text-[10px] opacity-80 uppercase tracking-widest mt-2 font-bold font-mono">
              {getDateForDay(currentResult?.day || 0)} @ {profile?.selectedLeagueId ? LEAGUES.find(l => l.id === profile.selectedLeagueId)?.startTime : '23:00'} MSK
            </p>
          </div>

          <div className="p-6 space-y-6 max-h-[60vh] overflow-y-auto scrollbar-hide">
            <div className="space-y-2">
               <h3 className="text-[10px] uppercase font-bold text-accent tracking-widest flex items-center gap-2">
                 <Swords className="w-3 h-3" /> {language === 'ru' ? 'ОБЗОР МАТЧА' : 'MATCH SUMMARY'}
               </h3>
               <p className="text-sm leading-relaxed text-muted-foreground italic">"{currentResult?.matchSummary}"</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
               <div className="bg-secondary/20 p-3 rounded-lg border border-white/5 text-center">
                  <Skull className="w-4 h-4 mx-auto mb-1 text-red-400" />
                  <p className="text-xl font-bold">{currentResult?.teamStats?.teamA?.kills}</p>
                  <p className="text-[8px] uppercase text-muted-foreground">Kills</p>
               </div>
               <div className="bg-secondary/20 p-3 rounded-lg border border-white/5 text-center">
                  <Crosshair className="w-4 h-4 mx-auto mb-1 text-blue-400" />
                  <p className="text-xl font-bold">{currentResult?.teamStats?.teamA?.towersDestroyed}</p>
                  <p className="text-[8px] uppercase text-muted-foreground">Towers</p>
               </div>
            </div>
          </div>

          <DialogFooter className="p-4 bg-secondary/20 border-t border-white/5 sm:justify-center">
            <Button onClick={() => setShowResultDialog(false)} className="w-full font-bold uppercase text-[10px] tracking-widest h-12">
              {language === 'ru' ? 'ЗАКРЫТЬ ТЕРМИНАЛ' : 'CLOSE TERMINAL'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!seasonResults} onOpenChange={(open) => !open && dismissSeasonResults()}>
        <DialogContent className="max-w-md p-0 overflow-hidden bg-background border-white/10 shadow-2xl">
          <DialogHeader className="p-8 text-center bg-gradient-to-br from-primary/20 via-background to-accent/10 border-b border-white/5">
            <div className="mx-auto w-20 h-20 rounded-full bg-secondary/50 flex items-center justify-center mb-4 border-2 border-primary shadow-[0_0_30px_rgba(var(--primary),0.3)]">
              {seasonResults?.awardedTrophy ? (
                <Star className="w-10 h-10 text-yellow-500 animate-pulse" />
              ) : seasonResults?.promoted ? (
                <ArrowUpCircle className="w-10 h-10 text-primary animate-bounce" />
              ) : seasonResults?.demoted ? (
                <ArrowDownCircle className="w-10 h-10 text-red-400" />
              ) : (
                <MinusCircle className="w-10 h-10 text-accent" />
              )}
            </div>
            <DialogTitle className="text-2xl font-headline font-bold uppercase tracking-tight text-primary">
              {seasonResults?.awardedTrophy ? t.trophyEarned : t.congrats}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground mt-2 uppercase tracking-widest font-bold">
              {language === 'ru' ? `Завершен Сезон ${seasonResults?.seasonNumber}` : `Season ${seasonResults?.seasonNumber} Concluded`}
            </DialogDescription>
          </DialogHeader>

          <div className="p-8 space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-secondary/30 p-4 rounded-xl border border-white/5 text-center">
                <p className="text-[10px] uppercase font-bold text-muted-foreground mb-1">{t.pos}</p>
                <p className="text-3xl font-headline font-bold text-accent">{seasonResults?.lastRank}</p>
              </div>
              <div className="bg-secondary/30 p-4 rounded-xl border border-white/5 text-center">
                <p className="text-[10px] uppercase font-bold text-muted-foreground mb-1">{t.pts}</p>
                <p className="text-3xl font-headline font-bold text-primary">{seasonResults?.lastPoints}</p>
              </div>
            </div>

            <div className={cn(
              "p-6 rounded-xl border-2 text-center space-y-2",
              seasonResults?.promoted || seasonResults?.awardedTrophy ? "bg-primary/10 border-primary/30" : seasonResults?.demoted ? "bg-destructive/10 border-destructive/30" : "bg-accent/10 border-accent/30"
            )}>
              <h3 className="text-xl font-headline font-bold uppercase tracking-tight">
                {seasonResults?.awardedTrophy ? t.trophyEarned : seasonResults?.promoted ? t.promoted : seasonResults?.demoted ? t.demoted : t.stayed}
              </h3>
              <p className="text-xs text-muted-foreground italic">
                {seasonResults?.awardedTrophy ? t.trophyDesc : seasonResults?.promoted ? t.descPromoted : seasonResults?.demoted ? t.descDemoted : t.descStayed}
              </p>
            </div>
          </div>

          <DialogFooter className="p-6 bg-secondary/20 border-t border-white/5">
            <Button 
              className="w-full h-14 hero-gradient font-bold uppercase text-xs tracking-widest shadow-lg hover:scale-[1.02] active:scale-95 transition-all" 
              onClick={dismissSeasonResults}
            >
              {t.next}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
