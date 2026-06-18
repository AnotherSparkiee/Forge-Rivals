/**
 * @fileOverview Ядро времени v30.1. Абсолютная синхронизация с эпохой 2026.
 * Текущая дата: 18 июня 2026 (Межсезонье).
 * Старт сезона: 20 июня 2026.
 */

export function getMoscowTime(): Date {
  const now = new Date();
  
  // MSK Offset (UTC+3)
  const mskOffset = (now.getTimezoneOffset() + 180) * 60000;
  const currentMsk = new Date(now.getTime() + mskOffset);

  // Map real-world time to virtual 2026.
  // If real time is around May 2025, we add ~390 days to hit June 2026.
  // If real time is already 2026, we add minimal offset.
  const needsLargeOffset = currentMsk.getFullYear() < 2026;
  
  let offsetMs = 0;
  if (needsLargeOffset) {
    // Reference: Feb 2025 -> June 2026 (~479 days)
    const virtualToday = new Date('2026-06-18T12:00:00+03:00');
    const realReference = new Date('2025-02-23T12:00:00+03:00');
    offsetMs = virtualToday.getTime() - realReference.getTime();
  }

  const virtualTime = new Date(currentMsk.getTime() + offsetMs);

  // ABSOLUTE SAFETY CLAMP
  // Force 2026 to prevent 2027 drift reported by user
  if (virtualTime.getFullYear() > 2026) {
    virtualTime.setFullYear(2026);
  }
  
  // Force June if we are in June testing phase and drift occurs
  if (virtualTime.getFullYear() === 2026 && virtualTime.getMonth() > 5) {
     virtualTime.setMonth(5); // June is month index 5
     // If we hit late June/July in drift, reset to 18th for offseason feel
     if (virtualTime.getDate() > 20) {
        virtualTime.setDate(18);
     }
  }

  return virtualTime;
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

export function getGlobalSeasonInfo() {
  const mskNow = getMoscowTime();
  const seasonStart = new Date('2026-06-20T00:00:00+03:00');
  
  const isOffseason = mskNow.getTime() < seasonStart.getTime();
  const diffMs = seasonStart.getTime() - mskNow.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (isOffseason) {
    return {
      seasonDay: 0,
      seasonNumber: 1,
      isOffseason: true,
      activeSeasonNumber: 1,
      isTransitionPhase: false,
      startsInMs: diffMs,
      diffDays
    };
  }

  const activeMs = mskNow.getTime() - seasonStart.getTime();
  const cycleDuration = 16; 
  const totalDaysPassed = Math.floor(activeMs / (1000 * 60 * 60 * 24));
  
  let currentSeasonDay = (totalDaysPassed % cycleDuration) + 1;
  let currentSeasonNumber = Math.floor(totalDaysPassed / cycleDuration) + 1;

  return {
    seasonDay: Number(currentSeasonDay),
    seasonNumber: Number(currentSeasonNumber),
    isTransitionPhase: currentSeasonDay >= 15,
    isOffseason: false,
    activeSeasonNumber: currentSeasonDay >= 15 ? currentSeasonNumber + 1 : currentSeasonNumber,
    diffDays: 0
  };
}

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

export function calculateLiveAge(baseAge: number, hiredAt: string) {
  const mskNow = getMoscowTime();
  const hiredDate = new Date(hiredAt);
  const diffMs = mskNow.getTime() - hiredDate.getTime();
  const msInYear = 1000 * 60 * 60 * 24 * 365.25;
  const currentAge = Number(baseAge || 18) + (diffMs / msInYear);
  return { numeric: currentAge, display: currentAge.toFixed(1) };
}
