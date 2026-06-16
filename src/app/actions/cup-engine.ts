'use server';

/**
 * @fileOverview Глобальный движок Кубка Пирамиды (Pyramid Cup Engine).
 * 
 * Логика генерации сетки:
 * - 16 независимых лиг (ALPHA..PI).
 * - Посев "От края до края" (Edge-to-Edge) для Див 2-9 в Раунде 1.
 * - Див 1 пропускает Раунд 1 и попадает в Раунд 2 как Гости (awayTeamId).
 * - Время: 17.06.2026 20:00 UTC (фикс).
 * - Пакетная запись Firestore (batches) по 500 операций.
 */

import { 
  collection, doc, getDocs, writeBatch, query, where, 
  getDoc, updateDoc, Firestore
} from 'firebase/firestore';
import { initializeFirebase } from '@/firebase';
import { LEAGUES } from '@/app/lib/leagues-data';

interface CupMatch {
  cupMatchId: string;
  seasonId: string;
  seasonNumber: number;
  leagueId: string;
  round: number;
  date: string; // ISO UTC
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
  constructor(private db: Firestore) {
    this.batch = writeBatch(db);
  }

  async set(ref: any, data: any) {
    this.batch.set(ref, data);
    this.count++;
    if (this.count >= 490) {
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
 * ПРИНУДИТЕЛЬНАЯ ГЕНЕРАЦИЯ КУБКА.
 * Реализует логику "От края до края" и "Byes для Див 1".
 */
export async function generatePyramidCup() {
  const { firestore: db } = initializeFirebase();
  const CURRENT_SEASON_NUM = 1;
  const START_DATE_STR = "2026-06-17T20:00:00Z";

  console.log(`[CUP] Starting generation for Season ${CURRENT_SEASON_NUM}`);

  for (const league of LEAGUES) {
    console.log(`[CUP] Processing League: ${league.id}`);
    const batcher = new FirestoreBatcher(db);
    
    // 1. Сбор всех участников лиги из мастер-индекса
    const q = query(
      collection(db, 'players_v10'),
      where('selectedLeagueId', '==', league.id)
    );
    
    const snap = await getDocs(q);
    const allTeams = snap.docs.map(d => ({ 
      id: d.id, 
      divisionId: String(d.data().leagueLevel || "9"),
      rank: Number(d.data().rank || 8)
    }));
    
    // Разделение: Див 1 (Byes) и Див 2-9 (R1)
    const div1Teams = allTeams.filter(t => t.divisionId === "1").slice(0, 8);
    const lowerTeams = allTeams.filter(t => t.divisionId !== "1");

    // Сортировка lowerTeams (от сильных к слабым)
    lowerTeams.sort((a, b) => Number(a.divisionId) - Number(b.divisionId) || a.rank - b.rank);

    // 2. Генерируем Раунд 1 (От края до края)
    const round1Pairs: { homeId: string, awayId: string | null }[] = [];
    let left = 0;
    let right = lowerTeams.length - 1;

    while (left < right) {
      const strongTeam = lowerTeams[left];
      const weakTeam = lowerTeams[right];
      // Сильный (strong) — в гостях, слабый (weak) — дома
      round1Pairs.push({ homeId: weakTeam.id, awayId: strongTeam.id });
      left++;
      right--;
    }

    if (left === right) {
      round1Pairs.push({ homeId: lowerTeams[left].id, awayId: null });
    }

    const totalR1Matches = round1Pairs.length;

    // 3. Запись Раунда 1
    for (let i = 0; i < totalR1Matches; i++) {
      const match = round1Pairs[i];
      const mNum = i + 1;
      const matchId = `season_${CURRENT_SEASON_NUM}_league_${league.id}_round_1_match_${mNum}`;
      const nextMatchNum = Math.ceil(mNum / 2);
      const nextCupMatchId = `season_${CURRENT_SEASON_NUM}_league_${league.id}_round_2_match_${nextMatchNum}`;

      await batcher.set(doc(db, 'cup_matches', matchId), {
        cupMatchId: matchId,
        seasonId: `season_${CURRENT_SEASON_NUM}`,
        seasonNumber: CURRENT_SEASON_NUM,
        leagueId: league.id,
        round: 1,
        date: START_DATE_STR,
        homeTeamId: match.homeId,
        awayTeamId: match.awayId,
        status: 'scheduled',
        winnerId: null,
        nextCupMatchId: nextCupMatchId
      } as CupMatch);
    }

    // 4. Генерация Раунда 2 (Byes для Дивизиона 1 в слотах Away)
    const totalR2Matches = Math.ceil((totalR1Matches + div1Teams.length) / 2);

    for (let mNum = 1; mNum <= totalR2Matches; mNum++) {
      const matchId = `season_${CURRENT_SEASON_NUM}_league_${league.id}_round_2_match_${mNum}`;
      const nextMatchNum = Math.ceil(mNum / 2);
      const nextCupMatchId = `season_${CURRENT_SEASON_NUM}_league_${league.id}_round_3_match_${nextMatchNum}`;
      
      // Див 1 садятся гостями в первые матчи
      const byeTeamId = div1Teams[mNum - 1] ? div1Teams[mNum - 1].id : null;

      await batcher.set(doc(db, 'cup_matches', matchId), {
        cupMatchId: matchId,
        seasonId: `season_${CURRENT_SEASON_NUM}`,
        seasonNumber: CURRENT_SEASON_NUM,
        leagueId: league.id,
        round: 2,
        date: START_DATE_STR,
        homeTeamId: null, // Ждет победителя R1
        awayTeamId: byeTeamId, 
        status: 'scheduled',
        winnerId: null,
        nextCupMatchId: nextCupMatchId
      } as CupMatch);
    }

    // 5. Генерация остального дерева до Финала (Раунд 12)
    let currentRoundMatches = Math.ceil(totalR2Matches / 2);
    for (let r = 3; r <= 12; r++) {
      if (currentRoundMatches === 0) break;
      for (let mNum = 1; mNum <= currentRoundMatches; mNum++) {
        const matchId = `season_${CURRENT_SEASON_NUM}_league_${league.id}_round_${r}_match_${mNum}`;
        const nextMatchId = r < 12 ? `season_${CURRENT_SEASON_NUM}_league_${league.id}_round_${r+1}_match_${Math.ceil(mNum / 2)}` : null;

        await batcher.set(doc(db, 'cup_matches', matchId), {
          cupMatchId: matchId,
          seasonId: `season_${CURRENT_SEASON_NUM}`,
          seasonNumber: CURRENT_SEASON_NUM,
          leagueId: league.id,
          round: r,
          date: START_DATE_STR,
          homeTeamId: null,
          awayTeamId: null,
          status: 'scheduled',
          winnerId: null,
          nextCupMatchId: nextMatchId
        } as CupMatch);
      }
      if (currentRoundMatches === 1) break;
      currentRoundMatches = Math.ceil(currentRoundMatches / 2);
    }

    await batcher.commit();
  }
  
  console.log(`[CUP] Generation Complete for all 16 leagues.`);
  return { success: true };
}

/**
 * Реактивное продвижение победителя.
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

  // Правило продвижения:
  // Победитель нечетного матча идет в Home, четного - в Away.
  const currentMatchNumStr = matchId.split('_match_').pop() || '1';
  const currentMatchNum = parseInt(currentMatchNumStr);

  if (nextData.homeTeamId === null) {
    await updateDoc(nextRef, { homeTeamId: winnerId });
  } else {
    await updateDoc(nextRef, { awayTeamId: winnerId });
  }
}
