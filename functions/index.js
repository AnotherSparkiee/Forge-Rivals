
const functions = require('firebase-functions');
const admin = require('firebase-admin');

/**
 * @fileOverview Централизованные облачные функции ядра v140.
 * Использует Admin SDK для гарантированного доступа.
 */

admin.initializeApp();
const db = admin.firestore();

/**
 * Инициализация клуба (Callable).
 * Перенесено из Server Actions для максимальной надежности.
 */
exports.initializeClub = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Auth required');
  }

  const { clubName } = data;
  const userId = context.auth.uid;
  const email = context.auth.token.email || `user_${userId}@lote.io`;

  // Мы вызываем логику из общего серверного модуля через обертку,
  // но здесь реализуем её напрямую для исключения проблем с путями в Node.js
  try {
    const { provisionClubComplete } = require('./provisioning'); // Локальный хелпер в папке functions
    return await provisionClubComplete(userId, email, clubName);
  } catch (e) {
    console.error("Cloud function crash:", e);
    throw new functions.https.HttpsError('internal', e.message);
  }
});

/**
 * Глобальный планировщик мира.
 * Запускается каждые 5 минут для продвижения состояний сезона.
 */
exports.seasonOrchestrator = functions.pubsub.schedule('every 5 minutes').onRun(async (context) => {
  const configRef = db.collection('system_v1').doc('season_config');
  const configSnap = await configRef.get();
  const config = configSnap.data() || { activeSeasonNumber: 1, phase: 'REGULAR_SEASON' };

  console.log(`[ORCHESTRATOR] Current Phase: ${config.phase}, Season: ${config.activeSeasonNumber}`);

  // Здесь вызывается логика из src/app/actions/season-cycle.ts
  // В продакшене рекомендуется вызывать через fetch защищенный API роут приложения
  const APP_URL = "https://studio-2788872209.web.app"; 
  const CRON_SECRET = process.env.CRON_SECRET || 'lote_secure_cron_token_2026';
  
  try {
    await fetch(`${APP_URL}/api/cron/season-orchestrator`, {
      headers: { 'Authorization': `Bearer ${CRON_SECRET}` }
    });
  } catch (err) {
    console.error("Orchestrator ping failed:", err);
  }
});
