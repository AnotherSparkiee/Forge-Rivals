
'use server';

/**
 * @fileOverview Заглушка серверных действий. 
 * Логика перенесена на клиент для корректной работы правил безопасности Firestore.
 */

export async function findStrategicPlacement(leagueId: string) {
  // Функция оставлена для обратной совместимости, но логика теперь внутри SetupPage или клиентских утилит
  return { tier: 9, group: 1 };
}

export async function ensureWorldInitialized() {
  return { success: true };
}
