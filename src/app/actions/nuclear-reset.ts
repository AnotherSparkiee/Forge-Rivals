
'use server';

/**
 * Скрипт "Ядерной очистки" v143 (Privileged System Auth).
 */

import { 
  collection, getDocs, query, limit, 
  writeBatch, doc, deleteDoc 
} from 'firebase/firestore';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { initializeFirebase } from '@/firebase';

const SYSTEM_EMAIL = "system@internal.mobamanageronline.app";

async function authenticateAsSystem() {
  const { auth } = initializeFirebase();
  const password = process.env.SYSTEM_ACCOUNT_PASSWORD;
  if (!password) throw new Error("SYSTEM_AUTH_CRITICAL_ERROR");
  await signInWithEmailAndPassword(auth, SYSTEM_EMAIL, password);
}

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

  for (const sId of systemDocs) {
    try {
      await deleteDoc(doc(db, 'system_v1', sId));
    } catch (e) {}
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
          await batch.commit();
          batchDeletedCount = snap.size;
          totalDeletedInThisCall += batchDeletedCount;
          break; 
        }
      }
      if (batchDeletedCount === 0) break;
    }
  } catch (globalErr: any) {
    return { success: false, error: globalErr.message };
  }

  const isComplete = totalDeletedInThisCall === 0;
  return { success: true, isComplete, deletedCount: totalDeletedInThisCall };
}
