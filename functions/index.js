
const functions = require('firebase-functions');
const admin = require('firebase-admin');

/**
 * @fileOverview Единое ядро облачных функций v150.
 * Обеспечивает атомарную регистрацию и защиту данных.
 */

admin.initializeApp();
const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;

const MAX_LEVELS = 4;
const TEAMS_PER_GROUP = 8;

// ============ ХЕЛПЕРЫ ============

function getGroupsCountInLevel(level) {
  return Math.pow(2, level - 1);
}

function getBotId(leagueId, level, group, rank) {
  return `BOT_${leagueId}_L${level}_G${group}_R${rank}`;
}

function getTableId(season, leagueId, level, group) {
  return `table_v140_S${season}_L${leagueId}_V${level}_G${group}`;
}

// ============ ИНИЦИАЛИЗАЦИЯ КЛУБА (CALLABLE) ============

exports.initializeClub = functions.https.onCall(async (data, context) => {
  console.log('[INIT] Request received');
  
  if (!context.auth) {
    console.error('[INIT] No Auth Context');
    throw new functions.https.HttpsError('unauthenticated', 'AUTHENTICATION_REQUIRED');
  }

  const userId = context.auth.uid;
  const email = context.auth.token.email || `user_${userId}@lote.io`;
  const requestedName = data.clubName;
  const leagueId = "ALPHA";

  try {
    const playerRef = db.collection('players_v14').doc(userId);
    const existingSnap = await playerRef.get();
    
    // Идемпотентность: если профиль уже есть, просто возвращаем его
    if (existingSnap.exists) {
      console.log(`[INIT] Player ${userId} already exists.`);
      const d = existingSnap.data();
      return { 
        success: true, 
        clubName: d.clubName, 
        tier: d.leagueLevel, 
        group: d.groupId, 
        rank: d.rank 
      };
    }

    // 1. Получаем текущий сезон
    const configSnap = await db.collection('system_v1').doc('season_config').get();
    if (!configSnap.exists) throw new Error("SEASON_CONFIG_MISSING");
    const config = configSnap.data();
    
    if (config.phase === 'ACTIVATING' || config.phase === 'GENERATING_NEXT') {
       throw new functions.https.HttpsError('unavailable', 'SEASON_TRANSITION_IN_PROGRESS');
    }

    const seasonNum = config.activeSeasonNumber || 1;

    // 2. Атомарный поиск и захват слота
    let placement = null;
    console.log('[INIT] Searching for free slot...');

    // Ищем в Дивизионе 4 (стартовый для новичков)
    const slotsQuery = db.collection('league_slots_v1')
      .where('season', '==', seasonNum)
      .where('division', '==', 4)
      .where('status', '==', 'FREE')
      .limit(1);

    const slotTransaction = await db.runTransaction(async (t) => {
      const snap = await t.get(slotsQuery);
      if (snap.empty) return null;

      const slotDoc = snap.docs[0];
      const slotData = slotDoc.data();
      
      t.update(slotDoc.ref, { 
        status: 'OCCUPIED', 
        occupantId: userId, 
        updatedAt: FieldValue.serverTimestamp() 
      });

      return { 
        tier: slotData.division, 
        group: slotData.group, 
        rank: slotData.rank,
        slotId: slotDoc.id
      };
    });

    if (!slotTransaction) {
      console.warn('[INIT] Division 4 is full.');
      throw new functions.https.HttpsError('resource-exhausted', 'NO_FREE_SLOTS_IN_STARTING_DIVISION');
    }

    placement = slotTransaction;
    const clubName = requestedName ? requestedName.trim().substring(0, 25) : `Commander_${userId.slice(0,4)}`;

    // 3. Создание профиля и обновление таблицы
    console.log('[INIT] Finalizing club data...');
    const tableId = getTableId(seasonNum, leagueId, placement.tier, placement.group);
    const tableRef = db.collection('league_tables_v2').doc(tableId);

    const finalResult = await db.runTransaction(async (t) => {
      const tSnap = await t.get(tableRef);
      if (!tSnap.exists) throw new Error("LEAGUE_TABLE_MISSING");

      const stats = tSnap.data().stats;
      const botId = Object.keys(stats).find(id => Number(stats[id].rank) === placement.rank && stats[id].isBot);
      
      if (!botId) throw new Error("BOT_NOT_FOUND_IN_SLOT");

      const newStats = { ...stats };
      delete newStats[botId];
      newStats[userId] = { 
        id: userId, 
        name: clubName, 
        rank: placement.rank, 
        matchesPlayed: 0, wins: 0, draws: 0, losses: 0, points: 0, diff: 0, 
        isBot: false 
      };

      t.update(tableRef, { stats: newStats, updatedAt: FieldValue.serverTimestamp() });

      const initialState = {
        id: userId, email, numericId: Date.now() % 1000000,
        displayName: clubName, clubName, country: "International",
        selectedLeagueId: leagueId, leagueLevel: placement.tier, groupId: placement.group, rank: placement.rank,
        credits: 1000000, crystals: 50, experiencePoints: 0, managerLevel: 1,
        lastProcessedSeason: seasonNum, lastLoginDate: new Date().toISOString(),
        createdAt: FieldValue.serverTimestamp(), version: 140,
        ownedPlayers: [], lineup: {}, staff: { coach: null }, strategy: "Balanced Play",
        arena: { capacity: 5000 }, hq: {}, bootcamp: {}, academy: {}, medical: {}
      };

      t.set(playerRef, initialState);
      return { botId };
    });

    // 4. Обновляем матчи в фоне
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

    console.log('[INIT] Success');
    return { success: true, ...placement, clubName };

  } catch (e) {
    console.error('[INIT ERROR]:', e.message);
    throw new functions.https.HttpsError('internal', e.message);
  }
});
