
const functions = require('firebase-functions');
const admin = require('firebase-admin');

/**
 * @fileOverview Единое ядро облачных функций v140.
 * Обеспечивает атомарную регистрацию и автономный цикл мира.
 */

admin.initializeApp();
const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;

// ============ КОНСТАНТЫ ============
const MAX_LEVELS = 4;
const TEAMS_PER_GROUP = 8;
const GLOBAL_EPOCH_ISO = '2026-08-30T21:00:00Z';

function getGroupsCountInLevel(level) {
  return Math.pow(2, level - 1);
}

function getBotId(leagueId, level, group, rank) {
  return `BOT_${leagueId}_L${level}_G${group}_R${rank}`;
}

function getBotName(level, group, rank) {
  const gStr = String(group).padStart(3, '0');
  const rStr = String(rank).padStart(2, '0');
  return `Bot01${level}${gStr}${rStr}`;
}

function getTableId(season, leagueId, level, group) {
  return `table_v140_S${season}_L${leagueId}_V${level}_G${group}`;
}

// ============ ХЕЛПЕРЫ ============

function generateSeasonCalendar(teams, seasonNumber, leagueId) {
  const n = TEAMS_PER_GROUP;
  const rounds = n - 1;
  const matches = [];
  const hh = 18; // 18:00 MSK
  
  const epochUtc = new Date(GLOBAL_EPOCH_ISO);
  const cycleDuration = 17;
  const dayMs = 24 * 60 * 60 * 1000;
  const seasonStartMs = epochUtc.getTime() + (seasonNumber - 1) * cycleDuration * dayMs;
  const pool = Array.from({ length: n }, (_, i) => i);

  for (let round = 0; round < rounds; round++) {
    for (let i = 0; i < n / 2; i++) {
      const hIdx = pool[i];
      const aIdx = pool[n - 1 - i];
      const home = teams[hIdx];
      const away = teams[aIdx];

      const createMatch = (day, h, a, tour) => {
        const startTime = new Date(seasonStartMs + (day - 1) * dayMs + (hh - 3) * 3600000);
        const mId = `match_v140_S${seasonNumber}_L${leagueId}_V${h.level}_G${h.group}_T${tour}_H${h.rank}_A${a.rank}`;
        
        let seed = 0;
        for (let j = 0; j < mId.length; j++) { seed = ((seed << 5) - seed) + mId.charCodeAt(j); seed |= 0; }
        
        return {
          day, tour, season: seasonNumber,
          homeId: h.id, homeName: h.name, homeRank: Number(h.rank),
          awayId: a.id, awayName: a.name, awayRank: Number(a.rank),
          startTime: startTime.toISOString(), type: 'league', 
          resultSeed: Math.abs(seed) % 1000, version: 140
        };
      };
      matches.push(createMatch(round + 1, home, away, round + 1));
      matches.push(createMatch(round + 8, away, home, round + 8));
    }
    const last = pool.pop();
    pool.splice(1, 0, last);
  }
  return matches;
}

// ============ ИНИЦИАЛИЗАЦИЯ КЛУБА ============

