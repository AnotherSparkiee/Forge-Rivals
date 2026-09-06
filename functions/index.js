const functions = require('firebase-functions');
const admin = require('firebase-admin');

/**
 * @fileOverview Единое серверное ядро v162.
 * Реализует атомарную регистрацию и расширенную диагностику.
 */

admin.initializeApp();
const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;

// ============ РЕГИСТРАЦИЯ (CALLABLE) ============

exports.initializeClub = functions.https.onCall(async (data, context) => {
  console.log('[INIT] Start. Auth UID:', context?.auth?.uid);
  
  // 1. Проверка аутентификации
  if (!context.auth) {
    console.error('[INIT] Unauthenticated request');
    throw new functions.https.HttpsError('unauthenticated', 'AUTHENTICATION_REQUIRED');
  }

  const userId = context.auth.uid;
  const email = context.auth.token.email || `user_${userId}@lote.io`;
  
  // 2. Безопасная валидация имени клуба
  const rawClubName = typeof data?.clubName === 'string' ? data.clubName.trim() : '';
  const clubName = rawClubName.substring(0, 25) || `Commander_${userId.slice(0, 4)}`;
  
  const leagueId = "ALPHA";

  try {
    const playerRef = db.collection('players_v14').doc(userId);
    const configRef = db.collection('system_v1').doc('season_config');
    const statsRef = db.collection('system_v1').doc('global_stats');

    return await db.runTransaction(async (t) => {
      // --- ВСЕ ЧТЕНИЯ (READS) ---
      console.log('[INIT] Transaction: Starting READS');
      
      // Чтение 1: Идемпотентность
      const pSnap = await t.get(playerRef);
      if (pSnap.exists) {
        const d = pSnap.data();
        console.log('[INIT] Player already exists, returning existing data');
        return { 
          success: true, 
          clubName: d.clubName, 
          tier: d.leagueLevel, 
          group: d.groupId, 
          rank: d.rank,
          numericId: d.numericId
        };
      }

      // Чтение 2: Конфигурация сезона
      const configSnap = await t.get(configRef);
      if (!configSnap.exists) {
        console.error('[INIT] season_config missing');
        throw new functions.https.HttpsError('failed-precondition', 'SEASON_CONFIG_MISSING');
      }
      const config = configSnap.data();
      console.log('[INIT] Season Info:', { season: config.activeSeasonNumber, phase: config.phase });

      if (config.phase !== 'REGULAR_SEASON' && config.phase !== 'ACTIVE') {
        console.warn('[INIT] Registration blocked by phase:', config.phase);
        throw new functions.https.HttpsError('failed-precondition', 'SEASON_TRANSITION_IN_PROGRESS');
      }
      const seasonNum = config.activeSeasonNumber || 1;

      // Чтение 3: Глобальная статистика
      const globalStatsSnap = await t.get(statsRef);

      // Чтение 4: Поиск свободного слота
      const slotsQuery = db.collection('league_slots_v1')
        .where('season', '==', seasonNum)
        .where('division', '==', 4)
        .where('status', '==', 'FREE')
        .limit(1);
      
      const slotsSnap = await t.get(slotsQuery);

      if (slotsSnap.empty) {
        console.error('[INIT] No free slots in division 4. Season:', seasonNum);
        throw new functions.https.HttpsError('resource-exhausted', 'NO_FREE_SLOTS_IN_STARTING_DIVISION');
      }

      const slotDoc = slotsSnap.docs[0];
      const slot = slotDoc.data();
      
      // Валидация слота
      if (!slot || slot.status !== 'FREE' || slot.occupantId) {
        console.error('[INIT] Selected slot is invalid:', slotDoc.id, slot);
        throw new functions.https.HttpsError('failed-precondition', 'INVALID_LEAGUE_SLOT');
      }

      // Чтение 5: Турнирная таблица
      const tableId = `table_v140_S${seasonNum}_L${leagueId}_V${slot.division}_G${slot.group}`;
      const tableRef = db.collection('league_tables_v2').doc(tableId);
      const tableSnap = await t.get(tableRef);

      if (!tableSnap.exists) {
        console.error('[INIT] League table missing:', tableId);
        throw new functions.https.HttpsError('failed-precondition', 'LEAGUE_TABLE_MISSING');
      }

      const tableData = tableSnap.data();
      
      // Валидация таблицы
      if (Number(tableData.season) !== Number(seasonNum) || Number(tableData.level) !== Number(slot.division) || Number(tableData.group) !== Number(slot.group)) {
        console.error('[INIT] League table mismatch:', { tableId, tableData, slot });
        throw new functions.https.HttpsError('failed-precondition', 'LEAGUE_TABLE_MISMATCH');
      }

      const stats = tableData.stats || {};
      const botId = Object.keys(stats).find(id => {
        const team = stats[id];
        return Number(team.rank) === Number(slot.rank) && team.isBot === true;
      });

      if (!botId) {
        console.error('[INIT] Bot not found for rank:', slot.rank, 'in table:', tableId);
        throw new functions.https.HttpsError('failed-precondition', 'BOT_NOT_FOUND_IN_SLOT');
      }

      // --- ВСЕ ЗАПИСИ (WRITES) ---
      console.log('[INIT] Transaction: Proceeding to WRITES');

      // 1. Обновляем слот
      t.update(slotDoc.ref, { 
        status: 'OCCUPIED', 
        occupantId: userId, 
        updatedAt: FieldValue.serverTimestamp() 
      });

      // 2. Обновляем таблицу (заменяем бота на человека)
      const newStats = { ...stats };
      delete newStats[botId];
      newStats[userId] = { 
        id: userId, 
        name: clubName, 
        rank: slot.rank, 
        matchesPlayed: 0, wins: 0, draws: 0, losses: 0, points: 0, diff: 0, 
        isBot: false 
      };
      t.update(tableRef, { 
        stats: newStats, 
        updatedAt: FieldValue.serverTimestamp() 
      });

      // 3. Обновляем счетчик игроков
      const totalPlayers = (globalStatsSnap.exists ? (globalStatsSnap.data().totalPlayers || 1000) : 1000) + 1;
      t.set(statsRef, { totalPlayers, updatedAt: FieldValue.serverTimestamp() }, { merge: true });

      // 4. Создаем профиль игрока
      const initialState = {
        id: userId, email, numericId: totalPlayers,
        displayName: clubName, clubName, country: "International",
        selectedLeagueId: leagueId, leagueLevel: slot.division, groupId: slot.group, rank: slot.rank,
        credits: 1000000, crystals: 50, experiencePoints: 0, managerLevel: 1,
        lastProcessedSeason: seasonNum, lastLoginDate: new Date().toISOString(),
        createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
        version: 140, ownedPlayers: [], lineup: {}, staff: { coach: null }, strategy: "Balanced Play",
        arena: { capacity: 5000 }, hq: {}, bootcamp: {}, academy: {}, medical: {}
      };
      t.set(playerRef, initialState);

      console.log('[INIT] Transaction SUCCESS for UID:', userId);

      return { 
        success: true, 
        clubName, 
        tier: slot.division, 
        group: slot.group, 
        rank: slot.rank,
        numericId: totalPlayers
      };
    });

  } catch (e) {
    console.error('[INIT CRITICAL ERROR]:', {
      message: e.message,
      code: e.code,
      stack: e.stack,
      userId
    });

    if (e instanceof functions.https.HttpsError) {
      throw e;
    }

    throw new functions.https.HttpsError('internal', 'CLUB_INITIALIZATION_FAILED');
  }
});