
/**
 * @fileOverview Серверная логика расчета времени матчей.
 * Исключает Race Conditions при планировании Лиги и Кубка.
 */

export function getMoscowTime(): Date {
  const now = new Date();
  return new Date(now.toLocaleString("en-US", { timeZone: "Europe/Moscow" }));
}

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
 * Возвращает ISO строку конца текущего дня по МСК (23:59:59)
 */
export function getEndOfMoscowDay(): string {
  const msk = getMoscowTime();
  msk.setHours(23, 59, 59, 999);
  return msk.toISOString();
}

/**
 * Рассчитывает время Кубка Пирамиды.
 * ПРАВИЛО: Время Лиги (X) - 12 часов.
 */
export function getPyramidCupTime(leagueStartTime: string): string {
  const [hours, minutes] = leagueStartTime.split(':').map(Number);
  let cupHours = hours - 12;
  if (cupHours < 0) cupHours += 24;
  return `${String(cupHours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

/**
 * Рассчитывает возраст игрока с учетом прогрессии времени.
 */
export function calculateLiveAge(baseAge: number, hiredAt: string) {
  const hired = new Date(hiredAt).getTime();
  const now = getMoscowTime().getTime();
  // 1 реальный день = ~0.1 года прогрессии для динамики
  const diffDays = (now - hired) / (1000 * 60 * 60 * 24);
  const age = baseAge + (diffDays * 0.1);
  return {
    numeric: age,
    display: age.toFixed(1)
  };
}

export function getGlobalSeasonInfo() {
  const mskNow = getMoscowTime();
  const epoch = Date.UTC(2024, 0, 1);
  const nowUtc = Date.UTC(mskNow.getFullYear(), mskNow.getMonth(), mskNow.getDate());
  const diffDays = Math.floor((nowUtc - epoch) / (1000 * 60 * 60 * 24));
  const cycleDuration = 16; 
  const currentSeasonDay = (diffDays % cycleDuration) + 1;
  const currentSeasonNumber = Math.floor(diffDays / cycleDuration) + 1;
  
  return {
    seasonDay: currentSeasonDay,
    seasonNumber: currentSeasonNumber
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
