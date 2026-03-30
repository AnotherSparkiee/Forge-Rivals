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

  const userRef = useMemoFirebase(() => user ? doc(db, 'players_v5', user.uid) : null, [db, user]);
  const { data: profile } = useDoc(userRef);

  const groupQuery = useMemoFirebase(() => {
    if (!profile?.selectedLeagueId) return null;
    return query(
      collection(db, 'players_v5'),
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
          if (matchHistory.some(m => m.day === d && m.type === 'league' && m.seasonNumber === seasonNumber)) continue;
          if (d < seasonDay || isMatchDue(matchTime, lastLeagueMatchDate)) {
            await triggerAutoMatch(matchTime, d);
            break; 
          }
        }
      };
      catchUp();
    }
  }, [isLoaded, profile, groupPlayers, lastLeagueMatchDate, isUserLoading, seasonDay, seasonNumber, matchHistory, user, isSimulating]);

  const triggerAutoMatch = async (matchTime: string, targetDay: number) => {
    if (!groupPlayers || !user || !profile || simulationRef.current) return;
    simulationRef.current = true; setIsSimulating(true); setSyncing(true);
    try {
      const groupTeams = getMockGroupTeams(rank, profile.displayName || "My Team", leagueLevel, divisionSubId, groupId, profile.selectedLeagueId || "ALPHA", groupPlayers || [], user.uid, 0);
      const schedule = getSchedule(groupTeams);
      const todayMatch = schedule[targetDay - 1]?.find((m: any) => m.home.id === user.uid || m.away.id === user.uid);
      if (!todayMatch) throw new Error("No match scheduled");
      const opponent = todayMatch.home.id === user.uid ? todayMatch.away : todayMatch.home;
      const [detScoreA, detScoreB] = getMatchResult(todayMatch.home.id, todayMatch.away.id, targetDay);
      const forcedScoreA = todayMatch.home.id === user.uid ? detScoreA : detScoreB;
      const forcedScoreB = todayMatch.away.id === user.uid ? detScoreA : detScoreB;
      const botPowerMultiplier = 1.2 + ((10 - leagueLevel) * 0.15); 
      const result = await simulateMobaMatch({
        teamA: { name: profile.displayName || "My Team", strategy, heroes: team },
        teamB: { name: opponent.name || "Unknown Team", strategy: "Advanced Tactics", heroes: INITIAL_HEROES.map(h => ({ ...h, baseStats: { ...h.baseStats, attack: Math.round(h.baseStats.attack * botPowerMultiplier) + 30, health: Math.round(h.baseStats.health * botPowerMultiplier) + 300 } })) },
        includeRandomEvents: true, isBo2: true, scoreA: forcedScoreA, scoreB: forcedScoreB
      });
      let customPlayedAt = undefined;
      if (targetDay < seasonDay && seasonStartDate) {
        const d = new Date(seasonStartDate); d.setDate(d.getDate() + (targetDay - 1));
        const [h, m] = matchTime.split(':').map(Number); d.setHours(h, m, 0, 0); customPlayedAt = d.toISOString();
      }
      recordMatch(result.winner, result, targetDay, opponent.name || "Unknown Team", 'league', customPlayedAt);
      if (targetDay === seasonDay) { setCurrentResult({ ...result, day: targetDay, opponentName: opponent.name }); setShowResultDialog(true); }
    } catch (e: any) { console.error("Sim failed", e); } finally { setIsSimulating(false); simulationRef.current = false; setSyncing(false); }
  };

  const t = { 
    title: language === 'ru' ? 'ИТОГИ СЕЗОНА' : 'SEASON RESULTS', 
    congrats: language === 'ru' ? 'СЕЗОН ЗАВЕРШЕН!' : 'SEASON COMPLETE!', 
    pos: language === 'ru' ? 'Ваше место:' : 'Your Place:', 
    pts: language === 'ru' ? 'Набрано очков:' : 'Points Scored:', 
    promoted: language === 'ru' ? 'ПОВЫШЕНИЕ В КЛАССЕ!' : 'PROMOTED!', 
    demoted: language === 'ru' ? 'ПОНИЖЕНИЕ В КЛАССЕ' : 'RELEGATED', 
    stayed: language === 'ru' ? 'ПОЗИЦИЯ СОХРАНЕНА' : 'POSITION MAINTAINED', 
    next: language === 'ru' ? 'СЛЕДУЮЩИЙ СЕЗОН' : 'NEXT SEASON',
    matchSummary: language === 'ru' ? 'Обзор матча' : 'Match Summary'
  };

  return (
    <>
      <Dialog open={showResultDialog} onOpenChange={(open) => { setShowResultDialog(open); if (!open && currentResult) markMatchAsSeen(currentResult.day); }}>
        <DialogContent className="max-w-md p-0 overflow-hidden bg-background border-white/5">
          <div className={cn("p-6 text-center border-b", currentResult?.scoreA > currentResult?.scoreB ? "bg-primary/10 border-primary/20" : "bg-accent/10 border-accent/20")}>
            <Trophy className="w-16 h-16 mx-auto mb-3 text-primary" />
            <DialogTitle className="text-3xl font-headline font-bold mb-1 uppercase">
              {currentResult?.scoreA > currentResult?.scoreB ? (language === 'ru' ? 'ПОБЕДА' : 'VICTORY') : (language === 'ru' ? 'МАТЧ ОКОНЧЕН' : 'MATCH OVER')}
            </DialogTitle>
            <DialogDescription className="sr-only">{t.matchSummary}</DialogDescription>
            <div className="flex items-center justify-center gap-4 text-2xl font-headline font-bold mt-2">
              <span>{currentResult?.scoreA}</span>
              <span className="opacity-30">:</span>
              <span>{currentResult?.scoreB}</span>
            </div>
          </div>
          <div className="p-6 space-y-6">
            <p className="text-sm leading-relaxed text-muted-foreground italic">"{currentResult?.matchSummary}"</p>
          </div>
          <DialogFooter className="p-4 bg-secondary/20">
            <Button onClick={() => setShowResultDialog(false)} className="w-full font-bold uppercase text-[10px] h-12">
              {language === 'ru' ? 'ЗАКРЫТЬ' : 'CLOSE'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!seasonResults} onOpenChange={(open) => !open && dismissSeasonResults()}>
        <DialogContent className="max-w-md p-0 overflow-hidden bg-background border-white/10 shadow-2xl">
          <div className="p-8 text-center bg-gradient-to-br from-primary/20 via-background to-accent/10 border-b border-white/5">
            <div className="mx-auto w-20 h-20 rounded-full bg-secondary/50 flex items-center justify-center mb-4 border-2 border-primary">
              {seasonResults?.promoted ? <ArrowUpCircle className="w-10 h-10 text-primary animate-bounce" /> : <MinusCircle className="w-10 h-10 text-accent" />}
            </div>
            <DialogTitle className="text-2xl font-headline font-bold uppercase tracking-tight text-primary">{t.congrats}</DialogTitle>
            <DialogDescription className="sr-only">{t.title}</DialogDescription>
          </div>
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
            <div className={cn("p-6 rounded-xl border-2 text-center", seasonResults?.promoted ? "bg-primary/10 border-primary/30" : "bg-accent/10 border-accent/30")}>
              <h3 className="text-xl font-headline font-bold uppercase">{seasonResults?.promoted ? t.promoted : t.stayed}</h3>
            </div>
          </div>
          <DialogFooter className="p-6 bg-secondary/20 border-t border-white/5">
            <Button className="w-full h-14 hero-gradient font-bold uppercase text-xs" onClick={dismissSeasonResults}>{t.next}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}