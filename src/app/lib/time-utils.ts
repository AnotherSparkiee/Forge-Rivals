/**
 * @fileOverview Ядро времени. Эпоха сезона 1: 17 июня 2026.
 */

export function getMoscowTime(): Date {
  const now = new Date();
  return new Date(now.getTime() + (now.getTimezoneOffset() + 180) * 60000);
}

export function getMoscowDateString(): string {
  const msk = getMoscowTime();
  const year = msk.getFullYear();
  const month = String(msk.getMonth() + 1).padStart(2, '0');
  const day = String(msk.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function formatMoscowTime(date: Date): string {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${day}.${month} ${hours}:${minutes}:${seconds}`;
}

/**
 * Calculates display date for a specific day of the season.
 * Ensures Day 1 is June 17, 2026.
 */
export function getSeasonDateLabel(dayOfSeason: number): string {
  const info = getGlobalSeasonInfo();
  
  // FIXED EPOCH DATE: June 17, 2026
  const epochDate = new Date('2026-06-17T00:00:00+03:00');
  const targetDate = new Date(epochDate);
  
  // Date = Epoch + (Season - 1) * 16 days + (DayOfSeason - 1) days
  const offsetDays = (info.activeSeasonNumber - 1) * 16 + (dayOfSeason - 1);
  targetDate.setDate(epochDate.getDate() + offsetDays);
  
  return `${String(targetDate.getMonth() + 1).padStart(2, '0')}.${String(targetDate.getDate()).padStart(2, '0')}`;
}

/**
 * Цикл 16 дней: 14 дней матчей + 2 дня перехода.
 * СЕЗОН 1 НАЧИНАЕТСЯ: 17 Июня 2026 00:00 MSK.
 */
export function getGlobalSeasonInfo() {
  const mskNow = getMoscowTime();
  const epochDate = new Date('2026-06-17T00:00:00+03:00');
  
  const diffMs = mskNow.getTime() - epochDate.getTime();
  
  // КОРРЕКЦИЯ: Если мы до старта эпохи (например 16 июня)
  if (diffMs < 0) {
    return {
      seasonDay: 1, 
      seasonNumber: 1,
      isTransitionPhase: true,
      activeSeasonNumber: 1
    };
  }

  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const cycleDuration = 16; 
  let currentSeasonDay = (diffDays % cycleDuration) + 1;
  let currentSeasonNumber = Math.floor(diffDays / cycleDuration) + 1;

  const isTransitionPhase = currentSeasonDay >= 15;
  const effectiveSeason = isTransitionPhase ? currentSeasonNumber + 1 : currentSeasonNumber;
  
  return {
    seasonDay: currentSeasonDay,
    seasonNumber: currentSeasonNumber,
    isTransitionPhase,
    activeSeasonNumber: effectiveSeason
  };
}

export function calculateLiveAge(baseAge: number, hiredAtIso: string) {
  const hiredAt = new Date(hiredAtIso).getTime();
  const now = getMoscowTime().getTime();
  const daysPassed = (now - hiredAt) / (1000 * 60 * 60 * 24);
  const seasonsPassed = daysPassed / 16; 
  const age = baseAge + seasonsPassed;
  return { numeric: age, display: age.toFixed(1) };
}
