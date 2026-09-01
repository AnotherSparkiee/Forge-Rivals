
'use server';

/**
 * Скрипт "Ядерной очистки" v141 (Safe Force Purge).
 * Оптимизирован для предотвращения таймаутов сервера.
 * Удаляет документы порциями, пропуская ошибки доступа.
 */

import { 
  collection, getDocs, query, limit, 
  writeBatch, doc, deleteDoc 
} from 'firebase/firestore';
import { initializeFirebase } from '@/firebase';

const DELETE_BATCH_SIZE = 500;
const BATCHES_PER_CALL = 3; // Снижено для стабильности (макс 1500 доков за вызов)

export async function totalNuclearResetV131() {
  const { firestore: db } = initializeFirebase();
  console.log("[NUCLEAR v141] Initiating Protected Purge...");

  // 1. ПРИНУДИТЕЛЬНОЕ УДАЛЕНИЕ СИСТЕМНЫХ ФЛАГОВ
  const systemDocs = [
    'repair_v131_S1_LALPHA', 'init_v131_S1_LALPHA',
    'repair_v140_S1_LALPHA', 'init_v140_S1_LALPHA',
    'world_v131_status', 'world_v140_status'
  ];

  for (const sId of systemDocs) {
    try {
      await deleteDoc(doc(db, 'system_v1', sId));
    } catch (e) {}
  }

  // 2. СПИСОК КОЛЛЕКЦИЙ ДЛЯ ЗАЧИСТКИ
  const colls = [
    'league_tables_v2', 'matches_v2', // v140
    'league_tables_v1', 'matches_v1', // v130
    'players_v14', 'players_v13', 'players_v12', 'players_v11', 'players_v10',
    'global_chat_v2', 'market_v7', 'friend_requests_v4', 
    'private_messages_v3', 'cup_matches', 'notifications_v7',
    'cup_pyramid_v1', 'cw_basket_v2', 'friendly_lobbies_v3'
  ];
  
  let totalDeletedInThisCall = 0;

  try {
    for (let b = 0; b < BATCHES_PER_CALL; b++) {
      let batchDeletedCount = 0;
      
      for (const coll of colls) {
        const q = query(collection(db, coll), limit(DELETE_BATCH_SIZE));
        const snap = await getDocs(q);
        
        if (!snap.empty) {
          const batch = writeBatch(db);
          snap.docs.forEach(d => batch.delete(d.ref));
          
          try {
            await batch.commit();
            batchDeletedCount = snap.size;
            totalDeletedInThisCall += batchDeletedCount;
          } catch (batchErr) {
            console.warn(`[NUCLEAR] Batch failed for ${coll}, likely security rules. Skipping.`);
          }
          break; // Переход к следующему батчу после одной коллекции
        }
      }
      
      if (batchDeletedCount === 0) break;
    }
  } catch (globalErr: any) {
    console.error("[NUCLEAR CRITICAL ERROR]", globalErr.message);
    return { success: false, error: globalErr.message };
  }

  const isComplete = totalDeletedInThisCall === 0;

  return { 
    success: true, 
    isComplete,
    deletedCount: totalDeletedInThisCall,
    msg: isComplete ? "Universe Fully Purged" : `Purging... ${totalDeletedInThisCall} docs removed.` 
  };
}
