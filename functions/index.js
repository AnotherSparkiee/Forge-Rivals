/**
 * @fileOverview Серверные задачи и API ядра (Cloud Functions v2).
 */

const { onSchedule } = require("firebase-functions/v2/scheduler");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { logger } = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();
const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;

// ============ КОНСТАНТЫ ЛИГИ (v140) ============
const MAX_LEVELS = 4;
const TEAMS_PER_GROUP = 8;
const TOTAL_GROUPS = 15; 
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

function generateSeasonCalendar(teams, seasonNumber, leagueId) {
  const n = TEAMS_PER_GROUP; 
  const rounds = n - 1; 
  const matches = [];
  const hh = 18; // 18:00 MSK
  const mm = 0;
  
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
        const startTime = new Date(seasonStartMs + (day - 1) * dayMs + (hh - 3) * 3600000 + mm * 60000);
        const mId = `match_v140_S${seasonNumber}_L${leagueId}_T${tour}_H${h.rank}_A${a.rank}`;
        let seed = 0;
        for (let j = 0; j < mId.length; j++) { seed = ((seed << 5) - seed) + mId.charCodeAt(j); seed |= 0; }
        return {
          day, tour, season: seasonNumber,
          homeId: h.id, homeName: h.name, homeRank: Number(h.rank),
          awayId: a.id, awayName: a.name, awayRank: Number(a.rank),
          startTime: startTime.toISOString(), type: 'league', resultSeed: Math.abs(seed) % 1000, version: 140
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

/**
 * Инициализация клуба (Https Callable).
 */
exports.initializeClub = onCall({ region: "us-central1" }, async (request) => {
  const { userId, email, clubName: requestedName } = request.data;
  
  if (!userId || !email) {
    throw new HttpsError('invalid-argument', 'Missing credentials');
  }

  // Защита: пользователь может создавать только свой профиль
  if (request.auth && request.auth.uid !== userId) {
     throw new HttpsError('permission-denied', 'Unauthorized access');
  }

  const clubName = requestedName || `Manager_${Math.floor(1000 + Math.random() * 9000)}`;
  const clubLogo = "https://iili.io/CYIAgVa.webp";
  const leagueId = "ALPHA";

  try {
    // 1. Находим свободный слот
    const playersSnap = await db.collection('players_v14').where('selectedLeagueId', '==', leagueId).get();
    const occupied = new Set();
    playersSnap.forEach(d => {
      const p = d.data();
      if (p.leagueLevel && p.groupId && p.rank) occupied.add(`${p.leagueLevel}_${p.groupId}_${p.rank}`);
    });

    let placement = { tier: MAX_LEVELS, group: 1, rank: 1 };
    let found = false;
    for (let tier = MAX_LEVELS; tier >= 1; tier--) {
      const groupsInTier = getGroupsCountInLevel(tier);
      for (let group = 1; group <= groupsInTier; group++) {
        for (let r = 1; r <= 8; r++) {
          if (!occupied.has(`${tier}_${group}_${r}`)) {
            placement = { tier, group, rank: r };
            found = true; break;
          }
        }
        if (found) break;
      }
      if (found) break;
    }

    // 2. Текущий сезон
    const configSnap = await db.collection('system_v1').doc('season_config').get();
    const seasonNum = configSnap.exists ? configSnap.data().activeSeasonNumber : 1;

    const playerRef = db.collection('players_v14').doc(userId);
    const tableId = getTableId(seasonNum, leagueId, placement.tier, placement.group);
    const tableRef = db.collection('league_tables_v2').doc(tableId);

    // 3. Атомарная транзакция
    const result = await db.runTransaction(async (t) => {
      const [pSnap, tSnap, cSnap] = await Promise.all([
        t.get(playerRef), t.get(tableRef), t.get(db.collection('system_v1').doc('global_stats'))
      ]);

      if (pSnap.exists) return { success: true, ...pSnap.data() };

      let stats;
      if (!tSnap.exists) {
        // Создаем новую группу (только боты)
        stats = {};
        const teamsForCal = [];
        for (let r = 1; r <= TEAMS_PER_GROUP; r++) {
          const bId = getBotId(leagueId, placement.tier, placement.group, r);
          const bName = getBotName(placement.tier, placement.group, r);
          stats[bId] = { id: bId, name: bName, rank: r, matchesPlayed: 0, wins: 0, draws: 0, losses: 0, points: 0, diff: 0, isBot: true, clubLogo: null };
          teamsForCal.push({ id: bId, name: bName, rank: r });
        }
        t.set(tableRef, { id: tableId, leagueId, level: placement.tier, group: placement.group, season: seasonNum, stats, createdAt: FieldValue.serverTimestamp(), version: 140 });
        
        const cal = generateSeasonCalendar(teamsForCal, seasonNum, leagueId);
        cal.forEach(m => {
          const mId = `match_v140_S${seasonNum}_L${leagueId}_V${placement.tier}_G${placement.group}_T${m.tour}_R${m.homeRank}_vs_R${m.awayRank}`;
          t.set(db.collection('matches_v2').doc(mId), { ...m, id: mId, leagueId, level: placement.tier, groupId: placement.group, season: seasonNum, isFinished: false, isProcessing: false, scoreA: 0, scoreB: 0, version: 140 });
        });
      } else {
        stats = tSnap.data().stats;
      }

      const botToReplaceId = Object.keys(stats).find(id => Number(stats[id].rank) === placement.rank && stats[id].isBot);
      if (!botToReplaceId) throw new Error("SECTOR_UNAVAILABLE");

      const finalStats = { ...stats };
      delete finalStats[botToReplaceId];
      finalStats[userId] = { id: userId, name: clubName, clubLogo, rank: placement.rank, matchesPlayed: 0, wins: 0, draws: 0, losses: 0, points: 0, diff: 0, isBot: false };

      t.update(tableRef, { stats: finalStats, updatedAt: FieldValue.serverTimestamp() });
      
      const totalPlayers = (cSnap.exists ? cSnap.data().totalPlayers : 1000) + 1;
      t.set(db.collection('system_v1').doc('global_stats'), { totalPlayers, updatedAt: FieldValue.serverTimestamp() }, { merge: true });

      const playerData = {
        id: userId, email, numericId: totalPlayers, displayName: clubName, clubName, country: "International",
        selectedLeagueId: leagueId, leagueLevel: placement.tier, groupId: placement.group, rank: placement.rank,
        credits: 1000000, crystals: 50, experiencePoints: 0, managerLevel: 1,
        lastProcessedSeason: seasonNum, lastLoginDate: new Date().toISOString(),
        createdAt: FieldValue.serverTimestamp(), version: 140
      };
      t.set(playerRef, playerData);

      return { success: true, ...playerData, botId: botToReplaceId };
    });

    // 4. Пассивное обновление матчей (вне транзакции для скорости)
    const matchesSnap = await db.collection('matches_v2')
      .where('season', '==', seasonNum)
      .where('groupId', '==', placement.group)
      .where('level', '==', placement.tier)
      .get();
    
    const batch = db.batch();
    matchesSnap.forEach(doc => {
      const m = doc.data();
      const up = {};
      if (m.homeId === result.botId) { up.homeId = userId; up.homeName = clubName; }
      if (m.awayId === result.botId) { up.awayId = userId; up.awayName = clubName; }
      if (Object.keys(up).length > 0) batch.update(doc.ref, up);
    });
    await batch.commit();

    return result;
  } catch (e) {
    logger.error("Initialization Failed", e);
    throw new HttpsError('internal', e.message);
  }
});

/**
 * 1. РАСЧЕТ МАТЧЕЙ (Каждые 5 минут)
 */
exports.resolveMatchesCron = onSchedule("every 5 minutes", async (event) => {
  const APP_URL = process.env.APP_URL || "https://studio-2788872209.web.app"; 
  const CRON_SECRET = process.env.CRON_SECRET;
  try {
    await fetch(`${APP_URL}/api/cron/resolve-matches`, {
      headers: { 'Authorization': `Bearer ${CRON_SECRET}` }
    });
  } catch (error) {
    logger.error("[CRON] Match resolution failed", error);
  }
});
