
/**
 * @fileOverview Серверные задачи по расписанию (Google Cloud Scheduler).
 * Использует Firebase Functions v2 для вызова API-эндпоинтов автоматизации Next.js.
 */

const { onSchedule } = require("firebase-functions/v2/scheduler");
const { logger } = require("firebase-functions");

// Конфигурация безопасности
const CRON_SECRET = "lote_secure_cron_token_2026";
// Ссылка на ваше основное приложение (будет работать через внутреннюю сеть или публичный URL)
const APP_URL = "https://studio-2788872209.web.app"; 

/**
 * 1. РАСЧЕТ МАТЧЕЙ (Каждые 5 минут)
 * Задача: автоматический расчет завершенных игр во всех лигах.
 */
exports.resolveMatchesCron = onSchedule("every 5 minutes", async (event) => {
  try {
    const res = await fetch(`${APP_URL}/api/cron/resolve-matches`, {
      headers: { 'Authorization': `Bearer ${CRON_SECRET}` }
    });
    logger.info(`[CRON] Match resolution triggered. Status: ${res.status}`);
  } catch (error) {
    logger.error("[CRON] Match resolution failed", error);
  }
});

/**
 * 2. ПОДГОТОВКА СЛЕДУЮЩЕГО СЕЗОНА (16:05 MSK / 13:05 UTC)
 * Задача: создание таблиц и календаря для нового сезона за день до старта.
 */
exports.generateNextSeasonCron = onSchedule("05 13 * * *", async (event) => {
  try {
    const res = await fetch(`${APP_URL}/api/cron/generate-next-season`, {
      headers: { 'Authorization': `Bearer ${CRON_SECRET}` }
    });
    logger.info(`[CRON] Next season generation triggered. Status: ${res.status}`);
  } catch (error) {
    logger.error("[CRON] Next season generation failed", error);
  }
});

/**
 * 3. АКТИВАЦИЯ НОВОГО СЕЗОНА (18:05 MSK / 15:05 UTC)
 * Задача: официальное переключение activeSeasonNumber и отмена старых игр.
 */
exports.activateNextSeasonCron = onSchedule("05 15 * * *", async (event) => {
  try {
    const res = await fetch(`${APP_URL}/api/cron/activate-season`, {
      headers: { 'Authorization': `Bearer ${CRON_SECRET}` }
    });
    logger.info(`[CRON] Season activation triggered. Status: ${res.status}`);
  } catch (error) {
    logger.error("[CRON] Season activation failed", error);
  }
});
