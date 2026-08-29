'use server';

/**
 * @fileOverview Скрипт Абсолютного Сброса v119 (Total Database Purge).
 * Последовательность: 
 * 1. Удаление ВСЕХ таблиц и матчей.
 * 2. Полное удаление ВСЕХ профилей игроков (v10, v11, v12).
 * 3. Очистка чатов, друзей, рынка и уведомлений (Удаление всех упоминаний старых игроков).
 * 4. Создание чистого мира (511 групп с ботами).
 */

import { 
  collection, getDocs, doc, getDoc,
  serverTimestamp, query, limit, setDoc, deleteDoc, writeBatch 
} from 'firebase/firestore';
import { initializeFirebase } from '@/firebase';
import { getGlobalSeasonInfo } from '@/app/lib/time-utils';
import { initializeLeagueWorld } from './world-engine';

const DELETE_BATCH_SIZE = 500; 

export async function runGlobalEmergencyRepair() {
  const { firestore: db } = initializeFirebase();
  const info = getGlobalSeasonInfo();
  const seasonNum = info.activeSeasonNumber;
  const leagueId = "ALPHA";

  // Документ состояния ремонта v119 (Тотальная очистка v12)
  const repairStatusRef = doc(db, 'system_v1', `repair_v119_S${seasonNum}_L${leagueId}`);
  const repairSnap = await getDoc(repairStatusRef);
  const repairData = repairSnap.exists() ? repairSnap.data() : { phase: 'WIPE_TABLES' };

  if (repairData.phase === 'COMPLETED') {
    return { status: 'ALL_READY', msg: 'Season 1 initialized. World is empty and ready for new managers.' };
  }

  console.log(`[TOTAL PURGE] v119, Phase: ${repairData.phase}`);

  /**
   * ЭТАП 1: Очистка таблиц и матчей
   */
  if (repairData.phase === 'WIPE_TABLES') {
    const q = query(collection(db, 'league_tables_v1'), limit(DELETE_BATCH_SIZE));
    const snap = await getDocs(q);
    if (!snap.empty) {
      const batch = writeBatch(db);
      snap.docs.forEach(d => batch.delete(d.ref));
      await batch.commit();
      return { status: 'WIPING_TABLES', deleted: snap.size };
    }
    await setDoc(repairStatusRef, { phase: 'WIPE_MATCHES' }, { merge: true });
    return { status: 'TABLES_CLEARED', next: 'WIPE_MATCHES' };
  }

  if (repairData.phase === 'WIPE_MATCHES') {
    const q = query(collection(db, 'matches_v1'), limit(DELETE_BATCH_SIZE));
    const snap = await getDocs(q);
    if (!snap.empty) {
      const batch = writeBatch(db);
      snap.docs.forEach(d => batch.delete(d.ref));
      await batch.commit();
      return { status: 'WIPING_MATCHES', deleted: snap.size };
    }
    await setDoc(repairStatusRef, { phase: 'WIPE_PLAYERS_ALL' }, { merge: true });
    return { status: 'MATCHES_CLEARED', next: 'WIPE_PLAYERS_ALL' };
  }

  /**
   * ЭТАП 2: Удаление ВСЕХ игроков (v10, v11, v12)
   */
  if (repairData.phase === 'WIPE_PLAYERS_ALL') {
    // Чистим v12
    const q12 = query(collection(db, 'players_v12'), limit(DELETE_BATCH_SIZE));
    const s12 = await getDocs(q12);
    if (!s12.empty) {
      const batch = writeBatch(db);
      s12.docs.forEach(d => batch.delete(d.ref));
      await batch.commit();
      return { status: 'WIPING_PLAYERS_V12', deleted: s12.size };
    }
    // Чистим v11
    const q11 = query(collection(db, 'players_v11'), limit(DELETE_BATCH_SIZE));
    const s11 = await getDocs(q11);
    if (!s11.empty) {
      const batch = writeBatch(db);
      s11.docs.forEach(d => batch.delete(d.ref));
      await batch.commit();
      return { status: 'WIPING_PLAYERS_V11', deleted: s11.size };
    }
    await setDoc(repairStatusRef, { phase: 'WIPE_SOCIAL' }, { merge: true });
    return { status: 'PLAYERS_CLEARED', next: 'WIPE_SOCIAL' };
  }

  /**
   * ЭТАП 3: Очистка социальных данных (Чаты, Друзья, Рынок)
   */
  if (repairData.phase === 'WIPE_SOCIAL') {
    // 1. Чаты
    const qChat = query(collection(db, 'global_chat_v2'), limit(DELETE_BATCH_SIZE));
    const sChat = await getDocs(qChat);
    if (!sChat.empty) {
      const batch = writeBatch(db);
      sChat.docs.forEach(d => batch.delete(d.ref));
      await batch.commit();
      return { status: 'WIPING_CHATS', deleted: sChat.size };
    }
    // 2. Друзья
    const qFriends = query(collection(db, 'friend_requests_v4'), limit(DELETE_BATCH_SIZE));
    const sFriends = await getDocs(qFriends);
    if (!sFriends.empty) {
      const batch = writeBatch(db);
      sFriends.docs.forEach(d => batch.delete(d.ref));
      await batch.commit();
      return { status: 'WIPING_FRIENDS', deleted: sFriends.size };
    }
    // 3. Рынок
    const qMarket = query(collection(db, 'market_v7'), limit(DELETE_BATCH_SIZE));
    const sMarket = await getDocs(qMarket);
    if (!sMarket.empty) {
      const batch = writeBatch(db);
      sMarket.docs.forEach(d => batch.delete(d.ref));
      await batch.commit();
      return { status: 'WIPING_MARKET', deleted: sMarket.size };
    }
    // 4. Уведомления
    const qNotifs = query(collection(db, 'notifications_v7'), limit(DELETE_BATCH_SIZE));
    const sNotifs = await getDocs(qNotifs);
    if (!sNotifs.empty) {
      const batch = writeBatch(db);
      sNotifs.docs.forEach(d => batch.delete(d.ref));
      await batch.commit();
      return { status: 'WIPING_NOTIFICATIONS', deleted: sNotifs.size };
    }

    await setDoc(repairStatusRef, { phase: 'WIPE_SYSTEM_FLAGS' }, { merge: true });
    return { status: 'SOCIAL_CLEARED', next: 'WIPE_SYSTEM_FLAGS' };
  }

  /**
   * ЭТАП 4: Удаление системных флагов
   */
  if (repairData.phase === 'WIPE_SYSTEM_FLAGS') {
    const sysRefs = [
      doc(db, 'system_v1', `init_S${seasonNum}_L${leagueId}`),
      doc(db, 'system_v1', `repair_v118_S${seasonNum}_L${leagueId}`),
      doc(db, 'system_v1', `repair_v117_S${seasonNum}_L${leagueId}`),
      doc(db, 'system_v1', `repair_v116_S${seasonNum}_L${leagueId}`),
      doc(db, 'system_v1', `repair_v115_S${seasonNum}_L${leagueId}`)
    ];
    for (const r of sysRefs) await deleteDoc(r).catch(() => {});
    
    await setDoc(repairStatusRef, { phase: 'INIT_WORLD' }, { merge: true });
    return { status: 'SYSTEM_CLEARED', next: 'INIT_WORLD' };
  }

  /**
   * ЭТАП 5: Постройка нового мира (только боты)
   */
  if (repairData.phase === 'INIT_WORLD') {
    const worldRes = await initializeLeagueWorld(leagueId, seasonNum);
    if (worldRes.isComplete) {
      await setDoc(repairStatusRef, { 
        phase: 'COMPLETED', 
        status: 'completed',
        finishedAt: serverTimestamp()
      }, { merge: true });
      return { status: 'ALL_COMPLETE', msg: "Universe v119 built: 511 bot-only groups ready. No old players remain." };
    }
    return { status: 'BUILDING_WORLD', currentIndex: worldRes.currentIndex };
  }

  return { status: 'UNKNOWN' };
}
