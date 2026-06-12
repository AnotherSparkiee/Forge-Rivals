/**
 * @fileOverview Ядро расчетов времени на основе UTC.
 * Все игровые события синхронизированы относительно фиксированной эпохи.
 */

/**
 * Возвращает текущее время по Москве (UTC+3)
 */
export function getMoscowTime(): Date {
  const now = new Date();
  return new Date(now.getTime() + (now.getTimezoneOffset() + 180) * 60000);
}

/**
 * Возвращает текущую дату по Москве в формате YYYY-MM-DD
 */
export function getMoscowDateString(): string {
  const msk = getMoscowTime();
  const year = msk.getFullYear();
  const month = String(msk.getMonth() + 1).padStart(2, '0');
  const day = String(msk.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Форматирует время для отображения в терминале (DD.MM HH:mm:ss)
 */
export function formatMoscowTime(date: Date): string {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${day}.${month} ${hours}:${minutes}:${seconds}`;
}

/**
 * Возвращает дату конкретного дня сезона в формате MM.DD
 */
export function getSeasonDateLabel(dayOfSeason: number): string {
  const mskNow = getMoscowTime();
  const info = getGlobalSeasonInfo();
  
  const targetDate = new Date(mskNow);
  
  if (info.isTransitionPhase) {
    // В фазе подготовки (15-16) мы смотрим на следующий сезон
    const daysUntilNewSeason = (17 - info.seasonDay);
    targetDate.setDate(mskNow.getDate() + daysUntilNewSeason + (dayOfSeason - 1));
  } else {
    // Внутри активного сезона
    const diffDays = dayOfSeason - info.seasonDay;
    targetDate.setDate(mskNow.getDate() + diffDays);
  }
  
  const m = String(targetDate.getMonth() + 1).padStart(2, '0');
  const d = String(targetDate.getDate()).padStart(2, '0');
  return `${m}.${d}`;
}

/**
 * Глобальный расчет сезона. 
 * Цикл: 16 дней (14 игры + 2 переход).
 * СТАТИЧЕСКАЯ ЭПОХА: Сезон 1 начинается 3 Марта 2025 в 00:00 MSK.
 */
export function getGlobalSeasonInfo() {
  const mskNow = getMoscowTime();
  
  // ФИКСИРОВАННАЯ ТОЧКА ОТСЧЕТА (Понедельник, 3 Марта 2025)
  const epochDate = new Date('2025-03-03T00:00:00+03:00');
  
  const diffMs = mskNow.getTime() - epochDate.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  const cycleDuration = 16; 
  
  // Текущий день в цикле (1-16)
  let currentSeasonDay = ((diffDays % cycleDuration) + cycleDuration) % cycleDuration + 1;
  let currentSeasonNumber = Math.floor(diffDays / cycleDuration) + 1;
  
  // Фаза перехода: 15 и 16 дни
  const isTransitionPhase = currentSeasonDay >= 15 || currentSeasonNumber < 1;
  
  const effectiveSeason = Math.max(1, (currentSeasonDay >= 15) ? currentSeasonNumber + 1 : currentSeasonNumber);
  
  return {
    seasonDay: currentSeasonDay,
    seasonNumber: Math.max(1, currentSeasonNumber),
    isTransitionPhase: isTransitionPhase,
    activeSeasonNumber: effectiveSeason
  };
}

/**
 * Возвращает конец московского дня для экспирации маркета
 */
export function getEndOfMoscowDay(): string {
  const now = getMoscowTime();
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  return end.toISOString();
}

/**
 * Возвращает возраст игрока с учетом прошедшего времени
 */
export function calculateLiveAge(baseAge: number, hiredAtIso: string) {
  const hiredAt = new Date(hiredAtIso).getTime();
  const now = getMoscowTime().getTime();
  const daysPassed = (now - hiredAt) / (1000 * 60 * 60 * 24);
  const seasonsPassed = daysPassed / 16; 
  const age = baseAge + seasonsPassed;
  return {
    numeric: age,
    display: age.toFixed(1)
  };
}
