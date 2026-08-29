'use server';

/**
 * @fileOverview Скрипт "Ядерной очистки" S1.
 * Вызывает удаление старых таблиц и матчей для полной перезагрузки автономного цикла.
 */

import { 
  collection, getDocs, query, where, 
  deleteDoc, doc, writeBatch, updateDoc 
} from 'firebase/firestore';
import { initializeFirebase } from '@/firebase';

export async function nuclearResetS1() {
  const { firestore: db } = initializeFirebase();
  
  console.log("[NUCLEAR] Starting Deep Clean for Season 1 (v130)...");

  // 1. Удаление таблиц v2
  const tablesQ = query(collection(db, 'league_tables_v2'), where('season', '==', 1));
  const tablesSnap = await getDocs(tablesQ);
  for (const d of tablesSnap.docs) await deleteDoc(d.ref);

  // 2. Удаление матчей v2
  const matchesQ = query(collection(db, 'matches_v2'), where('season', '==', 1));
  const matchesSnap = await getDocs(matchesQ);
  for (const d of matchesSnap.docs) await deleteDoc(d.ref);

  // 3. Удаление системных флагов
  const sysRefs = [
    doc(db, 'system_v1', 'init_S1_LALPHA'),
    doc(db, 'system_v1', 'repair_v130_S1_LALPHA'),
    doc(db, 'system_v1', 'transition_S1')
  ];
  for (const r of sysRefs) await deleteDoc(r).catch(() => {});

  // 4. Сброс игроков v13
  const playersSnap = await getDocs(collection(db, 'players_v13'));
  const batch = writeBatch(db);
  playersSnap.forEach(p => {
    batch.update(p.ref, {
      leagueLevel: null,
      groupId: null,
      rank: null,
      targetLevel: null,
      targetGroup: null,
      targetRank: null,
      lastProcessedSeason: 0,
      version: 130
    });
  });
  await batch.commit();

  console.log("[NUCLEAR] Clean Complete. System ready for Autonomous Build.");
  return { success: true };
}
