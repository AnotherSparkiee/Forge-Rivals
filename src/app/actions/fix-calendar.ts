'use server';

/**
 * @fileOverview Скрипт-миграция v49 (Final Synchronizer).
 * Исправлены импорты и логика объединения всех игроков в общий мир Сезона 1.
 */

import { 
  collection, getDocs, writeBatch, doc, getDoc,
  serverTimestamp, query, where, Firestore, setDoc, limit, startAfter, updateDoc, orderBy
} from 'firebase/firestore';
import { initializeFirebase } from '@/firebase';
import { getGlobalSeasonInfo } from '@/app/lib/time-utils';
import { getBotId } from '@/app/lib/leagues-data';
import { initializeLeagueWorld } from './world-engine';

/**
 * ГЛОБАЛЬНЫЙ РЕМОНТ МИРА v49.
 * Выполняется пошагово: сначала строится структура 511 групп, затем мигрируют игроки.
 */
export async function runGlobalEmergencyRepair() {
  const { firestore: db } = initializeFirebase();
  const info = getGlobalSeasonInfo();
  const seasonNum = info.activeSeasonNumber;
  const leagueId = "ALPHA";

  const repairStatusRef = doc(db, 'system_v1', `repair_S${seasonNum}_L${leagueId}`);
  const repairSnap = await getDoc(repairStatusRef);
  const repairData = repairSnap.exists() ? repairSnap.data() : { phase: 'INIT_WORLD' };

  console.log(`[AUTONOMOUS REPAIR] Season ${seasonNum}, Phase: ${repairData.phase}`);

  // ФАЗА 1: Пошаговое создание структуры мира (все дивизионы)
  if (repairData.phase === 'INIT_WORLD') {
    const worldRes = await initializeLeagueWorld(leagueId, seasonNum);
    if (worldRes.isComplete) {
      await setDoc(repairStatusRef, { phase: 'MIGRATE_PLAYERS', lastPlayerId: null }, { merge: true });
      return { status: 'PHASE_COMPLETE', nextPhase: 'MIGRATE_PLAYERS' };
    }
    return { status: 'PROCESSING_WORLD', progress: `Tier ${worldRes.lastTier}, Group ${worldRes.lastGroup}` };
  }

  // ФАЗА 2: Перенос зарегистрированных игроков в новую структуру (по 20 игроков за вызов)
  if (repairData.phase === 'MIGRATE_PLAYERS') {
    const playersQ = repairData.lastPlayerId 
      ? query(collection(db, 'players_v11'), orderBy('id'), startAfter(repairData.lastPlayerId), limit(20))
      : query(collection(db, 'players_v11'), orderBy('id'), limit(20));
    
    const pSnap = await getDocs(playersQ);
    if (pSnap.empty) {
      await updateDoc(repairStatusRef, { phase: 'COMPLETED', finishedAt: serverTimestamp() });
      return { status: 'ALL_COMPLETE' };
    }

    const batch = writeBatch(db);
    let lastId = repairData.lastPlayerId;

    for (const pDoc of pSnap.docs) {
      const p = pDoc.data();
      const tier = Number(p.leagueLevel || 9);
      const group = Number(p.groupId || 1);
      const rank = Number(p.rank || 1);
      const userId = p.id;
      const clubName = p.clubName || p.displayName;
      const clubLogo = p.clubLogo || null;

      const botId = getBotId(leagueId, tier, group, rank);
      const tableId = `table_S${seasonNum}_L${leagueId}_V${tier}_G${group}`;
      const tableRef = doc(db, 'league_tables_v1', tableId);
      
      const tableSnap = await getDoc(tableRef);
      if (tableSnap.exists()) {
        const tableData = tableSnap.data();
        const stats = { ...tableData.stats };
        
        // Если бот еще в таблице - заменяем его на игрока
        if (stats[botId]) {
          const botStats = stats[botId];
          stats[userId] = {
            ...botStats,
            id: userId, name: clubName, clubLogo: clubLogo, isBot: false
          };
          delete stats[botId];
          batch.update(tableRef, { stats, updatedAt: serverTimestamp() });
        }
      }

      // Обновляем матчи игрока в новой структуре (заменяем Bot ID на User ID)
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
    return { status: 'MIGRATING', processed: pSnap.size };
  }

  return { status: 'ALREADY_DONE' };
}
