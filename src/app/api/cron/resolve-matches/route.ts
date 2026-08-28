
import { NextResponse } from 'next/server';
import { resolveDailyMatches } from '@/app/actions/autonomous-cycle';

/**
 * @fileOverview Серверная точка входа для расчета матчей.
 * Должна вызываться ежедневно в 18:00 МСК (или чаще для проверки пропусков).
 */

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  try {
    const result = await resolveDailyMatches();
    return NextResponse.json({ 
      success: true, 
      timestamp: new Date().toISOString(),
      ...result 
    });
  } catch (error: any) {
    console.error('[CRON MATCH RESOLVE ERROR]:', error.message);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
