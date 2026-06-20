/**
 * @fileOverview Ядро времени v42. Absolute Global Sync & Seasonal Engine.
 * 
 * Система обеспечивает полную синхронизацию времени между всеми клиентами.
 * Использует UTC+3 (Москва) как базовый стандарт.
 */

let syncPoint = {
  serverMs: typeof Date !== 'undefined' ? Date.now() : 0,
  perfMs: typeof performance !== 'undefined' ? performance.now() : 0
};

/**
 * Устанавливает абсолютную точку отсчета серверного времени.
 */
export function setServerTime(serverMs: number) {
  if (typeof performance !== 'undefined') {
    syncPoint = {
      serverMs,
      perfMs: performance.now()
    };
  } else {
    syncPoint = {
      serverMs,
      perfMs: 0
    };
  }
  console.log(`[TIME-CORE v42] Global Sync Established: ${new Date(serverMs).toISOString()}`);
}

/**
 * Возвращает текущее игровое время (UTC+3).
 */
export function getMoscowTime(): Date {
  const isBrowser = typeof window !== 'undefined';
  let currentUtcMs;
  if (isBrowser && performance) {
    const elapsed = performance.now() - syncPoint.perfMs;
    currentUtcMs = syncPoint.serverMs + elapsed;
  } else {
    currentUtcMs = Date.now(); 
  }
  const MSK_OFFSET = 3 * 60 * 60 * 1000; 
  return new Date(currentUtcMs + MSK_OFFSET);
}

export function formatTerminalTime(date: Date): string {
  const day = String(date.getUTCDate()).padStart(2, '0');
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const hours = String(date.getUTCHours()).padStart(2, '0');
  const minutes = String(date.getUTCMinutes()).padStart(2, '0');
  const seconds = String(date.getUTCSeconds()).padStart(2, '0');
  return `${day}.${month} ${hours}:${minutes}:${seconds}`;
}

export function getMoscowDateString(): string {
  const msk = getMoscowTime();
  const year = msk.getUTCFullYear();
  const month = String(msk.getUTCMonth() + 1).padStart(2, '0');
  const day = String(msk.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Рассчитывает состояние сезона на основе 15-дневного цикла.
 * Эпоха (S1 Day 1): 20.06.2026 00:00 MSK
 */
export function getGlobalSeasonInfo() {
  const mskNow = getMoscowTime();
  const epoch = new Date('2026-06-20T00:00:00+03:00');
  
  const diffMs = mskNow.getTime() - epoch.getTime();
  const cycleDuration = 15; 
  const dayMs = 24 * 60 * 60 * 1000;

  let seasonNumber: number;
  let dayOfCycle: number;

  if (diffMs < 0) {
    seasonNumber = 1;
    dayOfCycle = 0; // Предсезон
  } else {
    seasonNumber = Math.floor(diffMs / (cycleDuration * dayMs)) + 1;
    dayOfCycle = Math.floor((diffMs % (cycleDuration * dayMs)) / dayMs) + 1;
  }

  const isOffseason = dayOfCycle === 15 || diffMs < 0;
  const isGenerationDay = dayOfCycle === 15;
  
  const currentSeasonStart = new Date(epoch.getTime() + (seasonNumber - 1) * cycleDuration * dayMs);
  const nextSeasonStart = new Date(epoch.getTime() + seasonNumber * cycleDuration * dayMs);

  return {
    seasonDay: isOffseason ? 0 : dayOfCycle,
    dayOfCycle,
    seasonNumber,
    activeSeasonNumber: seasonNumber,
    isOffseason,
    isGenerationDay,
    timeToStartMs: Math.max(0, nextSeasonStart.getTime() - mskNow.getTime()),
    currentSeasonStart,
    nextSeasonStart
  };
}

/**
 * Проверяет, просрочен ли матч более чем на 35 минут (длительность симуляции).
 */
export function isMatchOverdue(startTimeIso: string): boolean {
  const mskNow = getMoscowTime();
  const start = new Date(startTimeIso);
  return mskNow.getTime() > (start.getTime() + (35 * 60 * 1000));
}

/**
 * Проверяет, идет ли матч прямо сейчас (окно 35 минут).
 */
export function isMatchLive(startTimeIso: string): boolean {
  const mskNow = getMoscowTime();
  const start = new Date(startTimeIso);
  const end = new Date(start.getTime() + (35 * 60 * 1000));
  return mskNow.getTime() >= start.getTime() && mskNow.getTime() <= end.getTime();
}

export function getSeasonDateLabel(dayOfSeason: number, seasonNumber: number = 1): string {
  const epoch = new Date('2026-06-20T00:00:00+03:00');
  const cycleDuration = 15;
  const targetMs = epoch.getTime() + (seasonNumber - 1) * cycleDuration * 24 * 60 * 60 * 1000 + (dayOfSeason - 1) * 24 * 60 * 60 * 1000;
  const targetDate = new Date(targetMs);
  
  const d = String(targetDate.getUTCDate()).padStart(2, '0');
  const m = String(targetDate.getUTCMonth() + 1).padStart(2, '0');
  return `${d}.${m}.${targetDate.getUTCFullYear()}`;
}
