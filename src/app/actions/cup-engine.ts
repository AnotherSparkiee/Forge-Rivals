'use server';

/**
 * @fileOverview Двигатель Кубка v16.1 (Admin SDK Transition).
 */

import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase-admin';
import { LEAGUES } from '@/app/lib/leagues-data';

class FirestoreBatcher {
  private count = 0;
  private batch;
  constructor(private db: any) {
    this.batch = db.batch();
  }

  async set(ref: any, data: any) {
    this.batch.set(ref, data);
    this.count++;
    if (this.count >= 450) {
      await this.commit();
      this.batch = this.db.batch();
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
  const db = adminDb;
  
  const SEASON_NUM = Number(targetSeasonNumber || 1);
  const SEASON_ID = String(SEASON_NUM);

  const checkId = `cup_status_S${SEASON_ID}_LALPHA`;
  const checkSnap = await db.collection('system_v1').doc(checkId).get();
  if (checkSnap.exists && checkSnap.data()!.status === 'generated') {
    return { success: true, alreadyExists: true };
  }

  const playersSnap = await db.collection('players_v14').get();
  const allGlobalPlayers = playersSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));

  for (let i = 0; i < LEAGUES.length; i++) {
    const league = LEAGUES[i];
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

      await batcher.set(db.collection('cup_matches').doc(cupMatchId), {
        cupMatchId,
        seasonId: SEASON_ID,
        round: 1,
        homeTeamId: home?.id || 'TBD',
        homeTeamName: home?.name || 'TBD',
        awayTeamId: away?.id || 'TBD',
        awayTeamName: away?.name || 'TBD',
        status: 'scheduled',
        isFinished: false,
        createdAt: FieldValue.serverTimestamp(),
        version: 140
      });

      left++;
      right--;
      matchNum++;
    }

    await batcher.commit();
  }
  
  await db.collection('system_v1').doc(checkId).set({ 
    status: 'generated', 
    generatedAt: FieldValue.serverTimestamp() 
  });

  return { success: true };
}
