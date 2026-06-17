/**
 * @fileOverview Ядро времени v28. Абсолютная синхронизация с эпохой 2026.
 * Текущая дата: 18 июня 2026 (Межсезонье).
 * Старт сезона: 20 июня 2026.
 */

/**
 * Возвращает "Виртуальное время Москвы".
 * Физически переносит систему в 18 июня 2026 года.
 */
export function getMoscowTime(): Date {
  const now = new Date();
  
  // MSK Offset (UTC+3)
  const mskOffset = (now.getTimezoneOffset() + 180) * 60000;
  const currentMsk = new Date(now.getTime() + mskOffset);

  // Виртуальное "Сегодня": 18 июня 2026 12:00:00
  const virtualToday = new Date('2026-06-18T12:00:00+03:00');
  // Реальная точка отсчета (день написания кода)
  const realReference = new Date('2025-02-21T12:00:00+03:00');
  
  // Постоянное смещение (482 дня)
  const offsetMs = virtualToday.getTime() - realReference.getTime();

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
  return `${day}.${month}.${date.getFullYear()} ${hours}:${minutes}:${seconds}`;
}

/**
 * Расчет текущего игрового дня и сезона.
 */
export function getGlobalSeasonInfo() {
  const mskNow = getMoscowTime();
  // СТАРТ СЕЗОНА 1: 20 Июня 2026
  const seasonStart = new Date('2026-06-20T00:00:00+03:00');
  
  const isOffseason = mskNow.getTime() < seasonStart.getTime();
  
  if (isOffseason) {
    return {
      seasonDay: 0,
      seasonNumber: 1,
      isOffseason: true,
      activeSeasonNumber: 1,
      isTransitionPhase: false,
      startsInMs: seasonStart.getTime() - mskNow.getTime()
    };
  }

  const diffMs = mskNow.getTime() - seasonStart.getTime();
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
    isOffseason: false,
    activeSeasonNumber: Number(Math.max(1, effectiveSeason))
  };
}

/**
 * Проверяет, должен ли матч быть уже рассчитан.
 */
export function isMatchOverdue(startTimeIso: string): boolean {
  const mskNow = getMoscowTime();
  const start = new Date(startTimeIso);
  return mskNow.getTime() > (start.getTime() + 2000);
}

export function getSeasonDateLabel(dayOfSeason: number): string {
  // Эпоха старта
  const epochDate = new Date('2026-06-20T00:00:00+03:00');
  const targetDate = new Date(epochDate);
  
  // Прибавляем дни (День 1 = смещение 0)
  targetDate.setDate(epochDate.getDate() + (dayOfSeason - 1));
  
  const d = String(targetDate.getDate()).padStart(2, '0');
  const m = String(targetDate.getMonth() + 1).padStart(2, '0');
  const y = targetDate.getFullYear();
  
  return `${d}.${m}.${y}`;
}
