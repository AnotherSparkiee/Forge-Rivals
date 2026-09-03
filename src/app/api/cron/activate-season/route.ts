import { NextResponse } from 'next/server';
import { activateNextSeason } from '@/app/actions/season-cycle';

/**
 * @fileOverview Cron-эндпоинт для официального переключения сезона.
 * Рекомендуемый запуск: 18:05 MSK в 16-й день цикла.
 */

export const maxDuration = 300; 

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  try {
    const result = await activateNextSeason();
    return NextResponse.json({ 
      success: true, 
      timestamp: new Date().toISOString(),
      ...result 
    });
  } catch (error: any) {
    console.error('[CRON SEASON ACTIVATION ERROR]:', error.message);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
