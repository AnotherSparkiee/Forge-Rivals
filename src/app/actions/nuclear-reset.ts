
'use server';

/**
 * Скрипт "Ядерной очистки" v140 (Safe Force Purge).
 * Принудительно удаляет системные блокировки и очищает коллекции ВСЕХ версий (v10-v14).
 */

import { 
  collection, getDocs, query, limit, 
  writeBatch, doc, deleteDoc 
} from 'firebase/firestore';
import { initializeFirebase } from '@/firebase';

const DELETE_BATCH_SIZE = 500;
const BATCHES_PER_CALL = 5; 

export async function totalNuclearResetV131() {
  const { firestore: db } = initializeFirebase();
  console.log("[NUCLEAR v140] Force Purging System...");

  // 1. ПРИНУДИТЕЛЬНОЕ УДАЛЕНИЕ ВСЕХ СИСТЕМНЫХ ФЛАГОВ
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

  // 2. ПОЛНЫЙ СПИСОК КОЛЛЕКЦИЙ ВСЕХ ВЕРСИЙ ДЛЯ ЗАЧИСТКИ
  const colls = [
    'league_tables_v2', 'matches_v2', // v140
    'league_tables_v1', 'matches_v1', // v130
    'players_v14', 'players_v13', 'players_v12', 'players_v11', 'players_v10',
    'global_chat_v2', 'market_v7', 'friend_requests_v4', 
    'private_messages_v3', 'cup_matches', 'notifications_v7',
    'cup_pyramid_v1', 'cw_basket_v2', 'friendly_lobbies_v3'
  ];
  
  let totalDeletedInThisCall = 0;

  for (let b = 0; b < BATCHES_PER_CALL; b++) {
    let batchDeletedCount = 0;
    
    for (const coll of colls) {
      const q = query(collection(db, coll), limit(DELETE_BATCH_SIZE));
      const snap = await getDocs(q);
      
      if (!snap.empty) {
        const batch = writeBatch(db);
        snap.docs.forEach(d => batch.delete(d.ref));
        await batch.commit();
        
        batchDeletedCount = snap.size;
        totalDeletedInThisCall += batchDeletedCount;
        break; // Перезапуск цикла для следующего батча
      }
    }
    
    if (batchDeletedCount === 0) break;
  }

  const isComplete = totalDeletedInThisCall === 0;

  return { 
    success: true, 
    isComplete,
    deletedCount: totalDeletedInThisCall,
    msg: isComplete ? "Universe Fully Purged" : `Purging... ${totalDeletedInThisCall} docs removed.` 
  };
}
