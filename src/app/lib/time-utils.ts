/**
 * @fileOverview Ядро времени v127 (Universal Sync - Season 1 Start). 
 * Обеспечивает единство отсчета для всех групп лиги.
 * Точка отсчета: 29 августа 2026 года, 00:00 MSK (День 1 Сезона 1).
 */

let syncPoint = {
  serverMs: typeof Date !== 'undefined' ? Date.now() : 0,
  perfMs: typeof performance !== 'undefined' ? performance.now() : 0
};

const SIMULATION_OFFSET_MS = 0; 
const MSK_OFFSET = 3 * 60 * 60 * 1000;

// Полночь 29 августа 2026 по МСК = 21:00 28 августа UTC
export const GLOBAL_EPOCH_ISO = '2026-08-28T21:00:00Z'; 
export const SEASON_CYCLE_DAYS = 15;

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
  return new Date(currentUtcMs + SIMULATION_OFFSET_MS);
}

export function toMskDate(date: Date): Date {
  return new Date(date.getTime() + MSK_OFFSET);
}

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
  
  const dayMs = 24 * 60 * 60 * 1000;
  const cycleMs = SEASON_CYCLE_DAYS * dayMs;

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
  const isOffseason = dayOfCycle === SEASON_CYCLE_DAYS;

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

export function isMatchStarted(startTimeIso: string): boolean {
  const simNow = getMoscowTime();
  const start = new Date(startTimeIso);
  return simNow.getTime() >= start.getTime();
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
