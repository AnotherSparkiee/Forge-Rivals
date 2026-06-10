
/**
 * @fileOverview Математическое ядро системы прогрессии игроков.
 * Реализует формулы XP, талантов, влияния инфраструктуры и бесконечного OVR.
 */

import { Role } from './moba-data';

export type ActivityType = 'daily' | 'league' | 'cup' | 'friendly' | 'scrim' | 'tournament_ext' | 'trial';

export const ROLE_CORE_SKILLS: Record<Role, string[]> = {
  'Carry': ['lastHitting', 'positioning', 'reflexes', 'tiltResistance', 'versatility'],
  'Midlaner': ['reflexes', 'lastHitting', 'ganking', 'positioning', 'tiltResistance'],
  'Tank': ['objectiveControl', 'positioning', 'ganking', 'tiltResistance', 'versatility'],
  'Jungler': ['ganking', 'objectiveControl', 'reflexes', 'communication', 'versatility'],
  'Support': ['communication', 'reflexes', 'positioning', 'objectiveControl', 'tiltResistance']
};

/**
 * Рассчитывает коэффициент таланта (Мягкий кап).
 */
export function calculateTalentMultiplier(currentValue: number, talentValue: number): number {
  if (currentValue >= 100) return 0;
  if (currentValue >= talentValue) return 0.01;
  
  const threshold = talentValue * 0.9;
  if (currentValue < threshold) return 1.0;
  
  // Зона торможения: линейное затухание от 1.0 до 0.0
  return (talentValue - currentValue) / (talentValue - threshold);
}

/**
 * Рассчитывает итоговый опыт за действие.
 */
export function calculateXpGain(params: {
  activity: ActivityType;
  currentValue: number;
  talentValue: number;
  infra: { bootcamp: number; research: number; psychologist: number };
  matchResult?: { win: boolean; mvp: boolean; great: boolean; fail: boolean };
  matchesToday: number;
}): number {
  if (params.currentValue >= 100) return 0;

  // 1. Базовые значения
  let baseXP = 0;
  switch (params.activity) {
    case 'daily': baseXP = 100; break;
    case 'league': baseXP = 150; break;
    case 'cup': baseXP = 180; break;
    case 'friendly': 
    case 'trial': baseXP = 50; break;
    case 'scrim': baseXP = 50; break;
    case 'tournament_ext': baseXP = 90; break;
  }

  // 2. Модификаторы матча
  if (params.matchResult && params.activity !== 'daily') {
    if (params.matchResult.win) baseXP += 30;
    if (params.matchResult.mvp) baseXP += 50;
    if (params.matchResult.great) baseXP += 20;
    if (params.matchResult.fail) baseXP -= 20;
    baseXP = Math.max(10, baseXP);
  }

  // 3. Влияние инфраструктуры
  const bootcampMod = 1 + (params.infra.bootcamp * 0.04);
  
  let researchMod = 0;
  let psychologistMod = 0;
  
  const isUnofficial = ['friendly', 'trial', 'scrim', 'tournament_ext'].includes(params.activity);
  
  if (isUnofficial) {
    researchMod = params.infra.research * 0.05;
    psychologistMod = params.infra.psychologist * 0.02;
  }

  // Бонус высокого уровня (только PRO > 70)
  let highLevelResearchBonus = 1.0;
  if (params.currentValue > 70) {
    highLevelResearchBonus = 1 + (params.infra.research * 0.02);
  }

  // 4. Коэффициент таланта
  const talentMod = calculateTalentMultiplier(params.currentValue, params.talentValue);

  // 5. Коэффициент усталости
  // Каждый последующий матч -25% XP. 1-й = 0% штраф, 2-й = 25% и т.д.
  const fatiguePenaltyBase = Math.max(0, params.matchesToday - 1) * 0.25;
  const psychFatigueReduction = params.infra.psychologist * 0.03;
  const finalFatiguePenalty = Math.max(0, fatiguePenaltyBase - psychFatigueReduction);
  const fatigueMod = Math.min(1.0, 1.0 - finalFatiguePenalty);

  // 6. Финальная сборка
  let totalXP = 0;
  
  if (params.activity === 'daily') {
    totalXP = baseXP * bootcampMod * talentMod;
    if (params.currentValue > 70) totalXP *= highLevelResearchBonus;
  } else if (isUnofficial) {
    totalXP = baseXP * (bootcampMod + researchMod + psychologistMod) * talentMod * fatigueMod;
  } else {
    // Официальные матчи
    totalXP = baseXP * bootcampMod * talentMod * fatigueMod;
  }

  return Math.round(totalXP);
}

/**
 * Рассчитывает Бесконечный Динамический OVR героя.
 */
export function calculateHeroOVR(
  role: Role, 
  stats: Record<string, number>,
  totalMatches: number = 0,
  moral: number = 50,
  titles: { league: number; cup: number; friendly: number } = { league: 0, cup: 0, friendly: 0 }
): number {
  const coreKeys = ROLE_CORE_SKILLS[role];
  const allKeys = Object.keys(stats);
  const secondaryKeys = allKeys.filter(k => !coreKeys.includes(k));
  
  const coreSum = coreKeys.reduce((acc, k) => acc + (stats[k] || 0), 0);
  const secondarySum = secondaryKeys.reduce((acc, k) => acc + (stats[k] || 0), 0);
  
  const avgCore = coreSum / 5;
  const avgSecondary = secondarySum / 5;
  
  // 1. Базовый OVR (Макс 100)
  const baseOvr = (avgCore * 0.7) + (avgSecondary * 0.3);
  
  // 2. Match Multiplier (Бесконечный рост)
  const matchMultiplier = 1 + (Math.sqrt(totalMatches) / 20);
  
  // 3. Mood Multiplier (Мораль 50 = 1.0x)
  const moodMultiplier = 0.9 + (moral / 500);
  
  // 4. Legacy Bonus (Титулы)
  const legacyBonus = (titles.league * 5) + (titles.cup * 8) + (titles.friendly * 1);
  
  // Финальный расчет
  return Math.round(baseOvr * matchMultiplier * moodMultiplier) + legacyBonus;
}
