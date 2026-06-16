'use server';

/**
 * @fileOverview Скрипт-миграция для архивации старых матчей и инициации Сезона 1.
 */

import { 
  collection, 
  query, 
  getDocs, 
  writeBatch, 
  doc, 
  serverTimestamp, 
  where 
} from 'firebase/firestore';
import { initializeFirebase } from '@/firebase';

export async function runEmergencyMigration() {
  const { firestore: db } = initializeFirebase();
  const matchesRef = collection(db, 'matches_v1');

  console.log("Starting Migration: Archiving old drafts...");
  
  // 1. Находим все матчи, не принадлежащие Сезону 1 или со старыми ботами
  const snapshot = await getDocs(matchesRef);
  let batch = writeBatch(db);
  let count = 0;

  for (const d of snapshot.docs) {
    const data = d.data();
    const isOldBot = (data.homeName || "").includes("ELITE BOT") || (data.awayName || "").includes("ELITE BOT");
    const isWrongSeason = data.seasonId !== "season_1";

    if (isOldBot || isWrongSeason) {
      batch.update(d.ref, {
        status: 'archived',
        archivedAt: serverTimestamp()
      });
      count++;

      if (count % 400 === 0) {
        await batch.commit();
        batch = writeBatch(db);
      }
    }
  }
  await batch.commit();
  console.log(`Archived ${count} old match documents.`);

  // 2. Обновляем глобальный статус
  const statusRef = doc(db, 'system_v1', 'status');
  await setDoc(statusRef, {
    currentSeasonNumber: 1,
    currentSeasonId: "season_1",
    status: "active",
    updatedAt: serverTimestamp()
  }, { merge: true });

  console.log("Global Status Updated: Season 1 is now ACTIVE.");

  return { success: true, archived: count };
}
