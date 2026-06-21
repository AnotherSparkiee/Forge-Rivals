'use server';

/**
 * @fileOverview Атомарный инициализатор сезона v4.0.
 * Создает таблицы (8 команд), 14 туров матчей и кубок в одной транзакции.
 */

import { 
  collection, doc, getDocs, writeBatch, query, where, 
  getDoc, serverTimestamp, setDoc
} from 'firebase/firestore';
import { initializeFirebase } from '@/firebase';
import { LEAGUES } from '@/app/lib/leagues-data';

interface TeamStats {
  points: number;
  matchesPlayed: number;
  wins: number;
  draws: number;
  losses: number;
  diff: number;
  goalsScored: number;
  goalsConceded: number;
}

/**
 * Инициализирует группу в лиге: Таблица + 14 туров матчей.
 */
export async function initializeSeasonGroup(
  season: number, 
  tier: number, 
  group: number, 
  leagueId: string,
  realPlayers: any[]
) {
  const { firestore: db } = initializeFirebase();
  const batch = writeBatch(db);
  
  const tableId = `season_${season}_tier_${tier}_group_${group}_league_${leagueId}`;
  const tableRef = doc(db, 'league_tables_v1', tableId);
  
  // 1. Подготовка 8 команд (игроки + боты)
  const teams = [...realPlayers];
  const botsNeeded = Math.max(0, 8 - teams.length);
  const leagueIdx = LEAGUES.findIndex(l => l.id === leagueId);
  const leaguePrefix = (leagueIdx + 1).toString().padStart(2, '0');
  const groupPrefix = group.toString().padStart(3, '0');
  
  for (let i = 0; i < botsNeeded; i++) {
    const botId = `bot${leaguePrefix}${tier}${groupPrefix}${i + 1}`;
    teams.push({ id: botId, name: botId, isBot: true });
  }
  
  // Сортируем для детерминированности
  teams.sort((a, b) => a.id.localeCompare(b.id));
  const teamIds = teams.map(t => t.id);
  
  const stats: Record<string, TeamStats> = {};
  teams.forEach(t => {
    stats[t.id] = { 
      points: 0, matchesPlayed: 0, wins: 0, draws: 0, losses: 0, 
      diff: 0, goalsScored: 0, goalsConceded: 0 
    };
  });

  // 2. Создание документа таблицы
  batch.set(tableRef, {
    id: tableId,
    season,
    tier,
    group,
    leagueId,
    teams: teamIds,
    teamData: teams.map(t => ({ id: t.id, name: t.name, isBot: !!t.isBot })),
    stats,
    updatedAt: serverTimestamp(),
    version: 35
  });

  // 3. Генерация 14 туров (Round-robin 2 круга)
  const schedule = generateRoundRobin(teamIds);
  const leagueInfo = LEAGUES.find(l => l.id === leagueId) || LEAGUES[0];
  const [hh, mm] = leagueInfo.startTime.split(':').map(Number);
  
  // Эпоха сезона (согласно time-utils v90)
  const seasonStart = new Date('2026-06-22T00:00:00+03:00');
  const startMs = seasonStart.getTime() + (season - 1) * 15 * 24 * 60 * 60 * 1000;

  schedule.forEach((roundMatches, roundIdx) => {
    const tour = roundIdx + 1;
    roundMatches.forEach((m, mIdx) => {
      const matchTime = new Date(startMs + (tour - 1) * 24 * 60 * 60 * 1000 + hh * 3600000 + mm * 60000);
      const matchId = `m_${tableId}_t${tour}_idx${mIdx}`;
      const matchRef = doc(db, 'matches_v1', matchId);
      
      const homeTeam = teams.find(t => t.id === m.home);
      const awayTeam = teams.find(t => t.id === m.away);

      batch.set(matchRef, {
        id: matchId,
        tableId,
        season,
        tour,
        day: tour,
        leagueId,
        tier,
        groupId: String(group),
        homeId: m.home,
        homeName: homeTeam?.name || m.home,
        awayId: m.away,
        awayName: awayTeam?.name || m.away,
        startTime: matchTime.toISOString(),
        status: "scheduled",
        isFinished: false,
        createdAt: serverTimestamp(),
        version: 35
      });
    });
  });

  await batch.commit();
  return { success: true, tableId };
}

/**
 * Инициализирует сетку кубка для лиги в одном документе.
 */
export async function initializePyramidCup(season: number, leagueId: string) {
  const { firestore: db } = initializeFirebase();
  const cupDocId = `season_${season}_league_${leagueId}`;
  const cupRef = doc(db, 'cup_pyramid_v1', cupDocId);
  
  // Проверяем существование
  const cupSnap = await getDoc(cupRef);
  if (cupSnap.exists() && cupSnap.data().version === 35) return { success: true, alreadyExists: true };

  // Собираем всех реальных игроков лиги (макс 32 для сетки)
  const playersSnap = await getDocs(query(collection(db, 'players_v10'), where('selectedLeagueId', '==', leagueId)));
  const participants = playersSnap.docs.map(d => ({ 
    id: d.id, 
    name: d.data().displayName || `Manager_${d.id.slice(0,4)}`,
    isPlayer: true,
    level: d.data().leagueLevel || 9
  }));
  
  // Дополняем до 32 команд ботами
  const totalSlots = 32;
  const leagueIdx = LEAGUES.findIndex(l => l.id === leagueId);
  const leaguePrefix = (leagueIdx + 1).toString().padStart(2, '0');

  while (participants.length < totalSlots) {
    const botId = `bot${leaguePrefix}cup${participants.length + 1}`;
    participants.push({ id: botId, name: botId, isPlayer: false, level: 9 });
  }

  // Перемешиваем детерминировано на основе сезона
  const seed = season;
  const shuffledParticipants = [...participants].sort((a, b) => a.id.localeCompare(b.id));
  for (let i = shuffledParticipants.length - 1; i > 0; i--) {
    const j = (seed + i) % (i + 1);
    [shuffledParticipants[i], shuffledParticipants[j]] = [shuffledParticipants[j], shuffledParticipants[i]];
  }

  // Формируем Раунд 1 (1/16)
  const round1 = [];
  for (let i = 0; i < shuffledParticipants.length; i += 2) {
    round1.push({
      matchId: `cup_s${season}_l${leagueId}_r1_m${(i/2)+1}`,
      home: shuffledParticipants[i],
      away: shuffledParticipants[i+1],
      scoreA: null,
      scoreB: null,
      winnerId: null,
      status: 'scheduled'
    });
  }

  await setDoc(cupRef, {
    season,
    leagueId,
    rounds: {
      r1: round1,
      r2: Array(8).fill(null),
      r3: Array(4).fill(null),
      r4: Array(2).fill(null),
      r5: [null] // Final
    },
    status: 'active',
    createdAt: serverTimestamp(),
    version: 35
  });

  return { success: true };
}

/**
 * Алгоритм круговой системы (Round-robin) для 8 команд.
 */
function generateRoundRobin(teams: string[]) {
  const n = teams.length;
  const rounds = [];
  const players = [...teams];
  
  // Первый круг (7 туров)
  for (let r = 0; r < n - 1; r++) {
    const roundMatches = [];
    for (let i = 0; i < n / 2; i++) {
      roundMatches.push({ home: players[i], away: players[n - 1 - i] });
    }
    rounds.push(roundMatches);
    players.splice(1, 0, players.pop()!);
  }
  
  // Второй круг (смена сторон)
  const secondCircle = rounds.map(r => r.map(m => ({ home: m.away, away: m.home })));
  return [...rounds, ...secondCircle];
}
