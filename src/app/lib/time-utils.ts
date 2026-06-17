/**
 * @fileOverview Ядро времени v22. Внедрена жесткая виртуальная эпоха 2026 года.
 */

/**
 * Возвращает "Виртуальное время Москвы".
 * К текущему реальному времени добавляется смещение, чтобы в игре всегда был Июнь 2026.
 */
export function getMoscowTime(): Date {
  const now = new Date();
  
  // MSK Offset (UTC+3)
  const mskOffset = (now.getTimezoneOffset() + 180) * 60000;
  const currentMsk = new Date(now.getTime() + mskOffset);

  // Целевая дата: 17 июня 2026
  const virtualEpoch = new Date('2026-06-17T00:00:00+03:00');
  // Реальная дата написания этого кода (точка отсчета)
  const realReference = new Date('2025-02-21T00:00:00+03:00');
  
  const offsetMs = virtualEpoch.getTime() - realReference.getTime();

  return new Date(currentMsk.getTime() + offsetMs);
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
  const info = getGlobalSeasonInfo();
  const epochDate = new Date('2026-06-17T00:00:00+03:00');
  const targetDate = new Date(epochDate);
  
  const offsetDays = (info.activeSeasonNumber - 1) * 16 + (dayOfSeason - 1);
  targetDate.setDate(epochDate.getDate() + offsetDays);
  
  return `${String(targetDate.getMonth() + 1).padStart(2, '0')}.${String(targetDate.getDate()).padStart(2, '0')}`;
}

export function getGlobalSeasonInfo() {
  const mskNow = getMoscowTime();
  const epochDate = new Date('2026-06-17T00:00:00+03:00');
  
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
 * ПРОВЕРКА ПРОСРОЧКИ МАТЧА
 */
export function isMatchOverdue(startTimeIso: string): boolean {
  const mskNow = getMoscowTime();
  const start = new Date(startTimeIso);
  // Если виртуальное время Москвы больше времени старта + 5 секунд
  return mskNow.getTime() > (start.getTime() + 5000);
}

export function calculateLiveAge(baseAge: number, hiredAtIso: string) {
  const hiredAt = new Date(hiredAtIso).getTime();
  const mskNow = getMoscowTime().getTime();
  const daysPassed = (mskNow - hiredAt) / (1000 * 60 * 60 * 24);
  const seasonsPassed = daysPassed / 16; 
  const age = baseAge + seasonsPassed;
  return { numeric: age, display: age.toFixed(1) };
}
