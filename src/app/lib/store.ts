'use client';

import { useState, useEffect } from 'react';
import { Hero, INITIAL_HEROES } from './moba-data';

interface GameState {
  credits: number;
  ownedHeroes: Hero[];
  team: Hero[];
  strategy: string;
  rank: number;
  matchHistory: any[];
  language: 'en' | 'ru';
  // League Pyramid State
  leagueLevel: number; // 1-9 (1 is top)
  divisionSubId: number; // 1 to 2^(level-1)
  groupId: number; // 1-8
  lastLeagueMatchDate: string | null; // Format: YYYY-MM-DD
  seasonDay: number; // 1-14
  seasonStartDate: string | null; // Format: YYYY-MM-DD
}

const DEFAULT_STATE: GameState = {
  credits: 500,
  ownedHeroes: INITIAL_HEROES,
  team: INITIAL_HEROES,
  strategy: 'Balanced Play',
  rank: 1000,
  matchHistory: [],
  language: 'ru',
  leagueLevel: 8,
  divisionSubId: 1,
  groupId: 1,
  lastLeagueMatchDate: null,
  seasonDay: 1,
  seasonStartDate: new Date().toISOString().split('T')[0]
};

export function useGameState() {
  const [state, setState] = useState<GameState>(DEFAULT_STATE);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('moba_tactics_state');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        
        // Calculate current season day based on start date
        const today = new Date();
        const start = parsed.seasonStartDate ? new Date(parsed.seasonStartDate) : today;
        const diffTime = Math.abs(today.getTime() - start.getTime());
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;
        
        // Season wraps every 14 days
        const currentDay = ((diffDays - 1) % 14) + 1;

        setState(prev => ({ 
          ...prev, 
          ...parsed,
          seasonDay: currentDay,
          language: parsed.language || prev.language,
        }));
      } catch (e) {
        console.error("Failed to load game state", e);
      }
    }
    setIsLoaded(true);
  }, []);

  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem('moba_tactics_state', JSON.stringify(state));
    }
  }, [state, isLoaded]);

  const addCredits = (amount: number) => {
    setState(s => ({ ...s, credits: s.credits + amount }));
  };

  const buyHero = (hero: Hero) => {
    if (state.credits >= hero.price && !state.ownedHeroes.find(h => h.id === hero.id)) {
      setState(s => ({
        ...s,
        credits: s.credits - hero.price,
        ownedHeroes: [...s.ownedHeroes, hero]
      }));
      return true;
    }
    return false;
  };

  const setTeam = (newTeam: Hero[]) => {
    setState(s => ({ ...s, team: newTeam }));
  };

  const setStrategy = (strategy: string) => {
    setState(s => ({ ...s, strategy }));
  };

  const setLanguage = (lang: 'en' | 'ru') => {
    setState(s => ({ ...s, language: lang }));
  };

  const promoteLeague = () => {
    if (state.leagueLevel > 1) {
      setState(s => ({
        ...s,
        leagueLevel: s.leagueLevel - 1,
        divisionSubId: Math.max(1, Math.ceil(s.divisionSubId / 2)),
        groupId: 1,
        lastLeagueMatchDate: null,
        seasonStartDate: new Date().toISOString().split('T')[0] // Reset season on promotion
      }));
      return true;
    }
    return false;
  };

  const recordMatch = (winner: string, result: any, isAutomated = false) => {
    const scoreA = result.scoreA || 0;
    const scoreB = result.scoreB || 0;
    
    // Points system Bo2: 2-0 = 3pts, 1-1 = 1pt, 0-2 = 0pts
    let creditsEarned = 50;
    let rankChange = -15;

    if (scoreA === 2) {
      creditsEarned = 200;
      rankChange = 25;
    } else if (scoreA === 1) {
      creditsEarned = 100;
      rankChange = 5;
    }

    const today = new Date().toISOString().split('T')[0];
    
    setState(s => ({
      ...s,
      credits: s.credits + creditsEarned,
      rank: s.rank + rankChange,
      matchHistory: [result, ...s.matchHistory].slice(0, 10),
      lastLeagueMatchDate: isAutomated ? today : s.lastLeagueMatchDate
    }));
  };

  return {
    ...state,
    isLoaded,
    addCredits,
    buyHero,
    setTeam,
    setStrategy,
    setLanguage,
    recordMatch,
    promoteLeague
  };
}
