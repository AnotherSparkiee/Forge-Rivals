import { NextResponse } from 'next/server';
import { runSeasonOrchestrator } from '@/app/actions/season-cycle';

/**
 * @fileOverview Единая точка входа для автономного управления миром.
 * Запуск: каждые 5 минут.
 */

export const maxDuration = 300; 

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  try {
    const result = await runSeasonOrchestrator();
    return NextResponse.json({ 
      success: true, 
      timestamp: new Date().toISOString(),
      ...result 
    });
  } catch (error: any) {
    console.error('[CRON ORCHESTRATOR ERROR]:', error.message);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
