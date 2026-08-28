
import { NextResponse } from 'next/server';
import { initializeLeagueWorld } from '@/app/actions/world-engine';

/**
 * @fileOverview Серверная точка входа для инициализации мира.
 * Предназначена для вызова через Cloud Scheduler каждые 30-60 секунд.
 * Автоматически определяет сезон и достраивает пропущенные группы.
 */

export async function GET(request: Request) {
  // Проверка секретного ключа для защиты от несанкционированного доступа
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  try {
    const result = await initializeLeagueWorld('ALPHA');
    return NextResponse.json({ 
      success: true, 
      timestamp: new Date().toISOString(),
      ...result 
    });
  } catch (error: any) {
    console.error('[CRON WORLD INIT ERROR]:', error.message);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
