import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { initializeFirebase } from './index';

/**
 * @fileOverview Централизованный модуль системной авторизации v1.5 (Optimized for Server Actions).
 */

const SYSTEM_EMAIL = "system@internal.mobamanageronline.app";

// Кэшируем credential в рамках жизненного цикла процесса Node.js
let systemUserCredential: any = null;

/**
 * Аутентификация как системный аккаунт.
 * Оптимизировано для Server Actions: убраны проверки состояния и добавлено кэширование.
 */
export async function authenticateAsSystem(): Promise<{ success: boolean; error?: string }> {
  const { auth } = initializeFirebase();
  
  // 1. Возвращаем кэшированный результат, если он есть
  if (systemUserCredential) {
    return { success: true };
  }

  const password = process.env.SYSTEM_ACCOUNT_PASSWORD;
  
  if (!password) {
    console.error(`[SYSTEM AUTH] CRITICAL: SYSTEM_ACCOUNT_PASSWORD is not defined.`);
    return { success: false, error: "PASSWORD_MISSING_IN_ENV" };
  }

  try {
    // 2. Попытка входа
    systemUserCredential = await signInWithEmailAndPassword(auth, SYSTEM_EMAIL, password.trim());
    console.log(`[SYSTEM AUTH SUCCESS] Authorized as admin.`);
    return { success: true };
  } catch (e: any) {
    // 3. Если пользователя нет - пытаемся создать
    if (e.code === 'auth/user-not-found' || e.code === 'auth/invalid-credential' || e.code === 'auth/invalid-email') {
      try {
        console.log(`[SYSTEM AUTH] Bootstrapping system account...`);
        systemUserCredential = await createUserWithEmailAndPassword(auth, SYSTEM_EMAIL, password.trim());
        return { success: true };
      } catch (regError: any) {
        if (regError.code === 'auth/email-already-in-use') {
          return { success: false, error: "SYSTEM_EMAIL_EXISTS_BUT_PASSWORD_MISMATCH" };
        }
        console.error(`[SYSTEM AUTH FAILURE] Bootstrap failed:`, regError.code);
        return { success: false, error: regError.code };
      }
    }
    
    console.error(`[SYSTEM AUTH FAILURE] Login failed:`, e.code);
    return { success: false, error: e.code || "AUTH_UNKNOWN_ERROR" };
  }
}
