'use server';

/**
 * @fileOverview Серверный модуль инициализации мира v49.
 * Реализует логику стратегического размещения игроков с приоритетом в высшие дивизионы (1 -> 9).
 */

import { collection, getDocs, query, where } from 'firebase/firestore';
import { initializeFirebase } from '@/firebase';
import { getGroupsCountInLevel } from '@/app/lib/leagues-data';

/**
 * Находит первое свободное место (занятое ботом) в иерархии лиги.
 * Приоритет: Дивизион 1 -> Дивизион 9.
 */
export async function findStrategicPlacement(leagueId: string) {
  const { firestore: db } = initializeFirebase();
  
  // 1. Получаем всех реальных игроков в этой лиге
  const q = query(collection(db, 'players_v10'), where('selectedLeagueId', '==', leagueId));
  const snap = await getDocs(q);
  
  // Создаем карту занятых слотов: "level_group_rank"
  const occupiedSlots = new Set<string>();
  
  snap.forEach(d => {
    const data = d.data();
    if (data.leagueLevel && data.groupId && data.rank) {
      occupiedSlots.add(`${data.leagueLevel}_${data.groupId}_${data.rank}`);
    }
  });

  // 2. Ищем первый свободный слот (сверху вниз: Див 1 -> Див 9)
  for (let tier = 1; tier <= 9; tier++) {
    const groupsInTier = getGroupsCountInLevel(tier);
    for (let group = 1; group <= groupsInTier; group++) {
      for (let rank = 1; group <= 8; rank++) {
        // Мы используем ботов для заполнения пустых мест, поэтому любое место, 
        // не занятое реальным игроком, считается доступным для "захвата".
        const key = `${tier}_${group}_${rank}`;
        if (!occupiedSlots.has(key)) {
          console.log(`[PLACEMENT v49] Assigning player to: League ${leagueId}, Tier ${tier}, Group ${group}, Rank ${rank}`);
          return { tier, group, rank };
        }
        
        // Лимит 8 команд в группе
        if (rank === 8) break;
      }
    }
  }

  // Fallback (если все 4088 мест заняты, что маловероятно для прототипа)
  return { tier: 9, group: 256, rank: 8 };
}

/**
 * Заглушка для совместимости
 */
export async function ensureWorldInitialized(seasonNum: number, leagueId: string, tier: number, group: number, userId: string) {
  return { success: true };
}
