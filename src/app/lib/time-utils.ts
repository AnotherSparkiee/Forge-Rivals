/**
 * @fileOverview Ядро времени v60. Absolute Global Sync & Seasonal Engine.
 * 
 * Система обеспечивает полную синхронизацию времени между всеми клиентами.
 * Использует UTC+3 (Москва) как базовый стандарт для игровых циклов.
 */

let syncPoint = {
  serverMs: typeof Date !== 'undefined' ? Date.now() : 0,
  perfMs: typeof performance !== 'undefined' ? performance.now() : 0
};

const MSK_OFFSET = 3 * 60 * 60 * 1000;

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
  console.log(`[TIME-CORE v60] Global Sync Established: ${new Date(serverMs).toISOString()}`);
}

/**
 * Возвращает текущее реальное UTC время (синхронизированное).
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
  return new Date(currentUtcMs);
}

/**
 * Возвращает объект Date, сдвинутый на MSK (UTC+3) для удобства доступа к компонентам дня/часа.
 * Используйте getUTCHours(), getUTCDate() и т.д. на полученном объекте.
 */
export function toMskDate(date: Date): Date {
  return new Date(date.getTime() + MSK_OFFSET);
}

/**
 * Рассчитывает порог опыта для уровня менеджера.
 */
export function getLevelThreshold(level: number): number {
  return Math.floor(1000 * Math.pow(level, 1.3));
}

/**
 * Рассчитывает возраст игрока в реальном времени.
 */
export function calculateLiveAge(baseAge: number, hiredAtIso: string) {
  const hiredAt = new Date(hiredAtIso).getTime();
  const utcNow = getMoscowTime().getTime();
  const diffMs = utcNow - hiredAt;
  
  const yearInMs = 365.25 * 24 * 60 * 60 * 1000;
  const yearsPassed = diffMs / yearInMs;
  const currentAge = baseAge + yearsPassed;
  
  return {
    display: currentAge.toFixed(1),
    numeric: currentAge
  };
}

export function formatTerminalTime(date: Date): string {
  const msk = toMskDate(date);
  const day = String(msk.getUTCDate()).padStart(2, '0');
  const month = String(msk.getUTCMonth() + 1).padStart(2, '0');
  const hours = String(msk.getUTCHours()).padStart(2, '0');
  const minutes = String(msk.getUTCMinutes()).padStart(2, '0');
  const seconds = String(msk.getUTCSeconds()).padStart(2, '0');
  return `${day}.${month} ${hours}:${minutes}:${seconds}`;
}

export function getMoscowDateString(): string {
  const msk = toMskDate(getMoscowTime());
  const year = msk.getUTCFullYear();
  const month = String(msk.getUTCMonth() + 1).padStart(2, '0');
  const day = String(msk.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Рассчитывает состояние сезона на основе 15-дневного цикла.
 * Эпоха (S1 Day 1): 01.01.2025 00:00 MSK
 */
export function getGlobalSeasonInfo() {
  const mskNow = toMskDate(getMoscowTime());
  const epoch = new Date('2025-01-01T00:00:00Z'); // MSK 00:00 in our shifted logic
  
  const diffMs = mskNow.getTime() - epoch.getTime();
  const cycleDuration = 15; 
  const dayMs = 24 * 60 * 60 * 1000;
  const cycleMs = cycleDuration * dayMs;

  let seasonNumber = Math.floor(diffMs / cycleMs) + 1;
  let dayOfCycle = Math.floor((diffMs % cycleMs) / dayMs) + 1;

  if (diffMs < 0) {
    seasonNumber = 1;
    dayOfCycle = 1;
  }

  const isOffseason = dayOfCycle === 15;
  const isGenerationDay = dayOfCycle === 15;
  
  const currentSeasonStart = new Date(epoch.getTime() + (seasonNumber - 1) * cycleMs);
  const nextSeasonStart = new Date(epoch.getTime() + seasonNumber * cycleMs);

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
  const utcNow = getMoscowTime();
  const start = new Date(startTimeIso);
  return utcNow.getTime() > (start.getTime() + (35 * 60 * 1000));
}

/**
 * Проверяет, идет ли матч прямо сейчас (окно 35 минут).
 */
export function isMatchLive(startTimeIso: string): boolean {
  const utcNow = getMoscowTime();
  const start = new Date(startTimeIso);
  const end = new Date(start.getTime() + (35 * 60 * 1000));
  return utcNow.getTime() >= start.getTime() && utcNow.getTime() <= end.getTime();
}

export function getSeasonDateLabel(dayOfSeason: number, seasonNumber: number = 1): string {
  const epoch = new Date('2025-01-01T00:00:00Z');
  const cycleDuration = 15;
  const targetMs = epoch.getTime() + (seasonNumber - 1) * cycleDuration * 24 * 60 * 60 * 1000 + (dayOfSeason - 1) * 24 * 60 * 60 * 1000;
  const targetDate = new Date(targetMs);
  
  const d = String(targetDate.getUTCDate()).padStart(2, '0');
  const m = String(targetDate.getUTCMonth() + 1).padStart(2, '0');
  return `${d}.${m}.${targetDate.getUTCFullYear()}`;
}