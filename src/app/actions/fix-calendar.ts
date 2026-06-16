'use server';

/**
 * @fileOverview Скрипт экстренной миграции календаря.
 * Шаг 1: Удаление всех матчей со старыми ботами (ELITE BOT).
 * Шаг 2: Сдвиг актуальных матчей (NEON) на правильные даты (с 17.06).
 */

import { 
  collection, 
  query, 
  getDocs, 
  writeBatch, 
  doc, 
  Timestamp, 
  where 
} from 'firebase/firestore';
import { initializeFirebase } from '@/firebase';

export async function runEmergencyMigration() {
  const { firestore: db } = initializeFirebase();
  const matchesRef = collection(db, 'matches_v1');

  // --- ШАГ 1: УДАЛЕНИЕ СТАРЫХ БОТОВ ---
  console.log("Starting Step 1: Cleanup old bots...");
  const oldMatchesSnap = await getDocs(matchesRef);
  let deleteBatch = writeBatch(db);
  let deleteCount = 0;

  for (const d of oldMatchesSnap.docs) {
    const data = d.data();
    const home = String(data.homeName || "");
    const away = String(data.awayName || "");

    // Проверяем старых ботов (ELITE BOT или 9.1.1)
    if (home.includes("ELITE BOT") || away.includes("ELITE BOT") || home.includes("9.1.1") || away.includes("9.1.1")) {
      deleteBatch.delete(d.ref);
      deleteCount++;

      // Лимит 400 для безопасности Firestore
      if (deleteCount % 400 === 0) {
        await deleteBatch.commit();
        deleteBatch = writeBatch(db);
      }
    }
  }
  await deleteBatch.commit();
  console.log(`Deleted ${deleteCount} old match documents.`);

  // --- ШАГ 2: СДВИГ МАТЧЕЙ NEON НА 17.06 ---
  console.log("Starting Step 2: Shifting NEON matches...");
  const neonMatchesSnap = await getDocs(query(matchesRef, where('seasonNumber', '==', 1)));
  let updateBatch = writeBatch(db);
  let updateCount = 0;

  // Базовая дата: 17 июня 2026, 12:00 UTC
  const baseDate = new Date('2026-06-17T12:00:00Z');

  for (const d of neonMatchesSnap.docs) {
    const data = d.data();
    const home = String(data.homeName || "");
    const away = String(data.awayName || "");

    // Фильтруем только нашу актуальную группу по ключевому слову NEON
    if (home.includes("NEON") || away.includes("NEON")) {
      const tour = Number(data.day || data.tour || 1);
      
      // Вычисляем новую дату: База + (День - 1)
      const newDate = new Date(baseDate.getTime());
      newDate.setUTCDate(baseDate.getUTCDate() + (tour - 1));

      // Конвертация в Timestamp, как просили
      const newTimestamp = Timestamp.fromDate(newDate);

      updateBatch.update(d.ref, {
        startTime: newDate.toISOString(), // Сохраняем ISO для фронтенда
        scheduledAt: newTimestamp,        // Сохраняем Timestamp для бэкенда
        status: 'pending'
      });

      updateCount++;

      if (updateCount % 400 === 0) {
        await updateBatch.commit();
        updateBatch = writeBatch(db);
      }
    }
  }
  await updateBatch.commit();
  console.log(`Updated ${updateCount} neon match documents.`);

  return { success: true, deleted: deleteCount, updated: updateCount };
}
