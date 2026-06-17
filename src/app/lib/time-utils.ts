/**
 * @fileOverview Ядро времени v27. Абсолютная синхронизация с эпохой 17 июня 2026.
 * Исключает использование некорректных строковых форматов дат в базе.
 */

/**
 * Возвращает "Виртуальное время Москвы".
 * Физически переносит систему в 17 июня 2026 года.
 */
export function getMoscowTime(): Date {
  const now = new Date();
  
  // MSK Offset (UTC+3)
  const mskOffset = (now.getTimezoneOffset() + 180) * 60000;
  const currentMsk = new Date(now.getTime() + mskOffset);

  // Виртуальный старт: 17 июня 2026 00:00:00
  const virtualEpoch = new Date('2026-06-17T00:00:00+03:00');
  // Реальная точка отсчета (февраль 2025)
  const realReference = new Date('2025-02-21T00:00:00+03:00');
  
  // Постоянное смещение (481 день)
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

/**
 * Расчет текущего игрового дня и сезона.
 */
export function getGlobalSeasonInfo() {
  const mskNow = getMoscowTime();
  const epochDate = new Date('2026-06-17T00:00:00+03:00');
  
  const diffMs = mskNow.getTime() - epochDate.getTime();
  const cycleDuration = 16; 
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  let currentSeasonDay = ((diffDays % cycleDuration) + cycleDuration) % cycleDuration + 1;
  let currentSeasonNumber = Math.floor(diffMs / (1000 * 60 * 60 * 24 * cycleDuration)) + 1;

  const isTransitionPhase = currentSeasonDay >= 15;
  const effectiveSeason = isTransitionPhase ? currentSeasonNumber + 1 : currentSeasonNumber;
  
  return {
    seasonDay: Number(Math.max(1, currentSeasonDay)),
    seasonNumber: Number(Math.max(1, currentSeasonNumber)),
    isTransitionPhase,
    activeSeasonNumber: Number(Math.max(1, effectiveSeason))
  };
}

/**
 * Проверяет, должен ли матч быть уже рассчитан.
 * Сравнивает виртуальное время Москвы с временем старта из документа.
 */
export function isMatchOverdue(startTimeIso: string): boolean {
  const mskNow = getMoscowTime();
  const start = new Date(startTimeIso);
  // Запас 5 секунд на синхронизацию
  return mskNow.getTime() > (start.getTime() + 5000);
}

export function getSeasonDateLabel(dayOfSeason: number): string {
  const info = getGlobalSeasonInfo();
  const epochDate = new Date('2026-06-17T00:00:00+03:00');
  const targetDate = new Date(epochDate);
  
  const offsetDays = (info.activeSeasonNumber - 1) * 16 + (dayOfSeason - 1);
  targetDate.setDate(epochDate.getDate() + offsetDays);
  
  return `${String(targetDate.getMonth() + 1).padStart(2, '0')}.${String(targetDate.getDate()).padStart(2, '0')}`;
}
