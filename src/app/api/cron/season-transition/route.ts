
import { NextResponse } from 'next/server';
import { performSeasonTransition } from '@/app/actions/autonomous-cycle';

/**
 * @fileOverview Серверная точка входа для смены сезона.
 * Вызывается в последний день цикла (Offseason) для миграции лиг.
 */

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  try {
    const result = await performSeasonTransition();
    return NextResponse.json({ 
      success: true, 
      timestamp: new Date().toISOString(),
      ...result 
    });
  } catch (error: any) {
    console.error('[CRON SEASON TRANSITION ERROR]:', error.message);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
