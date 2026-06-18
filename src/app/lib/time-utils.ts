/**
 * @fileOverview Ядро времени v36. Абсолютная синхронизация Сезона 1.
 * 
 * Цикл: 15 дней.
 * Дни 1-14: Активные матчи сезона.
 * День 15: Межсезонье. В 16:00 — генерация СЛЕДУЮЩЕГО сезона.
 * ЭПОХА (S1 Day 1): 20.06.2026
 */

export function getMoscowTime(): Date {
  const now = new Date();
  
  /**
   * ПИВОТ ВРЕМЕНИ (v36)
   * Реальное: 26.02.2025 (текущий момент разработки)
   * Виртуальное: 18.06.2026 (сегодня в игре)
   */
  const realReference = new Date('2025-02-26T00:00:00+03:00').getTime();
  const virtualReference = new Date('2026-06-18T00:00:00+03:00').getTime();
  const offsetMs = virtualReference - realReference;

  return new Date(now.getTime() + offsetMs);
}

/**
 * Форматирует время для нижнего терминала: "18.06 14:05:01"
 */
export function formatTerminalTime(date: Date): string {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  
  return `${day}.${month} ${hours}:${minutes}:${seconds}`;
}

export function getMoscowDateString(): string {
  const msk = getMoscowTime();
  const year = msk.getFullYear();
  const month = String(msk.getMonth() + 1).padStart(2, '0');
  const day = String(msk.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getGlobalSeasonInfo() {
  const mskNow = getMoscowTime();
  
  /**
   * ЭПОХА СЕЗОНА 1: Старт 20.06.2026 00:00
   */
  const epoch = new Date('2026-06-20T00:00:00+03:00');
  
  const diffMs = mskNow.getTime() - epoch.getTime();
  const totalDaysPassed = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  const cycleDuration = 15; 

  let seasonNumber: number;
  let dayOfCycle: number;

  if (totalDaysPassed < 0) {
    // Период ДО старта Сезона 1 (18.06 - 19.06)
    seasonNumber = 1;
    // 18.06 -> Day 14 (totalDaysPassed = -2)
    // 19.06 -> Day 15 (totalDaysPassed = -1)
    dayOfCycle = totalDaysPassed === -1 ? 15 : (totalDaysPassed === -2 ? 14 : 1);
  } else {
    // Период после старта Сезона 1
    seasonNumber = Math.floor(totalDaysPassed / cycleDuration) + 1;
    dayOfCycle = (totalDaysPassed % cycleDuration) + 1;
  }

  // Межсезонье: 15-й день цикла ИЛИ любой день до старта S1
  const isOffseason = dayOfCycle === 15 || totalDaysPassed < 0;
  const isGenerationDay = dayOfCycle === 15;
  
  // Расчет времени до начала следующего (или первого) сезона
  let nextSeasonStartDate: Date;
  if (totalDaysPassed < 0) {
    nextSeasonStartDate = epoch;
  } else {
    const cyclesPassed = Math.floor(totalDaysPassed / cycleDuration) + 1;
    nextSeasonStartDate = new Date(epoch.getTime() + (cyclesPassed * cycleDuration * 24 * 60 * 60 * 1000));
  }
  
  const timeToStartMs = nextSeasonStartDate.getTime() - mskNow.getTime();

  return {
    seasonDay: (isOffseason) ? 0 : dayOfCycle,
    dayOfCycle,
    seasonNumber: Math.max(1, seasonNumber),
    activeSeasonNumber: isGenerationDay ? seasonNumber + 1 : seasonNumber,
    isOffseason,
    isGenerationDay,
    timeToStartMs: Math.max(0, timeToStartMs),
    nextSeasonStart: nextSeasonStartDate
  };
}

export function isMatchOverdue(startTimeIso: string): boolean {
  const mskNow = getMoscowTime();
  const start = new Date(startTimeIso);
  return mskNow.getTime() > (start.getTime() + 2000);
}

export function getSeasonDateLabel(dayOfSeason: number, seasonNumber: number = 1): string {
  const epoch = new Date('2026-06-20T00:00:00+03:00');
  const cycleDuration = 15;
  const seasonStartOffset = (seasonNumber - 1) * cycleDuration;
  const targetDate = new Date(epoch.getTime() + (seasonStartOffset + dayOfSeason - 1) * 24 * 60 * 60 * 1000);
  
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