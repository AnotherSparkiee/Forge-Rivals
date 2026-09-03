import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { initializeFirebase } from './index';

/**
 * @fileOverview Централизованный модуль системной авторизации.
 */

const SYSTEM_EMAIL = "system@internal.mobamanageronline.app";

/**
 * Аутентификация как системный аккаунт.
 */
export async function authenticateAsSystem(): Promise<{ success: boolean; error?: string }> {
  const { auth } = initializeFirebase();
  
  if (auth.currentUser?.email === SYSTEM_EMAIL) {
    return { success: true };
  }

  const password = process.env.SYSTEM_ACCOUNT_PASSWORD;
  
  if (!password) {
    console.error(`[SYSTEM AUTH] CRITICAL: SYSTEM_ACCOUNT_PASSWORD is not defined.`);
    return { success: false, error: "PASSWORD_MISSING_IN_ENV" };
  }

  try {
    await signInWithEmailAndPassword(auth, SYSTEM_EMAIL, password.trim());
    console.log(`[SYSTEM AUTH SUCCESS] Authorized as admin.`);
    return { success: true };
  } catch (e: any) {
    if (e.code === 'auth/user-not-found' || e.code === 'auth/invalid-credential') {
      try {
        console.log(`[SYSTEM AUTH] Bootstrapping system account...`);
        await createUserWithEmailAndPassword(auth, SYSTEM_EMAIL, password.trim());
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
