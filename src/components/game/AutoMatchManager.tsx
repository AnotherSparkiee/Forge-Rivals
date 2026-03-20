'use client';

import { useState, useEffect, useRef } from 'react';
import { useGameState } from '@/app/lib/store';
import { useUser, useFirestore, useDoc, useCollection, useMemoFirebase } from '@/firebase';
import { doc, collection, query, where } from 'firebase/firestore';
import { isMatchDue, getMoscowDateString, getMoscowTime } from '@/app/lib/time-utils';
import { getMockGroupTeams, getSchedule, LEAGUES, getMatchResult } from '@/app/lib/leagues-data';
import { INITIAL_HEROES } from '@/app/lib/moba-data';
import { simulateMobaMatch, SimulateMobaMatchOutput } from '@/ai/flows/simulate-moba-match';
import { useToast } from '@/hooks/use-toast';
import { 
  Dialog, DialogContent, DialogFooter 
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Trophy, Skull, Crosshair, Swords, Clock, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export function AutoMatchManager() {
  const { 
    isLoaded, language, leagueLevel, divisionSubId, groupId, 
    seasonDay, lastLeagueMatchDate, recordMatch, team, strategy, rank, seasonStartDate,
    lastSeenMatchDay, markMatchAsSeen, matchHistory
  } = useGameState();
  const { user, isUserLoading } = useUser();
  const db = useFirestore();
  const { toast } = useToast();
  
  const [isSimulating, setIsSimulating] = useState(false);
  const [showResultDialog, setShowResultDialog] = useState(false);
  const [currentResult, setCurrentResult] = useState<any | null>(null);
  
  // Ref to prevent double-simulation during catch-up
  const simulationRef = useRef(false);

  const userRef = useMemoFirebase(() => user ? doc(db, 'players_v2', user.uid) : null, [db, user]);
  const { data: profile } = useDoc(userRef);

  const groupQuery = useMemoFirebase(() => {
    if (!profile?.selectedLeagueId) return null;
    return query(
      collection(db, 'players_v2'),
      where('selectedLeagueId', '==', profile.selectedLeagueId),
      where('leagueLevel', '==', profile.leagueLevel),
      where('groupId', '==', profile.groupId)
    );
  }, [db, profile?.selectedLeagueId, profile?.leagueLevel, profile?.groupId]);

  const { data: groupPlayers } = useCollection(groupQuery);

  useEffect(() => {
    // Check for missing matches since creation/last login
    if (isLoaded && seasonDay > 0 && !isSimulating && !simulationRef.current && !isUserLoading && profile?.selectedLeagueId && groupPlayers && user) {
      const league = LEAGUES.find(l => l.id === profile.selectedLeagueId);
      const matchTime = league?.startTime || '23:00';
      
      const catchUp = async () => {
        // Iterate through all days up to current season day to find gaps in history
        for (let d = 1; d <= seasonDay; d++) {
          const alreadyPlayed = matchHistory.some(m => m.day === d && m.type === 'league');
          if (alreadyPlayed) continue;

          // If it's a previous day, it's definitely due. If it's today, check if league time passed.
          const isDue = d < seasonDay || isMatchDue(matchTime, lastLeagueMatchDate);
          
          if (isDue) {
            await triggerAutoMatch(matchTime, d);
            // Simulate only one at a time per effect cycle to keep UI reactive
            break; 
          }
        }
      };
      catchUp();
    }
  }, [isLoaded, profile, groupPlayers, lastLeagueMatchDate, isUserLoading, seasonDay, matchHistory, user, isSimulating]);

  const triggerAutoMatch = async (matchTime: string, targetDay: number) => {
    if (!groupPlayers || !user || !profile || simulationRef.current) return;
    
    simulationRef.current = true;
    setIsSimulating(true);
    
    toast({
      title: language === 'ru' ? "Синхронизация матча..." : "Match Syncing...",
      description: language === 'ru' ? `Начало развертывания (День ${targetDay})` : `Deployment window open (Day ${targetDay})`,
    });

    try {
      // 1. Calculate deterministic result for the table stability
      const groupTeams = getMockGroupTeams(
        rank, 
        profile.displayName || "My Team", 
        leagueLevel, 
        divisionSubId, 
        groupId, 
        true, 
        targetDay,
        undefined,
        profile.selectedLeagueId || "ALPHA",
        groupPlayers,
        user.uid
      );
      const schedule = getSchedule(groupTeams);
      const todayMatch = schedule[targetDay - 1]?.find((m: any) => m.home.id === user.uid || m.away.id === user.uid);
      
      if (!todayMatch) throw new Error("No match scheduled for this day");

      const opponent = todayMatch.home.id === user.uid ? todayMatch.away : todayMatch.home;
      const opponentName = opponent.name || "Unknown Team";
      
      const [detScoreA, detScoreB] = getMatchResult(todayMatch.home.id, todayMatch.away.id, targetDay);
      
      // Determine score for simulation (Score A is always the current user)
      const forcedScoreA = todayMatch.home.id === user.uid ? detScoreA : detScoreB;
      const forcedScoreB = todayMatch.away.id === user.uid ? detScoreA : detScoreB;

      // 2. Simulate via AI with FORCED deterministic score to match table
      // Added realistic hero adjustments for opponents to make games more significant
      const result = await simulateMobaMatch({
        teamA: {
          name: profile.displayName || "My Team",
          strategy: strategy,
          heroes: team
        },
        teamB: {
          name: opponentName,
          strategy: opponent.isPlayer ? "High Level Tactics" : "Balanced Execution",
          heroes: INITIAL_HEROES.map(h => ({ 
            ...h, 
            baseStats: { 
              ...h.baseStats, 
              attack: h.baseStats.attack + (opponent.isPlayer ? 20 : 12),
              health: h.baseStats.health + (opponent.isPlayer ? 150 : 80)
            } 
          }))
        },
        includeRandomEvents: true,
        isBo2: true,
        scoreA: forcedScoreA,
        scoreB: forcedScoreB
      });
      
      // Explicitly pass the opponent name to recordMatch to avoid "Unknown" in history
      recordMatch(result.winner, result, targetDay, opponentName, 'league', true);
      
      // Only show popup if it's the current active day (not catch-up from previous days)
      if (targetDay === seasonDay) {
        setCurrentResult({ ...result, day: targetDay, opponentName: opponentName });
        setShowResultDialog(true);
        toast({
          title: language === 'ru' ? "Матч лиги завершен!" : "League Match Completed!",
          description: `${profile.displayName || "My Team"} ${result.scoreA}:${result.scoreB} ${opponentName}`,
        });
      }
    } catch (e) {
      console.error("Auto simulation failed", e);
    } finally {
      setIsSimulating(false);
      simulationRef.current = false;
    }
  };

  const getDateForDay = (day: number) => {
    if (!seasonStartDate) return "";
    const date = new Date(seasonStartDate);
    date.setDate(date.getDate() + (day - 1));
    return date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
  };

  if (isSimulating) {
    return (
      <div className="fixed top-16 left-1/2 -translate-x-1/2 z-[100] animate-in fade-in zoom-in">
        <Badge variant="outline" className="bg-background/90 backdrop-blur border-primary text-primary px-4 py-2 flex items-center gap-2 shadow-2xl">
          <Loader2 className="w-3 h-3 animate-spin" />
          <span className="text-[10px] font-bold uppercase tracking-widest">
            {language === 'ru' ? 'Синхронизация с сервером' : 'Syncing with League Server'}
          </span>
        </Badge>
      </div>
    );
  }

  if (!currentResult) return null;

  const isWin = currentResult.scoreA > currentResult.scoreB;
  const isDraw = currentResult.scoreA === currentResult.scoreB;

  return (
    <Dialog open={showResultDialog} onOpenChange={(open) => {
      setShowResultDialog(open);
      if (!open && currentResult) {
        markMatchAsSeen(currentResult.day);
      }
    }}>
      <DialogContent className="max-w-md p-0 overflow-hidden bg-background border-white/5">
        <div className={cn(
          "p-6 text-center border-b",
          isWin ? "bg-primary/10 border-primary/20" : isDraw ? "bg-accent/10 border-accent/20" : "bg-destructive/10 border-destructive/20"
        )}>
          <Trophy className={cn("w-16 h-16 mx-auto mb-3", isWin ? "text-primary" : isDraw ? "text-accent" : "text-muted-foreground")} />
          <h2 className="text-3xl font-headline font-bold mb-1 uppercase">
            {isWin ? (language === 'ru' ? 'ПОБЕДА' : 'VICTORY') : isDraw ? (language === 'ru' ? 'НИЧЬЯ' : 'DRAW') : (language === 'ru' ? 'ПОРАЖЕНИЕ' : 'DEFEAT')}
          </h2>
          <div className="flex items-center justify-center gap-4 text-2xl font-headline font-bold mt-2">
            <span>{currentResult.scoreA}</span>
            <span className="opacity-30">:</span>
            <span>{currentResult.scoreB}</span>
          </div>
          <p className="text-[10px] opacity-80 uppercase tracking-widest mt-2 font-bold font-mono">
            {getDateForDay(currentResult.day)} @ {profile?.selectedLeagueId ? LEAGUES.find(l => l.id === profile.selectedLeagueId)?.startTime : '23:00'} MSK
          </p>
        </div>

        <div className="p-6 space-y-6 max-h-[60vh] overflow-y-auto scrollbar-hide">
          <div className="space-y-2">
             <h3 className="text-[10px] uppercase font-bold text-accent tracking-widest flex items-center gap-2">
               <Swords className="w-3 h-3" /> {language === 'ru' ? 'ОБЗОР МАТЧА' : 'MATCH SUMMARY'}
             </h3>
             <p className="text-sm leading-relaxed text-muted-foreground italic">"{currentResult.matchSummary}"</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
             <div className="bg-secondary/20 p-3 rounded-lg border border-white/5 text-center">
                <Skull className="w-4 h-4 mx-auto mb-1 text-red-400" />
                <p className="text-xl font-bold">{currentResult.teamStats.teamA.kills}</p>
                <p className="text-[8px] uppercase text-muted-foreground">Kills</p>
             </div>
             <div className="bg-secondary/20 p-3 rounded-lg border border-white/5 text-center">
                <Crosshair className="w-4 h-4 mx-auto mb-1 text-blue-400" />
                <p className="text-xl font-bold">{currentResult.teamStats.teamA.towersDestroyed}</p>
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
  );
}
