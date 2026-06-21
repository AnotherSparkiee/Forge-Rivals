/**
 * @fileOverview Ядро времени v91. Глобальная синхронизация (Эпоха: 15.06.2026).
 */

let syncPoint = {
  serverMs: typeof Date !== 'undefined' ? Date.now() : 0,
  perfMs: typeof performance !== 'undefined' ? performance.now() : 0
};

const MSK_OFFSET = 3 * 60 * 60 * 1000;
// 15.06.2026 00:00 MSK (14.06 21:00 UTC)
export const GLOBAL_EPOCH_ISO = '2026-06-14T21:00:00Z'; 

export function setServerTime(serverMs: number) {
  if (typeof performance !== 'undefined') {
    syncPoint = { serverMs, perfMs: performance.now() };
  } else {
    syncPoint = { serverMs, perfMs: 0 };
  }
  console.log(`[TIME-CORE v91] Global Sync established: ${new Date(serverMs).toISOString()}`);
}

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

export function toMskDate(date: Date): Date {
  return new Date(date.getTime() + MSK_OFFSET);
}

export function getLevelThreshold(level: number): number {
  return Math.floor(1000 * Math.pow(level, 1.3));
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
      seasonDay: 0, dayOfCycle: 0, seasonNumber: 1, activeSeasonNumber: 1,
      isOffseason: true, isPreSeason: true, isGenerationDay: true,
      timeToStartMs: Math.abs(diffMs), currentSeasonStart: epochUtc, nextSeasonStart: epochUtc
    };
  }

  const seasonNumber = Math.floor(diffMs / cycleMs) + 1;
  const dayOfCycle = Math.floor((diffMs % cycleMs) / dayMs) + 1;
  const isOffseason = dayOfCycle === 15;

  return {
    seasonDay: isOffseason ? 0 : dayOfCycle,
    dayOfCycle,
    seasonNumber,
    activeSeasonNumber: seasonNumber,
    isOffseason,
    isPreSeason: false,
    isGenerationDay: isOffseason,
    timeToStartMs: Math.max(0, (new Date(epochUtc.getTime() + seasonNumber * cycleMs)).getTime() - utcNow.getTime()),
    currentSeasonStart: new Date(epochUtc.getTime() + (seasonNumber - 1) * cycleMs),
    nextSeasonStart: new Date(epochUtc.getTime() + seasonNumber * cycleMs)
  };
}

export function isMatchOverdue(startTimeIso: string): boolean {
  const utcNow = getMoscowTime();
  const start = new Date(startTimeIso);
  return utcNow.getTime() > (start.getTime() + (35 * 60 * 1000));
}

export function isMatchLive(startTimeIso: string): boolean {
  const utcNow = getMoscowTime();
  const start = new Date(startTimeIso);
  const end = new Date(start.getTime() + (35 * 60 * 1000));
  return utcNow.getTime() >= start.getTime() && utcNow.getTime() <= end.getTime();
}