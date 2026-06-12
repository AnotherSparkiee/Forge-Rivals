'use client';

/**
 * @fileOverview Глобальный автономный монитор матчей. 
 * Отвечает за инициализацию календарей и симуляцию всех игр в группе.
 */

import { useEffect, useRef } from 'react';
import { useGameState, LineupSlot } from '@/app/lib/store';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { doc, updateDoc, setDoc, getDoc, writeBatch, collection, query, where } from 'firebase/firestore';
import { simulateMobaMatch } from '@/ai/flows/simulate-moba-match';
import { generateBotSquad } from '@/app/lib/moba-data';
import { getMatchResult, generateDeterministicDayMatches, getStableGroupTeams } from '@/app/lib/leagues-data';

function sanitize(obj: any) {
  try {
    return JSON.parse(JSON.stringify(obj));
  } catch (e) {
    return null;
  }
}

export function AutoMatchManager() {
  const { 
    isLoaded, id: userId, 
    strategy, ownedHeroes, lineup, recordMatch,
    groupMatches, seasonNumber, leagueLevel, groupId, selectedLeagueId
  } = useGameState();
  const db = useFirestore();
  const processingRef = useRef<Set<string>>(new Set());
  const initTriggeredRef = useRef<string>("");

  const leaguePlayersQuery = useMemoFirebase(() => {
    if (!selectedLeagueId) return null;
    return query(collection(db, 'players_v10'), where('selectedLeagueId', '==', selectedLeagueId));
  }, [db, selectedLeagueId]);

  const { data: allLeaguePlayers } = useCollection(leaguePlayersQuery);

  /**
   * Инициализация расписания на весь сезон для всей группы (56 матчей).
   */
  const ensureScheduleExists = async () => {
    if (!selectedLeagueId || !leagueLevel || !groupId || !seasonNumber || !allLeaguePlayers) return;
    
    const syncKey = `${selectedLeagueId}_${leagueLevel}_${groupId}_${seasonNumber}`;
    if (initTriggeredRef.current === syncKey) return;
    initTriggeredRef.current = syncKey;

    try {
      const firstMatchId = `match_${seasonNumber}_${selectedLeagueId}_${leagueLevel}_${groupId}_d1_m0`;
      const firstSnap = await getDoc(doc(db, 'matches_v1', firstMatchId));
      
      if (!firstSnap.exists()) {
        console.log("Generating global schedule for group:", syncKey);
        
        const teams = getStableGroupTeams(leagueLevel, groupId, selectedLeagueId, allLeaguePlayers);
        const batch = writeBatch(db);
        
        for (let d = 1; d <= 14; d++) {
          const dayMatches = generateDeterministicDayMatches(leagueLevel, groupId, selectedLeagueId, seasonNumber, d, teams);
          dayMatches.forEach(m => {
            batch.set(doc(db, 'matches_v1', m.id), m, { merge: true });
          });
        }
        await batch.commit();
      }
    } catch (e) {
      console.error("Schedule generation error:", e);
    }
  };

  /**
   * Симуляция и запись результата для любого матча в группе.
   */
  const processPendingMatch = async (match: any) => {
    if (processingRef.current.has(match.id)) return;
    processingRef.current.add(match.id);

    try {
      // 1. Проверяем, не записал ли кто-то результат за время ожидания
      const freshSnap = await getDoc(doc(db, 'matches_v1', match.id));
      if (freshSnap.exists() && freshSnap.data()?.status === 'finished') {
        processingRef.current.delete(match.id);
        return;
      }

      // 2. Детерминированный исход Bo2
      const [finalScoreH, finalScoreA] = getMatchResult(match.homeId, match.awayId, match.day, seasonNumber);
      const isOurMatch = match.homeId === userId || match.awayId === userId;
      
      let simulationResult;

      if (isOurMatch) {
        // AI-симуляция для матча игрока
        const activeSlots: LineupSlot[] = ['carry', 'mid', 'offlane', 'support', 'full_support'];
        const myHeroes = activeSlots.map(slot => ownedHeroes.find(h => h.id === lineup[slot])).filter(Boolean);
        
        const mySquad = myHeroes.map(h => ({ 
          name: h!.name, role: h!.role, overallRating: h!.overallRating, proStats: h!.proStats, isSub: false 
        }));
        
        while (mySquad.length < 5) {
          mySquad.push({ 
            name: `Reserve AI`, role: 'Support', overallRating: 20, 
            proStats: generateBotSquad(20)[0].proStats, isSub: false 
          });
        }
        
        const opponentSquad = generateBotSquad(25);
        const stratA = match.homeId === userId ? strategy : 'Balanced Play';
        const stratB = match.homeId === userId ? 'Balanced Play' : strategy;

        simulationResult = await simulateMobaMatch({
          teamA: { name: match.homeName, strategy: stratA, heroes: match.homeId === userId ? mySquad : opponentSquad },
          teamB: { name: match.awayName, strategy: stratB, heroes: match.awayId === userId ? mySquad : opponentSquad },
          isBo2: true, scoreA: finalScoreH, scoreB: finalScoreA
        });

        // Запись в локальную историю игрока
        const myScoreA = match.homeId === userId ? finalScoreH : finalScoreA;
        const myScoreB = match.homeId === userId ? finalScoreA : finalScoreH;
        const opponentName = match.homeId === userId ? match.awayName : match.homeName;

        recordMatch(
          myScoreA > myScoreB ? (match.homeId === userId ? match.homeName : match.awayName) : (myScoreA === myScoreB ? "Draw" : opponentName),
          { ...simulationResult.games[0], scoreA: myScoreA, scoreB: myScoreB, games: simulationResult.games, seriesScore: `${myScoreA}-${myScoreB}` },
          50000, opponentName, 'league', new Date().toISOString(), match.id
        );
      } else {
        // Упрощенная симуляция для матчей ботов/других игроков
        simulationResult = { 
          winner: finalScoreH > finalScoreA ? match.homeName : (finalScoreH === finalScoreA ? "Draw" : match.awayName), 
          seriesScore: `${finalScoreH}-${finalScoreA}`, 
          games: [
            { scoreA: finalScoreH > 0 ? 1 : 0, scoreB: finalScoreA > 0 ? 0 : 0, duration: "35:00", matchSummary: "Standard performance.", timeline: [], scoreboard: [] },
            { scoreA: finalScoreH > 1 ? 1 : 0, scoreB: finalScoreA > 1 ? 1 : 0, duration: "35:00", matchSummary: "Standard performance.", timeline: [], scoreboard: [] }
          ] 
        };
      }

      // 3. Сохранение в глобальную базу данных
      await updateDoc(doc(db, 'matches_v1', match.id), {
        status: 'finished',
        scoreA: finalScoreH,
        scoreB: finalScoreA,
        winnerId: finalScoreH > finalScoreA ? match.homeId : (finalScoreH < finalScoreA ? match.awayId : null),
        simulation: sanitize(simulationResult),
        finishedAt: new Date().toISOString()
      });

    } catch (e) {
      console.error("Match persistence failed:", match.id, e);
    } finally {
      processingRef.current.delete(match.id);
    }
  };

  useEffect(() => {
    if (!isLoaded || !userId || !allLeaguePlayers) return;
    
    // Инициализация календаря всей группы
    ensureScheduleExists();

    if (!groupMatches || groupMatches.length === 0) return;
    
    const now = Date.now();
    
    // Поиск матчей, которые должны быть сыграны
    const dueMatches = groupMatches.filter(m => {
      const startTime = new Date(m.startTime).getTime();
      return m.status === 'pending' && now >= startTime;
    });

    // Обрабатываем последовательно, чтобы не спамить в Firestore
    dueMatches.forEach(processPendingMatch);
  }, [groupMatches, isLoaded, userId, selectedLeagueId, leagueLevel, groupId, seasonNumber, allLeaguePlayers]);

  return null;
}
