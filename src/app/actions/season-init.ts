'use server';

/**
 * @fileOverview Атомарный инициализатор игрового мира v8.0.
 * Гарантирует создание таблиц, календаря и Кубка Пирамиды.
 */

import { 
  collection, doc, getDocs, writeBatch, query, where, 
  getDoc, serverTimestamp, setDoc, Timestamp
} from 'firebase/firestore';
import { initializeFirebase } from '@/firebase';
import { LEAGUES } from '@/app/lib/leagues-data';

/**
 * Находит оптимальное место в иерархии лиги.
 */
export async function findStrategicPlacement(leagueId: string) {
  const { firestore: db } = initializeFirebase();
  
  for (let tier = 1; tier <= 9; tier++) {
    const groupsInTier = Math.pow(2, tier - 1);
    const playersSnap = await getDocs(query(
      collection(db, 'players_v10'),
      where('selectedLeagueId', '==', leagueId),
      where('leagueLevel', '==', tier)
    ));

    const groupCounts: Record<number, number> = {};
    playersSnap.docs.forEach(d => {
      const g = Number(d.data().groupId || 1);
      groupCounts[g] = (groupCounts[g] || 0) + 1;
    });

    for (let g = 1; g <= groupsInTier; g++) {
      if ((groupCounts[g] || 0) < 8) {
        return { tier, group: g };
      }
    }
  }
  return { tier: 9, group: 1 };
}

/**
 * ГЛАВНЫЙ ВХОД: Инициализирует или обновляет группу и Кубок.
 */
