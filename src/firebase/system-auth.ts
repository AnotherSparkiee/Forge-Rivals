import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { initializeFirebase } from './index';

/**
 * @fileOverview Централизованный модуль системной авторизации v1.8 (Verification Bypass Fix).
 */

const SYSTEM_EMAIL = "system@internal.mobamanageronline.app";

// Кэшируем credential в рамках жизненного цикла процесса Node.js
let systemUserCredential: any = null;

/**
 * Аутентификация как системный аккаунт.
 * Оптимизировано для Server Actions: гарантированное ожидание токена.
 */
export async function authenticateAsSystem(): Promise<{ success: boolean; error?: string; uid?: string }> {
  const { auth } = initializeFirebase();
  
  // 1. Возвращаем кэшированный результат, если пользователь всё еще в системе
  if (systemUserCredential && auth.currentUser?.email === SYSTEM_EMAIL) {
    return { success: true, uid: auth.currentUser.uid };
  }

  const password = process.env.SYSTEM_ACCOUNT_PASSWORD;
  
  if (!password) {
    console.error(`[SYSTEM AUTH] CRITICAL: SYSTEM_ACCOUNT_PASSWORD is not defined.`);
    return { success: false, error: "PASSWORD_MISSING_IN_ENV" };
  }

  try {
    // 2. Попытка входа
    systemUserCredential = await signInWithEmailAndPassword(auth, SYSTEM_EMAIL, password.trim());
    
    // Принудительно обновляем токен для получения свежих Claims
    await auth.currentUser?.getIdToken(true);
    
    console.log(`[SYSTEM AUTH SUCCESS] Authorized as ${SYSTEM_EMAIL} (${auth.currentUser?.uid})`);
    return { success: true, uid: auth.currentUser?.uid };
  } catch (e: any) {
    // Если пароль не совпал, сбрасываем кэш
    if (e.code === 'auth/wrong-password' || e.code === 'auth/invalid-credential') {
      console.warn(`[SYSTEM AUTH] Password mismatch for ${SYSTEM_EMAIL}. Attempting to clean session...`);
      await signOut(auth);
    }

    // 3. Если пользователя нет - пытаемся создать
    if (e.code === 'auth/user-not-found' || e.code === 'auth/invalid-credential') {
      try {
        console.log(`[SYSTEM AUTH] Bootstrapping system account...`);
        systemUserCredential = await createUserWithEmailAndPassword(auth, SYSTEM_EMAIL, password.trim());
        await auth.currentUser?.getIdToken(true);
        return { success: true, uid: auth.currentUser?.uid };
      } catch (regError: any) {
        if (regError.code === 'auth/email-already-in-use') {
          console.error(`[SYSTEM AUTH FAILURE] Password mismatch for ${SYSTEM_EMAIL}. Delete user in console to reset.`);
          return { success: false, error: "SYSTEM_EMAIL_EXISTS_BUT_PASSWORD_MISMATCH" };
        }
        return { success: false, error: regError.code };
      }
    }
    
    console.error(`[SYSTEM AUTH FAILURE] Login failed:`, e.code);
    return { success: false, error: e.code || "AUTH_UNKNOWN_ERROR" };
  }
}