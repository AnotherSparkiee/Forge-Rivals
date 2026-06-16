'use server';

/**
 * @fileOverview Глобальный движок Кубка Пирамиды (Pyramid Cup Engine).
 * 
 * Логика генерации сетки:
 * - 16 независимых лиг.
 * - Посев "От края до края" (Edge-to-Edge) для Див 2-9.
 * - Див 1 пропускает Раунд 1 (Byes) и попадает в Раунд 2 как Гости.
 * - Время: Старт лиги + 12 часов UTC.
 */

import { 
  collection, doc, getDocs, writeBatch, query, where, 
  orderBy, serverTimestamp, updateDoc, getDoc 
} from 'firebase/firestore';
import { initializeFirebase } from '@/firebase';
import { LEAGUES } from '@/app/lib/leagues-data';
import { getGlobalSeasonInfo } from '@/app/lib/time-utils';

interface CupMatch {
  cupMatchId: string;
  seasonId: string;
  seasonNumber: number;
  leagueId: string;
  round: number;
  startTime: string; // ISO UTC
  homeTeamId: string | null;
  awayTeamId: string | null;
  status: 'scheduled' | 'finished';
  winnerId: string | null;
  nextCupMatchId: string | null;
}

/**
 * Пакетный обработчик для обхода лимита Firestore (500 операций).
 */
class FirestoreBatcher {
  private count = 0;
  private batch;
  constructor(private db: any) {
    this.batch = writeBatch(db);
  }

  async set(ref: any, data: any) {
    this.batch.set(ref, data);
    this.count++;
    if (this.count >= 480) {
      await this.commit();
      this.batch = writeBatch(this.db);
      this.count = 0;
    }
  }

  async commit() {
    if (this.count > 0) {
      await this.batch.commit();
      this.count = 0;
    }
  }
}

/**
 * Рассчитывает время начала матча кубка (+12 часов от старта лиги).
 */
function calculateCupTime(leagueStartTime: string, round: number, seasonNumber: number): string {
  const [hh, mm] = leagueStartTime.split(':').map(Number);
  const epochDate = new Date('2026-06-17T00:00:00Z'); // Начало проекта
  
  const targetDate = new Date(epochDate);
  // Сдвиг на сезон + раунд + 12 часов
  const daysOffset = (seasonNumber - 1) * 16 + (round - 1);
  targetDate.setUTCDate(epochDate.getUTCDate() + daysOffset);
  targetDate.setUTCHours(hh + 12, mm, 0, 0);
  
  return targetDate.toISOString();
}

/**
 * Основная функция генерации Кубка Пирамиды.
 * Запускается в Межсезонье (15-й день).
 */
