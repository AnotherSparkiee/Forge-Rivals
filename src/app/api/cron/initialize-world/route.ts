import { NextResponse } from 'next/server';
import { runGlobalEmergencyRepair } from '@/app/actions/fix-calendar';

/**
 * @fileOverview Единственная точка входа для подготовки мира.
 * Защищена секретным токеном CRON_SECRET.
 */

export const maxDuration = 300; 

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  try {
    const result = await runGlobalEmergencyRepair();
    return NextResponse.json({ 
      success: true, 
      timestamp: new Date().toISOString(),
      ...result 
    });
  } catch (error: any) {
    console.error('[CRON WORLD REPAIR ERROR]:', error.message);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
