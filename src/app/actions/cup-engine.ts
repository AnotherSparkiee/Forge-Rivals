'use server';

/**
 * @fileOverview Глобальный движок Кубка Пирамиды (Pyramid Cup Emergency Engine).
 * 
 * Логика генерации сетки:
 * - 16 независимых лиг (ALPHA..PI).
 * - Посев "От края до края" (Edge-to-Edge) для Див 2-9 в Раунде 1.
 * - Див 1 пропускает Раунд 1 и попадает в Раунд 2 как Гости (awayTeamId).
 * - Время: 17.06.2026 + 12 часов UTC от старта лиги.
 * - Пакетная запись Firestore (batches) по 500 операций.
 */

import { 
  collection, doc, getDocs, writeBatch, query, where, 
  orderBy, getDoc, updateDoc 
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
  winnerId: null;
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
      console.log("[BATCH] Committed partial chunk.");
    }
  }
}

/**
 * Рассчитывает время начала матча кубка (17.06.2026 + раунд + 12 часов).
 */
function calculateCupTime(leagueStartTime: string, round: number, seasonNumber: number): string {
  const [hh, mm] = leagueStartTime.split(':').map(Number);
  // Эпоха: 17 июня 2026
  const epochDate = new Date('2026-06-17T00:00:00Z'); 
  
  const targetDate = new Date(epochDate);
  // Сдвиг на сезон (цикл 16 дней) + раунд
  const daysOffset = (seasonNumber - 1) * 16 + (round - 1);
  targetDate.setUTCDate(epochDate.getUTCDate() + daysOffset);
  // Принудительный сдвиг +12 часов
  targetDate.setUTCHours(hh + 12, mm, 0, 0);
  
  return targetDate.toISOString();
}

/**
 * ПРИНУДИТЕЛЬНАЯ ГЕНЕРАЦИЯ КУБКА (EMERGENCY SCRIPT).
 * Запускается вручную или триггером старта сезона.
 */
export async function generatePyramidCup() {
  const { firestore: db } = initializeFirebase();
  const { activeSeasonNumber } = getGlobalSeasonInfo();
  const seasonId = `season_${activeSeasonNumber}`;

  console.log(`[CUP_EMERGENCY] Starting generation for Season ${activeSeasonNumber}`);

  for (const league of LEAGUES) {
    console.log(`[CUP_EMERGENCY] Processing League: ${league.id}`);
    const batcher = new FirestoreBatcher(db);
    
    // 1. Сбор всех участников лиги через корневой профиль (эффективнее скана вложенностей)
    const q = query(
      collection(db, 'players_v10'),
      where('selectedLeagueId', '==', league.id),
      orderBy('leagueLevel', 'asc'),
      orderBy('groupId', 'asc'),
      orderBy('rank', 'asc')
    );
    
    const snap = await getDocs(q);
    const players = snap.docs.map(d => ({ 
      id: d.id, 
      level: d.data().leagueLevel || 9,
      rank: d.data().rank || 8
    }));
    
    // Добиваем системными ботами до 4096 (идеальное дерево 2^12)
    const allParticipants = [...players];
    while (allParticipants.length < 4096) {
      allParticipants.push({ 
        id: `sys_bot_${league.id}_${allParticipants.length}`, 
        level: 9,
        rank: 8
      });
    }

    // Разделение: Див 1 (Byes) и Див 2-9 (R1 Participants)
    const div1Teams = allParticipants.filter(p => p.level === 1).slice(0, 8);
    const lowerTeams = allParticipants.filter(p => p.level > 1);

    // 2. Генерация Раунда 1 (2040 матчей для 4080 команд)
    // Посев "От края до края": Сильный (из топа) vs Слабый (из хвоста)
    // Правило: Слабый ДОМА (home), Сильный В ГОСТЯХ (away)
    for (let i = 0; i < 2040; i++) {
      const strongTeam = lowerTeams[i];
      const weakTeam = lowerTeams[lowerTeams.length - 1 - i];
      
      const matchId = `season_${activeSeasonNumber}_league_${league.id}_round_1_match_${i}`;
      const nextMatchId = `season_${activeSeasonNumber}_league_${league.id}_round_2_match_${Math.floor(i / 2)}`;

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

    // 3. Генерация Раунда 2 (1024 матча)
    // Включает победителей R1 + 8 команд Див 1
    for (let i = 0; i < 1024; i++) {
      const matchId = `season_${activeSeasonNumber}_league_${league.id}_round_2_match_${i}`;
      const nextMatchId = `season_${activeSeasonNumber}_league_${league.id}_round_3_match_${Math.floor(i / 2)}`;
      
      // Первые 8 матчей раунда принимают фаворитов Див 1 в слот Away
      const byeTeamId = i < 8 ? div1Teams[i].id : null;

      await batcher.set(doc(db, 'cup_matches', matchId), {
        cupMatchId: matchId,
        seasonId,
        seasonNumber: activeSeasonNumber,
        leagueId: league.id,
        round: 2,
        startTime: calculateCupTime(league.startTime, 2, activeSeasonNumber),
        homeTeamId: null,      // Ждет победителя R1
        awayTeamId: byeTeamId, // Либо Див 1, либо ждет победителя R1
        status: 'scheduled',
        winnerId: null,
        nextCupMatchId: nextMatchId
      });
    }

    // 4. Генерация дерева до Финала (R3 - R12)
    let matchesInRound = 512;
    for (let r = 3; r <= 12; r++) {
      for (let i = 0; i < matchesInRound; i++) {
        const matchId = `season_${activeSeasonNumber}_league_${league.id}_round_${r}_match_${i}`;
        const nextMatchId = r < 12 ? `season_${activeSeasonNumber}_league_${league.id}_round_${r+1}_match_${Math.floor(i / 2)}` : null;

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
  
  console.log(`[CUP_EMERGENCY] Complete. Bracket generated for all 16 leagues.`);
  return { success: true };
}

/**
 * Реактивное продвижение победителя.
 * Триггер: update на коллекции 'cup_matches' при status == 'finished'
 */
export async function advanceCupWinner(matchId: string, winnerId: string) {
  const { firestore: db } = initializeFirebase();
  const matchRef = doc(db, 'cup_matches', matchId);
  const snap = await getDoc(matchRef);
  
  if (!snap.exists()) return;
  const data = snap.data() as CupMatch;
  
  if (!data.nextCupMatchId) {
    console.log("[CUP] Grand Final Finished. Champion Crowned.");
    return;
  }

  const nextRef = doc(db, 'cup_matches', data.nextCupMatchId);
  const nextSnap = await getDoc(nextRef);
  if (!nextSnap.exists()) return;
  
  const nextData = nextSnap.data();
  
  // Логика заполнения слота:
  // Если текущий match index четный -> идем в Home, если нечетный -> в Away
  const currentMatchIndex = parseInt(matchId.split('_match_').pop() || '0');
  const isHomeSlot = currentMatchIndex % 2 === 0;

  if (isHomeSlot) {
    await updateDoc(nextRef, { homeTeamId: winnerId });
  } else {
    await updateDoc(nextRef, { awayTeamId: winnerId });
  }
}
