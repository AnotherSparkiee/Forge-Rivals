'use server';

/**
 * @fileOverview Глобальный движок Кубка Пирамиды (Pyramid Cup Engine).
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
 * ПРИНУДИТЕЛЬНАЯ ГЕНЕРАЦИЯ КУБКА.
 * Реализует логику "От края до края" и "Byes для Див 1".
 */
export async function generatePyramidCup() {
  const { firestore: db } = initializeFirebase();
  const { activeSeasonNumber } = getGlobalSeasonInfo();
  const seasonId = `season_${activeSeasonNumber}`;

  console.log(`[CUP] Starting generation for Season ${activeSeasonNumber}`);

  for (const league of LEAGUES) {
    console.log(`[CUP] Processing League: ${league.id}`);
    const batcher = new FirestoreBatcher(db);
    
    // 1. Сбор участников лиги (через корневой профиль для скорости)
    const q = query(
      collection(db, 'players_v10'),
      where('selectedLeagueId', '==', league.id)
    );
    
    const snap = await getDocs(q);
    const players = snap.docs.map(d => ({ 
      id: d.id, 
      level: Number(d.data().leagueLevel || 9),
      rank: Number(d.data().rank || 8)
    }));
    
    // Добиваем системными ботами до 4096 (идеальное дерево)
    const allParticipants = [...players];
    while (allParticipants.length < 4096) {
      allParticipants.push({ 
        id: `sys_bot_${league.id}_${allParticipants.length}`, 
        level: 9,
        rank: 8
      });
    }

    // Разделение: Див 1 (Byes) и Див 2-9 (R1)
    const div1Teams = allParticipants.filter(p => p.level === 1).slice(0, 8);
    const lowerTeams = allParticipants.filter(p => p.level > 1);

    // Сортировка lowerTeams (от сильных к слабым)
    // Сильнее тот, у кого меньше level, а при равном level — меньше rank
    lowerTeams.sort((a, b) => a.level - b.level || a.rank - b.rank);

    // 2. Генерация пар Раунда 1 (От края до края)
    const round1Matches: { homeId: string, awayId: string | null }[] = [];
    let left = 0;
    let right = lowerTeams.length - 1;

    while (left < right) {
      const strongTeam = lowerTeams[left];
      const weakTeam = lowerTeams[right];
      // Сильный (strong) — в гостях, слабый (weak) — дома
      round1Matches.push({ homeId: weakTeam.id, awayId: strongTeam.id });
      left++;
      right--;
    }

    // На случай нечетного количества (хотя при 4096-8=4088 это не произойдет)
    if (left === right) {
      round1Matches.push({ homeId: lowerTeams[left].id, awayId: null });
    }

    const totalR1Matches = round1Matches.length;

    // 3. Запись Раунда 1
    for (let i = 0; i < totalR1Matches; i++) {
      const match = round1Matches[i];
      const matchId = `season_${activeSeasonNumber}_league_${league.id}_round_1_match_${i + 1}`;
      const nextMatchNum = Math.ceil((i + 1) / 2);
      const nextCupMatchId = `season_${activeSeasonNumber}_league_${league.id}_round_2_match_${nextMatchNum}`;

      await batcher.set(doc(db, 'cup_matches', matchId), {
        cupMatchId: matchId,
        seasonId,
        seasonNumber: activeSeasonNumber,
        leagueId: league.id,
        round: 1,
        startTime: calculateCupTime(league.startTime, 1, activeSeasonNumber),
        homeTeamId: match.homeId,
        awayTeamId: match.awayId,
        status: 'scheduled',
        winnerId: null,
        nextCupMatchId: nextCupMatchId
      });
    }

    // 4. Генерация Раунда 2 (С Дивизионом 1 в слотах Away)
    const totalR2Matches = Math.ceil((totalR1Matches + div1Teams.length) / 2);

    for (let i = 0; i < totalR2Matches; i++) {
      const matchId = `season_${activeSeasonNumber}_league_${league.id}_round_2_match_${i + 1}`;
      const nextMatchNum = Math.ceil((i + 1) / 2);
      const nextCupMatchId = `season_${activeSeasonNumber}_league_${league.id}_round_3_match_${nextMatchNum}`;
      
      // Див 1 садятся гостями в первые 8 матчей
      const byeTeamId = div1Teams[i] ? div1Teams[i].id : null;

      await batcher.set(doc(db, 'cup_matches', matchId), {
        cupMatchId: matchId,
        seasonId,
        seasonNumber: activeSeasonNumber,
        leagueId: league.id,
        round: 2,
        startTime: calculateCupTime(league.startTime, 2, activeSeasonNumber),
        homeTeamId: null, // Ждет победителя R1
        awayTeamId: byeTeamId, 
        status: 'scheduled',
        winnerId: null,
        nextCupMatchId: nextCupMatchId
      });
    }

    // 5. Генерация остального дерева (R3 - R12)
    let matchesInRound = Math.ceil(totalR2Matches / 2);
    for (let r = 3; r <= 12; r++) {
      for (let i = 0; i < matchesInRound; i++) {
        const matchId = `season_${activeSeasonNumber}_league_${league.id}_round_${r}_match_${i + 1}`;
        const nextMatchId = r < 12 ? `season_${activeSeasonNumber}_league_${league.id}_round_${r+1}_match_${Math.ceil((i + 1) / 2)}` : null;

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
      if (matchesInRound === 1) break;
      matchesInRound = Math.ceil(matchesInRound / 2);
    }

    await batcher.commit();
  }
  
  console.log(`[CUP] Emergency Generation Complete for all 16 leagues.`);
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
  
  const nextData = nextSnap.data() as CupMatch;
  
  // Логика заполнения слотов:
  // Если текущий номер матча нечетный -> идем в Home, если четный -> в Away
  const currentMatchMatchStr = matchId.split('_match_').pop() || '1';
  const currentMatchNum = parseInt(currentMatchMatchStr);
  const isHomeSlot = currentMatchNum % 2 !== 0;

  if (isHomeSlot) {
    await updateDoc(nextRef, { homeTeamId: winnerId });
  } else {
    await updateDoc(nextRef, { awayTeamId: winnerId });
  }
}
