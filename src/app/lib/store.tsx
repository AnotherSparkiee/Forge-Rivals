
'use client';

/**
 * @fileOverview Глобальное хранилище данных клуба.
 * Реализует иерархическую загрузку: Root Pointer -> League Group -> Team Data.
 */

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode, useRef, useMemo } from 'react';
import { Hero, StaffMember, StaffRole } from './moba-data';
import { getMoscowTime, getGlobalSeasonInfo } from './time-utils';
import { useUser, useFirestore } from '@/firebase';
import { doc, onSnapshot, collection, query, where, getDocs, updateDoc, setDoc } from 'firebase/firestore';

export type LineupSlot = 'carry' | 'mid' | 'offlane' | 'support' | 'full_support' | 'sub1' | 'sub2' | 'res1' | 'res2' | 'res3' | 'res4' | 'res5' | 'res6' | 'res7' | 'res8';

interface GameState {
  credits: number; crystals: number; experiencePoints: number; managerLevel: number;
  leagueLevel: number; groupId: number; selectedLeagueId: string | null;
  displayName: string; id: string; isLoaded: boolean;
  lineup: Record<LineupSlot, string | null>;
  ownedHeroes: Hero[];
  staff: Record<StaffRole, StaffMember | null>;
}

const DEFAULT_STATE: GameState = {
  credits: 0, crystals: 0, experiencePoints: 0, managerLevel: 1,
  leagueLevel: 9, groupId: 1, selectedLeagueId: null,
  displayName: 'Manager', id: '', isLoaded: false,
  lineup: { carry: null, mid: null, offlane: null, support: null, full_support: null, sub1: null, sub2: null, res1: null, res2: null, res3: null, res4: null, res5: null, res6: null, res7: null, res8: null },
  ownedHeroes: [],
  staff: { coach: null, analyst: null, scout: null, doctor: null, financier: null }
};

const GameStateContext = createContext<GameState | undefined>(undefined);

export function GameStateProvider({ children }: { children: ReactNode }) {
  const { user, isUserLoading } = useUser();
  const db = useFirestore();
  const [state, setState] = useState<GameState>(DEFAULT_STATE);

  useEffect(() => {
    if (isUserLoading || !user) {
      if (!isUserLoading) setState(s => ({ ...s, isLoaded: true }));
      return;
    }

    // 1. Get Root Pointer
    const rootRef = doc(db, 'players_v10', user.uid);
    const unsubRoot = onSnapshot(rootRef, (snap) => {
      if (!snap.exists()) return;
      const rootData = snap.data();
      const { selectedLeagueId, leagueLevel, groupId } = rootData;

      if (!selectedLeagueId) {
        setState(s => ({ ...s, id: user.uid, displayName: rootData.displayName, isLoaded: true }));
        return;
      }

      // 2. Subscribe to Team Data in Pyramid Hierarchy
      const teamRef = doc(db, 'leagues_v2', selectedLeagueId, 'divisions', String(leagueLevel), 'groups', String(groupId), 'teams', user.uid);
      
      const unsubTeam = onSnapshot(teamRef, (teamSnap) => {
        const teamData = teamSnap.data() || {};
        
        // 3. Subscribe to sub-collections (Heroes & Staff)
        const heroesUnsub = onSnapshot(collection(teamRef, 'heroes'), (hSnap) => {
          const heroes = hSnap.docs.map(d => ({ ...d.data(), id: d.id } as Hero));
          
          const staffUnsub = onSnapshot(collection(teamRef, 'staff'), (sSnap) => {
            const staffObj: any = {};
            sSnap.docs.forEach(d => {
              const m = d.data() as StaffMember;
              staffObj[m.role] = m;
            });

            setState(s => ({
              ...s,
              id: user.uid,
              displayName: rootData.displayName,
              selectedLeagueId,
              leagueLevel,
              groupId,
              credits: teamData.credits ?? 0,
              crystals: teamData.crystals ?? 0,
              managerLevel: teamData.managerLevel ?? 1,
              lineup: teamData.lineup || s.lineup,
              ownedHeroes: heroes,
              staff: staffObj,
              isLoaded: true
            }));
          });
        });
      });
    });

    return () => unsubRoot();
  }, [user, isUserLoading, db]);

  return (
    <GameStateContext.Provider value={state}>
      {children}
    </GameStateContext.Provider>
  );
}

export function useGameState() {
  const context = useContext(GameStateContext);
  if (context === undefined) throw new Error('useGameState must be used within a GameStateProvider');
  return context;
}
