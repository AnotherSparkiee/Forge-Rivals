
'use client';

/**
 * @fileOverview Глобальный синхронизированный менеджер матчей.
 * Гарантирует проведение всех матчей группы и запись их в Firestore.
 */

import { useState, useEffect, useRef } from 'react';
import { useGameState, LineupSlot } from '@/app/lib/store';
import { useUser, useFirestore } from '@/firebase';
import { collection, query, where, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
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
  const [lastMatch, setLastMatch] = useState<any | null>(null);
  const processedMatches = useRef<Set<string>>(new Set());

  const performSimulation = async (match: any) => {
    if (processedMatches.current.has(match.id)) return;
    processedMatches.current.add(match.id);
    
    const isOurMatch = match.homeId === userId || match.awayId === userId;

    try {
      // 1. Детерминированный результат (единый для всех клиентов)
      const [finalScoreA, finalScoreB] = getMatchResult(match.homeId, match.awayId, match.day, false);

      // 2. Сбор данных (только если это наш матч)
      let strategyA = 'Balanced Play';
      let strategyB = 'Balanced Play';
      let squadA = generateBotSquad(25);
      let squadB = generateBotSquad(25);

      if (isOurMatch) {
        const activeSlots: LineupSlot[] = ['carry', 'mid', 'offlane', 'support', 'full_support'];
        const myHeroes = activeSlots.map(slot => ownedHeroes.find(h => h.id === lineup[slot])).filter(Boolean);
        const mySquad = myHeroes.map(h => ({
          name: h!.name, role: h!.role, overallRating: h!.overallRating, proStats: h!.proStats, isSub: false
        }));
        
        if (match.homeId === userId) { squadA = mySquad; strategyA = strategy; }
        else { squadB = mySquad; strategyB = strategy; }
      }

      // 3. AI Симуляция
      const simulationResult = await simulateMobaMatch({
        teamA: { name: match.homeName, strategy: strategyA, heroes: squadA },
        teamB: { name: match.awayName, strategy: strategyB, heroes: squadB },
        isBo2: true,
        scoreA: finalScoreA,
        scoreB: finalScoreB
      });

      // 4. Запись в БД (Source of Truth)
      const matchRef = doc(db, 'matches_v1', match.id);
      const finishedData = {
        status: 'finished',
        scoreA: finalScoreA,
        scoreB: finalScoreB,
        winnerId: finalScoreA > finalScoreB ? match.homeId : (finalScoreA < finalScoreB ? match.awayId : null),
        simulation: sanitize(simulationResult),
        finishedAt: new Date().toISOString()
      };

      await updateDoc(matchRef, finishedData);

      // 5. Персональная история и уведомление
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

        setLastMatch({ ...match, ...finishedData });
        setShowResultDialog(true);
        toast({ title: language === 'ru' ? "Матч завершен!" : "Match completed!" });
      }
    } catch (error) {
      console.error("Simulation failed for", match.id, error);
      processedMatches.current.delete(match.id);
    }
  };

  useEffect(() => {
    if (!isLoaded || !groupMatches || !userId) return;
    const now = Date.now();
    
    // Ищем все матчи группы, время которых пришло
    const dueMatches = groupMatches.filter(m => {
      const startTime = new Date(m.startTime).getTime();
      return m.status === 'pending' && now >= startTime;
    });

    dueMatches.forEach(match => {
      performSimulation(match);
    });
  }, [groupMatches, isLoaded, userId]);

  if (!isLoaded || !selectedLeagueId) return null;

  return (
    <Dialog open={showResultDialog} onOpenChange={setShowResultDialog}>
      <DialogContent className="max-w-sm bg-card border-white/10 p-0 overflow-hidden shadow-2xl">
        <div className="p-6 text-center bg-gradient-to-br from-primary/20 via-background to-accent/10 border-b border-white/5">
          <div className="mx-auto w-16 h-16 rounded-full bg-secondary/50 flex items-center justify-center mb-4 border-2 border-primary">
            <Trophy className="w-8 h-8 text-primary animate-bounce" />
          </div>
          <DialogTitle className="text-xl font-headline font-bold uppercase tracking-tight text-primary">OFFICIAL RESULT</DialogTitle>
          <DialogDescription className="text-[10px] text-muted-foreground mt-2 uppercase tracking-widest font-black">
            The league has finalized your recent engagement.
          </DialogDescription>
        </div>
        <div className="p-6">
           <Button 
            className="w-full h-14 hero-gradient font-black text-xs tracking-widest" 
            onClick={() => { 
              setShowResultDialog(false); 
              router.push(`/match?id=${lastMatch?.id}`); 
            }}
           >
             VIEW TACTICAL DEBRIEF
           </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
