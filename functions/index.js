const functions = require('firebase-functions');
const admin = require('firebase-admin');

/**
 * @fileOverview Единое серверное ядро v160.
 * Реализует атомарную регистрацию и защиту данных через Admin SDK.
 */

admin.initializeApp();
const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;

const MAX_LEVELS = 4;
const TEAMS_PER_GROUP = 8;

// ============ РЕГИСТРАЦИЯ (CALLABLE) ============

exports.initializeClub = functions.https.onCall(async (data, context) => {
  console.log('[INIT] Start');
  
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'AUTHENTICATION_REQUIRED');
  }

  const userId = context.auth.uid;
  const email = context.auth.token.email || `user_${userId}@lote.io`;
  const clubName = (data.clubName || `Commander_${userId.slice(0, 4)}`).trim().substring(0, 25);
  const leagueId = "ALPHA";

  try {
    const playerRef = db.collection('players_v14').doc(userId);
    
    return await db.runTransaction(async (t) => {
      const pSnap = await t.get(playerRef);
      
      // Идемпотентность: если профиль уже есть, просто возвращаем его
      if (pSnap.exists) {
        const d = pSnap.data();
        return { 
          success: true, 
          clubName: d.clubName, 
          tier: d.leagueLevel, 
          group: d.groupId, 
          rank: d.rank,
          numericId: d.numericId
        };
      }

      // 1. Получаем текущий сезон
      const configSnap = await t.get(db.collection('system_v1').doc('season_config'));
      if (!configSnap.exists) throw new Error("SEASON_CONFIG_MISSING");
      const config = configSnap.data();
      
      if (config.phase !== 'REGULAR_SEASON' && config.phase !== 'ACTIVE') {
        throw new functions.https.HttpsError('failed-precondition', 'SEASON_TRANSITION_IN_PROGRESS');
      }

      const seasonNum = config.activeSeasonNumber || 1;

      // 2. Атомарный поиск и захват слота в Division 4
      const slotsQuery = db.collection('league_slots_v1')
        .where('season', '==', seasonNum)
        .where('division', '==', 4)
        .where('status', '==', 'FREE')
        .limit(1);

      const slotsSnap = await t.get(slotsQuery);
      if (slotsSnap.empty) {
        throw new functions.https.HttpsError('resource-exhausted', 'NO_FREE_SLOTS_IN_STARTING_DIVISION');
      }

      const slotDoc = slotsSnap.docs[0];
      const slot = slotDoc.data();

      // 3. Создание профиля
      const statsSnap = await t.get(db.collection('system_v1').doc('global_stats'));
      const numericId = (statsSnap.exists ? (statsSnap.data().totalPlayers || 1000) : 1000) + 1;

      const initialState = {
        id: userId, email, numericId,
        displayName: clubName, clubName, country: "International",
        selectedLeagueId: leagueId, leagueLevel: slot.division, groupId: slot.group, rank: slot.rank,
        credits: 1000000, crystals: 50, experiencePoints: 0, managerLevel: 1,
        lastProcessedSeason: seasonNum, lastLoginDate: new Date().toISOString(),
        createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
        version: 140, ownedPlayers: [], lineup: {}, staff: { coach: null }, strategy: "Balanced Play",
        arena: { capacity: 5000 }, hq: {}, bootcamp: {}, academy: {}, medical: {}
      };

      // 4. Обновление связанных документов
      t.update(slotDoc.ref, { 
        status: 'OCCUPIED', 
        occupantId: userId, 
        updatedAt: FieldValue.serverTimestamp() 
      });

      const tableId = `table_v140_S${seasonNum}_L${leagueId}_V${slot.division}_G${slot.group}`;
      const tableRef = db.collection('league_tables_v2').doc(tableId);
      const tableSnap = await t.get(tableRef);
      
      if (tableSnap.exists) {
        const stats = tableSnap.data().stats;
        const botId = Object.keys(stats).find(id => Number(stats[id].rank) === slot.rank && stats[id].isBot);
        if (botId) {
          const newStats = { ...stats };
          delete newStats[botId];
          newStats[userId] = { id: userId, name: clubName, rank: slot.rank, matchesPlayed: 0, wins: 0, draws: 0, losses: 0, points: 0, diff: 0, isBot: false };
          t.update(tableRef, { stats: newStats, updatedAt: FieldValue.serverTimestamp() });
        }
      }

      t.set(db.collection('system_v1').doc('global_stats'), { totalPlayers: numericId }, { merge: true });
      t.set(playerRef, initialState);

      return { 
        success: true, 
        clubName, 
        tier: slot.division, 
        group: slot.group, 
        rank: slot.rank,
        numericId
      };
    });

  } catch (e) {
    console.error('[INIT ERROR]:', e);
    throw new functions.https.HttpsError('internal', e.message);
  }
});
