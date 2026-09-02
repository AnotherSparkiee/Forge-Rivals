import { signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { initializeFirebase } from './index';

/**
 * @fileOverview Централизованный модуль системной авторизации.
 * Использует учетную запись system@internal.mobamanageronline.app.
 * ПАРОЛЬ ЧИТАЕТСЯ ИЗ ПЕРЕМЕННЫХ ОКРУЖЕНИЯ (Файл .env или Секреты App Hosting).
 */

const SYSTEM_EMAIL = "system@internal.mobamanageronline.app";

/**
 * Аутентификация как системный аккаунт.
 * Сначала проверяет .env, затем секреты хостинга.
 */
export async function authenticateAsSystem(): Promise<{ success: boolean; error?: string }> {
  const { auth } = initializeFirebase();
  
  // 1. Если сессия уже активна и это системный аккаунт - пропускаем вход
  if (auth.currentUser?.email === SYSTEM_EMAIL) {
    console.log(`[SYSTEM AUTH] Session already active for ${SYSTEM_EMAIL}`);
    return { success: true };
  }

  // 2. Получение пароля из окружения
  // Мы ищем SYSTEM_ACCOUNT_PASSWORD, который теперь прописан в файле .env
  const password = process.env.SYSTEM_ACCOUNT_PASSWORD;
  
  if (!password) {
    console.error(`[SYSTEM AUTH] CRITICAL: SYSTEM_ACCOUNT_PASSWORD is not defined in .env or Secrets.`);
    return { success: false, error: "PASSWORD_MISSING_IN_ENV" };
  }

  // 3. Сброс текущей "зависшей" сессии перед входом администратора
  try {
    await signOut(auth);
  } catch (e) {
    // Игнорируем ошибки выхода
  }

  // 4. Выполняем вход
  try {
    const userCredential = await signInWithEmailAndPassword(auth, SYSTEM_EMAIL, password.trim());
    console.log(`[SYSTEM AUTH SUCCESS] Authorized as admin. UID: ${userCredential.user.uid}`);
    
    // Ждем небольшую паузу для обновления токена в SDK
    await new Promise(resolve => setTimeout(resolve, 200));
    
    return { success: true };
  } catch (e: any) {
    console.error(`[SYSTEM AUTH FAILURE] Login failed for ${SYSTEM_EMAIL}. Error code: ${e.code}`);
    return { success: false, error: e.code || "AUTH_UNKNOWN_ERROR" };
  }
}