export async function ensureWorldInitialized(
  season: number, 
  leagueId: string, 
  tier: number, 
  group: number,
  userId: string
) {
  const { firestore: db } = initializeFirebase();
  const batch = writeBatch(db);
  
  const tableId = `season_${season}_tier_${tier}_group_${group}_league_${leagueId}`;
  const tableRef = doc(db, 'league_tables_v1', tableId);
  const cupDocId = `season_${season}_league_${leagueId}`;
  const cupRef = doc(db, 'cup_pyramid_v1', cupDocId);
  
  const [tableSnap, meSnap, cupSnap] = await Promise.all([
    getDoc(tableRef),
    getDoc(doc(db, 'players_v10', userId)),
    getDoc(cupRef)
  ]);

  const myName = meSnap.exists() ? (meSnap.data().displayName || `Manager_${userId.slice(0, 4)}`) : `Manager_${userId.slice(0, 4)}`;

  // 1. Инициализация Кубка (если еще не создан для этой лиги/сезона)
  if (!cupSnap.exists()) {
    const leaguePlayersSnap = await getDocs(query(collection(db, 'players_v10'), where('selectedLeagueId', '==', leagueId)));
    const players = leaguePlayersSnap.docs.map(d => ({ id: d.id, name: d.data().displayName || `Manager_${d.id.slice(0,4)}` }));
    
    // Дополняем ботами до 32 участников для 1/16 финала
    const totalSlots = 32;
    const participants = [...players];
    while (participants.length < totalSlots) {
      const botId = `bot_cup_${leagueId}_${participants.length + 1}`;
      participants.push({ id: botId, name: botId });
    }

    // Формируем 1-й раунд
    const r1 = [];
    for (let i = 0; i < participants.length; i += 2) {
      r1.push({
        home: participants[i],
        away: participants[i+1],
        scoreA: null,
        scoreB: null,
        winnerId: null
      });
    }

    batch.set(cupRef, {
      season, leagueId,
      rounds: { r1, r2: [], r3: [], r4: [], r5: [] },
      updatedAt: serverTimestamp(),
      version: 35
    });
  }

  // 2. Инициализация или обновление Лиги
  if (tableSnap.exists() && tableSnap.data().version === 35) {
    const data = tableSnap.data();
    if (!data.teams.includes(userId)) {
      const botIdx = data.teamData.findIndex((t: any) => t.isBot === true);
      if (botIdx !== -1) {
        const oldBotId = data.teamData[botIdx].id;
        const newTeams = [...data.teams];
        newTeams[newTeams.indexOf(oldBotId)] = userId;
        const newTeamData = [...data.teamData];
        newTeamData[botIdx] = { id: userId, name: myName, isBot: false };
        const newStats = { ...data.stats };
        newStats[userId] = { points: 0, matchesPlayed: 0, wins: 0, draws: 0, losses: 0, diff: 0, goalsScored: 0, goalsConceded: 0 };
        delete newStats[oldBotId];

        batch.update(tableRef, {
          teams: newTeams,
          teamData: newTeamData,
          stats: newStats,
          updatedAt: serverTimestamp()
        });

        const matchesSnap = await getDocs(query(collection(db, 'matches_v1'), where('tableId', '==', tableId)));
        matchesSnap.docs.forEach(mDoc => {
          const mData = mDoc.data();
          const update: any = {};
          if (mData.homeId === oldBotId) { update.homeId = userId; update.homeName = myName; }
          if (mData.awayId === oldBotId) { update.awayId = userId; update.awayName = myName; }
          if (Object.keys(update).length > 0) batch.update(mDoc.ref, update);
        });
      }
    }
  } else {
    // Создаем группу с нуля
    const teams = [{ id: userId, name: myName, isBot: false }];
    const leagueIdx = LEAGUES.findIndex(l => l.id === leagueId);
    const lPref = (leagueIdx + 1).toString().padStart(2, '0');
    const gPref = group.toString().padStart(3, '0');

    for (let i = 0; i < 7; i++) {
      const botId = `bot${lPref}${tier}${gPref}${i + 1}`;
      teams.push({ id: botId, name: botId, isBot: true });
    }

    teams.sort((a, b) => a.id.localeCompare(b.id));
    const teamIds = teams.map(t => t.id);
    const stats: any = {};
    teams.forEach(t => {
      stats[t.id] = { points: 0, matchesPlayed: 0, wins: 0, draws: 0, losses: 0, diff: 0, goalsScored: 0, goalsConceded: 0 };
    });

    batch.set(tableRef, {
      id: tableId, season, tier, group, leagueId, teams: teamIds,
      teamData: teams, stats, updatedAt: serverTimestamp(), version: 35
    });

    const schedule = generateFullSchedule(teamIds);
    const leagueInfo = LEAGUES.find(l => l.id === leagueId) || LEAGUES[0];
    const [hh, mm] = leagueInfo.startTime.split(':').map(Number);
    const seasonStart = new Date('2026-06-22T00:00:00+03:00');
    const startMs = seasonStart.getTime() + (season - 1) * 15 * 24 * 60 * 60 * 1000;

    schedule.forEach((m: any) => {
      const matchTime = new Date(startMs + (m.day - 1) * 24 * 60 * 60 * 1000 + hh * 3600000 + mm * 60000);
      const matchId = `m_${tableId}_d${m.day}_h${m.homeId}`;
      const hTeam = teams.find(t => t.id === m.homeId);
      const aTeam = teams.find(t => t.id === m.awayId);

      batch.set(doc(db, 'matches_v1', matchId), {
        id: matchId, tableId, season, tour: m.day, day: m.day, leagueId, tier, groupId: String(group),
        homeId: m.homeId, homeName: hTeam?.name || m.homeId,
        awayId: m.awayId, awayName: aTeam?.name || m.awayId,
        startTime: matchTime.toISOString(), status: "scheduled", isFinished: false,
        createdAt: serverTimestamp(), version: 35
      });
    });
  }

  await batch.commit();
  return { success: true };
}

function generateFullSchedule(teams: string[]) {
  const n = teams.length;
  const rounds = n - 1;
  const matches = [];
  const players = [...teams];

  for (let r = 0; r < rounds; r++) {
    for (let i = 0; i < n / 2; i++) {
      const home = players[i];
      const away = players[n - 1 - i];
      matches.push({ day: r + 1, homeId: home, awayId: away });
      matches.push({ day: r + 1 + rounds, homeId: away, awayId: home });
    }
    players.splice(1, 0, players.pop()!);
  }
  return matches;
}

