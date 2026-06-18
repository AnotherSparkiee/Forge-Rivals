/**
 * @fileOverview Ядро времени v40. Absolute Real-Time Sync.
 * 
 * Система полностью переведена на реальное время без искусственных смещений.
 * Использует UTC+3 (Москва) как базовый стандарт для всех онлайн-событий.
 */

// Точка синхронизации: [Реальное серверное время в MS, Время performance.now() в MS]
let syncPoint = {
  serverMs: typeof Date !== 'undefined' ? Date.now() : 0,
  perfMs: typeof performance !== 'undefined' ? performance.now() : 0
};

/**
 * Устанавливает абсолютную точку отсчета серверного времени.
 * Вызывается при запуске приложения после получения времени из сети (NTP).
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
 * Возвращает текущее игровое время по Москве (UTC+3).
 * Защищено от манипуляций с локальными часами через монотонный таймер.
 */
export function getMoscowTime(): Date {
  const isBrowser = typeof window !== 'undefined';
  
  // 1. Рассчитываем текущее реальное UTC время на основе монотонного таймера
  let currentUtcMs;
  if (isBrowser && performance) {
    const elapsed = performance.now() - syncPoint.perfMs;
    currentUtcMs = syncPoint.serverMs + elapsed;
  } else {
    currentUtcMs = Date.now(); 
  }
  
  // 2. Добавляем смещение МСК (UTC+3)
  const MSK_OFFSET = 3 * 60 * 60 * 1000; 

  // Возвращаем объект даты, скорректированный под МСК
  return new Date(currentUtcMs + MSK_OFFSET);
}

/**
 * Форматирует время для нижнего терминала: "18.06 22:44:01"
 */
export function formatTerminalTime(date: Date): string {
  // Нам нужно отобразить дату как 18.06 ЧЧ:ММ:СС. 
  // Так как мы уже в МСК через getMoscowTime, используем UTC методы объекта даты, 
  // чтобы избежать повторного наложения локального часового пояса браузера.
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
  
  // Разница в миллисекундах между "сейчас" и стартом Сезона 1
  const diffMs = mskNow.getTime() - epoch.getTime();
  const totalDaysPassed = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  const cycleDuration = 15; 

  let seasonNumber: number;
  let dayOfCycle: number;

  if (diffMs < 0) {
    // Период до старта самого первого сезона (Offseason S1)
    seasonNumber = 1;
    // Корректный маппинг дней до эпохи: 
    // Если сегодня 19.06 (diff ~ -1 день) -> Day 15 (Gen)
    // Если сегодня 18.06 (diff ~ -2 дня) -> Day 14
    dayOfCycle = 15 + ((totalDaysPassed + 1) % 15);
    if (dayOfCycle === 0) dayOfCycle = 15;
  } else {
    seasonNumber = Math.floor(totalDaysPassed / cycleDuration) + 1;
    dayOfCycle = (totalDaysPassed % cycleDuration) + 1;
  }

  const isOffseason = dayOfCycle === 15 || diffMs < 0;
  const isGenerationDay = dayOfCycle === 15;
  
  let nextSeasonStartDate: Date;
  if (diffMs < 0) {
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
  
  const d = String(targetDate.getUTCDate()).padStart(2, '0');
  const m = String(targetDate.getUTCMonth() + 1).padStart(2, '0');
  const y = targetDate.getUTCFullYear();
  
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
