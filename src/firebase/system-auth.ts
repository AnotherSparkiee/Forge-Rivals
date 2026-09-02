import { signInWithEmailAndPassword } from 'firebase/auth';
import { initializeFirebase } from './index';

/**
 * @fileOverview Централизованный модуль системной авторизации.
 * Использует учетную запись system@internal.mobamanageronline.app для привилегированных операций.
 */

const SYSTEM_EMAIL = "system@internal.mobamanageronline.app";

/**
 * Аутентификация как системный аккаунт.
 * Проверяет текущую сессию перед попыткой входа для экономии лимитов Auth.
 */
export async function authenticateAsSystem(): Promise<{ success: boolean; error?: string }> {
  const { auth } = initializeFirebase();
  
  // 1. Если сессия уже активна и это системный аккаунт - пропускаем вход
  if (auth.currentUser?.email === SYSTEM_EMAIL) {
    return { success: true };
  }

  // 2. Получаем пароль из переменных окружения (секретов)
  const password = process.env.SYSTEM_ACCOUNT_PASSWORD;
  
  if (!password) {
    console.error("[SYSTEM AUTH CRITICAL] 'SYSTEM_ACCOUNT_PASSWORD' is not set in environment secrets.");
    return { success: false, error: "PASSWORD_MISSING" };
  }

  try {
    // 3. Выполняем вход
    await signInWithEmailAndPassword(auth, SYSTEM_EMAIL, password);
    console.log(`[SYSTEM AUTH SUCCESS] Authenticated as ${SYSTEM_EMAIL}`);
    return { success: true };
  } catch (e: any) {
    console.error(`[SYSTEM AUTH FAILURE] ${SYSTEM_EMAIL} login failed:`, e.code, e.message);
    
    // Возвращаем конкретный код ошибки для диагностики на клиенте
    return { success: false, error: e.code || "AUTH_UNKNOWN_ERROR" };
  }
}
