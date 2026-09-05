
'use server';

import { FieldValue } from 'firebase-admin/firestore';
import { getAdminDb } from '@/lib/firebase-admin';
import { 
  MAX_LEVELS, getGroupsCountInLevel, TEAMS_PER_GROUP, 
  getTableId, getBotId, getBotName, generateSeasonCalendar 
} from '@/app/lib/leagues-data';
import { getGlobalSeasonInfo } from '@/app/lib/time-utils';
import { logger } from '@/app/lib/logger';

/**
 * @fileOverview Глобальный оркестратор сезона v150.
 * Реализует State Machine игрового мира.
 */

export async function runSeasonOrchestrator() {
  const db = getAdminDb();
  const configRef = db.collection('system_v1').doc('season_config');
  
  try {
    const result = await db.runTransaction(async (t) => {
      const snap = await t.get(configRef);
      const config = snap.data() || { 
        activeSeasonNumber: 1, 
        phase: 'REGULAR_SEASON', 
        worldReady: false 
      };
      
      const info = getGlobalSeasonInfo();

      // ШАГ 1: Инициализация мира (если не готов)
      if (!config.worldReady) {
        return { action: 'INITIALIZE_WORLD', season: config.activeSeasonNumber };
      }

      // ШАГ 2: Регулярный сезон (Расчет матчей)
      if (config.phase === 'REGULAR_SEASON') {
        if (info.dayOfCycle >= 15) {
          t.update(configRef, { phase: 'FINALIZING', updatedAt: FieldValue.serverTimestamp() });
          return { action: 'START_FINALIZATION' };
        }
        return { action: 'RESOLVE_MATCHES' };
      }

      // ШАГ 3: Финализация и генерация следующего сезона
      if (config.phase === 'FINALIZING') {
        t.update(configRef, { 
          phase: 'GENERATING_NEXT', 
          nextSeasonNumber: config.activeSeasonNumber + 1 
        });
        return { action: 'START_GENERATION' };
      }

      return { action: 'IDLE', phase: config.phase };
    });

    if (result.action === 'INITIALIZE_WORLD') {
      await initializeWorldJob(result.season);
    }

    return result;
  } catch (e: any) {
    logger.error("Orchestrator failed", e);
    return { action: 'ERROR', error: e.message };
  }
}

/**
 * Инициализирует структуру лиги: таблицы, слоты и матчи.
 */
async function initializeWorldJob(season: number) {
  const db = getAdminDb();
  const statusRef = db.collection('system_v1').doc(`world_gen_S${season}`);
  const statusSnap = await statusRef.get();
  const completedGroups = statusSnap.exists ? (statusSnap.data()?.completedGroups || 0) : 0;

  const totalToBuild = 15; // 1+2+4+8 групп
  if (completedGroups >= totalToBuild) {
    await db.collection('system_v1').doc('season_config').update({ worldReady: true });
    return;
  }

  const batch = db.batch();
  let builtInThisJob = 0;
  
  // Строим по 4 группы за запуск для стабильности
  for (let i = 1; i <= totalToBuild; i++) {
    if (i <= completedGroups) continue;
    if (builtInThisJob >= 4) break;

    const coords = getGroupCoordinates(i);
    await provisionGroup(batch, season, "ALPHA", coords.tier, coords.group);
    builtInThisJob++;
  }

  const newTotal = completedGroups + builtInThisJob;
  batch.set(statusRef, { 
    completedGroups: newTotal, 
    status: newTotal >= totalToBuild ? 'completed' : 'processing',
    updatedAt: FieldValue.serverTimestamp() 
  }, { merge: true });
  
  await batch.commit();
  logger.info(`World generation progress: ${newTotal}/${totalToBuild}`);
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
      season, leagueId, division: tier, group, rank: r,
      status: 'FREE', occupantId: null, updatedAt: FieldValue.serverTimestamp()
    });
  }

  batch.set(db.collection('league_tables_v2').doc(tableId), {
    id: tableId, leagueId, level: tier, group, season,
    stats: initialStats, version: 140, createdAt: FieldValue.serverTimestamp()
  });

  const calendar = generateSeasonCalendar(teams, season, leagueId);
  calendar.forEach(m => {
    const mId = `match_S${season}_V${tier}_G${group}_T${m.tour}_R${m.homeRank}_vs_R${m.awayRank}`;
    // Оркестратор позже установит startTime на основе даты активации сезона
    batch.set(db.collection('matches_v2').doc(mId), { ...m, id: mId, isFinished: false, isProcessing: false });
  });
}
