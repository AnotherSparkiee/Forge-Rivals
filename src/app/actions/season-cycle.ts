'use server';

/**
 * @fileOverview Ядро управления сезонными циклами v1.1 (Admin SDK Transition).
 */

import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase-admin';
import { getGlobalSeasonInfo, getMoscowHours } from '@/app/lib/time-utils';
import { initializeLeagueWorld } from './world-engine';
import { getTableId } from '../lib/leagues-data';

/**
 * Читает номер активного сезона из конфига БД.
 */
export async function getActiveSeasonNumber(db?: any) {
  const database = db || adminDb;
  const configRef = database.collection('system_v1').doc('season_config');
  try {
    const snap = await configRef.get();
    if (snap.exists) {
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
  const db = adminDb;
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
  const db = adminDb;
  const info = getGlobalSeasonInfo();
  const mskHour = getMoscowHours();

  if (info.dayOfCycle !== 16 || mskHour < 18) {
    return { success: false, msg: "NOT_TIME_FOR_ACTIVATION", info, mskHour };
  }

  const currentSeason = await getActiveSeasonNumber(db);
  const nextSeason = currentSeason + 1;
  
  // 1. Отменяем незавершенные матчи текущего сезона
  const snap = await db.collection('matches_v2')
    .where('season', '==', currentSeason)
    .where('isFinished', '==', false)
    .limit(500)
    .get();
  
  if (!snap.empty) {
    const batch = db.batch();
    snap.docs.forEach(d => batch.update(d.ref, { 
      status: 'cancelled', 
      isFinished: true, 
      resolvedAt: FieldValue.serverTimestamp() 
    }));
    await batch.commit();
  }

  // 2. Переключаем сезон в конфиге
  const configRef = db.collection('system_v1').doc('season_config');
  await configRef.set({ 
    activeSeasonNumber: nextSeason,
    updatedAt: FieldValue.serverTimestamp()
  }, { merge: true });

  // 3. Миграция живых игроков в новые таблицы сезона
  const playersSnap = await db.collection('players_v14').get();
  let migrateBatch = db.batch();
  let migrateCount = 0;

  for (const pDoc of playersSnap.docs) {
    const p = pDoc.data();
    if (p.lastProcessedSeason === currentSeason) {
      const tableId = getTableId(nextSeason, p.selectedLeagueId, p.leagueLevel, p.groupId);
      const tableRef = db.collection('league_tables_v2').doc(tableId);
      const tableSnap = await tableRef.get();
      
      if (tableSnap.exists) {
        const stats = { ...tableSnap.data()!.stats };
        // Ищем бота на том же ранге
        const botId = Object.keys(stats).find(id => Number(stats[id].rank) === Number(p.rank) && stats[id].isBot);
        
        if (botId) {
          delete stats[botId];
          stats[pDoc.id] = { 
            id: pDoc.id, name: p.clubName || p.displayName, rank: p.rank,
            matchesPlayed: 0, wins: 0, draws: 0, losses: 0, points: 0, diff: 0,
            isBot: false, clubLogo: p.clubLogo || null
          };
          
          migrateBatch.update(tableRef, { stats, updatedAt: FieldValue.serverTimestamp() });
          migrateBatch.update(pDoc.ref, { lastProcessedSeason: nextSeason });
          migrateCount++;
          
          if (migrateCount >= 400) {
            await migrateBatch.commit();
            migrateBatch = db.batch();
            migrateCount = 0;
          }
        }
      }
    }
  }
  if (migrateCount > 0) await migrateBatch.commit();

  return { success: true, newSeason: nextSeason, migrated: migrateCount };
}
