/**
 * @fileOverview Ядро времени v125 (Always Check StartTime). 
 */

let syncPoint = {
  serverMs: typeof Date !== 'undefined' ? Date.now() : 0,
  perfMs: typeof performance !== 'undefined' ? performance.now() : 0
};

const SIMULATION_OFFSET_MS = 0; 
const MSK_OFFSET = 3 * 60 * 60 * 1000;

export const GLOBAL_EPOCH_ISO = '2026-08-30T21:00:00Z'; 
export const SEASON_CYCLE_DAYS = 17; 

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
      seasonDay: 1, dayOfCycle: 1, seasonNumber: 1, activeSeasonNumber: 1,
      isOffseason: false, isTransitionDay: false, isPreparationDay: false,
      timeToStartMs: Math.abs(diffMs), currentSeasonStart: epochUtc,
      nextSeasonStart: new Date(epochUtc.getTime() + cycleMs)
    };
  }

  const seasonNumber = Math.floor(diffMs / cycleMs) + 1;
  const dayOfCycle = Math.floor((diffMs % cycleMs) / dayMs) + 1;
  const isOffseason = dayOfCycle >= 15;
  const isTransitionDay = dayOfCycle === 16;
  const currentSeasonStart = new Date(epochUtc.getTime() + (seasonNumber - 1) * cycleMs);

  return {
    seasonDay: dayOfCycle > 14 ? 0 : dayOfCycle,
    dayOfCycle, seasonNumber, activeSeasonNumber: seasonNumber,
    isOffseason, isTransitionDay,
    currentSeasonStart,
    nextSeasonStart: new Date(currentSeasonStart.getTime() + cycleMs)
  };
}

/**
 * Рассчитывает текущий возраст игрока на основе базового возраста при найме.
 * 17 реальных дней = 1 игровой год (цикл сезона).
 */
export function calculateLiveAge(baseAge: number, hiredAtIso: string) {
  const now = getMoscowTime();
  const hiredAt = new Date(hiredAtIso);
  const diffMs = now.getTime() - hiredAt.getTime();
  const dayMs = 24 * 60 * 60 * 1000;
  const daysPassed = Math.max(0, diffMs / dayMs);
  
  const yearsPassed = daysPassed / SEASON_CYCLE_DAYS;
  const currentAge = baseAge + yearsPassed;
  
  return {
    numeric: currentAge,
    display: Math.floor(currentAge)
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