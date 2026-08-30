'use server';

/**
 * Скрипт "Ядерной очистки" v131 (Engineered for Total Purge).
 * Возвращает точный статус, чтобы клиент видел реальный прогресс удаления.
 */

import { 
  collection, getDocs, query, limit, 
  writeBatch, doc, deleteDoc 
} from 'firebase/firestore';
import { initializeFirebase } from '@/firebase';

const DELETE_BATCH_SIZE = 500;
const MAX_DOCS_PER_CALL = 2000; // Удаляем до 2000 за один проход для стабильности

export async function totalNuclearResetV131() {
  const { firestore: db } = initializeFirebase();
  console.log("[NUCLEAR v131] Force Purge Cycle Initiated...");

  // 1. ПРИНУДИТЕЛЬНОЕ УДАЛЕНИЕ СИСТЕМНЫХ БЛОКИРОВОК
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

  const colls = [
    'league_tables_v2', 
    'matches_v2', 
    'players_v13', 
    'global_chat_v2', 
    'market_v7', 
    'friend_requests_v4', 
    'private_messages_v3'
  ];
  
  let totalDeletedInThisCall = 0;

  for (const coll of colls) {
    // Если мы уже набрали лимит в 2000 доков, прерываем проход по коллекциям
    if (totalDeletedInThisCall >= MAX_DOCS_PER_CALL) break;
    
    // Берем пачку документов
    const q = query(collection(db, coll), limit(DELETE_BATCH_SIZE));
    const snap = await getDocs(q);
    
    if (!snap.empty) {
      const batch = writeBatch(db);
      snap.docs.forEach(d => batch.delete(d.ref));
      await batch.commit();
      
      totalDeletedInThisCall += snap.size;
    }
  }

  // Если за весь проход мы не нашли ни одного документа — очистка завершена
  const isComplete = totalDeletedInThisCall === 0;

  return { 
    success: true, 
    isComplete,
    deletedCount: totalDeletedInThisCall,
    msg: isComplete ? "System Fully Purged" : `Wiping... ${totalDeletedInThisCall} docs removed.` 
  };
}
