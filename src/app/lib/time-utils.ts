/**
 * @fileOverview Ядро времени v38. Глобальная синхронизация серверного игрового времени.
 * 
 * Исключает использование локального времени устройства. 
 * Реальное время МСК + 1 год = Виртуальное время игры.
 */

let globalServerTimeOffset = 0; // Разница между UTC сервера и UTC устройства

/**
 * Устанавливает смещение между локальным временем устройства и временем сервера.
 * Вызывается один раз при инициализации приложения.
 */
export function setServerTimeOffset(offset: number) {
  globalServerTimeOffset = offset;
  console.log(`[TIME-CORE] Server offset established: ${offset}ms`);
}

/**
 * Возвращает текущее игровое время по Москве (UTC+3), 
 * полностью синхронизированное с сервером.
 */
export function getMoscowTime(): Date {
  // 1. Получаем текущее реальное UTC время (синхронизированное)
  const realUtcMs = Date.now() + globalServerTimeOffset;
  
  // 2. Константы смещения
  const MSK_OFFSET = 3 * 60 * 60 * 1000; // +3 часа для Москвы
  const YEAR_JUMP = 365 * 24 * 60 * 60 * 1000; // Ровно 1 год (365 дней)

  /**
   * ВИРТУАЛЬНЫЙ ТАЙМЛАЙН (v38)
   * Если сегодня в реальном мире 18.06.2025 22:18 MSK, 
   * в игре будет ровно 18.06.2026 22:18 MSK.
   */
  const virtualMskMs = realUtcMs + MSK_OFFSET + YEAR_JUMP;

  return new Date(virtualMskMs);
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
    // Период ДО старта Сезона 1 (Межсезонье)
    seasonNumber = 1;
    // 18.06 (сегодня) -> День 14 цикла 0
    // 19.06 (завтра) -> День 15 цикла 0 (Генерация)
    dayOfCycle = totalDaysPassed === -1 ? 15 : (totalDaysPassed === -2 ? 14 : 1);
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