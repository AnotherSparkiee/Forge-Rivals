
'use server';

/**
 * @fileOverview Скрипт-миграция v46 (Chunked Repair).
 * Разделяет процесс восстановления на безопасные этапы.
 */

import { 
  collection, getDocs, writeBatch, doc, getDoc,
  serverTimestamp, query, where, Firestore, setDoc, limit, startAfter, updateDoc
} from 'firebase/firestore';
import { initializeFirebase } from '@/firebase';
import { getGlobalSeasonInfo } from '@/app/lib/time-utils';
import { 
  getGroupsCountInLevel, getBotId, TEAMS_PER_GROUP, generateSeasonCalendar 
} from '@/app/lib/leagues-data';
import { initializeLeagueWorld } from './world-engine';

/**
 * ГЛОБАЛЬНЫЙ РЕМОНТ МИРА v46.
 * Вызывает пошаговую инициализацию мира, а затем переносит игроков.
 */
export async function runGlobalEmergencyRepair() {
  const { firestore: db } = initializeFirebase();
  const info = getGlobalSeasonInfo();
  const seasonNum = info.activeSeasonNumber;
  const leagueId = "ALPHA";

  const repairStatusRef = doc(db, 'system_v1', `repair_S${seasonNum}_L${leagueId}`);
  const repairSnap = await getDoc(repairStatusRef);
  const repairData = repairSnap.exists() ? repairSnap.data() : { phase: 'INIT_WORLD' };

  console.log(`[REPAIR v46] Current Phase: ${repairData.phase}`);

  // ФАЗА 1: Создание структуры мира через world-engine (порционно)
  if (repairData.phase === 'INIT_WORLD') {
    const worldRes = await initializeLeagueWorld(leagueId, seasonNum);
    if (worldRes.isComplete) {
      await setDoc(repairStatusRef, { phase: 'MIGRATE_PLAYERS', lastPlayerId: null }, { merge: true });
      return { status: 'PHASE_COMPLETE', nextPhase: 'MIGRATE_PLAYERS' };
    }
    return { status: 'PROCESSING_WORLD', ...worldRes };
  }

  // ФАЗА 2: Перенос реальных игроков в новую структуру (порционно по 20 игроков)
  if (repairData.phase === 'MIGRATE_PLAYERS') {
    const playersQ = repairData.lastPlayerId 
      ? query(collection(db, 'players_v11'), orderBy('__name__'), startAfter(repairData.lastPlayerId), limit(20))
      : query(collection(db, 'players_v11'), orderBy('__name__'), limit(20));
    
    const pSnap = await getDocs(playersQ);
    if (pSnap.empty) {
      await updateDoc(repairStatusRef, { phase: 'COMPLETED', finishedAt: serverTimestamp() });
      return { status: 'ALL_COMPLETE' };
    }

    const batch = writeBatch(db);
    let lastId = repairData.lastPlayerId;

    for (const pDoc of pSnap.docs) {
      const p = pDoc.data();
      const tier = Number(p.leagueLevel);
      const group = Number(p.groupId);
      const rank = Number(p.rank);
      const userId = p.id;
      const clubName = p.clubName || p.displayName;
      const clubLogo = p.clubLogo || null;

      const botId = getBotId(leagueId, tier, group, rank);
      const tableId = `table_S${seasonNum}_L${leagueId}_V${tier}_G${group}`;
      const tableRef = doc(db, 'league_tables_v1', tableId);
      
      // Обновляем таблицу (атомарно через dot-notation для безопасности)
      const statsPath = `stats.${botId}`;
      const newStatsPath = `stats.${userId}`;
      
      // Получаем текущие данные для переноса накопленной ботом статистики
      const tableSnap = await getDoc(tableRef);
      if (tableSnap.exists()) {
        const stats = tableSnap.data().stats;
        if (stats[botId]) {
          const botStats = stats[botId];
          const updatedStats = { ...stats };
          updatedStats[userId] = {
            ...botStats,
            id: userId, name: clubName, clubLogo: clubLogo, isBot: false
          };
          delete updatedStats[botId];
          batch.update(tableRef, { stats: updatedStats, updatedAt: serverTimestamp() });
        }
      }

      // Обновляем матчи игрока
      const matchesQ = query(collection(db, 'matches_v1'), 
        where('leagueId', '==', leagueId),
        where('level', '==', tier),
        where('groupId', '==', group),
        where('season', '==', seasonNum)
      );
      const mSnap = await getDocs(matchesQ);
      mSnap.forEach(mDoc => {
        const mData = mDoc.data();
        const updates: any = {};
        if (mData.homeId === botId) { updates.homeId = userId; updates.homeName = clubName; updates.homeLogo = clubLogo; }
        if (mData.awayId === botId) { updates.awayId = userId; updates.awayName = clubName; updates.awayLogo = clubLogo; }
        if (Object.keys(updates).length > 0) {
          batch.update(mDoc.ref, updates);
        }
      });

      lastId = pDoc.id;
    }

    await batch.commit();
    await updateDoc(repairStatusRef, { lastPlayerId: lastId });
    return { status: 'MIGRATING', processed: pSnap.size, lastId };
  }

  return { status: 'ALREADY_DONE' };
}
