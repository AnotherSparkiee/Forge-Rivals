
import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';

/**
 * @fileOverview Системный мониторинг игрового мира.
 */

export async function GET() {
  try {
    const db = getAdminDb();
    
    const [configSnap, worldGenSnap] = await Promise.all([
      db.collection('system_v1').doc('season_config').get(),
      db.collection('system_v1').doc('world_gen_S1').get() // Для примера S1
    ]);

    const config = configSnap.data() || {};
    const world = worldGenSnap.data() || {};

    return NextResponse.json({ 
      status: 'OPERATIONAL', 
      activeSeason: config.activeSeasonNumber || 1,
      phase: config.phase || 'UNKNOWN',
      worldStatus: {
        ready: config.worldReady || false,
        groupsReady: world.completedGroups || 0,
        totalGroups: 15
      },
      timestamp: new Date().toISOString() 
    });
  } catch (error: any) {
    return NextResponse.json({ 
      status: 'DEGRADED', 
      error: error.message 
    }, { status: 500 });
  }
}