exports.initializeClub = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Auth required');

  const userId = context.auth.uid;
  const email = context.auth.token.email || `user_${userId}@lote.io`;
  const requestedName = data.clubName;
  const leagueId = "ALPHA";

  console.log(`[INIT] Starting provisioning for ${userId}`);

  try {
    const playerRef = db.collection('players_v14').doc(userId);
    const existingSnap = await playerRef.get();
    
    if (existingSnap.exists) {
      console.log(`[INIT] Player ${userId} already exists, returning data`);
      const d = existingSnap.data();
      return { success: true, clubName: d.clubName, tier: d.leagueLevel, group: d.groupId, rank: d.rank, numericId: d.numericId };
    }

    // 1. Определение текущего сезона
    const configSnap = await db.collection('system_v1').doc('season_config').get();
    const seasonNum = configSnap.exists ? (configSnap.data().activeSeasonNumber || 1) : 1;

    // 2. Поиск места через атомарные слоты
    let placement = null;
    for (let tier = MAX_LEVELS; tier >= 1; tier--) {
      const groupsInTier = getGroupsCountInLevel(tier);
      for (let group = 1; group <= groupsInTier; group++) {
        for (let r = 1; r <= 8; r++) {
          const slotId = `S${seasonNum}_L${leagueId}_D${tier}_G${group}_R${r}`;
          const slotRef = db.collection('league_slots_v1').doc(slotId);
          
          const result = await db.runTransaction(async (t) => {
            const sSnap = await t.get(slotRef);
            if (!sSnap.exists || sSnap.data().status === 'FREE') {
              t.set(slotRef, { status: 'OCCUPIED', occupantId: userId, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
              return { tier, group, rank: r };
            }
            return null;
          });

          if (result) {
            placement = result;
            break;
          }
        }
        if (placement) break;
      }
      if (placement) break;
    }

    if (!placement) throw new functions.https.HttpsError('resource-exhausted', 'NO_FREE_SLOTS');

    const clubName = requestedName || `Manager_${Math.floor(1000 + Math.random() * 9000)}`;
    const tableId = getTableId(seasonNum, leagueId, placement.tier, placement.group);
    const tableRef = db.collection('league_tables_v2').doc(tableId);

    // 3. Создание профиля и обновление таблицы
    const finalResult = await db.runTransaction(async (t) => {
      const tSnap = await t.get(tableRef);
      const counterRef = db.collection('system_v1').doc('global_stats');
      const cSnap = await t.get(counterRef);
      
      const nextId = (cSnap.exists ? (cSnap.data().totalPlayers || 1000) : 1000) + 1;
      t.set(counterRef, { totalPlayers: nextId, updatedAt: FieldValue.serverTimestamp() }, { merge: true });

      let stats = {};
      if (tSnap.exists) {
        stats = tSnap.data().stats;
      }

      const botId = Object.keys(stats).find(id => Number(stats[id].rank) === placement.rank && stats[id].isBot);
      const actualBotId = botId || getBotId(leagueId, placement.tier, placement.group, placement.rank);

      const newStats = { ...stats };
      delete newStats[actualBotId];
      newStats[userId] = { id: userId, name: clubName, rank: placement.rank, matchesPlayed: 0, wins: 0, draws: 0, losses: 0, points: 0, diff: 0, isBot: false };

      t.set(tableRef, { stats: newStats, updatedAt: FieldValue.serverTimestamp() }, { merge: true });

      const initialState = {
        id: userId, email, numericId: nextId,
        displayName: clubName, clubName, country: "International",
        selectedLeagueId: leagueId, leagueLevel: placement.tier, groupId: placement.group, rank: placement.rank,
        credits: 1000000, crystals: 50, experiencePoints: 0, managerLevel: 1,
        lastProcessedSeason: seasonNum, lastLoginDate: new Date().toISOString(),
        createdAt: FieldValue.serverTimestamp(), version: 140,
        ownedPlayers: [], lineup: {}, staff: { coach: null }, strategy: "Balanced Play",
        arena: { capacity: 5000 }, hq: {}, bootcamp: {}, academy: {}, medical: {}
      };

      t.set(playerRef, initialState);
      return { ...placement, clubName, numericId: nextId, botId: actualBotId };
    });

    // 4. Обновление матчей
    const matchesSnap = await db.collection('matches_v2')
      .where('season', '==', seasonNum)
      .where('groupId', '==', placement.group)
      .where('level', '==', placement.tier)
      .get();
    
    const batch = db.batch();
    matchesSnap.forEach(d => {
      const m = d.data();
      const up = {};
      if (m.homeId === finalResult.botId) { up.homeId = userId; up.homeName = clubName; }
      if (m.awayId === finalResult.botId) { up.awayId = userId; up.awayName = clubName; }
      if (Object.keys(up).length > 0) batch.update(d.ref, up);
    });
    await batch.commit();

    console.log(`[INIT] Successfully provisioned club for ${userId}`);
    return { success: true, ...finalResult };

  } catch (e) {
    console.error(`[INIT ERROR] ${userId}:`, e.message);
    throw new functions.https.HttpsError('internal', e.message);
  }
});
