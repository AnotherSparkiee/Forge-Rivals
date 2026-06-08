/**
 * Utility to handle Moscow Time (MSK) formatting and calculations.
 * Ensures consistent behavior across different user local timezones.
 */

export function getMoscowTime(): Date {
  const now = new Date();
  // Get time string in Moscow and parse it back to a Date.
  // This ensures getTime() returns the correct moment regardless of local machine offset.
  const mskString = now.toLocaleString("en-US", { timeZone: "Europe/Moscow" });
  return new Date(mskString);
}

export function getMoscowDateString(): string {
  const msk = getMoscowTime();
  const year = msk.getFullYear();
  const month = String(msk.getMonth() + 1).padStart(2, '0');
  const day = String(msk.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getEndOfMoscowDay(): string {
  const msk = getMoscowTime();
  const endOfDay = new Date(msk);
  endOfDay.setDate(msk.getDate() + 1);
  endOfDay.setHours(0, 0, 0, 0);
  return endOfDay.toISOString();
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
  // Get current MSK date at 00:00:00 UTC for consistent day counting
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
  return "07:00";
}

/**
 * Calculates live age based on hiring date and base age.
 * NEW RULE: 1 real month (30 days) = 1 game year (12 months).
 * This means 1 game month = 2.5 real days.
 * @returns Object containing years, months and string representation
 */
export function calculateLiveAge(baseAge: number, hiredAt: string) {
  const mskNow = getMoscowTime();
  const hiredDate = new Date(hiredAt);
  
  // Calculate diff in milliseconds and then days
  const diffMs = mskNow.getTime() - hiredDate.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  
  // 2.5 real days = 1 in-game month
  const monthsElapsed = Math.floor(diffDays / 2.5);
  const totalMonths = (baseAge * 12) + monthsElapsed;
  
  const years = Math.floor(totalMonths / 12);
  const months = totalMonths % 12;
  
  return {
    years,
    months,
    display: `${years}.${months}`,
    numeric: years + (months / 12)
  };
}