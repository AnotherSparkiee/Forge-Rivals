
'use server';

/**
 * @fileOverview Серверный модуль инициализации мира v55.
 * Реализует логику стратегического размещения игроков в глобальную базу лиги.
 * Приоритет: Высшие лиги (Див 1) -> Низшие лиги (Див 9).
 */

import { collection, getDocs, query, where } from 'firebase/firestore';
import { initializeFirebase } from '@/firebase';
import { getGroupsCountInLevel } from '@/app/lib/leagues-data';

/**
 * Находит первое свободное место (занятое ботом) в иерархии лиги.
 * Приоритет: Дивизион 1 (Вершина) -> Дивизион 9 (Основание).
 */
export async function findStrategicPlacement(leagueId: string) {
  const { firestore: db } = initializeFirebase();
  
  console.log(`[PLACEMENT v55] Scanning occupied slots for league ${leagueId}...`);

  // 1. Получаем всех реальных игроков в этой лиге
  const q = query(collection(db, 'players_v10'), where('selectedLeagueId', '==', leagueId));
  const snap = await getDocs(q);
  
  const occupiedSlots = new Set<string>();
  snap.forEach(d => {
    const data = d.data();
    if (data.leagueLevel && data.groupId && data.rank) {
      // Ключ уникальности: Уровень_Группа_Ранг
      occupiedSlots.add(`${data.leagueLevel}_${data.groupId}_${data.rank}`);
    }
  });

  console.log(`[PLACEMENT v55] Found ${occupiedSlots.size} occupied slots.`);

  // 2. Ищем первый свободный слот (сверху вниз: Див 1 -> Див 9)
  for (let tier = 1; tier <= 9; tier++) {
    const groupsInTier = getGroupsCountInLevel(tier);
    for (let group = 1; group <= groupsInTier; group++) {
      for (let rank = 1; rank <= 8; rank++) {
        const key = `${tier}_${group}_${rank}`;
        if (!occupiedSlots.has(key)) {
          console.log(`[PLACEMENT v55] SUCCESS: Assigned Slot: Tier ${tier}, Group ${group}, Rank ${rank}`);
          return { tier, group, rank };
        }
      }
    }
  }

  // Fallback (если пирамида переполнена)
  return { tier: 9, group: 1, rank: 1 };
}
