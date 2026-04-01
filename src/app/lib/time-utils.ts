/**
 * Utility to handle Moscow Time (MSK) formatting and calculations.
 */

export function getMoscowTime(): Date {
  // Moscow is UTC+3.
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
 * Calculates the global season info based on a fixed epoch.
 * New cycle: 16 days (14 days of matches + 2 days of break).
 */
export function getGlobalSeasonInfo() {
  const mskNow = getMoscowTime();
  // Fixed Epoch: Jan 1st, 2024
  const epoch = Date.UTC(2024, 0, 1);
  const nowUtc = Date.UTC(mskNow.getFullYear(), mskNow.getMonth(), mskNow.getDate());
  
  const diffDays = Math.floor((nowUtc - epoch) / (1000 * 60 * 60 * 24));
  const cycleDuration = 16; // 14 matches + 2 days off-season
  
  const currentSeasonDay = (diffDays % cycleDuration) + 1;
  const currentSeasonNumber = Math.floor(diffDays / cycleDuration) + 1;
  
  // Calculate when THIS specific season cycle started
  const seasonStartMsk = new Date(mskNow);
  seasonStartMsk.setDate(mskNow.getDate() - (currentSeasonDay - 1));
  
  const year = seasonStartMsk.getFullYear();
  const month = String(seasonStartMsk.getMonth() + 1).padStart(2, '0');
  const day = String(seasonStartMsk.getDate()).padStart(2, '0');
  const seasonStartDateStr = `${year}-${month}-${day}`;

  return {
    seasonDay: currentSeasonDay,
    seasonNumber: currentSeasonNumber,
    seasonStartDate: seasonStartDateStr
  };
}

/**
 * Checks if a match should be triggered based on league start time
 */
export function isMatchDue(startTimeStr: string, lastMatchDateStr: string | null): boolean {
  const mskNow = getMoscowTime();
  const todayStr = getMoscowDateString();
  
  // If already played today, not due
  if (lastMatchDateStr === todayStr) return false;

  const [matchHour, matchMinutes] = startTimeStr.split(':').map(Number);
  const currentHour = mskNow.getHours();
  const currentMinute = mskNow.getMinutes();

  // Trigger if we are at or past the match hour
  if (currentHour > matchHour) return true;
  if (currentHour === matchHour && currentMinute >= (matchMinutes || 0)) return true;

  return false;
}

/**
 * Calculates the Pyramid Cup match time (Fixed at 07:00 MSK for all)
 */
export function getPyramidCupTime(leagueStartTime?: string): string {
  // Disregard leagueStartTime, user requested fixed 07:00 finish for Cup
  return "07:00";
}
