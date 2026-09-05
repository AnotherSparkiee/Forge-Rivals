
'use server';

import { FieldValue } from 'firebase-admin/firestore';
import { getAdminDb } from '@/lib/firebase-admin';
import { MAX_LEVELS, getGroupsCountInLevel, getTableId } from '@/app/lib/leagues-data';
import { getRandomStartingSquad, Player, LineupSlot } from '@/app/lib/moba-data';

/**
 * @fileOverview Атомарная инициализация клуба.
 * Серверный источник истины для новых игроков.
 */

interface ProvisionResult {
  success: boolean;
  error?: string;
  data?: any;
}

/**
 * Генерирует полное начальное состояние клуба.
 */
export function createInitialClubState(userId: string, email: string, clubName: string, placement: any, seasonNum: number) {
  const startingSquad = getRandomStartingSquad();
  
  // Создаем Lineup на основе сгенерированного состава
  const lineup: Record<string, string | null> = {
    carry: startingSquad.find(p => p.role === 'Carry')?.id || null,
    mid: startingSquad.find(p => p.role === 'Midlaner')?.id || null,
    offlane: startingSquad.find(p => p.role === 'Tank')?.id || null,
    support: startingSquad.find(p => p.role === 'Jungler')?.id || null,
    full_support: startingSquad.find(p => p.role === 'Support')?.id || null,
    sub_carry: null, sub_mid: null, sub_offlane: null, sub_support: null, sub_full_support: null,
    res1: null, res2: null, res3: null, res4: null, res5: null, res6: null, res7: null, res8: null
  };

  return {
    id: userId,
    email: email,
    displayName: clubName,
    clubName: clubName,
    country: "International",
    numericId: 0, // Установит транзакция
    
    credits: 1000000,
    crystals: 50,
    experiencePoints: 0,
    managerLevel: 1,
    
    selectedLeagueId: "ALPHA",
    leagueLevel: placement.tier,
    groupId: placement.group,
    rank: placement.rank,
    
    ownedPlayers: startingSquad,
    lineup: lineup,
    
    staff: { coach: null, analyst: null, scout: null, doctor: null, financier: null },
    strategy: "Balanced Play",
    
    arena: { capacity: 5000, pressCenterLevel: 1, cafeLevel: 1, shopLevel: 1 },
    hq: { hrLevel: 1, financeLevel: 1 },
    bootcamp: { bootcampLevel: 1 },
    academy: { scoutsLevel: 1 },
    medical: { massageLevel: 1 },
    
    lastProcessedSeason: seasonNum,
    rewardDay: 1,
    lastLoginDate: new Date().toISOString(),
    version: 140
  };
}

/**
 * Атомарная регистрация клуба.
 */
export async function provisionClubComplete(userId: string, email: string, clubName: string): Promise<ProvisionResult> {
  const db = getAdminDb();
  const cleanName = clubName.trim().substring(0, 25);
  
  try {
    return await db.runTransaction(async (transaction) => {
      const playerRef = db.collection('players_v14').doc(userId);
      const playerSnap = await transaction.get(playerRef);

      // 1. Идемпотентность: возвращаем профиль, если он уже создан
      if (playerSnap.exists) {
        return { success: true, data: playerSnap.data() };
      }

      // 2. Получаем текущий сезон
      const configRef = db.collection('system_v1').doc('season_config');
      const configSnap = await transaction.get(configRef);
      const seasonNum = configSnap.exists ? (configSnap.data()?.activeSeasonNumber || 1) : 1;

      // 3. Поиск свободного слота (атомарно)
      let placement = null;
      // Начинаем поиск с Division 4
      for (let tier = MAX_LEVELS; tier >= 1; tier--) {
        const groupsInTier = getGroupsCountInLevel(tier);
        for (let group = 1; group <= groupsInTier; group++) {
          const tableId = getTableId(seasonNum, "ALPHA", tier, group);
          const tableRef = db.collection('league_tables_v2').doc(tableId);
          const tableSnap = await transaction.get(tableRef);
          
          if (!tableSnap.exists) continue; // Группа еще не инициализирована оркестратором

          const stats = tableSnap.data()?.stats || {};
          const botId = Object.keys(stats).find(id => stats[id].isBot);
          
          if (botId) {
            placement = { tier, group, rank: stats[botId].rank, botToReplace: botId, tableRef };
            break;
          }
        }
        if (placement) break;
      }

      if (!placement) return { success: false, error: "NO_FREE_SLOTS" };

      // 4. Создаем состояние клуба
      const initialState = createInitialClubState(userId, email, cleanName, placement, seasonNum);
      
      // 5. Обновляем счетчик игроков
      const statsRef = db.collection('system_v1').doc('global_stats');
      const statsSnap = await transaction.get(statsRef);
      const nextId = (statsSnap.exists ? (statsSnap.data()?.totalPlayers || 1000) : 1000) + 1;
      initialState.numericId = nextId;

      // 6. Обновляем таблицу (заменяем бота на человека)
      const tableData = (await transaction.get(placement.tableRef)).data();
      const newStats = { ...tableData?.stats };
      delete newStats[placement.botToReplace];
      newStats[userId] = {
        id: userId, name: cleanName, rank: placement.rank,
        matchesPlayed: 0, wins: 0, draws: 0, losses: 0, points: 0, diff: 0, isBot: false
      };

      transaction.update(placement.tableRef, { stats: newStats, updatedAt: FieldValue.serverTimestamp() });
      transaction.set(playerRef, { ...initialState, createdAt: FieldValue.serverTimestamp() });
      transaction.set(statsRef, { totalPlayers: nextId, updatedAt: FieldValue.serverTimestamp() }, { merge: true });

      // 7. Обновляем матчи в этой группе
      const matchesQuery = db.collection('matches_v2')
        .where('season', '==', seasonNum)
        .where('leagueId', '==', 'ALPHA')
        .where('level', '==', placement.tier)
        .where('groupId', '==', placement.group);
      
      const matchesSnap = await transaction.get(matchesQuery);
      matchesSnap.forEach(mDoc => {
        const m = mDoc.data();
        const updates: any = {};
        if (m.homeId === placement.botToReplace) { updates.homeId = userId; updates.homeName = cleanName; }
        if (m.awayId === placement.botToReplace) { updates.awayId = userId; updates.awayName = cleanName; }
        if (Object.keys(updates).length > 0) transaction.update(mDoc.ref, updates);
      });

      return { success: true, data: initialState };
    });
  } catch (e: any) {
    console.error("[PROVISIONING FAILED]:", e);
    return { success: false, error: "REGISTRATION_FAILED" };
  }
}
