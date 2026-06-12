
'use client';

/**
 * @fileOverview Global Group Synchronized Match Manager.
 * Orchestrates simulation for ALL matches in the group simultaneously.
 */

import { useState, useEffect, useRef } from 'react';
import { useGameState, LineupSlot } from '@/app/lib/store';
import { useUser, useFirestore } from '@/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { 
  Dialog, DialogContent, DialogTitle, DialogDescription
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';
import { Trophy } from 'lucide-react';
import { simulateMobaMatch } from '@/ai/flows/simulate-moba-match';
import { generateBotSquad } from '@/app/lib/moba-data';
import { useToast } from '@/hooks/use-toast';
import { getMatchResult } from '@/app/lib/leagues-data';

function sanitize(obj: any) {
  return JSON.parse(JSON.stringify(obj));
}

export function AutoMatchManager() {
  const { 
    isLoaded, selectedLeagueId, id: userId, 
    strategy, ownedHeroes, lineup, recordMatch, displayName, language,
    groupMatches
  } = useGameState();
  const db = useFirestore();
  const router = useRouter();
  const { toast } = useToast();
  
  const [showResultDialog, setShowResultDialog] = useState(false);
  const [lastProcessedMatch, setLastMatch] = useState<any | null>(null);
  const processingRef = useRef<Set<string>>(new Set());

  /**
   * Performs deterministic simulation for any match in the group.
   */
  const processGroupMatch = async (match: any) => {
    if (processingRef.current.has(match.id)) return;
    processingRef.current.add(match.id);
    
    const isOurMatch = match.homeId === userId || match.awayId === userId;

    try {
      // 1. Get deterministic Bo2 series score (Shared result for all players)
      const [finalScoreA, finalScoreB] = getMatchResult(match.homeId, match.awayId, match.day, false);

      // 2. Prepare squads
      let squadA, squadB, stratA, stratB;

      if (isOurMatch) {
        // Detailed simulation for the player's own match
        const activeSlots: LineupSlot[] = ['carry', 'mid', 'offlane', 'support', 'full_support'];
        const myHeroes = activeSlots.map(slot => ownedHeroes.find(h => h.id === lineup[slot])).filter(Boolean);
        
        // Fill empty slots with bots to prevent crashes
        const mySquad = myHeroes.map(h => ({
          name: h!.name, role: h!.role, overallRating: h!.overallRating, proStats: h!.proStats, isSub: false
        }));
        while (mySquad.length < 5) {
          mySquad.push({ name: `Substitute Bot ${mySquad.length + 1}`, role: 'Support', overallRating: 20, proStats: generateBotSquad(20)[0].proStats, isSub: false });
        }

        const opponentSquad = generateBotSquad(25);
        
        if (match.homeId === userId) {
          squadA = mySquad; stratA = strategy;
          squadB = opponentSquad; stratB = 'Balanced Play';
        } else {
          squadA = opponentSquad; stratA = 'Balanced Play';
          squadB = mySquad; stratB = strategy;
        }
      } else {
        // Ghost simulation for bot vs bot or other players
        squadA = generateBotSquad(25);
        squadB = generateBotSquad(25);
        stratA = 'Balanced Play';
        stratB = 'Balanced Play';
      }

      // 3. AI Narrative Generation
      const simulationResult = await simulateMobaMatch({
        teamA: { name: match.homeName, strategy: stratA, heroes: squadA },
        teamB: { name: match.awayName, strategy: stratB, heroes: squadB },
        isBo2: true,
        scoreA: finalScoreA,
        scoreB: finalScoreB
      });

      // 4. Update Source of Truth (Firestore)
      const matchRef = doc(db, 'matches_v1', match.id);
      await updateDoc(matchRef, {
        status: 'finished',
        scoreA: finalScoreA,
        scoreB: finalScoreB,
        winnerId: finalScoreA > finalScoreB ? match.homeId : (finalScoreA < finalScoreB ? match.awayId : null),
        simulation: sanitize(simulationResult),
        finishedAt: new Date().toISOString()
      });

      // 5. Personal local history and UI feedback
      if (isOurMatch) {
        const isHome = match.homeId === userId;
        const myScoreA = isHome ? finalScoreA : finalScoreB;
        const myScoreB = isHome ? finalScoreB : finalScoreA;
        const myWinner = myScoreA > myScoreB ? displayName : (myScoreA === myScoreB ? "Draw" : (isHome ? match.awayName : match.homeName));

        recordMatch(
          myWinner,
          {
            scoreA: myScoreA,
            scoreB: myScoreB,
            duration: simulationResult.games[0].duration,
            mvp: simulationResult.games[0].mvp,
            matchSummary: simulationResult.games[0].matchSummary,
            games: simulationResult.games,
            seriesScore: simulationResult.seriesScore,
            timeline: simulationResult.games[0].timeline,
            scoreboard: simulationResult.games[0].scoreboard
          },
          50000,
          isHome ? match.awayName : match.homeName,
          'league',
          new Date().toISOString(),
          match.id
        );

        setLastMatch(match);
        setShowResultDialog(true);
        toast({ title: language === 'ru' ? "Сражение завершено!" : "Engagement concluded!" });
      }
    } catch (error) {
      console.error("Group sync failed for", match.id, error);
      processingRef.current.delete(match.id);
    }
  };

  useEffect(() => {
    if (!isLoaded || !groupMatches || !userId) return;
    const now = Date.now();
    
    // Check ALL matches in the group schedule
    const dueMatches = groupMatches.filter(m => {
      const startTime = new Date(m.startTime).getTime();
      return m.status === 'pending' && now >= startTime;
    });

    dueMatches.forEach(processGroupMatch);
  }, [groupMatches, isLoaded, userId]);

  if (!isLoaded || !selectedLeagueId) return null;

  return (
    <Dialog open={showResultDialog} onOpenChange={setShowResultDialog}>
      <DialogContent className="max-w-sm bg-card border-white/10 p-0 overflow-hidden shadow-2xl">
        <div className="p-6 text-center bg-gradient-to-br from-primary/20 via-background to-accent/10 border-b border-white/5">
          <div className="mx-auto w-16 h-16 rounded-full bg-secondary/50 flex items-center justify-center mb-4 border-2 border-primary">
            <Trophy className="w-8 h-8 text-primary animate-bounce" />
          </div>
          <DialogTitle className="text-xl font-headline font-bold uppercase tracking-tight text-primary">BATTLE FINALIZED</DialogTitle>
          <DialogDescription className="text-[10px] text-muted-foreground mt-2 uppercase tracking-widest font-black leading-relaxed">
            The operational results for your group have been synchronized with HQ.
          </DialogDescription>
        </div>
        <div className="p-6">
           <Button 
            className="w-full h-14 hero-gradient font-black text-xs tracking-widest shadow-xl" 
            onClick={() => { 
              setShowResultDialog(false); 
              router.push(`/match?id=${lastProcessedMatch?.id}`); 
            }}
           >
             VIEW TACTICAL LOG
           </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
