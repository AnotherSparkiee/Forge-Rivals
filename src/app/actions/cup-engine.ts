'use server';

/**
 * @fileOverview Двигатель Кубка v15 (Security Patch).
 */

import { 
  collection, doc, getDocs, writeBatch, query, 
  Firestore, serverTimestamp, Timestamp
} from 'firebase/firestore';
import { initializeFirebase } from '@/firebase';
import { authenticateAsSystem } from '@/firebase/system-auth';
import { LEAGUES } from '@/app/lib/leagues-data';

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
    }
  }
}

export async function generatePyramidCup(targetSeasonNumber?: number) {
  await authenticateAsSystem();
  const { firestore: db } = initializeFirebase();
  
  const SEASON_NUM = Number(targetSeasonNumber || 1);
  const SEASON_ID = String(SEASON_NUM);
  const TIMESTAMP_NOW = Timestamp.now();

  const playersSnap = await getDocs(collection(db, 'players_v14'));
  const allGlobalPlayers = playersSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));

  for (let i = 0; i < LEAGUES.length; i++) {
    const league = LEAGUES[i];
    const leagueNum = i + 1;
    const batcher = new FirestoreBatcher(db);
    
    const leagueTeams = allGlobalPlayers.filter((p: any) => p.selectedLeagueId === league.id).map((p: any) => ({
      id: p.id,
      name: p.displayName || `Manager_${p.id.slice(0,4)}`,
      power: (Number(p.leagueLevel || 9) * 100) + Number(p.rank || 8),
    }));

    let bracketSize = 16;
    while (bracketSize < leagueTeams.length) {
      bracketSize *= 2;
    }

    leagueTeams.sort((a, b) => {
      if (b.power !== a.power) return b.power - a.power;
      return a.id.localeCompare(b.id);
    });

    const slots = new Array(bracketSize).fill(null);
    leagueTeams.forEach((team, idx) => {
      slots[idx] = team;
    });

    let left = 0;
    let right = bracketSize - 1;
    let matchNum = 1;

    while (left < right) {
      const home = slots[left];
      const away = slots[right];

      if (!home && !away) break;

      const cupMatchId = `season_${SEASON_ID}_league_${league.id}_round_1_match_${matchNum}`;

      await batcher.set(doc(db, 'cup_matches', cupMatchId), {
        cupMatchId,
        seasonId: SEASON_ID,
        round: 1,
        homeTeamId: home?.id || 'TBD',
        homeTeamName: home?.name || 'TBD',
        awayTeamId: away?.id || 'TBD',
        awayTeamName: away?.name || 'TBD',
        status: 'scheduled',
        isFinished: false,
        createdAt: serverTimestamp(),
        version: 140
      });

      left++;
      right--;
      matchNum++;
    }

    await batcher.commit();
  }
  
  return { success: true };
}
