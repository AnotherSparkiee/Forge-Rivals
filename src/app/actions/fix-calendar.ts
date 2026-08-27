'use server';

/**
 * @fileOverview Скрипт-миграция v41: Синхронизация дат матчей с новой эпохой (27.08.2026).
 * Исправляет startTime у существующих матчей Season 1, чтобы они совпали с реальностью.
 */

import { 
  collection, 
  getDocs, 
  writeBatch, 
  doc, 
  serverTimestamp,
  query,
  where
} from 'firebase/firestore';
import { initializeFirebase } from '@/firebase';
import { getGlobalSeasonInfo, GLOBAL_EPOCH_ISO } from '@/app/lib/time-utils';

export async function runEmergencySync() {
  const { firestore: db } = initializeFirebase();
  const info = getGlobalSeasonInfo();
  const currentSeason = info.activeSeasonNumber; // Должен быть 1

  console.log(`[SYNC] Starting emergency date alignment for Season ${currentSeason}...`);
  
  const matchesRef = collection(db, 'matches_v1');
  const q = query(matchesRef, where('season', '==', currentSeason));
  const snapshot = await getDocs(q);

  if (snapshot.empty) {
    return { success: false, error: "No matches found for current season." };
  }

  const epochUtc = new Date(GLOBAL_EPOCH_ISO);
  const dayMs = 24 * 60 * 60 * 1000;
  const seasonStartMs = epochUtc.getTime(); // Для S1 это и есть эпоха

  let batch = writeBatch(db);
  let count = 0;

  for (const d of snapshot.docs) {
    const data = d.data();
    const tour = Number(data.tour || 1);
    
    // Вычисляем правильный startTime на основе новой эпохи
    // Логика: 18:00 MSK (15:00 UTC) соответствующего дня тура
    const correctStartTime = new Date(seasonStartMs + (tour - 1) * dayMs + (15 * 60 * 60 * 1000));

    batch.update(d.ref, {
      startTime: correctStartTime.toISOString(),
      version: 41,
      updatedAt: serverTimestamp()
    });

    count++;
    if (count % 400 === 0) {
      await batch.commit();
      batch = writeBatch(db);
    }
  }
  
  await batch.commit();

  // Сбрасываем маркеры инициализации, чтобы мир считался актуальным
  const leagueId = "ALPHA";
  const statusRef = doc(db, 'system_v1', `init_S${currentSeason}_L${leagueId}`);
  await batchSet(statusRef, { 
    status: 'completed', 
    syncedAt: serverTimestamp(),
    epoch: GLOBAL_EPOCH_ISO 
  });

  return { success: true, updatedMatches: count };
}

async function batchSet(ref: any, data: any) {
  const { firestore: db } = initializeFirebase();
  await writeBatch(db).set(ref, data, { merge: true }).commit();
}
