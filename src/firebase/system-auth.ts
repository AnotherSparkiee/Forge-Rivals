import { signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { initializeFirebase } from './index';

/**
 * @fileOverview Централизованный модуль системной авторизации.
 * Использует учетную запись system@internal.mobamanageronline.app для привилегированных операций.
 */

const SYSTEM_EMAIL = "system@internal.mobamanageronline.app";
const SYSTEM_PASSWORD = "ftorres9";

/**
 * Аутентификация как системный аккаунт.
 * Принудительно использует предоставленный пароль и очищает сессию перед входом.
 */
export async function authenticateAsSystem(): Promise<{ success: boolean; error?: string }> {
  const { auth } = initializeFirebase();
  
  // 1. Если сессия уже активна и это системный аккаунт - пропускаем вход
  if (auth.currentUser?.email === SYSTEM_EMAIL) {
    console.log(`[SYSTEM AUTH] Already authenticated as ${SYSTEM_EMAIL}`);
    return { success: true };
  }

  // 2. Очистка текущей сессии на сервере перед входом администратора
  // Это предотвращает конфликты, если в текущем потоке Server Action был другой юзер
  try {
    if (auth.currentUser) {
      await signOut(auth);
    }
  } catch (e) {
    console.warn("[SYSTEM AUTH] Sign out before login failed, continuing...");
  }

  // 3. Выполняем вход с жестко заданными учетными данными
  try {
    const userCredential = await signInWithEmailAndPassword(auth, SYSTEM_EMAIL, SYSTEM_PASSWORD);
    console.log(`[SYSTEM AUTH SUCCESS] Signed in as ${userCredential.user.email} (UID: ${userCredential.user.uid})`);
    return { success: true };
  } catch (e: any) {
    console.error(`[SYSTEM AUTH FAILURE] Login failed for ${SYSTEM_EMAIL}. Error code: ${e.code}`);
    // Если ошибка invalid-credential, скорее всего не включен Email/Password провайдер в консоли
    return { success: false, error: e.code || "AUTH_UNKNOWN_ERROR" };
  }
}
