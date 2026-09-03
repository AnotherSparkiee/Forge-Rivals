/**
 * @fileOverview Серверные задачи по расписанию (Google Cloud Scheduler).
 * Использует Firebase Functions v2 для вызова API-эндпоинтов автоматизации Next.js.
 */

const { onSchedule } = require("firebase-functions/v2/scheduler");
const { logger } = require("firebase-functions");

// Конфигурация безопасности
const CRON_SECRET = process.env.CRON_SECRET;
// Ссылка на ваше основное приложение
const APP_URL = process.env.APP_URL || "https://studio-2788872209.web.app"; 

if (!CRON_SECRET) {
  logger.error("[CRON] CRON_SECRET environment variable is missing!");
}

/**
 * 1. РАСЧЕТ МАТЧЕЙ (Каждые 5 минут)
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