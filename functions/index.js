const functions = require('firebase-functions');
const admin = require('firebase-admin');

/**
 * @fileOverview Единое серверное ядро регистрации v164.
 * Реализует атомарную регистрацию, серверную генерацию состава и диагностику.
 */

admin.initializeApp();
const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;

const REGISTRATION_VERSION = 'v164';

// ============ ГЕНЕРАЦИЯ СОСТАВА (SERVER-SIDE) ============

function generateStartingSquad() {
  const roles = ['Carry', 'Midlaner', 'Tank', 'Jungler', 'Support', 'Carry', 'Midlaner', 'Tank', 'Jungler', 'Support'];
  const countries = [
    { code: 'RU', name: 'Россия', flag: '🇷🇺', url: 'https://i.postimg.cc/mg3yfqj5/rus-2.jpg' },
    { code: 'CN', name: 'Китай', flag: '🇨🇳', url: 'https://i.postimg.cc/wvzKxSYS/1755011442109.jpg' },
    { code: 'KR', name: 'Южная Корея', flag: '🇰🇷', url: 'https://i.postimg.cc/43mv7dsH/kr-1.jpg' },
    { code: 'UA', name: 'Украина', flag: '🇺🇦', url: 'https://i.postimg.cc/X7fs4pYn/ua-1.jpg' },
    { code: 'BR', name: 'Бразилия', flag: '🇧🇷', url: 'https://i.postimg.cc/Z5906yvS/br-1.jpg' }
  ];

  return roles.map((role, i) => {
    const country = countries[i % countries.length];
    const ovr = 28 + Math.floor(Math.random() * 10);
    const skillBase = Math.floor(ovr * 0.25);
    
    return {
      id: `p_init_${Date.now()}_${i}_${Math.random().toString(36).substr(2, 5)}`,
      name: `Cadet_${Math.random().toString(36).substr(2, 4).toUpperCase()}`,
      role: role,
      overallRating: ovr,
      image: country.url,
      country: { code: country.code, name: country.name, flag: country.flag },
      age: 18 + Math.floor(Math.random() * 10),
      hiredAt: new Date().toISOString(),
      salary: 2500,
      form: 80,
      fatigue: 0,
      isInjured: false,
      isPro: false,
      isYouth: false,
      proStats: {
        lastHitting: skillBase, mapAwareness: skillBase, positioning: skillBase,
        reflexes: skillBase, manaManagement: skillBase, objectiveControl: skillBase,
        communication: skillBase, tiltResistance: skillBase, versatility: skillBase, ganking: skillBase
      },
      proTalents: {
        lastHitting: 40, mapAwareness: 40, positioning: 40, reflexes: 40,
        manaManagement: 40, objectiveControl: 40, communication: 40,
        tiltResistance: 40, versatility: 40, ganking: 40
      }
    };
  });
}

// ============ РЕГИСТРАЦИЯ (CALLABLE v164) ============

