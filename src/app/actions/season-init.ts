'use server';

/**
 * @fileOverview Серверный модуль инициализации мира v51.
 * Реализует логику стратегического размещения игроков в глобальную базу лиги.
 */

import { collection, getDocs, query, where } from 'firebase/firestore';
import { initializeFirebase } from '@/firebase';
import { getGroupsCountInLevel } from '@/app/lib/leagues-data';

/**
 * Находит первое свободное место (занятое ботом) в иерархии лиги.
 * Приоритет: Дивизион 9 (вход в лигу) -> Дивизион 1.
 */
export async function findStrategicPlacement(leagueId: string) {
  const { firestore: db } = initializeFirebase();
  
  // 1. Получаем всех реальных игроков в этой лиге, чтобы понять какие слоты заняты
  const q = query(collection(db, 'players_v10'), where('selectedLeagueId', '==', leagueId));
  const snap = await getDocs(q);
  
  const occupiedSlots = new Set<string>();
  snap.forEach(d => {
    const data = d.data();
    if (data.leagueLevel && data.groupId && data.rank) {
      occupiedSlots.add(`${data.leagueLevel}_${data.groupId}_${data.rank}`);
    }
  });

  // 2. Ищем первый свободный слот (снизу вверх: Див 9 -> Див 1)
  // Это гарантирует, что новички заменяют ботов в 9-м дивизионе, пока он не заполнится.
  for (let tier = 9; tier >= 1; tier--) {
    const groupsInTier = getGroupsCountInLevel(tier);
    for (let group = 1; group <= groupsInTier; group++) {
      for (let rank = 1; rank <= 8; rank++) {
        const key = `${tier}_${group}_${rank}`;
        if (!occupiedSlots.has(key)) {
          console.log(`[PLACEMENT v51] Found free slot: League ${leagueId}, Tier ${tier}, Group ${group}, Rank ${rank}`);
          return { tier, group, rank };
        }
      }
    }
  }

  // Fallback (не должен наступить при текущих лимитах)
  return { tier: 9, group: 1, rank: 1 };
}
