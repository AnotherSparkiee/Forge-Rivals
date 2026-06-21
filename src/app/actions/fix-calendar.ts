'use server';

/**
 * @fileOverview Скрипт-миграция v40: Полный сброс к Сезону 1.
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

  console.log("Starting Migration v40: Resetting all timelines to Season 1...");
  
  // 1. Архивируем старые матчи
  const snapshot = await getDocs(matchesRef);
  let batch = writeBatch(db);
  let count = 0;

  for (const d of snapshot.docs) {
    if (d.data().version !== 40) {
      batch.delete(d.ref);
      count++;
    }

    if (count % 400 === 0) {
      await batch.commit();
      batch = writeBatch(db);
    }
  }
  await batch.commit();

  // 2. Сбрасываем глобальный статус системы
  const statusRef = doc(db, 'system_v1', 'status');
  await setDoc(statusRef, {
    currentSeasonNumber: 1,
    status: "active",
    updatedAt: serverTimestamp(),
    version: 40
  }, { merge: true });

  return { success: true, cleaned: count };
}
