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
}

const DEFAULT_STATE: GameState = {
  credits: 500,
  ownedHeroes: INITIAL_HEROES,
  team: INITIAL_HEROES,
  strategy: 'Balanced Play',
  rank: 1000,
  matchHistory: [],
  language: 'ru'
};

export function useGameState() {
  const [state, setState] = useState<GameState>(DEFAULT_STATE);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('moba_tactics_state');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Безопасное слияние: берем дефолты и накладываем сохраненные данные.
        // Это защищает от ошибок, если в сохраненном стейте нет новых полей (как language).
        setState(prev => ({ 
          ...prev, 
          ...parsed,
          language: parsed.language || prev.language 
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

  const recordMatch = (winner: string, result: any) => {
    const isWin = winner === 'My Team' || winner === 'Моя Команда';
    setState(s => ({
      ...s,
      credits: s.credits + (isWin ? 200 : 50),
      rank: s.rank + (isWin ? 25 : -15),
      matchHistory: [result, ...s.matchHistory].slice(0, 10)
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
    recordMatch
  };
}
