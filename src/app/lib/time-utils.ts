/**
 * @fileOverview Ядро времени v110 (Time Simulation & Global Sync). 
 * Глобальная синхронизация цикла (15 дней).
 * Симулирует дату: сегодня 25 августа 2026, завтра 26 августа 2026 (старт).
 */

let syncPoint = {
  serverMs: typeof Date !== 'undefined' ? Date.now() : 0,
  perfMs: typeof performance !== 'undefined' ? performance.now() : 0
};

// Смещение для симуляции 25 августа 2026 года (относительно 24 февраля 2025)
// Примерно 547 дней разницы
const SIMULATION_OFFSET_MS = 47347200000; 
const MSK_OFFSET = 3 * 60 * 60 * 1000;

// Эпоха: 26 августа 2026. Это День 1 Сезона 1.
export const GLOBAL_EPOCH_ISO = '2026-08-26T00:00:00Z'; 

export function setServerTime(serverMs: number) {
  if (typeof performance !== 'undefined') {
    syncPoint = { serverMs, perfMs: performance.now() };
  } else {
    syncPoint = { serverMs, perfMs: 0 };
  }
}

export function getMoscowTime(): Date {
  const isBrowser = typeof window !== 'undefined';
  let currentUtcMs;
  if (isBrowser && performance && syncPoint.perfMs > 0) {
    const elapsed = performance.now() - syncPoint.perfMs;
    currentUtcMs = syncPoint.serverMs + elapsed;
  } else {
    currentUtcMs = Date.now(); 
  }
  // Применяем смещение для симуляции нужной пользователю даты
  return new Date(currentUtcMs + SIMULATION_OFFSET_MS);
}

export function toMskDate(date: Date): Date {
  return new Date(date.getTime() + MSK_OFFSET);
}

/**
 * Рассчитывает порог опыта для следующего уровня.
 */
export function getLevelThreshold(level: number): number {
  if (level === 1) return 700;
  if (level === 2) return 1400;
  if (level === 3) return 3800;
  return 3800 * Math.pow(2, level - 3);
}

export function calculateLiveAge(baseAge: number, hiredAtIso: string) {
  const hiredAt = new Date(hiredAtIso).getTime();
  const simNow = getMoscowTime().getTime();
  const diffMs = simNow - hiredAt;
  const yearInMs = 365.25 * 24 * 60 * 60 * 1000;
  const currentAge = baseAge + (diffMs / yearInMs);
  return { display: currentAge.toFixed(1), numeric: currentAge };
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
  return `${msk.getUTCFullYear()}-${String(msk.getUTCMonth() + 1).padStart(2, '0')}-${String(msk.getUTCDate()).padStart(2, '0')}`;
}

export function getGlobalSeasonInfo() {
  const simNow = getMoscowTime();
  const epochUtc = new Date(GLOBAL_EPOCH_ISO);
  const diffMs = simNow.getTime() - epochUtc.getTime();
  
  const cycleDuration = 15; 
  const dayMs = 24 * 60 * 60 * 1000;
  const cycleMs = cycleDuration * dayMs;

  // Если время до начала эпохи (Сезон 1 еще не начался)
  if (diffMs < 0) {
    return {
      seasonDay: 0, // Фаза подготовки
      dayOfCycle: 0, 
      seasonNumber: 1, 
      activeSeasonNumber: 1,
      isOffseason: true, 
      isGenerationReady: true,
      timeToStartMs: Math.abs(diffMs), 
      currentSeasonStart: epochUtc, 
      nextSeasonStart: epochUtc,
      generationTime: new Date(epochUtc.getTime() - 12 * 3600000) // Готовность за 12ч до старта
    };
  }

  const seasonNumber = Math.floor(diffMs / cycleMs) + 1;
  const dayOfCycle = Math.floor((diffMs % cycleMs) / dayMs) + 1;
  const isOffseason = dayOfCycle === 15;

  const currentSeasonStart = new Date(epochUtc.getTime() + (seasonNumber - 1) * cycleMs);
  const generationTime = new Date(currentSeasonStart.getTime() + (14 * dayMs) + (16 * 3600000));
  const isGenerationReady = simNow.getTime() >= generationTime.getTime();

  return {
    seasonDay: isOffseason ? 0 : dayOfCycle,
    dayOfCycle,
    seasonNumber,
    activeSeasonNumber: seasonNumber,
    isOffseason,
    isGenerationReady,
    generationTime,
    currentSeasonStart,
    nextSeasonStart: new Date(currentSeasonStart.getTime() + cycleMs)
  };
}

export function isMatchOverdue(startTimeIso: string): boolean {
  const simNow = getMoscowTime();
  const start = new Date(startTimeIso);
  return simNow.getTime() > (start.getTime() + (45 * 60 * 1000));
}

export function isMatchLive(startTimeIso: string): boolean {
  const simNow = getMoscowTime();
  const start = new Date(startTimeIso);
  const end = new Date(start.getTime() + (45 * 60 * 1000));
  return simNow.getTime() >= start.getTime() && simNow.getTime() <= end.getTime();
}
