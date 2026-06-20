'use server';

/**
 * @fileOverview Скрипт-миграция v2.0: Полный сброс к Сезону 1 на 22 июня 2026.
 */

import { 
  collection, 
  getDocs, 
  writeBatch, 
  doc, 
  serverTimestamp,
  setDoc
} from 'firebase/firestore';
import { initializeFirebase } from '@/firebase';

export async function runEmergencyMigration() {
  const { firestore: db } = initializeFirebase();
  const matchesRef = collection(db, 'matches_v1');

  console.log("Starting Migration v2.0: Resetting all timelines to Season 1 (June 2026)...");
  
  // 1. Архивируем абсолютно все старые матчи, так как временная шкала изменилась
  const snapshot = await getDocs(matchesRef);
  let batch = writeBatch(db);
  let count = 0;

  for (const d of snapshot.docs) {
    batch.update(d.ref, {
      status: 'archived',
      archivedAt: serverTimestamp(),
      reason: 'epoch_reset'
    });
    count++;

    if (count % 400 === 0) {
      await batch.commit();
      batch = writeBatch(db);
    }
  }
  await batch.commit();
  console.log(`Archived ${count} legacy match documents.`);

  // 2. Сбрасываем глобальный статус системы на Сезон 1
  const statusRef = doc(db, 'system_v1', 'status');
  await setDoc(statusRef, {
    currentSeasonNumber: 1,
    currentSeasonId: "season_1",
    status: "active",
    epoch: "2026-06-22T00:00:00+03:00",
    updatedAt: serverTimestamp()
  }, { merge: true });

  console.log("Global Status Reset: System is now set to Season 1.");

  return { success: true, archived: count };
}
