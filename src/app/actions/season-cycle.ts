
'use server';

import { FieldValue } from 'firebase-admin/firestore';
import { getAdminDb } from '@/lib/firebase-admin';
import { MAX_LEVELS, getGroupsCountInLevel, TEAMS_PER_GROUP, getTableId, getBotId, getBotName, generateSeasonCalendar } from '@/app/lib/leagues-data';
import { getMoscowTime, getGlobalSeasonInfo } from '@/app/lib/time-utils';
import { logger } from '@/app/lib/logger';

/**
 * @fileOverview Глобальный оркестратор сезона v142.
 * Реализует State Machine игрового мира.
 */

export async function runSeasonOrchestrator() {
  const db = getAdminDb();
  const configRef = db.collection('system_v1').doc('season_config');
  
  try {
    const result = await db.runTransaction(async (t) => {
      const snap = await t.get(configRef);
      const config = snap.data() || { activeSeasonNumber: 1, phase: 'REGULAR_SEASON', worldReady: false };
      const info = getGlobalSeasonInfo();

      // ШАГ 1: Инициализация нового мира
      if (!config.worldReady) {
        return { action: 'INITIALIZE_WORLD', season: config.activeSeasonNumber };
      }

      // ШАГ 2: Переход в финальную стадию (День 15)
      if (info.dayOfCycle >= 15 && config.phase === 'REGULAR_SEASON') {
        t.update(configRef, { phase: 'FINALIZING', updatedAt: FieldValue.serverTimestamp() });
        return { action: 'START_FINALIZATION' };
      }

      // ШАГ 3: Генерация следующего сезона
      if (config.phase === 'FINALIZING') {
        t.update(configRef, { phase: 'GENERATING_NEXT', nextSeasonNumber: config.activeSeasonNumber + 1 });
        return { action: 'START_GENERATION' };
      }

      // ШАГ 4: Активация (День 1 или День 17 поздно вечером)
      if (config.phase === 'READY_TO_ACTIVATE' && (info.dayOfCycle === 1 || info.dayOfCycle === 17)) {
        t.update(configRef, { 
          phase: 'REGULAR_SEASON', 
          activeSeasonNumber: config.nextSeasonNumber,
          worldReady: true,
          updatedAt: FieldValue.serverTimestamp() 
        });
        return { action: 'SEASON_ACTIVATED', newSeason: config.nextSeasonNumber };
      }

      return { action: 'IDLE', phase: config.phase };
    });

    if (result.action === 'INITIALIZE_WORLD') {
      await initializeWorldJob(result.season);
    }

    return result;
  } catch (e: any) {
    logger.error("Orchestrator transaction failed", e);
    return { action: 'ERROR', error: e.message };
  }
}

async function initializeWorldJob(season: number) {
  const db = getAdminDb();
  const statusRef = db.collection('system_v1').doc(`world_gen_S${season}`);
  const statusSnap = await statusRef.get();
  const currentIndex = statusSnap.exists ? (statusSnap.data()?.currentIndex || 0) : 0;

  const totalToBuild = 15; // 1+2+4+8 групп
  if (currentIndex >= totalToBuild) {
    await db.collection('system_v1').doc('season_config').update({ worldReady: true });
    return;
  }

  const batch = db.batch();
  let nextIndex = currentIndex;
  
  // Строим по 4 группы за запуск для стабильности
  for (let i = 0; i < 4 && nextIndex < totalToBuild; i++) {
    nextIndex++;
    const coords = getGroupCoordinates(nextIndex);
    await provisionGroup(batch, season, "ALPHA", coords.tier, coords.group);
  }

  batch.set(statusRef, { 
    currentIndex: nextIndex, 
    status: nextIndex >= totalToBuild ? 'completed' : 'processing',
    updatedAt: FieldValue.serverTimestamp() 
  }, { merge: true });
  
  await batch.commit();
}

function getGroupCoordinates(index: number) {
  let tier = 1;
  let runningTotal = 0;
  while (tier <= 4) {
    const groupsInTier = Math.pow(2, tier - 1);
    if (index <= runningTotal + groupsInTier) {
      return { tier, group: index - runningTotal };
    }
    runningTotal += groupsInTier;
    tier++;
  }
  return { tier: 4, group: 8 };
}

async function provisionGroup(batch: any, season: number, leagueId: string, tier: number, group: number) {
  const db = getAdminDb();
  const tableId = getTableId(season, leagueId, tier, group);
  
  const initialStats: any = {};
  const teams = [];

  for (let r = 1; r <= TEAMS_PER_GROUP; r++) {
    const bId = getBotId(leagueId, tier, group, r);
    const bName = getBotName(tier, group, r);
    initialStats[bId] = {
      id: bId, name: bName, rank: r,
      matchesPlayed: 0, wins: 0, draws: 0, losses: 0, points: 0, diff: 0, isBot: true
    };
    teams.push({ id: bId, name: bName, rank: r });
    
    // Создаем атомарный слот для регистрации
    const slotId = `S${season}_L${leagueId}_D${tier}_G${group}_R${r}`;
    batch.set(db.collection('league_slots_v1').doc(slotId), {
      status: 'FREE', occupantId: null, updatedAt: FieldValue.serverTimestamp()
    });
  }

  batch.set(db.collection('league_tables_v2').doc(tableId), {
    id: tableId, leagueId, level: tier, group, season,
    stats: initialStats, version: 140, createdAt: FieldValue.serverTimestamp()
  });

  const calendar = generateSeasonCalendar(teams, season, leagueId, getMoscowTime());
  calendar.forEach(m => {
    const mId = `match_S${season}_V${tier}_G${group}_T${m.tour}_R${m.homeRank}_vs_R${m.awayRank}`;
    batch.set(db.collection('matches_v2').doc(mId), { ...m, id: mId, isFinished: false, isProcessing: false });
  });
}
