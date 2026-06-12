
/**
 * @fileOverview Ядро расчетов времени на основе UTC.
 * Все игровые события синхронизированы относительно 00:00 UTC.
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
  // Если мы смотрим следующий сезон, считаем от завтрашнего дня (старта S1)
  const diffDays = dayOfSeason - (info.seasonDay > 14 ? 0 : info.seasonDay);
  
  const targetDate = new Date(mskNow);
  // Если сегодня межсезонье (15-16), то Day 1 — это завтра
  if (info.seasonDay > 14) {
    targetDate.setDate(mskNow.getDate() + (17 - info.seasonDay) + (dayOfSeason - 1));
  } else {
    targetDate.setDate(mskNow.getDate() + diffDays);
  }
  
  const m = String(targetDate.getMonth() + 1).padStart(2, '0');
  const d = String(targetDate.getDate()).padStart(2, '0');
  return `${m}.${d}`;
}

/**
 * Глобальный расчет сезона. 
 * Цикл: 16 дней.
 */
export function getGlobalSeasonInfo() {
  const mskNow = getMoscowTime();
  
  // Устанавливаем Эпоху так, чтобы ЗАВТРА был День 1 Сезона 1.
  // Сегодня — 19 мая. Завтра — 20 мая (Старт).
  const startOfS1 = new Date(mskNow);
  startOfS1.setDate(mskNow.getDate() + 1);
  startOfS1.setHours(0, 0, 0, 0);
  
  const epoch = startOfS1.getTime(); 

  const diffMs = mskNow.getTime() - epoch;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  const cycleDuration = 16; 
  // Сегодня diffDays = -1. 
  // currentSeasonDay = ((-1 % 16) + 16) % 16 + 1 = 16.
  // currentSeasonNumber = floor(-1 / 16) + 1 = -1 + 1 = 0.
  
  let currentSeasonDay = ((diffDays % cycleDuration) + cycleDuration) % cycleDuration + 1;
  let currentSeasonNumber = Math.floor(diffDays / cycleDuration) + 1;
  
  // Мы хотим видеть Сезон 1 уже сегодня (в день подготовки)
  const isPreSeason = currentSeasonNumber === 0;
  const displaySeasonNumber = isPreSeason ? 1 : currentSeasonNumber;
  const displaySeasonDay = isPreSeason ? 16 : currentSeasonDay;

  const isTransitionTime = displaySeasonDay === 15 && mskNow.getHours() >= 16;
  
  return {
    seasonDay: displaySeasonDay,
    seasonNumber: displaySeasonNumber,
    isTransitionPhase: displaySeasonDay === 15,
    isAfterTransition: isTransitionTime || displaySeasonDay > 15
  };
}
