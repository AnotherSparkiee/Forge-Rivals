'use server';

/**
 * Скрипт "Ядерной очистки" v131.
 * Оптимизирован для предотвращения таймаутов (макс 1000 доков за вызов).
 */

import { 
  collection, getDocs, query, limit, 
  writeBatch, doc, deleteDoc 
} from 'firebase/firestore';
import { initializeFirebase } from '@/firebase';

const WIPE_BATCH_SIZE = 400;
const LIMIT_PER_CALL = 1000;

export async function totalNuclearResetV131() {
  const { firestore: db } = initializeFirebase();
  console.log("[NUCLEAR v131] Starting Force Purge...");

  // ПРИНУДИТЕЛЬНОЕ УДАЛЕНИЕ ФЛАГОВ БЛОКИРОВКИ
  const systemDocs = [
    'repair_v131_S1_LALPHA',
    'init_v131_S1_LALPHA',
    'repair_v130_S1_LALPHA',
    'init_v130_S1_LALPHA',
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
  
  let totalDeleted = 0;
  const results: any = {};

  for (const coll of colls) {
    if (totalDeleted >= LIMIT_PER_CALL) break;
    
    const q = query(collection(db, coll), limit(WIPE_BATCH_SIZE));
    const snap = await getDocs(q);
    
    if (!snap.empty) {
      const batch = writeBatch(db);
      snap.docs.forEach(d => batch.delete(d.ref));
      await batch.commit();
      
      results[coll] = snap.size;
      totalDeleted += snap.size;
    } else {
      results[coll] = 0;
    }
  }

  return { 
    success: true, 
    details: results, 
    msg: totalDeleted > 0 ? `Wiping: ${totalDeleted} docs removed...` : "System Fully Purged" 
  };
}
