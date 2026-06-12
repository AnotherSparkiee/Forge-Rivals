'use client';

/**
 * @fileOverview Автоматический симулятор матчей.
 * Обнаруживает матчи, время которых пришло, собирает данные команд и проводит расчет.
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

function sanitize(obj: any) {
  return JSON.parse(JSON.stringify(obj));
}

export function AutoMatchManager() {
  const { 
    isLoaded, selectedLeagueId, leagueLevel, groupId, id: userId, 
    strategy, ownedHeroes, lineup, recordMatch, displayName, language
  } = useGameState();
  const db = useFirestore();
  const router = useRouter();
  const { toast } = useToast();
  
  const [showResultDialog, setShowResultDialog] = useState(false);
  const [lastMatch, setLastMatch] = useState<any | null>(null);
  const [isSimulating, setIsSimulating] = useState(false);
  const processingMatches = useRef<Set<string>>(new Set());

  // Слушаем все матчи нашей группы
  const groupMatchesQuery = useMemoFirebase(() => {
    if (!selectedLeagueId || !userId) return null;
    return query(
      collection(db, 'matches_v1'),
      where('leagueId', '==', selectedLeagueId),
      where('divisionId', '==', leagueLevel),
      where('groupId', '==', groupId)
    );
  }, [db, selectedLeagueId, leagueLevel, groupId, userId]);

  const { data: matches } = useCollection(groupMatchesQuery);

  const performSimulation = async (match: any) => {
    if (processingMatches.current.has(match.id)) return;
    processingMatches.current.add(match.id);
    setIsSimulating(true);

    try {
      console.log(`ARCHITECT: Starting simulation for match ${match.id}`);
      
      const isHome = match.homeId === userId;
      const opponentId = isHome ? match.awayId : match.homeId;
      const opponentIsBot = opponentId.startsWith('bot');

      // 1. Собираем активную пятерку игрока
      const activeSlots: LineupSlot[] = ['carry', 'mid', 'offlane', 'support', 'full_support'];
      let mySquad = activeSlots
        .map(slot => ownedHeroes.find(h => h.id === lineup[slot]))
        .filter(h => !!h)
        .map(h => ({
          name: h!.name,
          role: h!.role,
          overallRating: h!.overallRating,
          proStats: h!.proStats,
          isSub: false
        }));

      // Если состав пуст или неполный (что странно для PRO), заполняем ботами для стабильности
      if (mySquad.length < 5) {
        const fillers = generateBotSquad(20).slice(0, 5 - mySquad.length);
        mySquad = [...mySquad, ...fillers];
      }

      let opponentSquad: any[] = [];
      let opponentStrategy = 'Balanced Play';

      if (opponentIsBot) {
        opponentSquad = generateBotSquad(25);
      } else {
        const oppTeamRef = doc(db, 'leagues_v2', match.leagueId, 'divisions', String(match.divisionId), 'groups', String(match.groupId), 'teams', opponentId);
        const oppSnap = await getDoc(oppTeamRef);
        if (oppSnap.exists()) {
          const oppData = oppSnap.data();
          opponentStrategy = oppData.strategy || 'Balanced Play';
          const oppHeroesSnap = await getDocs(collection(oppTeamRef, 'heroes'));
          const oppLineup = oppData.lineup || {};
          
          opponentSquad = activeSlots
            .map(slot => oppHeroesSnap.docs.find(d => d.id === oppLineup[slot])?.data())
            .filter(h => !!h)
            .map(h => ({
              name: h!.name,
              role: h!.role,
              overallRating: h!.overallRating,
              proStats: h!.proStats,
              isSub: false
            }));
        }
        
        if (opponentSquad.length < 5) {
          const fillers = generateBotSquad(20).slice(0, 5 - opponentSquad.length);
          opponentSquad = [...opponentSquad, ...fillers];
        }
      }

      // 2. Запускаем симуляцию
      const teamAData = isHome 
        ? { name: displayName, strategy, heroes: mySquad }
        : { name: match.homeName, strategy: opponentStrategy, heroes: opponentSquad };
      
      const teamBData = isHome
        ? { name: match.awayName, strategy: opponentStrategy, heroes: opponentSquad }
        : { name: displayName, strategy, heroes: mySquad };

      const simulationResult = await simulateMobaMatch({
        teamA: teamAData,
        teamB: teamBData,
        isBo2: false
      });

      // 3. Сохраняем в БД
      const matchRef = doc(db, 'matches_v1', match.id);
      const finishedData = {
        status: 'finished',
        scoreA: simulationResult.games[0].scoreA,
        scoreB: simulationResult.games[0].scoreB,
        winnerId: simulationResult.winner === teamAData.name ? match.homeId : (simulationResult.winner === "Draw" ? null : match.awayId),
        simulation: sanitize(simulationResult.games[0]),
        finishedAt: new Date().toISOString()
      };

      await updateDoc(matchRef, finishedData);

      // 4. Локальная история
      const myResult = isHome ? simulationResult.games[0] : {
        ...simulationResult.games[0],
        scoreA: simulationResult.games[0].scoreB,
        scoreB: simulationResult.games[0].scoreA,
      };

      recordMatch(
        simulationResult.winner === displayName ? displayName : (simulationResult.winner === "Draw" ? "Draw" : (isHome ? match.awayName : match.homeName)),
        myResult,
        50000,
        isHome ? match.awayName : match.homeName,
        'league',
        new Date().toISOString(),
        match.id
      );

      setLastMatch({ ...match, ...finishedData });
      setShowResultDialog(true);
      toast({ title: language === 'ru' ? "Матч завершен!" : "Match Completed!" });

    } catch (error) {
      console.error("Simulation failed", error);
    } finally {
      setIsSimulating(false);
    }
  };

  useEffect(() => {
    if (!matches || !userId) return;
    const mskNow = Date.now();
    const pendingMatch = matches.find(m => {
      const startTime = new Date(m.startTime).getTime();
      return m.status === 'pending' && mskNow >= startTime && (m.homeId === userId || m.awayId === userId);
    });
    if (pendingMatch && !isSimulating) {
      performSimulation(pendingMatch);
    }
  }, [matches, userId, isSimulating]);

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
