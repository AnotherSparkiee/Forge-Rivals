import { signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { initializeFirebase } from './index';

/**
 * @fileOverview Централизованный модуль системной авторизации.
 * Использует учетную запись system@internal.mobamanageronline.app.
 * ПАРОЛЬ ЧИТАЕТСЯ ТОЛЬКО ИЗ ПЕРЕМЕННЫХ ОКРУЖЕНИЯ (СЕКРЕТОВ).
 */

const SYSTEM_EMAIL = "system@internal.mobamanageronline.app";

/**
 * Аутентификация как системный аккаунт.
 * Использует секрет SYSTEM_ACCOUNT_PASSWORD из Firebase App Hosting.
 */
export async function authenticateAsSystem(): Promise<{ success: boolean; error?: string }> {
  const { auth } = initializeFirebase();
  
  // 1. Если сессия уже активна и это системный аккаунт - пропускаем вход
  if (auth.currentUser?.email === SYSTEM_EMAIL) {
    return { success: true };
  }

  // 2. Получение пароля из окружения (БЕЗОПАСНО)
  const password = process.env.SYSTEM_ACCOUNT_PASSWORD;
  
  if (!password) {
    const isDev = process.env.NODE_ENV === 'development';
    const errorMsg = isDev 
      ? "PASSWORD_MISSING: For local development, ensure SYSTEM_ACCOUNT_PASSWORD is in your .env file."
      : "PASSWORD_MISSING: Ensure the secret is set via 'firebase apphosting:secrets:set SYSTEM_ACCOUNT_PASSWORD'";
    
    console.error(`[SYSTEM AUTH] CRITICAL: ${errorMsg}`);
    return { success: false, error: "PASSWORD_MISSING_IN_ENV" };
  }

  // 3. Очистка текущей сессии на сервере перед входом администратора
  try {
    if (auth.currentUser) {
      await signOut(auth);
    }
  } catch (e) {
    // Игнорируем ошибки выхода
  }

  // 4. Выполняем вход
  try {
    // Используем trim() для предотвращения ошибок с пробелами
    const userCredential = await signInWithEmailAndPassword(auth, SYSTEM_EMAIL, password.trim());
    console.log(`[SYSTEM AUTH SUCCESS] Authorized as administrator (UID: ${userCredential.user.uid}).`);
    return { success: true };
  } catch (e: any) {
    console.error(`[SYSTEM AUTH FAILURE] Login failed for ${SYSTEM_EMAIL}: ${e.code}`);
    return { success: false, error: e.code || "AUTH_UNKNOWN_ERROR" };
  }
}
