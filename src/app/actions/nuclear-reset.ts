'use server';

/**
 * Скрипт "Ядерной очистки" v144 (Batch Improvements).
 */

import { 
  collection, getDocs, query, limit, 
  writeBatch, doc 
} from 'firebase/firestore';
import { authenticateAsSystem } from '@/firebase/system-auth';
import { initializeFirebase } from '@/firebase';

const DELETE_BATCH_SIZE = 500;
const BATCHES_PER_CALL = 3; 

export async function totalNuclearResetV131() {
  await authenticateAsSystem();
  const { firestore: db } = initializeFirebase();

  const systemDocs = [
    'repair_v131_S1_LALPHA', 'init_v131_S1_LALPHA',
    'repair_v140_S1_LALPHA', 'init_v140_S1_LALPHA',
    'world_v131_status', 'world_v140_status'
  ];

  let totalDeletedInThisCall = 0;

  try {
    // Цикл по батчам для обработки нескольких коллекций за один вызов
    for (let b = 0; b < BATCHES_PER_CALL; b++) {
      const batch = writeBatch(db);
      let batchCount = 0;

      // 1. В первом батче удаляем системные документы
      if (b === 0) {
        for (const sId of systemDocs) {
          batch.delete(doc(db, 'system_v1', sId));
          batchCount++;
        }
      }

      const colls = [
        'league_tables_v2', 'matches_v2', 'players_v14',
        'league_tables_v1', 'matches_v1', 'players_v13',
        'players_v12', 'players_v11', 'players_v10',
        'global_chat_v2', 'market_v7', 'friend_requests_v4', 
        'private_messages_v3', 'cup_matches', 'notifications_v7',
        'cup_pyramid_v1', 'cw_basket_v2', 'friendly_lobbies_v3',
        'associations_v4'
      ];

      for (const coll of colls) {
        if (batchCount >= DELETE_BATCH_SIZE) break;

        const q = query(collection(db, coll), limit(DELETE_BATCH_SIZE - batchCount));
        const snap = await getDocs(q);
        
        snap.docs.forEach(d => {
          batch.delete(d.ref);
          batchCount++;
        });
      }

      if (batchCount > 0) {
        await batch.commit();
        totalDeletedInThisCall += batchCount;
      } else {
        break; // Больше нечего удалять
      }
    }
  } catch (globalErr: any) {
    console.error("[NUCLEAR RESET CRITICAL ERROR]:", globalErr.message);
    return { success: false, error: globalErr.message };
  }

  const isComplete = totalDeletedInThisCall === 0;
  return { success: true, isComplete, deletedCount: totalDeletedInThisCall };
}
