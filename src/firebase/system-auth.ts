import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { initializeFirebase } from './index';

/**
 * @fileOverview Централизованный модуль системной авторизации v2.1 (No Cache Fix).
 */

const SYSTEM_EMAIL = "system@internal.mobamanageronline.app";

/**
 * Аутентификация как системный аккаунт.
 * Оптимизировано для Server Actions: убрано кэширование во избежание потери контекста авторизации между процессами.
 */
export async function authenticateAsSystem(): Promise<{ success: boolean; error?: string; uid?: string }> {
  const { auth } = initializeFirebase();
  
  // 1. Проверяем живой auth state
  if (auth.currentUser?.email === SYSTEM_EMAIL) {
    await auth.currentUser.getIdToken(true);
    return { success: true, uid: auth.currentUser.uid };
  }

  const password = process.env.SYSTEM_ACCOUNT_PASSWORD;
  
  if (!password) {
    console.error(`[SYSTEM AUTH] CRITICAL: SYSTEM_ACCOUNT_PASSWORD is not defined.`);
    return { success: false, error: "PASSWORD_MISSING_IN_ENV" };
  }

  try {
    // 2. Попытка входа
    await signInWithEmailAndPassword(auth, SYSTEM_EMAIL, password.trim());
    
    // Принудительно обновляем токен для передачи в Firestore
    await auth.currentUser?.getIdToken(true);
    
    return { success: true, uid: auth.currentUser?.uid };
  } catch (e: any) {
    // 3. Если пользователя нет - пытаемся создать
    if (e.code === 'auth/user-not-found' || e.code === 'auth/invalid-credential' || e.code === 'auth/invalid-email') {
      try {
        await createUserWithEmailAndPassword(auth, SYSTEM_EMAIL, password.trim());
        await auth.currentUser?.getIdToken(true);
        return { success: true, uid: auth.currentUser?.uid };
      } catch (regError: any) {
        if (regError.code === 'auth/email-already-in-use') {
          return { success: false, error: "SYSTEM_EMAIL_EXISTS_BUT_PASSWORD_MISMATCH" };
        }
        return { success: false, error: regError.code };
      }
    }
    
    console.error(`[SYSTEM AUTH FAILURE] Login failed:`, e.code);
    return { success: false, error: e.code || "AUTH_UNKNOWN_ERROR" };
  }
}
