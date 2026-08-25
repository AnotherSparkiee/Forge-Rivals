/**
 * @fileOverview Ядро времени v92 (Season 1 Reset). 
 * Глобальная синхронизация цикла (15 дней).
 * Эпоха установлена на 1 июля 2026 для старта нового сезона.
 */

let syncPoint = {
  serverMs: typeof Date !== 'undefined' ? Date.now() : 0,
  perfMs: typeof performance !== 'undefined' ? performance.now() : 0
};

const MSK_OFFSET = 3 * 60 * 60 * 1000;
// Установлено: старт сезона 1 июля 2026
export const GLOBAL_EPOCH_ISO = '2026-07-01T00:00:00Z'; 

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
  return new Date(currentUtcMs);
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
  const utcNow = getMoscowTime().getTime();
  const diffMs = utcNow - hiredAt;
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
  const utcNow = getMoscowTime();
  const epochUtc = new Date(GLOBAL_EPOCH_ISO);
  const diffMs = utcNow.getTime() - epochUtc.getTime();
  
  const cycleDuration = 15; 
  const dayMs = 24 * 60 * 60 * 1000;
  const cycleMs = cycleDuration * dayMs;

  if (diffMs < 0) {
    return {
      seasonDay: 1, 
      dayOfCycle: 1, 
      seasonNumber: 1, 
      activeSeasonNumber: 1,
      isOffseason: false, 
      isGenerationReady: false,
      timeToStartMs: Math.abs(diffMs), 
      currentSeasonStart: epochUtc, 
      nextSeasonStart: new Date(epochUtc.getTime() + cycleMs),
      generationTime: new Date(epochUtc.getTime() + (14 * dayMs) + (16 * 3600000))
    };
  }

  const seasonNumber = Math.floor(diffMs / cycleMs) + 1;
  const dayOfCycle = Math.floor((diffMs % cycleMs) / dayMs) + 1;
  const isOffseason = dayOfCycle === 15;

  const currentSeasonStart = new Date(epochUtc.getTime() + (seasonNumber - 1) * cycleMs);
  // Время генерации: 15-й день цикла в 16:00 MSK
  const generationTime = new Date(currentSeasonStart.getTime() + (14 * dayMs) + (16 * 3600000));
  const isGenerationReady = utcNow.getTime() >= generationTime.getTime();

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
  const utcNow = getMoscowTime();
  const start = new Date(startTimeIso);
  // Матч считается завершенным через 45 минут после начала
  return utcNow.getTime() > (start.getTime() + (45 * 60 * 1000));
}

export function isMatchLive(startTimeIso: string): boolean {
  const utcNow = getMoscowTime();
  const start = new Date(startTimeIso);
  const end = new Date(start.getTime() + (45 * 60 * 1000));
  return utcNow.getTime() >= start.getTime() && utcNow.getTime() <= end.getTime();
}
