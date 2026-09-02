import { signInWithEmailAndPassword } from 'firebase/auth';
import { initializeFirebase } from './index';

/**
 * @fileOverview Централизованный модуль системной авторизации.
 * Использует учетную запись system@internal.mobamanageronline.app для привилегированных операций.
 */

const SYSTEM_EMAIL = "system@internal.mobamanageronline.app";
// Резервный пароль, предоставленный пользователем
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

  // 2. Получаем пароль и очищаем от возможных пробелов при копировании
  const rawPassword = process.env.SYSTEM_ACCOUNT_PASSWORD || FALLBACK_PASSWORD;
  const password = rawPassword.trim();
  
  try {
    // 3. Выполняем вход
    const userCredential = await signInWithEmailAndPassword(auth, SYSTEM_EMAIL, password);
    console.log(`[SYSTEM AUTH SUCCESS] Signed in as ${userCredential.user.email} (UID: ${userCredential.user.uid})`);
    return { success: true };
  } catch (e: any) {
    // Выводим только код ошибки для безопасности
    console.error(`[SYSTEM AUTH FAILURE] Login failed for ${SYSTEM_EMAIL}. Error code: ${e.code}`);
    return { success: false, error: e.code || "AUTH_UNKNOWN_ERROR" };
  }
}
