'use server';

/**
 * @fileOverview Ядро управления сезонными циклами v1.0.
 * Отвечает за плавный переход между сезонами и подготовку данных.
 */

import { doc, getDoc, setDoc, serverTimestamp, collection, query, where, getDocs, writeBatch, limit } from 'firebase/firestore';
import { initializeFirebase } from '@/firebase';
import { authenticateAsSystem } from '@/firebase/system-auth';
import { getGlobalSeasonInfo, getMoscowTime } from '@/app/lib/time-utils';
import { initializeLeagueWorld } from './world-engine';

/**
 * Читает номер активного сезона из конфига БД.
 * Fallback на статический расчет времени.
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
 * Вызывается в 15-й день цикла (начало межсезонья).
 */
export async function generateNextSeasonWorld() {
  await authenticateAsSystem();
  const { firestore: db } = initializeFirebase();
  const info = getGlobalSeasonInfo();
  const now = getMoscowTime();

  // Должен быть 15-й день цикла и время после 16:00 MSK
  if (info.dayOfCycle !== 15 || now.getHours() < 16) {
    return { success: false, msg: "NOT_TIME_FOR_GENERATION", info };
  }

  const currentSeason = await getActiveSeasonNumber(db);
  const nextSeason = currentSeason + 1;

  // Инициализируем мир для следующего сезона
  const result = await initializeLeagueWorld('ALPHA', nextSeason);
  return { success: true, result };
}

/**
 * Официально активирует следующий сезон.
 * Вызывается в 16-й день цикла (день перехода).
 */
export async function activateNextSeason() {
  await authenticateAsSystem();
  const { firestore: db } = initializeFirebase();
  const info = getGlobalSeasonInfo();
  const now = getMoscowTime();

  // Должен быть 16-й день цикла и время после 18:00 MSK
  if (info.dayOfCycle !== 16 || now.getHours() < 18) {
    return { success: false, msg: "NOT_TIME_FOR_ACTIVATION", info };
  }

  const currentSeason = await getActiveSeasonNumber(db);
  
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
    activeSeasonNumber: currentSeason + 1,
    updatedAt: serverTimestamp()
  }, { merge: true });

  return { success: true, newSeason: currentSeason + 1 };
}
