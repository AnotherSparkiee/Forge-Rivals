'use client';

import { useState, useEffect } from 'react';
import { useGameState } from '@/app/lib/store';
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import { getMoscowTime, isMatchDue } from '@/app/lib/time-utils';
import { LEAGUES, getMockGroupTeams, getSchedule } from '@/app/lib/leagues-data';
import { simulateMobaMatch, SimulateMobaMatchOutput } from '@/ai/flows/simulate-moba-match';
import { INITIAL_HEROES } from '@/app/lib/moba-data';
import { useToast } from '@/hooks/use-toast';
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter 
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Trophy, Skull, Crosshair, Swords, TrendingUp, Wallet, Star } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * AutoMatchManager handles the background simulation of league matches.
 * It checks the Moscow server time and triggers a simulation if a match is due.
 */
export function AutoMatchManager() {
  const { 
    isLoaded, language, leagueLevel, divisionSubId, groupId, 
    seasonDay, lastLeagueMatchDate, recordMatch, team, strategy, rank 
  } = useGameState();
  const { user, isUserLoading } = useUser();
  const db = useFirestore();
  const { toast } = useToast();
  
  const [isSimulating, setIsSimulating] = useState(false);
  const [showResultDialog, setShowResultDialog] = useState(false);
  const [currentResult, setCurrentResult] = useState<SimulateMobaMatchOutput | null>(null);

  const userRef = useMemoFirebase(() => user ? doc(db, 'users', user.uid) : null, [db, user]);
  const { data: profile } = useDoc(userRef);

  useEffect(() => {
    if (isLoaded && profile?.selectedLeagueId && !isSimulating && !isUserLoading) {
      const league = LEAGUES.find(l => l.id === profile.selectedLeagueId);
      if (league && isMatchDue(league.startTime, lastLeagueMatchDate)) {
        triggerAutoMatch(league.id);
      }
    }
  }, [isLoaded, profile, lastLeagueMatchDate, isUserLoading]);

  const triggerAutoMatch = async (leagueId: string) => {
    setIsSimulating(true);
    try {
      const groupTeams = getMockGroupTeams(
        rank, profile?.displayName || "My Team", leagueLevel, divisionSubId, groupId, true, seasonDay
      );
      const schedule = getSchedule(groupTeams, seasonDay);
      const todayMatch = schedule?.find((m: any) => m.home.isPlayer || m.away.isPlayer);
      
      if (!todayMatch) throw new Error("Match not found in schedule");

      const opponent = todayMatch.home.isPlayer ? todayMatch.away : todayMatch.home;

      const result = await simulateMobaMatch({
        teamA: {
          name: profile?.displayName || "My Team",
          strategy: strategy,
          heroes: team
        },
        teamB: {
          name: opponent.name,
          strategy: "Standard Tactics",
          heroes: INITIAL_HEROES.map(h => ({ ...h, baseStats: { ...h.baseStats, attack: h.baseStats.attack + 2 } }))
        },
        includeRandomEvents: true,
        isBo2: true
      });
      
      recordMatch(result.winner, result, true);
      setCurrentResult(result);
      
      toast({
        title: language === 'ru' ? "Матч лиги завершен!" : "League Match Completed!",
        description: `${profile?.displayName || "My Team"} ${result.scoreA}:${result.scoreB} ${opponent.name}`,
        action: (
          <Button variant="outline" size="sm" onClick={() => setShowResultDialog(true)}>
            {language === 'ru' ? "ОБЗОР" : "REVIEW"}
          </Button>
        ),
      });
    } catch (e) {
      console.error("Auto simulation failed", e);
    } finally {
      setIsSimulating(false);
    }
  };

  if (!currentResult) return null;

  const isWin = currentResult.scoreA > currentResult.scoreB;
  const isDraw = currentResult.scoreA === currentResult.scoreB;

  return (
    <Dialog open={showResultDialog} onOpenChange={setShowResultDialog}>
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
          <p className="text-[10px] opacity-80 uppercase tracking-widest mt-2 font-bold">
            {isWin ? "+200 Credits | +25 Rank" : isDraw ? "+100 Credits | +5 Rank" : "+50 Credits | -15 Rank"}
          </p>
        </div>

        <div className="p-6 space-y-6 max-h-[60vh] overflow-y-auto scrollbar-hide">
          <div className="space-y-2">
             <h3 className="text-[10px] uppercase font-bold text-accent tracking-widest flex items-center gap-2">
               <Swords className="w-3 h-3" /> {language === 'ru' ? 'ОБЗОР МАТЧА' : 'MATCH SUMMARY'}
             </h3>
             <p className="text-sm leading-relaxed text-muted-foreground italic">
               "{currentResult.matchSummary}"
             </p>
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

          <div className="space-y-3">
            <h3 className="text-[10px] uppercase font-bold text-accent tracking-widest">{language === 'ru' ? 'ЭФФЕКТИВНОСТЬ ГЕРОЕВ' : 'HERO PERFORMANCE'}</h3>
            {currentResult.heroPerformance.filter(p => p.teamName === (profile?.displayName || "My Team")).map((perf, i) => (
              <div key={i} className="flex items-center gap-3 bg-secondary/10 p-2 rounded-lg border border-white/5">
                <div className="w-8 h-8 rounded-full bg-muted overflow-hidden">
                   <img src={`https://picsum.photos/seed/${perf.heroName}/100/100`} alt="" className="w-full h-full object-cover" />
                </div>
                <div className="flex-1">
                  <p className="text-[10px] font-bold uppercase">{perf.heroName}</p>
                  <p className="text-[8px] text-muted-foreground font-mono">KDA: {perf.kills}/{perf.deaths}/{perf.assists}</p>
                </div>
                <div className="text-right">
                  <p className="text-[9px] font-bold text-primary">{perf.damageDealt.toLocaleString()} DMG</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <DialogFooter className="p-4 bg-secondary/20 border-t border-white/5 sm:justify-center">
          <Button onClick={() => setShowResultDialog(false)} className="w-full font-bold uppercase text-[10px] tracking-widest">
            {language === 'ru' ? 'ЗАКРЫТЬ ТЕРМИНАЛ' : 'CLOSE TERMINAL'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
