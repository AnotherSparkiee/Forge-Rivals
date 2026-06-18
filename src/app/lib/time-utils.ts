/**
 * @fileOverview Ядро времени v37. Глобальная синхронизация серверного игрового времени.
 * 
 * Все события в игре привязаны к этой шкале. 
 * Реальное время 27.02.2025 = Виртуальное 18.06.2026.
 */

let globalServerTimeOffset = 0;

/**
 * Устанавливает смещение между локальным временем устройства и временем сервера.
 */
export function setServerTimeOffset(offset: number) {
  globalServerTimeOffset = offset;
  console.log(`[TIME-CORE] Server offset established: ${offset}ms`);
}

/**
 * Возвращает текущее игровое время по Москве (UTC+3), 
 * синхронизированное с сервером.
 */
export function getMoscowTime(): Date {
  // 1. Получаем реальное "мировое" время (UTC/MSK)
  const nowReal = new Date(Date.now() + globalServerTimeOffset);
  
  /**
   * ПИВОТ ВРЕМЕНИ (v37)
   * Синхронизация: Реальное 27.02.2025 12:00 = Виртуальное 18.06.2026 12:00
   */
  const realReference = new Date('2025-02-27T12:00:00+03:00').getTime();
  const virtualReference = new Date('2026-06-18T12:00:00+03:00').getTime();
  const driftMs = virtualReference - realReference;

  // 2. Трансформируем реальное время в виртуальное
  return new Date(nowReal.getTime() + driftMs);
}

/**
 * Форматирует время для нижнего терминала: "18.06 14:05:01"
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
 * Эпоха (S1 Day 1): 20.06.2026 00:00
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
    // Период ДО старта Сезона 1
    seasonNumber = 1;
    // 18.06 -> Day 14
    // 19.06 -> Day 15 (Generation)
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
