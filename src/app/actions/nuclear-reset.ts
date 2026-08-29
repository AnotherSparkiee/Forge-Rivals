'use server';

/**
 * Скрипт "Ядерной очистки" v131.
 * Выполняет удаление порциями для предотвращения таймаутов.
 */

import { 
  collection, getDocs, query, limit, 
  deleteDoc, doc, writeBatch 
} from 'firebase/firestore';
import { initializeFirebase } from '@/firebase';

const WIPE_BATCH_SIZE = 500;
const MAX_DELETIONS_PER_CALL = 5000; // Лимит во избежание таймаута

async function wipeCollection(db: any, collName: string) {
  let deletedCount = 0;
  while (deletedCount < MAX_DELETIONS_PER_CALL) {
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
  console.log("[NUCLEAR v131] Starting Safety Purge...");

  const results: any = {};

  // Очистка по цепочке, пока не упремся в лимит или не закончим
  results.tables = await wipeCollection(db, 'league_tables_v2');
  results.matches = await wipeCollection(db, 'matches_v2');
  results.players = await wipeCollection(db, 'players_v13');
  
  // Если за первый проход удалили много, возвращаем статус для повторного вызова
  const totalDeleted = Object.values(results).reduce((a: any, b: any) => a + b, 0);

  return { 
    success: true, 
    details: results, 
    msg: totalDeleted >= MAX_DELETIONS_PER_CALL ? "Purge In Progress (Click again)" : "System Purged" 
  };
}
