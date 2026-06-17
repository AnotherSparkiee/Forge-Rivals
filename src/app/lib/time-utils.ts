/**
 * @fileOverview Ядро времени. Эпоха сезона 1 перенесена на 2024 год для активации системы в реальном времени.
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
 * Рассчитывает отображаемую дату для конкретного дня сезона.
 * День 1 Сезона 1 = 17 июня 2024.
 */
export function getSeasonDateLabel(dayOfSeason: number): string {
  const info = getGlobalSeasonInfo();
  const epochDate = new Date('2024-06-17T00:00:00+03:00');
  const targetDate = new Date(epochDate);
  
  const offsetDays = (info.activeSeasonNumber - 1) * 16 + (dayOfSeason - 1);
  targetDate.setDate(epochDate.getDate() + offsetDays);
  
  return `${String(targetDate.getMonth() + 1).padStart(2, '0')}.${String(targetDate.getDate()).padStart(2, '0')}`;
}

/**
 * Цикл 16 дней. Сезон 1 начался 17 июня 2024.
 */
export function getGlobalSeasonInfo() {
  const mskNow = getMoscowTime();
  const epochDate = new Date('2024-06-17T00:00:00+03:00');
  
  const diffMs = mskNow.getTime() - epochDate.getTime();
  const cycleDuration = 16; 
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  let currentSeasonDay = ((diffDays % cycleDuration) + cycleDuration) % cycleDuration + 1;
  let currentSeasonNumber = Math.floor(diffDays / cycleDuration) + 1;

  const isTransitionPhase = currentSeasonDay >= 15;
  const effectiveSeason = isTransitionPhase ? currentSeasonNumber + 1 : currentSeasonNumber;
  
  return {
    seasonDay: currentSeasonDay,
    seasonNumber: currentSeasonNumber,
    isTransitionPhase,
    activeSeasonNumber: Math.max(1, effectiveSeason)
  };
}

/**
 * ПРОВЕРКА ПРОСРОЧКИ МАТЧА (V18 Reality Check)
 * Сравнивает время начала матча с текущим временем Москвы.
 */
export function isMatchOverdue(startTimeIso: string): boolean {
  const mskNow = getMoscowTime();
  const start = new Date(startTimeIso);
  // Если сейчас больше времени старта + 10 секунд буфера
  return mskNow.getTime() > (start.getTime() + 10000);
}

export function calculateLiveAge(baseAge: number, hiredAtIso: string) {
  const hiredAt = new Date(hiredAtIso).getTime();
  const now = getMoscowTime().getTime();
  const daysPassed = (now - hiredAt) / (1000 * 60 * 60 * 24);
  const seasonsPassed = daysPassed / 16; 
  const age = baseAge + seasonsPassed;
  return { numeric: age, display: age.toFixed(1) };
}
