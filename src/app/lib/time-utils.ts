/**
 * @fileOverview Ядро времени v29. Абсолютная синхронизация с эпохой 2026.
 * Текущая дата: 18 июня 2026 (Межсезонье).
 * Старт сезона: 20 июня 2026.
 */

/**
 * Возвращает "Виртуальное время Москвы".
 * Гарантирует, что в игре сейчас Июнь 2026 года.
 */
export function getMoscowTime(): Date {
  const now = new Date();
  
  // MSK Offset (UTC+3)
  const mskOffset = (now.getTimezoneOffset() + 180) * 60000;
  const currentMsk = new Date(now.getTime() + mskOffset);

  // Если системные часы УЖЕ в 2026 году (июнь или позже)
  if (currentMsk.getFullYear() === 2026 && currentMsk.getMonth() >= 5) {
    return currentMsk;
  }

  // Если системные часы УШЛИ в будущее (2027+)
  if (currentMsk.getFullYear() > 2026) {
    const clamped = new Date(currentMsk);
    clamped.setFullYear(2026);
    // Если мы в октябре 2027, станем октябрем 2026 (что тоже не айс для старта), 
    // поэтому форсируем Июнь для чистоты теста
    if (clamped.getMonth() > 5) {
      clamped.setMonth(5); // Июнь
      clamped.setDate(18); // 18 число
    }
    return clamped;
  }

  // Виртуальное "Сегодня": 18 июня 2026
  const virtualToday = new Date('2026-06-18T12:00:00+03:00');
  // Реальная точка отсчета (сегодняшний день разработки)
  const realReference = new Date('2025-02-22T12:00:00+03:00');
  
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
  const epochDate = new Date('2026-06-20T00:00:00+03:00');
  const targetDate = new Date(epochDate);
  targetDate.setDate(epochDate.getDate() + (dayOfSeason - 1));
  
  const d = String(targetDate.getDate()).padStart(2, '0');
  const m = String(targetDate.getMonth() + 1).padStart(2, '0');
  const y = targetDate.getFullYear();
  
  return `${d}.${m}.${y}`;
}

/**
 * Рассчитывает текущий возраст на основе базового возраста и даты найма.
 */
export function calculateLiveAge(baseAge: number, hiredAt: string) {
  const mskNow = getMoscowTime();
  const hiredDate = new Date(hiredAt);
  const diffMs = mskNow.getTime() - hiredDate.getTime();
  
  const msInYear = 1000 * 60 * 60 * 24 * 365.25;
  const diffYears = diffMs / msInYear;
  
  const currentAge = Number(baseAge || 18) + diffYears;
  
  return {
    numeric: currentAge,
    display: currentAge.toFixed(1)
  };
}
