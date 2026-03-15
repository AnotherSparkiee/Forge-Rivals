
/**
 * Utility to handle Moscow Time (MSK) formatting and calculations.
 */

export function getMoscowTime(): Date {
  // Moscow is UTC+3
  const now = new Date();
  return new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Moscow' }));
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
 * Checks if a match should be triggered based on league start time
 * Example startTime: "08:00 - 12:00" -> match starts at 08:00
 */
export function isMatchDue(startTimeStr: string, lastMatchDateStr: string | null): boolean {
  const mskNow = getMoscowTime();
  const todayStr = `${mskNow.getFullYear()}-${mskNow.getMonth() + 1}-${mskNow.getDate()}`;
  
  // If already played today, not due
  if (lastMatchDateStr === todayStr) return false;

  const matchHour = parseInt(startTimeStr.split(':')[0], 10);
  const currentHour = mskNow.getHours();

  return currentHour >= matchHour;
}
