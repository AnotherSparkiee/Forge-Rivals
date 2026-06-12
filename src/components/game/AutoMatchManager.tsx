
'use client';

/**
 * @fileOverview Глобальный синхронизированный симулятор матчей.
 * Обрабатывает ВСЕ матчи группы одновременно для поддержания единого рейтинга.
 */

import { useState, useEffect, useRef } from 'react';
import { useGameState, LineupSlot } from '@/app/lib/store';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, doc, updateDoc, getDocs, getDoc } from 'firebase/firestore';
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
    isLoaded, selectedLeagueId, leagueLevel, groupId, id: userId, 
    strategy, ownedHeroes, lineup, recordMatch, displayName, language,
    groupMatches
  } = useGameState();
  const db = useFirestore();
  const router = useRouter();
  const { toast } = useToast();
  
  const [showResultDialog, setShowResultDialog] = useState(false);
  const [lastMatch, setLastMatch] = useState<any | null>(null);
  const [isSimulating, setIsSimulating] = useState(false);
  
  // Отслеживание матчей, которые уже симулируются этим клиентом
  const processedMatches = useRef<Set<string>>(new Set());

  const performSimulation = async (match: any) => {
    if (processedMatches.current.has(match.id)) return;
    processedMatches.current.add(match.id);
    
    // Метка для UI только если это наш матч
    const isOurMatch = match.homeId === userId || match.awayId === userId;
    if (isOurMatch) setIsSimulating(true);

    try {
      console.log(`ARCHITECT: Syncing group match ${match.id}`);
      
      const isHome = match.homeId === userId;
      const isAway = match.awayId === userId;

      // 1. Детерминированный результат (для консистентности очков в группе)
      const [finalScoreA, finalScoreB] = getMatchResult(match.homeId, match.awayId, match.day, false);

      // 2. Сбор данных для симуляции
      let squadA: any[] = [];
      let squadB: any[] = [];
      let strategyA = 'Balanced Play';
      let strategyB = 'Balanced Play';

      // Если это наш матч, берем реальных героев. Если нет - ботов (для синхронности группы)
      if (isOurMatch) {
        const activeSlots: LineupSlot[] = ['carry', 'mid', 'offlane', 'support', 'full_support'];
        const myHeroes = activeSlots.map(slot => ownedHeroes.find(h => h.id === lineup[slot])).filter(Boolean);
        const mySquad = myHeroes.map(h => ({
          name: h!.name, role: h!.role, overallRating: h!.overallRating, proStats: h!.proStats, isSub: false
        }));
        
        if (isHome) { squadA = mySquad; strategyA = strategy; squadB = generateBotSquad(25); }
        else { squadB = mySquad; strategyB = strategy; squadA = generateBotSquad(25); }
      } else {
        // Матч других игроков группы
        squadA = generateBotSquad(25);
        squadB = generateBotSquad(25);
      }

      // 3. AI Симуляция (для таймлайна и статистики)
      const simulationResult = await simulateMobaMatch({
        teamA: { name: match.homeName, strategy: strategyA, heroes: squadA },
        teamB: { name: match.awayName, strategy: strategyB, heroes: squadB },
        isBo2: true,
        scoreA: finalScoreA,
        scoreB: finalScoreB
      });

      // 4. Глобальное обновление в matches_v1
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

      // 5. Локальная запись в историю (только если наш матч)
      if (isOurMatch) {
        const myResultScoreA = isHome ? finalScoreA : finalScoreB;
        const myResultScoreB = isHome ? finalScoreB : finalScoreA;
        const myWinner = myResultScoreA > myResultScoreB ? displayName : (myResultScoreA === myResultScoreB ? "Draw" : (isHome ? match.awayName : match.homeName));

        recordMatch(
          myWinner,
          {
            scoreA: myResultScoreA,
            scoreB: myResultScoreB,
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
        toast({ title: language === 'ru' ? "Ваш матч завершен!" : "Your match completed!" });
      }

    } catch (error) {
      console.error("Simulation failed", error);
      processedMatches.current.delete(match.id);
    } finally {
      if (isOurMatch) setIsSimulating(false);
    }
  };

  useEffect(() => {
    if (!groupMatches || !userId || !isLoaded) return;
    const mskNow = Date.now();
    
    // Ищем ВСЕ матчи группы, время которых пришло, но они еще не завершены
    const pendingMatches = groupMatches.filter(m => {
      const startTime = new Date(m.startTime).getTime();
      return m.status === 'pending' && mskNow >= startTime;
    });

    pendingMatches.forEach(match => {
      performSimulation(match);
    });
  }, [groupMatches, userId, isLoaded]);

  if (!isLoaded || !selectedLeagueId) return null;

  return (
    <Dialog open={showResultDialog} onOpenChange={setShowResultDialog}>
      <DialogContent className="max-w-sm bg-card border-white/10 p-0 overflow-hidden shadow-2xl">
        <div className="p-6 text-center bg-gradient-to-br from-primary/20 via-background to-accent/10 border-b border-white/5">
          <div className="mx-auto w-16 h-16 rounded-full bg-secondary/50 flex items-center justify-center mb-4 border-2 border-primary shadow-[0_0_20px_rgba(var(--primary),0.3)]">
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
