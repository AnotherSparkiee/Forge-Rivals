'use server';

/**
 * @fileOverview Серверный модуль инициализации мира v48.
 * Реализует логику стратегического размещения игроков в пирамиде лиг.
 */

import { collection, getDocs, query, where, doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { initializeFirebase } from '@/firebase';

/**
 * Находит первое свободное место (занятое ботом) в иерархии лиги.
 * Приоритет: Дивизион 1 -> Дивизион 9.
 */
export async function findStrategicPlacement(leagueId: string) {
  const { firestore: db } = initializeFirebase();
  
  // 1. Получаем всех реальных игроков в этой лиге
  const q = query(collection(db, 'players_v10'), where('selectedLeagueId', '==', leagueId));
  const snap = await getDocs(q);
  
  const occupiedIndices = new Set<number>();
  
  snap.forEach(d => {
    const data = d.data();
    const tier = Number(data.leagueLevel || 9);
    const group = Number(data.groupId || 1);
    const rank = Number(data.rank || 1);
    
    // Формула глобального индекса слота (0-4087)
    const groupsBefore = Math.pow(2, tier - 1) - 1;
    const globalIndex = (groupsBefore * 8) + (group - 1) * 8 + (rank - 1);
    occupiedIndices.add(globalIndex);
  });

  // 2. Ищем первый свободный индекс (сверху вниз)
  let foundIndex = 0;
  for (let i = 0; i < 4088; i++) {
    if (!occupiedIndices.has(i)) {
      foundIndex = i;
      break;
    }
  }

  // 3. Конвертируем индекс обратно в координаты пирамиды
  const groupIndex = Math.floor(foundIndex / 8);
  const tier = Math.floor(Math.log2(groupIndex + 1)) + 1;
  const groupsBefore = Math.pow(2, tier - 1) - 1;
  const group = (groupIndex - groupsBefore) + 1;
  const rank = (foundIndex % 8) + 1;

  console.log(`[PLACEMENT v48] Assigning player to: League ${leagueId}, Tier ${tier}, Group ${group}, Slot ${rank}`);

  return { tier, group, rank };
}

/**
 * Заглушка для совместимости, основная логика теперь в AutoMatchManager
 */
export async function ensureWorldInitialized(seasonNum: number, leagueId: string, tier: number, group: number, userId: string) {
  return { success: true };
}
