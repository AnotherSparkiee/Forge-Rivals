'use server';

/**
 * @fileOverview Глобальный движок Кубка Пирамиды (Pyramid Cup Engine) v2.
 * 
 * Логика генерации сетки:
 * - 16 независимых лиг (ALPHA..PI).
 * - Каждая лига должна иметь 4096 участников для идеального дерева.
 * - Если игроков не хватает, создаются системные боты.
 */

import { 
  collection, doc, getDocs, writeBatch, query, where, 
  getDoc, updateDoc, Firestore, serverTimestamp
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
  createdAt: any;
}

class FirestoreBatcher {
  private count = 0;
  private batch;
  constructor(private db: Firestore) {
    this.batch = writeBatch(db);
  }

  async set(ref: any, data: any) {
    this.batch.set(ref, data);
    this.count++;
    if (this.count >= 450) {
      await this.commit();
      this.batch = writeBatch(this.db);
      this.count = 0;
    }
  }

  async commit() {
    if (this.count > 0) {
      await this.batch.commit();
      this.count = 0;
      console.log("[BATCH] Committed chunk.");
    }
  }
}

/**
 * ПРИНУДИТЕЛЬНАЯ ГЕНЕРАЦИЯ КУБКА.
 * Заполняет сетку для всех 16 лиг.
 */
export async function generatePyramidCup() {
  const { firestore: db } = initializeFirebase();
  const CURRENT_SEASON_NUM = 1;
  const START_DATE_STR = "2026-06-17T20:00:00Z";

  console.log(`[CUP] Starting generation for Season ${CURRENT_SEASON_NUM}`);

  for (const league of LEAGUES) {
    console.log(`[CUP] Processing League: ${league.id}`);
    const batcher = new FirestoreBatcher(db);
    
    // 1. Сбор реальных участников
    const q = query(
      collection(db, 'players_v10'),
      where('selectedLeagueId', '==', league.id)
    );
    
    const snap = await getDocs(q);
    const realTeams = snap.docs.map(d => ({ 
      id: d.id, 
      divisionId: String(d.data().leagueLevel || "9"),
      rank: Number(d.data().rank || 8)
    }));
    
    // 2. Разделение и добивка ботами
    const div1Teams = realTeams.filter(t => t.divisionId === "1").slice(0, 8);
    // Добиваем Div 1 до 8 команд
    while (div1Teams.length < 8) {
      div1Teams.push({ id: `bot_l${league.id}_d1_g1_${div1Teams.length + 1}`, divisionId: "1", rank: div1Teams.length + 1 });
    }

    const lowerTeams = realTeams.filter(t => t.divisionId !== "1");
    // Добиваем нижние дивизионы до 4080 команд (чтобы общее было 4088)
    const totalLowerNeeded = 4080;
    while (lowerTeams.length < totalLowerNeeded) {
      const botId = `bot_l${league.id}_lower_${lowerTeams.length + 1}`;
      lowerTeams.push({ id: botId, divisionId: "9", rank: 8 });
    }

    // Сортировка lowerTeams (от сильных к слабым)
    lowerTeams.sort((a, b) => Number(a.divisionId) - Number(b.divisionId) || a.rank - b.rank);

    // 3. Раунд 1 (От края до края)
    const round1Pairs: { homeId: string, awayId: string | null }[] = [];
    let left = 0;
    let right = lowerTeams.length - 1;

    while (left < right) {
      round1Pairs.push({ homeId: lowerTeams[right].id, awayId: lowerTeams[left].id });
      left++;
      right--;
    }

    const totalR1Matches = round1Pairs.length; // 2040

    // Запись Раунда 1
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
        nextCupMatchId: nextCupMatchId,
        createdAt: serverTimestamp()
      } as CupMatch);
    }

    // 4. Раунд 2 (1024 матча)
    // Див 1 садятся гостями в первые 8 матчей
    const totalR2Matches = 1024;
    for (let mNum = 1; mNum <= totalR2Matches; mNum++) {
      const matchId = `season_${CURRENT_SEASON_NUM}_league_${league.id}_round_2_match_${mNum}`;
      const nextMatchNum = Math.ceil(mNum / 2);
      const nextCupMatchId = `season_${CURRENT_SEASON_NUM}_league_${league.id}_round_3_match_${nextMatchNum}`;
      
      const byeTeamId = div1Teams[mNum - 1]?.id || null;

      await batcher.set(doc(db, 'cup_matches', matchId), {
        cupMatchId: matchId,
        seasonId: `season_${CURRENT_SEASON_NUM}`,
        seasonNumber: CURRENT_SEASON_NUM,
        leagueId: league.id,
        round: 2,
        date: START_DATE_STR,
        homeTeamId: null, 
        awayTeamId: byeTeamId, 
        status: 'scheduled',
        winnerId: null,
        nextCupMatchId: nextCupMatchId,
        createdAt: serverTimestamp()
      } as CupMatch);
    }

    // 5. Остальные раунды до Финала (R12)
    let currentRoundMatches = 512;
    for (let r = 3; r <= 12; r++) {
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
          nextCupMatchId: nextMatchId,
          createdAt: serverTimestamp()
        } as CupMatch);
      }
      if (currentRoundMatches === 1) break;
      currentRoundMatches = currentRoundMatches / 2;
    }

    await batcher.commit();
  }
  
  return { success: true };
}

/**
 * Продвижение победителя.
 */
export async function advanceCupWinner(matchId: string, winnerId: string) {
  const { firestore: db } = initializeFirebase();
  const matchRef = doc(db, 'cup_matches', matchId);
  const snap = await getDoc(matchRef);
  
  if (!snap.exists()) return;
  const data = snap.data() as CupMatch;
  
  if (!data.nextCupMatchId) return;

  const nextRef = doc(db, 'cup_matches', data.nextCupMatchId);
  const nextSnap = await getDoc(nextRef);
  if (!nextSnap.exists()) return;
  
  const currentMatchNum = parseInt(matchId.split('_match_').pop() || '1');

  // Победитель нечетного матча -> Home, четного -> Away
  if (currentMatchNum % 2 !== 0) {
    await updateDoc(nextRef, { homeTeamId: winnerId });
  } else {
    await updateDoc(nextRef, { awayTeamId: winnerId });
  }
}
