'use server';

/**
 * Скрипт "Ядерной очистки" v134 (Ultra-Speed Multi-Batch Purge).
 * Увеличена скорость удаления до 2500 доков за один вызов для предотвращения зависаний.
 */

import { 
  collection, getDocs, query, limit, 
  writeBatch, doc, deleteDoc 
} from 'firebase/firestore';
import { initializeFirebase } from '@/firebase';

const DELETE_BATCH_SIZE = 500;
const BATCHES_PER_CALL = 5; // Удаляем до 2500 доков за один вызов для макс. скорости

export async function totalNuclearResetV131() {
  const { firestore: db } = initializeFirebase();
  console.log("[NUCLEAR v134] Initiating Ultra-Speed Purge...");

  // 1. ПРИНУДИТЕЛЬНОЕ УДАЛЕНИЕ СИСТЕМНЫХ ФЛАГОВ (Первый приоритет)
  const systemDocs = [
    'repair_v131_S1_LALPHA',
    'init_v131_S1_LALPHA',
    'repair_v131_S2_LALPHA',
    'init_v131_S2_LALPHA'
  ];

  for (const sId of systemDocs) {
    try {
      await deleteDoc(doc(db, 'system_v1', sId));
    } catch (e) {}
  }

  // 2. СПИСОК ВСЕХ КОЛЛЕКЦИЙ ДЛЯ ОЧИСТКИ
  const colls = [
    'league_tables_v2', 
    'matches_v2', 
    'players_v13', 
    'global_chat_v2', 
    'market_v7', 
    'friend_requests_v4', 
    'private_messages_v3',
    'cup_matches',
    'notifications_v7',
    'cup_pyramid_v1',
    'cw_basket_v2',
    'friendly_lobbies_v3'
  ];
  
  let totalDeletedInThisCall = 0;

  // Цикл по пачкам для ускорения
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
        break; // Нашли что удалять - переходим к следующему батчу в цикле BATCHES_PER_CALL
      }
    }
    
    if (batchDeletedCount === 0) break; // Все коллекции пусты
  }

  const isComplete = totalDeletedInThisCall === 0;

  return { 
    success: true, 
    isComplete,
    deletedCount: totalDeletedInThisCall,
    msg: isComplete ? "System Fully Purged" : `Purging... ${totalDeletedInThisCall} docs removed.` 
  };
}