exports.initializeClub = functions.region('us-central1').https.onCall(async (data, context) => {
  console.log(`[INIT] Start v${REGISTRATION_VERSION}. Auth UID:`, context?.auth?.uid);
  
  if (!context.auth) {
    console.error('[INIT] Unauthenticated request');
    throw new functions.https.HttpsError('unauthenticated', 'AUTHENTICATION_REQUIRED');
  }

  const userId = context.auth.uid;
  const email = context.auth.token.email;
  
  if (!email) {
    console.error('[INIT] Email missing in token');
    throw new functions.https.HttpsError('failed-precondition', 'EMAIL_REQUIRED');
  }

  const rawClubName = typeof data?.clubName === 'string' ? data.clubName.trim() : '';
  const clubName = rawClubName.substring(0, 25) || `Commander_${userId.slice(0, 4)}`;
  
  const leagueId = "ALPHA";

  try {
    const playerRef = db.collection('players_v14').doc(userId);
    const configRef = db.collection('system_v1').doc('season_config');
    const statsRef = db.collection('system_v1').doc('global_stats');

    return await db.runTransaction(async (t) => {
      // --- 1. ВСЕ ЧТЕНИЯ (READS) ---
      console.log('[INIT] Transaction: Starting READS');
      
      const pSnap = await t.get(playerRef);
      if (pSnap.exists) {
        const d = pSnap.data();
        console.log('[INIT] Player already exists, returning existing data');
        return { 
          success: true, 
          version: REGISTRATION_VERSION,
          clubName: d.clubName, 
          tier: d.leagueLevel, 
          group: d.groupId, 
          rank: d.rank,
          numericId: d.numericId
        };
      }

      const configSnap = await t.get(configRef);
      if (!configSnap.exists) {
        console.error('[INIT] season_config missing');
        throw new functions.https.HttpsError('failed-precondition', 'SEASON_CONFIG_MISSING');
      }
      const config = configSnap.data();

      if (config.phase !== 'REGULAR_SEASON' && config.phase !== 'ACTIVE') {
        console.warn('[INIT] Season phase restricted:', config.phase);
        throw new functions.https.HttpsError('failed-precondition', 'SEASON_TRANSITION_IN_PROGRESS');
      }
      const seasonNum = config.activeSeasonNumber || 1;

      const globalStatsSnap = await t.get(statsRef);

      const slotsQuery = db.collection('league_slots_v1')
        .where('season', '==', seasonNum)
        .where('division', '==', 4)
        .where('status', '==', 'FREE')
        .limit(1);
      
      const slotsSnap = await t.get(slotsQuery);
      if (slotsSnap.empty) {
        console.error('[INIT] No free slots in division 4');
        throw new functions.https.HttpsError('resource-exhausted', 'NO_FREE_SLOTS_IN_STARTING_DIVISION');
      }

      const slotDoc = slotsSnap.docs[0];
      const slot = slotDoc.data();
      console.log('[INIT] Found slot:', slotDoc.id, 'Group:', slot.group, 'Rank:', slot.rank);

      const tableId = `table_v140_S${seasonNum}_L${leagueId}_V${slot.division}_G${slot.group}`;
      const tableRef = db.collection('league_tables_v2').doc(tableId);
      const tableSnap = await t.get(tableRef);

      if (!tableSnap.exists) {
        console.error('[INIT] League table missing:', tableId);
        throw new functions.https.HttpsError('failed-precondition', 'LEAGUE_TABLE_MISSING');
      }

      const tableData = tableSnap.data();
      
      // Проверка консистентности таблицы
      if (tableData.level !== slot.division || tableData.group !== slot.group || tableData.season !== seasonNum) {
        console.error('[INIT] Table metadata mismatch');
        throw new functions.https.HttpsError('failed-precondition', 'LEAGUE_TABLE_MISMATCH');
      }

      const stats = tableData.stats || {};
      const botId = Object.keys(stats).find(id => {
        const team = stats[id];
        return Number(team.rank) === Number(slot.rank) && team.isBot === true;
      });

      if (!botId) {
        console.error('[INIT] Bot not found at rank:', slot.rank);
        throw new functions.https.HttpsError('failed-precondition', 'BOT_NOT_FOUND_IN_SLOT');
      }

      // --- 2. ВСЕ ЗАПИСИ (WRITES) ---
      console.log('[INIT] Transaction: Proceeding to WRITES');

      t.update(slotDoc.ref, { 
        status: 'OCCUPIED', 
        occupantId: userId, 
        updatedAt: FieldValue.serverTimestamp() 
      });

      const newStats = { ...stats };
      delete newStats[botId];
      newStats[userId] = { 
        id: userId, name: clubName, rank: slot.rank, 
        matchesPlayed: 0, wins: 0, draws: 0, losses: 0, points: 0, diff: 0, 
        isBot: false 
      };
      t.update(tableRef, { 
        stats: newStats, 
        updatedAt: FieldValue.serverTimestamp() 
      });

      const totalPlayers = (globalStatsSnap.exists ? (globalStatsSnap.data().totalPlayers || 1000) : 1000) + 1;
      t.set(statsRef, { totalPlayers, updatedAt: FieldValue.serverTimestamp() }, { merge: true });

      const startingSquad = generateStartingSquad();
      const initialState = {
        id: userId, email, numericId: totalPlayers,
        displayName: clubName, clubName, country: "International",
        selectedLeagueId: leagueId, leagueLevel: slot.division, groupId: slot.group, rank: slot.rank,
        credits: 1000000, crystals: 50, experiencePoints: 0, managerLevel: 1,
        lastProcessedSeason: seasonNum, lastLoginDate: new Date().toISOString(),
        createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
        version: 140, ownedPlayers: startingSquad,
        lineup: {
          carry: startingSquad[0].id, mid: startingSquad[1].id, offlane: startingSquad[2].id,
          support: startingSquad[3].id, full_support: startingSquad[4].id,
          sub_carry: startingSquad[5].id, sub_mid: startingSquad[6].id,
          sub_offlane: startingSquad[7].id, sub_support: startingSquad[8].id,
          sub_full_support: startingSquad[9].id
        },
        staff: { coach: null }, strategy: "Balanced Play",
        arena: { capacity: 5000 }, hq: {}, bootcamp: {}, academy: {}, medical: {}
      };
      
      t.set(playerRef, initialState);

      console.log('[INIT] Transaction SUCCESS for UID:', userId);

      return { 
        success: true, 
        version: REGISTRATION_VERSION,
        clubName, 
        tier: slot.division, 
        group: slot.group, 
        rank: slot.rank,
        numericId: totalPlayers
      };
    });

  } catch (e) {
    console.error('[INIT CRITICAL ERROR]:', {
      name: e.name,
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
