/**
 * @fileOverview Ядро времени v39.1. Монотонная синхронизация серверного времени.
 * 
 * Исключает зависимость от системных часов устройства.
 * Использует performance.now() для защиты от перевода времени пользователем.
 */

// Точка синхронизации: [Реальное серверное время в MS, Время performance.now() в MS]
let syncPoint = {
  serverMs: Date.now(),
  perfMs: typeof performance !== 'undefined' ? performance.now() : 0
};

/**
 * Устанавливает абсолютную точку отсчета серверного времени.
 * Вызывается при запуске приложения после получения времени из сети.
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
  console.log(`[TIME-CORE] Absolute server sync established: ${new Date(serverMs).toISOString()}`);
}

/**
 * Возвращает текущее игровое время по Москве (UTC+3), 
 * полностью защищенное от манипуляций с локальными часами.
 */
export function getMoscowTime(): Date {
  const isBrowser = typeof window !== 'undefined';
  
  // 1. Рассчитываем текущее реальное время на основе монотонного таймера
  let currentRealUtcMs;
  if (isBrowser && performance) {
    const elapsed = performance.now() - syncPoint.perfMs;
    currentRealUtcMs = syncPoint.serverMs + elapsed;
  } else {
    currentRealUtcMs = Date.now(); // Fallback для сервера
  }
  
  // 2. Константы смещения (Виртуальный таймлайн v39.1)
  // Нам нужно попасть в 18.06.2026 22:44 из 27.02.2025 22:44
  // Разница составляет ровно 476 дней.
  
  const MSK_OFFSET = 3 * 60 * 60 * 1000; 
  const PROTOTYPE_OFFSET = 476 * 24 * 60 * 60 * 1000; 

  // Принудительно вычисляем время относительно UTC, игнорируя локальный часовой пояс устройства
  return new Date(currentRealUtcMs + MSK_OFFSET + PROTOTYPE_OFFSET);
}

/**
 * Форматирует время для нижнего терминала: "18.06 22:18:01"
 */
export function formatTerminalTime(date: Date): string {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  
  return `${day}.${month} ${hours}:${minutes}:${seconds}`;
}

export function getMoscowDateString(): string {
  const msk = getMoscowTime();
  const year = msk.getFullYear();
  const month = String(msk.getMonth() + 1).padStart(2, '0');
  const day = String(msk.getDate()).padStart(2, '0');
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
  const totalDaysPassed = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  const cycleDuration = 15; 

  let seasonNumber: number;
  let dayOfCycle: number;

  if (totalDaysPassed < 0) {
    // Период до старта самого первого сезона (Offseason S1)
    seasonNumber = 1;
    // Маппинг дней до эпохи: -1 -> 15 (Gen), -2 -> 14 (Relax), etc.
    dayOfCycle = 15 + (totalDaysPassed % 15);
    if (dayOfCycle === 15 && totalDaysPassed < -1) dayOfCycle = 14; 
  } else {
    seasonNumber = Math.floor(totalDaysPassed / cycleDuration) + 1;
    dayOfCycle = (totalDaysPassed % cycleDuration) + 1;
  }

  const isOffseason = dayOfCycle === 15 || totalDaysPassed < 0;
  const isGenerationDay = dayOfCycle === 15;
  
  let nextSeasonStartDate: Date;
  if (totalDaysPassed < 0) {
    nextSeasonStartDate = epoch;
  } else {
    const cyclesPassed = Math.floor(totalDaysPassed / cycleDuration) + 1;
    nextSeasonStartDate = new Date(epoch.getTime() + (cyclesPassed * cycleDuration * 24 * 60 * 60 * 1000));
  }
  
  const timeToStartMs = nextSeasonStartDate.getTime() - mskNow.getTime();

  return {
    seasonDay: (isOffseason) ? 0 : dayOfCycle,
    dayOfCycle,
    seasonNumber: Math.max(1, seasonNumber),
    activeSeasonNumber: isGenerationDay ? seasonNumber + 1 : seasonNumber,
    isOffseason,
    isGenerationDay,
    timeToStartMs: Math.max(0, timeToStartMs),
    nextSeasonStart: nextSeasonStartDate
  };
}

export function isMatchOverdue(startTimeIso: string): boolean {
  const mskNow = getMoscowTime();
  const start = new Date(startTimeIso);
  return mskNow.getTime() > (start.getTime() + 2000);
}

export function getSeasonDateLabel(dayOfSeason: number, seasonNumber: number = 1): string {
  const epoch = new Date('2026-06-20T00:00:00+03:00');
  const cycleDuration = 15;
  const seasonStartOffset = (seasonNumber - 1) * cycleDuration;
  const targetDate = new Date(epoch.getTime() + (seasonStartOffset + dayOfSeason - 1) * 24 * 60 * 60 * 1000);
  
  const d = String(targetDate.getDate()).padStart(2, '0');
  const m = String(targetDate.getMonth() + 1).padStart(2, '0');
  const y = targetDate.getFullYear();
  
  return `${d}.${m}.${y}`;
}

export function calculateLiveAge(baseAge: number, hiredAt: string) {
  const mskNow = getMoscowTime();
  const hiredDate = new Date(hiredAt);
  const diffMs = mskNow.getTime() - hiredDate.getTime();
  const msInYear = 1000 * 60 * 60 * 24 * 365.25;
  const currentAge = Number(baseAge || 18) + (diffMs / msInYear);
  return { numeric: currentAge, display: currentAge.toFixed(1) };
}
