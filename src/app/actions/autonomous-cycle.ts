
'use server';

/**
 * @fileOverview ГЛОБАЛЬНЫЙ АВТОНОМНЫЙ ДВИГАТЕЛЬ ЛИГИ v1.0.
 * Реализует ТЗ по полностью независимому циклу:
 * 1. Ежедневный расчет матчей (resolveDailyMatches).
 * 2. Смена сезона с повышением/понижением (performSeasonTransition).
 */

import { 
  collection, doc, getDocs, getDoc, query, where, 
  writeBatch, serverTimestamp, Timestamp, increment,
  Firestore 
} from 'firebase/firestore';
import { initializeFirebase } from '@/firebase';
import { 
  getGroupsCountInLevel, getPromotionTarget, getRelegationTarget, 
  TEAMS_PER_GROUP, generateSeasonCalendar, getBotId, getMatchResult 
} from '@/app/lib/leagues-data';
import { getGlobalSeasonInfo } from '@/app/lib/time-utils';

class FirestoreBatcher {
  private count = 0;
  private batch;
  constructor(private db: Firestore) {
    this.batch = writeBatch(db);
  }
  async set(ref: any, data: any, options?: any) {
    this.batch.set(ref, data, options || {});
    this.count++;
    if (this.count >= 480) await this.commit();
  }
  async update(ref: any, data: any) {
    this.batch.update(ref, data);
    this.count++;
    if (this.count >= 480) await this.commit();
  }
  async commit() {
    if (this.count > 0) {
      await this.batch.commit();
      this.batch = writeBatch(this.db);
      this.count = 0;
    }
  }
}

/**
 * РАСЧЕТ МАТЧЕЙ ТУРА.
 * Вызывается сервером (cron) после 18:46 MSK.
 */
export async function resolveDailyMatches() {
  const { firestore: db } = initializeFirebase();
  const info = getGlobalSeasonInfo();
  const currentSeason = info.activeSeasonNumber;
  
  console.log(`[AUTONOMOUS] Starting daily resolution for Season ${currentSeason}, Tour ${info.dayOfCycle}`);

  const q = query(
    collection(db, 'matches_v1'),
    where('season', '==', currentSeason),
    where('tour', '==', info.dayOfCycle),
    where('isFinished', '==', false)
  );

  const snap = await getDocs(q);
  if (snap.empty) return { success: true, count: 0 };

  const batcher = new FirestoreBatcher(db);
  let count = 0;

  for (const matchDoc of snap.docs) {
    const m = matchDoc.data();
    const [sA, sB] = getMatchResult(m.homeRank, m.awayRank, m.level, m.groupId, m.season, m.tour);
    const winnerId = sA > sB ? (m.homeId || null) : (sB > sA ? (m.awayId || null) : null);

    // 1. Фиксируем результат матча
    await batcher.update(matchDoc.ref, {
      scoreA: sA,
      scoreB: sB,
      winnerId,
      status: 'finished',
      isFinished: true,
      resolvedAt: serverTimestamp(),
      version: 100
    });

    // 2. Обновляем таблицу группы
    const tableId = `table_S${currentSeason}_L${m.leagueId}_V${m.level}_G${m.groupId}`;
    const tableRef = doc(db, 'league_tables_v1', tableId);
    
    // В идеале это транзакция, но для массового резолва 28к матчей используем атомарный апдейт структуры stats
    const statsUpdate: any = {};
    if (m.homeId) {
      statsUpdate[`stats.${m.homeId}.matchesPlayed`] = increment(1);
      statsUpdate[`stats.${m.homeId}.wins`] = increment(sA > sB ? 1 : 0);
      statsUpdate[`stats.${m.homeId}.draws`] = increment(sA === sB ? 1 : 0);
      statsUpdate[`stats.${m.homeId}.losses`] = increment(sB > sA ? 1 : 0);
      statsUpdate[`stats.${m.homeId}.points`] = increment(sA > sB ? 3 : (sA === sB ? 1 : 0));
      statsUpdate[`stats.${m.homeId}.diff`] = increment(sA - sB);
    }
    if (m.awayId) {
      statsUpdate[`stats.${m.awayId}.matchesPlayed`] = increment(1);
      statsUpdate[`stats.${m.awayId}.wins`] = increment(sB > sA ? 1 : 0);
      statsUpdate[`stats.${m.awayId}.draws`] = increment(sA === sB ? 1 : 0);
      statsUpdate[`stats.${m.awayId}.losses`] = increment(sA > sB ? 1 : 0);
      statsUpdate[`stats.${m.awayId}.points`] = increment(sB > sA ? 3 : (sA === sB ? 1 : 0));
      statsUpdate[`stats.${m.awayId}.diff`] = increment(sB - sA);
    }

    await batcher.update(tableRef, { ...statsUpdate, updatedAt: serverTimestamp() });
    count++;
  }

  await batcher.commit();
  return { success: true, count };
}

/**
 * СМЕНА СЕЗОНА.
 * Вызывается сервером на 15-й день цикла.
 */
