
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
  const diffDays = dayOfSeason - info.seasonDay;
  
  const targetDate = new Date(mskNow);
  targetDate.setDate(mskNow.getDate() + diffDays);
  
  const m = String(targetDate.getMonth() + 1).padStart(2, '0');
  const d = String(targetDate.getDate()).padStart(2, '0');
  return `${m}.${d}`;
}

/**
 * Возвращает ISO строку конца текущего дня по МСК (23:59:59)
 */
export function getEndOfMoscowDay(): string {
  const msk = getMoscowTime();
  msk.setHours(23, 59, 59, 999);
  return msk.toISOString();
}

/**
 * Рассчитывает возраст игрока с учетом прогрессии времени.
 */
export function calculateLiveAge(baseAge: number, hiredAt: string) {
  const hired = new Date(hiredAt).getTime();
  const now = getMoscowTime().getTime();
  // 1 реальный день = ~0.1 года прогрессии
  const diffDays = (now - hired) / (1000 * 60 * 60 * 24);
  const age = baseAge + (diffDays * 0.1);
  return {
    numeric: age,
    display: age.toFixed(1)
  };
}

/**
 * Глобальный расчет сезона. 
 * Цикл: 16 дней.
 * День 1-14: Матчи.
 * День 15: Переход (16:00 MSK).
 * День 16: Межсезонье.
 * 
 * RESET FOR SEASON 1: Epoch adjusted so Day 1 starts TOMORROW.
 */
export function getGlobalSeasonInfo() {
  const mskNow = getMoscowTime();
  
  // Мы хотим, чтобы завтра был День 1 Сезона 1.
  // Значит сегодня (mskNow) должен быть День 16 Сезона 0.
  const today = new Date(mskNow);
  today.setHours(0,0,0,0);
  
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  
  // Эпоха — это начало Дня 1 Сезона 1.
  const epoch = tomorrow.getTime(); 

  const diffMs = mskNow.getTime() - epoch;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  const cycleDuration = 16; 
  // Модульное смещение для диапазона 1-16
  let currentSeasonDay = ((diffDays % cycleDuration) + cycleDuration) % cycleDuration + 1;
  let currentSeasonNumber = Math.floor(diffDays / cycleDuration) + 1;
  
  // Принудительная коррекция для старта
  if (currentSeasonNumber < 1) currentSeasonNumber = 1;

  const isTransitionTime = currentSeasonDay === 15 && mskNow.getHours() >= 16;
  
  return {
    seasonDay: currentSeasonDay,
    seasonNumber: currentSeasonNumber,
    isTransitionPhase: currentSeasonDay === 15,
    isAfterTransition: isTransitionTime || currentSeasonDay > 15,
    msUntilTransition: 0
  };
}

export function isMatchDue(startTimeStr: string): boolean {
  const mskNow = getMoscowTime();
  const [matchHour, matchMinutes] = startTimeStr.split(':').map(Number);
  const currentHour = mskNow.getHours();
  const currentMinute = mskNow.getMinutes();

  if (currentHour > matchHour) return true;
  if (currentHour === matchHour && currentMinute >= (matchMinutes || 0)) return true;
  return false;
}
