'use server';

/**
 * @fileOverview Ядро Кубка Пирамиды (Pyramid Cup Engine).
 * Управляет генерацией сетки, посевом "От края до края" и продвижением победителей.
 * 
 * Логика:
 * - 16 лиг изолированы.
 * - Див 1 пропускает Раунд 1.
 * - Див 2-9 играют Раунд 1 (Зеркальный посев).
 * - Победитель продвигается через nextCupMatchId.
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
 * Генерирует структуру Кубка для всех 16 лиг в начале сезона.
 * Вызывается в Межсезонье (15-й день).
 */
export async function generatePyramidCup() {
  const { firestore: db } = initializeFirebase();
  const { activeSeasonNumber } = getGlobalSeasonInfo();
  const seasonId = `season_${activeSeasonNumber}`;

  console.log(`[CUP] Generating Tournament Tree for Season ${activeSeasonNumber}`);

  for (const league of LEAGUES) {
    const batcher = new FirestoreBatcher(db);
    
    // 1. Собираем всех участников лиги (Див 1-9)
    const q = query(
      collection(db, 'players_v10'),
      where('selectedLeagueId', '==', league.id),
      orderBy('leagueLevel', 'asc'),
      orderBy('groupId', 'asc'),
      orderBy('rank', 'asc')
    );
    
    const snap = await getDocs(q);
    const allParticipants = snap.docs.map(d => d.id);
    
    // Если команд меньше нужного (4096), добиваем системными ботами для стабильности сетки
    while (allParticipants.length < 4096) {
      allParticipants.push(`sys_bot_${league.id}_${allParticipants.length}`);
    }

    // Разделяем на Див 1 (8 команд) и остальных (4088 команд)
    const div1Teams = allParticipants.slice(0, 8);
    const otherTeams = allParticipants.slice(8); // Див 2-9

    // 2. Генерация Раунда 1 (2044 матча)
    // Посев "От края до края": лучший из Див 2 против худшего из Див 9
    const r1Matches: string[] = [];
    const numR1Matches = otherTeams.length / 2;
    
    for (let i = 0; i < numR1Matches; i++) {
      const weakTeam = otherTeams[otherTeams.length - 1 - i];
      const strongTeam = otherTeams[i];
      const mId = `cup_s${activeSeasonNumber}_l${league.id}_r1_m${i}`;
      
      const matchData: CupMatch = {
        cupMatchId: mId,
        seasonId,
        seasonNumber: activeSeasonNumber,
        leagueId: league.id,
        round: 1,
        startTime: calculateCupTime(league.startTime, 1),
        homeTeamId: weakTeam,   // Слабый дома
        awayTeamId: strongTeam, // Сильный в гостях
        status: 'scheduled',
        winnerId: null,
        nextCupMatchId: `cup_s${activeSeasonNumber}_l${league.id}_r2_m${Math.floor(i / 2)}`
      };
      
      batcher.set(doc(db, 'cup_matches', mId), matchData);
      r1Matches.push(mId);
    }

    // 3. Генерация Раунда 2 (1024 матча)
    // Сюда входят 8 команд Див 1 и победители Раунда 1
    for (let i = 0; i < 1024; i++) {
      const mId = `cup_s${activeSeasonNumber}_l${league.id}_r2_m${i}`;
      
      // Первые 8 матчей Раунда 2 принимают фаворитов Див 1 в слот гостей
      const reservedAwayTeam = i < 8 ? div1Teams[i] : null;

      const matchData: CupMatch = {
        cupMatchId: mId,
        seasonId,
        seasonNumber: activeSeasonNumber,
        leagueId: league.id,
        round: 2,
        startTime: calculateCupTime(league.startTime, 2),
        homeTeamId: null, // Ждет победителя R1
        awayTeamId: reservedAwayTeam, // Либо Див 1, либо ждет победителя R1
        status: 'scheduled',
        winnerId: null,
        nextCupMatchId: `cup_s${activeSeasonNumber}_l${league.id}_r3_m${Math.floor(i / 2)}`
      };
      
      batcher.set(doc(db, 'cup_matches', mId), matchData);
    }

    // 4. Генерация последующих раундов до Финала (R3 - R11)
    let matchesInRound = 512;
    for (let r = 3; r <= 11; r++) {
      for (let i = 0; i < matchesInRound; i++) {
        const mId = `cup_s${activeSeasonNumber}_l${league.id}_r${r}_m${i}`;
        const nextMatchId = r < 11 ? `cup_s${activeSeasonNumber}_l${league.id}_r${r+1}_m${Math.floor(i / 2)}` : null;

        batcher.set(doc(db, 'cup_matches', mId), {
          cupMatchId: mId,
          seasonId,
          seasonNumber: activeSeasonNumber,
          leagueId: league.id,
          round: r,
          startTime: calculateCupTime(league.startTime, r),
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
}

/**
 * Реактивное продвижение победителя по сетке.
 * Вызывается при обновлении матча в 'finished' с установленным winnerId.
 */
export async function advanceCupWinner(matchId: string, winnerId: string) {
  const { firestore: db } = initializeFirebase();
  const matchRef = doc(db, 'cup_matches', matchId);
  const matchSnap = await getDoc(matchRef);
  
  if (!matchSnap.exists()) return;
  const matchData = matchSnap.data() as CupMatch;
  
  if (!matchData.nextCupMatchId) {
    console.log("[CUP] Tournament Finished. Champion Crowned!");
    return;
  }

  const nextMatchRef = doc(db, 'cup_matches', matchData.nextCupMatchId);
  const nextMatchSnap = await getDoc(nextMatchRef);

  if (!nextMatchSnap.exists()) return;
  const nextMatchData = nextMatchSnap.data();

  // Логика заполнения слотов в следующем раунде:
  // Если индекс текущего матча четный -> идет в Home, нечетный -> в Away.
  const currentMatchIndex = parseInt(matchId.split('_m').pop() || '0');
  const isHomeSlot = currentMatchIndex % 2 === 0;

  if (isHomeSlot) {
    await updateDoc(nextMatchRef, { homeTeamId: winnerId });
  } else {
    await updateDoc(nextMatchRef, { awayTeamId: winnerId });
  }
}

/**
 * Вспомогательный класс для обхода лимита 500 записей Firestore.
 */
class FirestoreBatcher {
  private count = 0;
  private batch;
  constructor(private db: any) { this.batch = writeBatch(db); }

  set(ref: any, data: any) {
    this.batch.set(ref, data);
    this.count++;
    if (this.count >= 450) this.rotate();
  }

  private async rotate() {
    await this.batch.commit();
    this.batch = writeBatch(this.db);
    this.count = 0;
  }

  async commit() { await this.batch.commit(); }
}

/**
 * Рассчитывает время начала матча кубка (+12 часов от старта лиги).
 */
function calculateCupTime(leagueStartTime: string, round: number): string {
  const [hh, mm] = leagueStartTime.split(':').map(Number);
  const date = new Date();
  date.setUTCHours(hh + 12, mm, 0, 0); // Сдвиг на 12 часов
  
  // Каждый раунд проходит в новый день (условно)
  date.setUTCDate(date.getUTCDate() + round); 
  
  return date.toISOString();
}
