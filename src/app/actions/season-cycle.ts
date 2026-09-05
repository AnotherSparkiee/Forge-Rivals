'use server';

import { FieldValue } from 'firebase-admin/firestore';
import { getAdminDb } from '@/lib/firebase-admin';
import { 
  MAX_LEVELS, TEAMS_PER_GROUP, TOTAL_GROUPS,
  getTableId, getBotId, getBotName, generateSeasonCalendar 
} from '@/app/lib/leagues-data';
import { getGlobalSeasonInfo } from '@/app/lib/time-utils';
import { logger } from '@/app/lib/logger';

/**
 * @fileOverview Глобальный оркестратор сезона v160.
 * Единственная точка входа для управления циклом мира.
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

      // ШАГ 1: Если мир текущего сезона не готов
      if (!config.worldReady) {
        return { action: 'INITIALIZE_WORLD', season: config.activeSeasonNumber };
      }

      // ШАГ 2: Регулярный сезон
      if (config.phase === 'REGULAR_SEASON' || config.phase === 'ACTIVE') {
        // Переход к финализации после 14 туров
        if (info.dayOfCycle >= 15) {
          t.update(configRef, { phase: 'FINALIZING', updatedAt: FieldValue.serverTimestamp() });
          return { action: 'START_FINALIZATION' };
        }
        return { action: 'RESOLVE_MATCHES' };
      }

      // ШАГ 3: Подготовка следующего сезона
      if (config.phase === 'FINALIZING') {
        t.update(configRef, { 
          phase: 'GENERATING_NEXT', 
          nextSeasonNumber: config.activeSeasonNumber + 1 
        });
        return { action: 'GENERATE_NEXT' };
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

async function initializeWorldJob(season: number) {
  const db = getAdminDb();
  const statusRef = db.collection('system_v1').doc(`world_gen_S${season}`);
  const statusSnap = await statusRef.get();
  const completedGroups = statusSnap.exists ? (statusSnap.data()?.completedGroups || 0) : 0;

  if (completedGroups >= TOTAL_GROUPS) {
    await db.collection('system_v1').doc('season_config').update({ worldReady: true });
    return;
  }

  const batch = db.batch();
  let builtInThisJob = 0;
  
  // Строим по 4 группы за запуск для стабильности (Cloud Run timeouts)
  for (let i = 1; i <= TOTAL_GROUPS; i++) {
    if (i <= completedGroups) continue;
    if (builtInThisJob >= 4) break;

    const coords = getGroupCoordinates(i);
    await provisionGroup(batch, season, "ALPHA", coords.tier, coords.group);
    builtInThisJob++;
  }

  const newTotal = completedGroups + builtInThisJob;
  batch.set(statusRef, { 
    completedGroups: newTotal, 
    status: newTotal >= TOTAL_GROUPS ? 'completed' : 'processing',
    updatedAt: FieldValue.serverTimestamp() 
  }, { merge: true });
  
  await batch.commit();
}

function getGroupCoordinates(index: number) {
  let tier = 1;
  let runningTotal = 0;
  while (tier <= MAX_LEVELS) {
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
  const info = getGlobalSeasonInfo();
  
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

  const calendar = generateSeasonCalendar(teams, season, leagueId, info.currentSeasonStart);
  calendar.forEach(m => {
    const mId = `match_v140_S${season}_L${leagueId}_V${tier}_G${group}_T${m.tour}_R${m.homeRank}_vs_R${m.awayRank}`;
    batch.set(db.collection('matches_v2').doc(mId), { ...m, id: mId });
  });
}
