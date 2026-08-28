import { NextResponse } from 'next/server';
import { runGlobalEmergencyRepair } from '@/app/actions/fix-calendar';

/**
 * @fileOverview Единственная точка входа для подготовки мира.
 * Вызывается Cloud Scheduler постоянно (каждые 30-60 сек).
 * Управляет постройкой групп и расстановкой игроков в зависимости от фазы.
 */

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
