import { signInWithEmailAndPassword } from 'firebase/auth';
import { initializeFirebase } from './index';

/**
 * @fileOverview Централизованный модуль системной авторизации.
 * Использует учетную запись system@internal.mobamanageronline.app для привилегированных операций.
 */

const SYSTEM_EMAIL = "system@internal.mobamanageronline.app";
// Пароль, предоставленный пользователем, как резервный вариант
const FALLBACK_PASSWORD = "ftorres9";

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

  // 2. Получаем пароль из секретов или используем fallback
  const password = process.env.SYSTEM_ACCOUNT_PASSWORD || FALLBACK_PASSWORD;
  
  if (!password) {
    console.warn("[SYSTEM AUTH] Warning: No password found in environment or fallback.");
    return { success: false, error: "PASSWORD_MISSING" };
  }

  try {
    // 3. Выполняем вход
    await signInWithEmailAndPassword(auth, SYSTEM_EMAIL, password);
    console.log(`[SYSTEM AUTH SUCCESS] Authenticated as ${SYSTEM_EMAIL}`);
    return { success: true };
  } catch (e: any) {
    console.error(`[SYSTEM AUTH FAILURE] ${SYSTEM_EMAIL} login failed:`, e.code, e.message);
    return { success: false, error: e.code || "AUTH_UNKNOWN_ERROR" };
  }
}
