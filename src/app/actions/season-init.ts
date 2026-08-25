
'use server';

/**
 * @fileOverview Серверный модуль инициализации мира v56.
 * Реализует логику стратегического размещения игроков в глобальную базу лиги.
 * Исправлена типизация ключей для исключения наложений.
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
  
  console.log(`[PLACEMENT v56] Scanning occupied slots for league: ${leagueId}`);

  // 1. Получаем всех реальных игроков в этой лиге
  const q = query(collection(db, 'players_v10'), where('selectedLeagueId', '==', leagueId));
  const snap = await getDocs(q);
  
  const occupiedSlots = new Set<string>();
  snap.forEach(d => {
    const data = d.data();
    // Важно: приводим к числу, так как в Firestore могут быть разные типы
    const t = Number(data.leagueLevel);
    const g = Number(data.groupId);
    const r = Number(data.rank);

    if (t && g && r) {
      const key = `${t}_${g}_${r}`;
      occupiedSlots.add(key);
    }
  });

  console.log(`[PLACEMENT v56] Found ${occupiedSlots.size} occupied slots in database.`);

  // 2. Ищем первый свободный слот (сверху вниз: Див 1 -> Див 9)
  for (let tier = 1; tier <= 9; tier++) {
    const groupsInTier = getGroupsCountInLevel(tier);
    for (let group = 1; group <= groupsInTier; group++) {
      for (let rank = 1; rank <= 8; rank++) {
        const key = `${tier}_${group}_${rank}`;
        if (!occupiedSlots.has(key)) {
          console.log(`[PLACEMENT v56] SUCCESS: Slot Found! Tier ${tier}, Group ${group}, Rank ${rank}`);
          return { tier, group, rank };
        }
      }
    }
  }

  // Fallback (если пирамида переполнена)
  return { tier: 9, group: 1, rank: 1 };
}
