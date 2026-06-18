/**
 * @fileOverview Ядро времени v32. Бесконечный цикл сезонов.
 * 
 * Цикл: 15 дней.
 * Дни 1-14: Активные матчи сезона.
 * День 15: Межсезонье. В 16:00 — генерация следующего сезона.
 * День 1 (следующего цикла): Старт нового сезона.
 */

export function getMoscowTime(): Date {
  const now = new Date();
  
  /**
   * СТАБИЛЬНАЯ СИНХРОНИЗАЦИЯ 2026 (v32)
   * Цель: Сделать так, чтобы сегодня (конец февраля 2025) соответствовало 18 июня 2026.
   * Опорная дата (Real): 2025-02-26
   * Опорная дата (Virtual): 2026-06-18
   */
  const realReference = new Date('2025-02-26T12:00:00+03:00').getTime();
  const virtualReference = new Date('2026-06-18T12:00:00+03:00').getTime();
  const offsetMs = virtualReference - realReference;

  // Рассчитываем текущее виртуальное время
  const virtualTime = new Date(now.getTime() + offsetMs);

  // ABSOLUTE SAFETY CLAMP (Фиксация в 2026 году для прототипа)
  if (virtualTime.getFullYear() > 2026) {
    virtualTime.setFullYear(2026);
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
  const year = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${day}.${month}.${year} ${hours}:${minutes}:${seconds}`;
}

export function getGlobalSeasonInfo() {
  const mskNow = getMoscowTime();
  
  /**
   * Эпоха: Начало самого первого цикла.
   * Чтобы 18.06.2026 был 15-м днем, Эпоха должна быть 04.06.2026.
   */
  const epoch = new Date('2026-06-04T00:00:00+03:00');
  
  const diffMs = mskNow.getTime() - epoch.getTime();
  const totalDaysPassed = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  const cycleDuration = 15; // 14 дней игры + 1 день перерыва/генерации
  const currentSeasonNumber = Math.floor(totalDaysPassed / cycleDuration) + 1;
  const dayOfCycle = (totalDaysPassed % cycleDuration) + 1;

  const isOffseason = dayOfCycle === 15;
  const isGenerationDay = dayOfCycle === 15;
  
  // Расчет времени до начала следующего сезона (День 16 / День 1 следующего цикла)
  const nextSeasonStart = new Date(epoch.getTime() + (currentSeasonNumber * cycleDuration * 24 * 60 * 60 * 1000));
  const timeToStartMs = nextSeasonStart.getTime() - mskNow.getTime();

  return {
    seasonDay: dayOfCycle > 14 ? 0 : dayOfCycle,
    dayOfCycle,
    seasonNumber: currentSeasonNumber,
    activeSeasonNumber: isOffseason ? currentSeasonNumber + 1 : currentSeasonNumber,
    isOffseason,
    isGenerationDay,
    timeToStartMs,
    nextSeasonStart
  };
}

export function isMatchOverdue(startTimeIso: string): boolean {
  const mskNow = getMoscowTime();
  const start = new Date(startTimeIso);
  return mskNow.getTime() > (start.getTime() + 2000);
}

export function getSeasonDateLabel(dayOfSeason: number, seasonNumber: number): string {
  const epoch = new Date('2026-06-04T00:00:00+03:00');
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
