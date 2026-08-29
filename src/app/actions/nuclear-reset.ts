'use server';

/**
 * @fileOverview Скрипт "Ядерной очистки" v131.
 * Выполняет тотальное удаление ВСЕХ игровых данных для перезапуска системы.
 */

import { 
  collection, getDocs, query, limit, 
  deleteDoc, doc, writeBatch 
} from 'firebase/firestore';
import { initializeFirebase } from '@/firebase';

const WIPE_BATCH_SIZE = 500;

async function wipeCollection(db: any, collName: string) {
  let deletedCount = 0;
  while (true) {
    const q = query(collection(db, collName), limit(WIPE_BATCH_SIZE));
    const snap = await getDocs(q);
    if (snap.empty) break;
    
    const batch = writeBatch(db);
    snap.docs.forEach(d => batch.delete(d.ref));
    await batch.commit();
    deletedCount += snap.size;
    if (snap.size < WIPE_BATCH_SIZE) break;
  }
  return deletedCount;
}

export async function totalNuclearResetV131() {
  const { firestore: db } = initializeFirebase();
  console.log("[NUCLEAR v131] Starting Global Wipe...");

  const results: any = {};

  // 1. Очистка игровых данных
  results.tables = await wipeCollection(db, 'league_tables_v2');
  results.matches = await wipeCollection(db, 'matches_v2');
  results.players = await wipeCollection(db, 'players_v13');
  
  // 2. Очистка социальных данных
  results.chat = await wipeCollection(db, 'global_chat_v2');
  results.market = await wipeCollection(db, 'market_v7');
  results.friends = await wipeCollection(db, 'friend_requests_v4');
  results.notifications = await wipeCollection(db, 'notifications_v7');
  
  // 3. Очистка турниров
  results.cup = await wipeCollection(db, 'cup_matches');
  results.pyramidCup = await wipeCollection(db, 'cup_pyramid_v1');

  // 4. Сброс системных флагов
  const sysCol = collection(db, 'system_v1');
  const sysSnap = await getDocs(sysCol);
  const batch = writeBatch(db);
  sysSnap.docs.forEach(d => batch.delete(d.ref));
  await batch.commit();
  results.systemFlags = sysSnap.size;

  console.log("[NUCLEAR v131] System Purged Successfully:", results);
  return { success: true, details: results };
}
