
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
  
  const targetDate = new Date(mskNow);
  
  // Если мы находимся в межсезонье (15-16), то Day 1 — это начало нового цикла
  if (info.seasonDay >= 15) {
    const daysUntilNewSeason = 17 - info.seasonDay;
    targetDate.setDate(mskNow.getDate() + daysUntilNewSeason + (dayOfSeason - 1));
  } else {
    // Внутри сезона
    const diffDays = dayOfSeason - info.seasonDay;
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
  
  // Точка отсчета Сезона 1. 
  // Мы настраиваем ее так, чтобы ПЕРВЫЙ МАТЧ был завтра (или сегодня, если уже наступил день 1)
  // Для этого за дату старта берем "завтра 00:00"
  const startOfS1 = new Date(mskNow);
  startOfS1.setDate(mskNow.getDate() + 1);
  startOfS1.setHours(0, 0, 0, 0);
  
  const epoch = startOfS1.getTime(); 
  const diffMs = mskNow.getTime() - epoch;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  const cycleDuration = 16; 
  
  // Если diffDays < 0 (мы до старта Сезона 1), это Season 1, Day 16 (Prep)
  let currentSeasonDay = ((diffDays % cycleDuration) + cycleDuration) % cycleDuration + 1;
  let currentSeasonNumber = Math.floor(diffDays / cycleDuration) + 1;
  
  // В период подготовки (день 15-16) мы уже считаем себя частью БУДУЩЕГО сезона для генерации
  const isTransitionTime = currentSeasonDay === 15 && mskNow.getHours() >= 16;
  
  return {
    seasonDay: currentSeasonDay,
    seasonNumber: currentSeasonNumber,
    isTransitionPhase: currentSeasonDay === 15,
    isAfterTransition: isTransitionTime || currentSeasonDay > 15
  };
}

/**
 * Возвращает конец московского дня (для истечения аукционов)
 */
export function getEndOfMoscowDay(): string {
  const now = getMoscowTime();
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  return end.toISOString();
}