export async function generatePyramidCup() {
  const { firestore: db } = initializeFirebase();
  const { activeSeasonNumber } = getGlobalSeasonInfo();
  const seasonId = `season_${activeSeasonNumber}`;

  console.log(`[CUP ENGINE] Initializing Season ${activeSeasonNumber}`);

  for (const league of LEAGUES) {
    const batcher = new FirestoreBatcher(db);
    
    // 1. Получаем всех участников лиги
    const q = query(
      collection(db, 'players_v10'),
      where('selectedLeagueId', '==', league.id),
      orderBy('leagueLevel', 'asc'),
      orderBy('groupId', 'asc'),
      orderBy('rank', 'asc')
    );
    
    const snap = await getDocs(q);
    const players = snap.docs.map(d => ({ id: d.id, level: d.data().leagueLevel }));
    
    // Добиваем системными ботами до 4096 (идеальное дерево 2^12)
    const allParticipants = [...players];
    while (allParticipants.length < 4096) {
      allParticipants.push({ 
        id: `sys_bot_${league.id}_${allParticipants.length}`, 
        level: 9 
      });
    }

    // Див 1 (8 команд) и остальные (4088 команд)
    const div1Teams = allParticipants.filter(p => p.level === 1).slice(0, 8);
    const div2to9Teams = allParticipants.filter(p => p.level > 1 || !p.level);

    // 2. Раунд 1 (2044 матча для 4088 команд)
    // Посев "От края до края": Лучший vs Худший
    for (let i = 0; i < 2044; i++) {
      const strongTeam = div2to9Teams[i];
      const weakTeam = div2to9Teams[div2to9Teams.length - 1 - i];
      
      const matchId = `cup_s${activeSeasonNumber}_l${league.id}_r1_m${i}`;
      const nextMatchId = `cup_s${activeSeasonNumber}_l${league.id}_r2_m${Math.floor(i / 2)}`;

      await batcher.set(doc(db, 'cup_matches', matchId), {
        cupMatchId: matchId,
        seasonId,
        seasonNumber: activeSeasonNumber,
        leagueId: league.id,
        round: 1,
        startTime: calculateCupTime(league.startTime, 1, activeSeasonNumber),
        homeTeamId: weakTeam.id,   // Слабый дома
        awayTeamId: strongTeam.id, // Сильный в гостях
        status: 'scheduled',
        winnerId: null,
        nextCupMatchId: nextMatchId
      });
    }

    // 3. Раунд 2 (1024 матча)
    // Включает победителей R1 + Byes из Див 1
    for (let i = 0; i < 1024; i++) {
      const matchId = `cup_s${activeSeasonNumber}_l${league.id}_r2_m${i}`;
      const nextMatchId = `cup_s${activeSeasonNumber}_l${league.id}_r3_m${Math.floor(i / 2)}`;
      
      // Первые 8 матчей принимают фаворитов Див 1 в слот гостей
      const reservedAwayId = i < 8 ? div1Teams[i].id : null;

      await batcher.set(doc(db, 'cup_matches', matchId), {
        cupMatchId: matchId,
        seasonId,
        seasonNumber: activeSeasonNumber,
        leagueId: league.id,
        round: 2,
        startTime: calculateCupTime(league.startTime, 2, activeSeasonNumber),
        homeTeamId: null, // Ждет победителя R1
        awayTeamId: reservedAwayId,
        status: 'scheduled',
        winnerId: null,
        nextCupMatchId: nextMatchId
      });
    }

    // 4. Генерация дерева до Финала (R3 - R12)
    let matchesInRound = 512;
    for (let r = 3; r <= 12; r++) {
      for (let i = 0; i < matchesInRound; i++) {
        const matchId = `cup_s${activeSeasonNumber}_l${league.id}_r${r}_m${i}`;
        const nextMatchId = r < 12 ? `cup_s${activeSeasonNumber}_l${league.id}_r${r+1}_m${Math.floor(i / 2)}` : null;

        await batcher.set(doc(db, 'cup_matches', matchId), {
          cupMatchId: matchId,
          seasonId,
          seasonNumber: activeSeasonNumber,
          leagueId: league.id,
          round: r,
          startTime: calculateCupTime(league.startTime, r, activeSeasonNumber),
          homeTeamId: null,
          awayTeamId: null,
          status: 'scheduled',
          winnerId: null,
          nextCupMatchId: nextMatchId
        });
      }
      matchesInRound /= 2;
    }

    await batcher.commit();
  }
  
  return { success: true };
}

/**
 * Реактивное продвижение победителя.
 * Вызывается при обновлении документа в 'finished' с winnerId.
 */
export async function advanceCupWinner(matchId: string, winnerId: string) {
  const { firestore: db } = initializeFirebase();
  const matchRef = doc(db, 'cup_matches', matchId);
  const snap = await getDoc(matchRef);
  
  if (!snap.exists()) return;
  const data = snap.data() as CupMatch;
  
  if (!data.nextCupMatchId) {
    console.log("[CUP] Final Reached. Tournament Closed.");
    return;
  }

  const nextRef = doc(db, 'cup_matches', data.nextCupMatchId);
  
  // Определяем слот (Home/Away) на основе индекса текущего матча
  // Четный индекс текущего матча -> идет в Home, нечетный -> в Away
  const currentMatchIndex = parseInt(matchId.split('_m').pop() || '0');
  const isHomeSlot = currentMatchIndex % 2 === 0;

  if (isHomeSlot) {
    await updateDoc(nextRef, { homeTeamId: winnerId });
  } else {
    await updateDoc(nextRef, { awayTeamId: winnerId });
  }
}
