
'use server';

/**
 * @fileOverview Серверный модуль инициализации мира v57 (Registry v11).
 * Реализует логику стратегического размещения игроков в глобальную базу лиги v11.
 */

import { collection, getDocs, query, where } from 'firebase/firestore';
import { initializeFirebase } from '@/firebase';
import { getGroupsCountInLevel } from '@/app/lib/leagues-data';

/**
 * Находит первое свободное место (занятое ботом) в иерархии лиги v11.
 * Приоритет: Дивизион 1 (Вершина) -> Дивизион 9 (Основание).
 */
export async function findStrategicPlacement(leagueId: string) {
  const { firestore: db } = initializeFirebase();
  
  console.log(`[PLACEMENT v57] Scanning occupied slots for league: ${leagueId} in players_v11`);

  // 1. Получаем всех реальных игроков в этой лиге из новой базы v11
  const q = query(collection(db, 'players_v11'), where('selectedLeagueId', '==', leagueId));
  const snap = await getDocs(q);
  
  const occupiedSlots = new Set<string>();
  snap.forEach(d => {
    const data = d.data();
    const t = Number(data.leagueLevel);
    const g = Number(data.groupId);
    const r = Number(data.rank);

    if (t && g && r) {
      const key = `${t}_${g}_${r}`;
      occupiedSlots.add(key);
    }
  });

  console.log(`[PLACEMENT v57] Found ${occupiedSlots.size} occupied slots in players_v11.`);

  // 2. Ищем первый свободный слот (сверху вниз: Див 1 -> Див 9)
  for (let tier = 1; tier <= 9; tier++) {
    const groupsInTier = getGroupsCountInLevel(tier);
    for (let group = 1; group <= groupsInTier; group++) {
      for (let rank = 1; rank <= 8; rank++) {
        const key = `${tier}_${group}_${rank}`;
        if (!occupiedSlots.has(key)) {
          console.log(`[PLACEMENT v57] SUCCESS: Slot Found! Tier ${tier}, Group ${group}, Rank ${rank}`);
          return { tier, group, rank };
        }
      }
    }
  }

  // Fallback (если пирамида переполнена)
  return { tier: 9, group: 1, rank: 1 };
}
