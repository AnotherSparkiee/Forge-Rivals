'use server';

/**
 * Скрипт "Ядерной очистки" v132 (Safe Multi-Collection Purge).
 * Исправлена логика завершения цикла для предотвращения бесконечного вращения в UI.
 */

import { 
  collection, getDocs, query, limit, 
  writeBatch, doc, deleteDoc 
} from 'firebase/firestore';
import { initializeFirebase } from '@/firebase';

const DELETE_BATCH_SIZE = 500;

export async function totalNuclearResetV131() {
  const { firestore: db } = initializeFirebase();
  console.log("[NUCLEAR v132] Initiating Deep Purge...");

  // 1. ПРИНУДИТЕЛЬНОЕ УДАЛЕНИЕ СИСТЕМНЫХ ФЛАГОВ
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
    'notifications_v7'
  ];
  
  let totalDeletedInThisCall = 0;

  for (const coll of colls) {
    // Берем пачку документов из текущей коллекции
    const q = query(collection(db, coll), limit(DELETE_BATCH_SIZE));
    const snap = await getDocs(q);
    
    if (!snap.empty) {
      const batch = writeBatch(db);
      snap.docs.forEach(d => batch.delete(d.ref));
      await batch.commit();
      
      totalDeletedInThisCall += snap.size;
      // Прерываем цикл по коллекциям, чтобы ответить серверу и не получить таймаут
      break; 
    }
  }

  // Если за весь проход по всем коллекциям мы удалили 0 доков — значит база чиста
  const isComplete = totalDeletedInThisCall === 0;

  return { 
    success: true, 
    isComplete,
    deletedCount: totalDeletedInThisCall,
    msg: isComplete ? "System Fully Purged" : `Purging... ${totalDeletedInThisCall} docs removed.` 
  };
}
