'use server';

/**
 * @fileOverview Ядро управления сезонными циклами v1.1 (Migration Fix).
 */

import { 
  doc, getDoc, setDoc, serverTimestamp, collection, 
  query, where, getDocs, writeBatch, limit 
} from 'firebase/firestore';
import { initializeFirebase } from '@/firebase';
import { authenticateAsSystem } from '@/firebase/system-auth';
import { getGlobalSeasonInfo, getMoscowHours } from '@/app/lib/time-utils';
import { initializeLeagueWorld } from './world-engine';
import { getTableId } from '../lib/leagues-data';

/**
 * Читает номер активного сезона из конфига БД.
 */
export async function getActiveSeasonNumber(db: any) {
  const configRef = doc(db, 'system_v1', 'season_config');
  try {
    const snap = await getDoc(configRef);
    if (snap.exists()) {
      return Number(snap.data().activeSeasonNumber);
    }
  } catch (e) {
    console.error("[SEASON CYCLE] Config read failed:", e);
  }
  return getGlobalSeasonInfo().activeSeasonNumber;
}

/**
 * Генерирует мир для СЛЕДУЮЩЕГО сезона.
 */
export async function generateNextSeasonWorld() {
  await authenticateAsSystem();
  const { firestore: db } = initializeFirebase();
  const info = getGlobalSeasonInfo();
  const mskHour = getMoscowHours();

  if (info.dayOfCycle !== 15 || mskHour < 16) {
    return { success: false, msg: "NOT_TIME_FOR_GENERATION", info, mskHour };
  }

  const currentSeason = await getActiveSeasonNumber(db);
  const nextSeason = currentSeason + 1;

  const result = await initializeLeagueWorld('ALPHA', nextSeason);
  return { success: true, result };
}

/**
 * Официально активирует следующий сезон и мигрирует игроков.
 */
export async function activateNextSeason() {
  await authenticateAsSystem();
  const { firestore: db } = initializeFirebase();
  const info = getGlobalSeasonInfo();
  const mskHour = getMoscowHours();

  if (info.dayOfCycle !== 16 || mskHour < 18) {
    return { success: false, msg: "NOT_TIME_FOR_ACTIVATION", info, mskHour };
  }

  const currentSeason = await getActiveSeasonNumber(db);
  const nextSeason = currentSeason + 1;
  
  // 1. Отменяем незавершенные матчи текущего сезона
  const q = query(
    collection(db, 'matches_v2'),
    where('season', '==', currentSeason),
    where('isFinished', '==', false),
    limit(500)
  );
  
  const snap = await getDocs(q);
  if (!snap.empty) {
    const batch = writeBatch(db);
    snap.docs.forEach(d => batch.update(d.ref, { 
      status: 'cancelled', 
      isFinished: true, 
      resolvedAt: serverTimestamp() 
    }));
    await batch.commit();
  }

  // 2. Переключаем сезон в конфиге
  const configRef = doc(db, 'system_v1', 'season_config');
  await setDoc(configRef, { 
    activeSeasonNumber: nextSeason,
    updatedAt: serverTimestamp()
  }, { merge: true });

  // 3. Миграция живых игроков в новые таблицы сезона
  const playersSnap = await getDocs(collection(db, 'players_v14'));
  let migrateBatch = writeBatch(db);
  let migrateCount = 0;

  for (const pDoc of playersSnap.docs) {
    const p = pDoc.data();
    if (p.lastProcessedSeason === currentSeason) {
      const tableId = getTableId(nextSeason, p.selectedLeagueId, p.leagueLevel, p.groupId);
      const tableRef = doc(db, 'league_tables_v2', tableId);
      const tableSnap = await getDoc(tableRef);
      
      if (tableSnap.exists()) {
        const stats = { ...tableSnap.data().stats };
        // Ищем бота на том же ранге
        const botId = Object.keys(stats).find(id => Number(stats[id].rank) === Number(p.rank) && stats[id].isBot);
        
        if (botId) {
          delete stats[botId];
          stats[pDoc.id] = { 
            id: pDoc.id, name: p.clubName || p.displayName, rank: p.rank,
            matchesPlayed: 0, wins: 0, draws: 0, losses: 0, points: 0, diff: 0,
            isBot: false, clubLogo: p.clubLogo || null
          };
          
          migrateBatch.update(tableRef, { stats, updatedAt: serverTimestamp() });
          migrateBatch.update(pDoc.ref, { lastProcessedSeason: nextSeason });
          migrateCount++;
          
          if (migrateCount >= 400) {
            await migrateBatch.commit();
            migrateBatch = writeBatch(db);
            migrateCount = 0;
          }
        }
      }
    }
  }
  if (migrateCount > 0) await migrateBatch.commit();

  return { success: true, newSeason: nextSeason, migrated: migrateCount };
}
