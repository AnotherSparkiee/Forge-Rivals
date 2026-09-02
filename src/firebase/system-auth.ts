import { signInWithEmailAndPassword } from 'firebase/auth';
import { initializeFirebase } from './index';

/**
 * @fileOverview Централизованный модуль системной авторизации.
 * Обновлен: возвращает детальный статус для диагностики Server Actions.
 */

const SYSTEM_EMAIL = "system@internal.mobamanageronline.app";

/**
 * Аутентификация как системный аккаунт для привилегированных операций.
 * Проверяет текущую сессию перед попыткой входа.
 */
export async function authenticateAsSystem(): Promise<{ success: boolean; error?: string }> {
  const { auth } = initializeFirebase();
  
  // 1. Если пользователь уже вошел и это системный аккаунт - пропускаем вход
  if (auth.currentUser?.email === SYSTEM_EMAIL) {
    return { success: true };
  }

  const password = process.env.SYSTEM_ACCOUNT_PASSWORD;
  
  // 2. Если пароль не задан в секретах
  if (!password) {
    const msg = "SYSTEM_AUTH_PASSWORD_MISSING: Secret 'SYSTEM_ACCOUNT_PASSWORD' is not set in environment.";
    console.warn(msg);
    return { success: false, error: "PASSWORD_MISSING" };
  }

  try {
    // 3. Попытка входа
    await signInWithEmailAndPassword(auth, SYSTEM_EMAIL, password);
    console.log("[SYSTEM AUTH] Successfully logged in as service account.");
    return { success: true };
  } catch (e: any) {
    console.error("[SYSTEM AUTH FAILED] System service could not log in:", e.code, e.message);
    
    // Если пользователя не существует
    if (e.code === 'auth/user-not-found' || e.code === 'auth/invalid-credential') {
      return { success: false, error: "USER_NOT_FOUND_OR_WRONG_PASS" };
    }
    
    return { success: false, error: e.code || "AUTH_UNKNOWN_ERROR" };
  }
}
