/**
 * Utility to handle Moscow Time (MSK) formatting and calculations.
 */

export function getMoscowTime(): Date {
  // Moscow is UTC+3. We calculate it by taking the UTC time and adding 3 hours.
  const now = new Date();
  const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
  const mskOffset = 3 * 3600000;
  return new Date(utc + mskOffset);
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
 * Checks if a match should be triggered based on league start time
 * Example startTime: "23:00" -> match starts at 23:00 MSK
 */
export function isMatchDue(startTimeStr: string, lastMatchDateStr: string | null): boolean {
  const mskNow = getMoscowTime();
  const todayStr = getMoscowDateString();
  
  // If already played today, not due
  if (lastMatchDateStr === todayStr) return false;

  const matchHour = parseInt(startTimeStr.split(':')[0], 10);
  const currentHour = mskNow.getHours();

  // Trigger if we are at or past the match hour
  return currentHour >= matchHour;
}
