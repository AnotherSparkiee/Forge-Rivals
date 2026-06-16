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

export function getSeasonDateLabel(dayOfSeason: number): string {
  const mskNow = getMoscowTime();
  const info = getGlobalSeasonInfo();
  const targetDate = new Date(mskNow);
  
  if (info.isTransitionPhase) {
    const daysUntilNewSeason = (17 - info.seasonDay);
    targetDate.setDate(mskNow.getDate() + daysUntilNewSeason + (dayOfSeason - 1));
  } else {
    const diffDays = dayOfSeason - info.seasonDay;
    targetDate.setDate(mskNow.getDate() + diffDays);
  }
  
  return `${String(targetDate.getMonth() + 1).padStart(2, '0')}.${String(targetDate.getDate()).padStart(2, '0')}`;
}

/**
 * Цикл 16 дней: 14 дней матчей + 2 дня перехода.
 * СЕЗОН 1 НАЧИНАЕТСЯ: 17 Июня 2026 00:00 MSK.
 */
export function getGlobalSeasonInfo() {
  const mskNow = getMoscowTime();
  // ФИКСИРОВАННАЯ ЭПОХА: 17 июня 2026
  const epochDate = new Date('2026-06-17T00:00:00+03:00');
  
  const diffMs = mskNow.getTime() - epochDate.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  const cycleDuration = 16; 
  let currentSeasonDay = ((diffDays % cycleDuration) + cycleDuration) % cycleDuration + 1;
  let currentSeasonNumber = Math.floor(diffDays / cycleDuration) + 1;
  
  // Если мы до эпохи (например 16 июня), ставим сезон 1, день подготовки
  if (diffMs < 0) {
    currentSeasonNumber = 1;
    currentSeasonDay = 16 + Math.floor(diffMs / (1000 * 60 * 60 * 24));
  }

  const isTransitionPhase = currentSeasonDay >= 15 || currentSeasonNumber < 1;
  const effectiveSeason = isTransitionPhase ? Math.max(1, currentSeasonNumber + 1) : Math.max(1, currentSeasonNumber);
  
  return {
    seasonDay: currentSeasonDay,
    seasonNumber: Math.max(1, currentSeasonNumber),
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