export async function performSeasonTransition() {
  const { firestore: db } = initializeFirebase();
  const info = getGlobalSeasonInfo();
  const currentSeason = info.activeSeasonNumber;
  const nextSeason = currentSeason + 1;
  const leagueId = "ALPHA";

  // Защита от повторного запуска
  const statusRef = doc(db, 'system_v1', `transition_S${currentSeason}`);
  const statusSnap = await getDoc(statusRef);
  if (statusSnap.exists() && statusSnap.data().status === 'completed') {
    return { alreadyDone: true };
  }
  await batcherSet(statusRef, { status: 'processing', startedAt: serverTimestamp() });

  console.log(`[SEASON] Transitioning from S${currentSeason} to S${nextSeason}...`);

  // Карта для сбора команд на следующий сезон: Pool[Level] = Array<{id, name, isBot, oldRank}>
  const pools: Map<number, any[]> = new Map();
  for (let i = 1; i <= 9; i++) pools.set(i, []);

  // 1. Собираем итоги всех 511 групп текущего сезона
  for (let level = 1; level <= 9; level++) {
    const groupsCount = getGroupsCountInLevel(level);
    for (let g = 1; g <= groupsCount; g++) {
      const tableId = `table_S${currentSeason}_L${leagueId}_V${level}_G${g}`;
      const tableSnap = await getDoc(doc(db, 'league_tables_v1', tableId));
      if (!tableSnap.exists()) continue;

      const stats = tableSnap.data().stats;
      const standings = Object.values(stats).sort((a: any, b: any) => {
        if (b.points !== a.points) return b.points - a.points;
        return b.diff - a.diff;
      });

      standings.forEach((team: any, index: number) => {
        const rank = index + 1;
        let targetLevel = level;

        if (rank === 1 && level > 1) targetLevel = level - 1;
        else if ((rank === 7 || rank === 8) && level < 9) targetLevel = level + 1;

        pools.get(targetLevel)?.push({ 
          id: team.id, 
          name: team.name, 
          isBot: !!team.isBot,
          clubLogo: team.clubLogo || null
        });
      });
    }
  }

  // 2. Распределяем команды по новым группам и создаем таблицы/календари
  const globalBatcher = new FirestoreBatcher(db);

  for (let level = 1; level <= 9; level++) {
    const pool = pools.get(level) || [];
    // Перемешиваем пул для равномерного распределения
    const shuffled = pool.sort(() => Math.random() - 0.5);
    const groupsNeeded = getGroupsCountInLevel(level);

    for (let g = 1; g <= groupsNeeded; g++) {
      const groupTeams = shuffled.slice((g - 1) * 8, g * 8);
      // Если команд не хватает (бывает при сбоях), заполняем ботами
      while (groupTeams.length < 8) {
        const bId = getBotId(leagueId, level, g, groupTeams.length + 1);
        groupTeams.push({ id: bId, name: bId, isBot: true });
      }

      const tableId = `table_S${nextSeason}_L${leagueId}_V${level}_G${g}`;
      const initialStats: any = {};
      const teamsForCalendar: any[] = [];

      groupTeams.forEach((team, idx) => {
        const rank = idx + 1;
        initialStats[team.id] = {
          id: team.id, name: team.name, isBot: team.isBot, clubLogo: team.clubLogo,
          rank, matchesPlayed: 0, wins: 0, draws: 0, losses: 0, points: 0, diff: 0
        };
        teamsForCalendar.push({ id: team.id, name: team.name, rank });

        // Обновляем профиль живого игрока
        if (!team.isBot) {
          globalBatcher.update(doc(db, 'players_v11', team.id), {
            leagueLevel: level,
            groupId: g,
            rank: rank,
            lastProcessedSeason: currentSeason,
            updatedAt: serverTimestamp()
          });
        }
      });

      // Создаем новую таблицу
      globalBatcher.set(doc(db, 'league_tables_v1', tableId), {
        id: tableId, leagueId, level, group: g, season: nextSeason,
        stats: initialStats,
        createdAt: serverTimestamp(),
        version: 100
      });

      // Создаем новый календарь
      const calendar = generateSeasonCalendar(teamsForCalendar, nextSeason, leagueId);
      calendar.forEach(m => {
        const mId = `match_S${nextSeason}_L${leagueId}_V${level}_G${g}_T${m.tour}_R${m.homeRank}_vs_R${m.awayRank}`;
        globalBatcher.set(doc(db, 'matches_v1', mId), {
          ...m,
          id: mId, leagueId, level, groupId: g, season: nextSeason,
          isFinished: false, scoreA: 0, scoreB: 0,
          version: 100
        });
      });
    }
  }

  await globalBatcher.commit();
  await setDoc(statusRef, { status: 'completed', finishedAt: serverTimestamp() }, { merge: true });

  return { success: true };
}

async function batcherSet(ref: any, data: any) {
  const { firestore: db } = initializeFirebase();
  await writeBatch(db).set(ref, data, { merge: true }).commit();
}
