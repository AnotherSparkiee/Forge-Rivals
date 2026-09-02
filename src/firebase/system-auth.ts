import { signInWithEmailAndPassword } from 'firebase/auth';
import { initializeFirebase } from './index';

/**
 * @fileOverview Централизованный модуль системной авторизации.
 * Исправлено: возвращает статус успеха для использования в логике.
 */

const SYSTEM_EMAIL = "system@internal.mobamanageronline.app";

/**
 * Аутентификация как системный аккаунт для привилегированных операций.
 * Проверяет текущую сессию перед попыткой входа.
 */
export async function authenticateAsSystem(): Promise<boolean> {
  const { auth } = initializeFirebase();
  
  // Если пользователь уже вошел и это системный аккаунт - пропускаем вход
  if (auth.currentUser?.email === SYSTEM_EMAIL) {
    return true;
  }

  const password = process.env.SYSTEM_ACCOUNT_PASSWORD;
  
  if (!password) {
    console.warn("SYSTEM_AUTH_WARNING: SYSTEM_ACCOUNT_PASSWORD missing in environment. Using current session.");
    return false;
  }

  try {
    await signInWithEmailAndPassword(auth, SYSTEM_EMAIL, password);
    return true;
  } catch (e) {
    console.error("[SYSTEM AUTH FAILED] System service could not log in:", e);
    return false;
  }
}
