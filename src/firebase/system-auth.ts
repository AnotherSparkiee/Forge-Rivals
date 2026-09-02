
'use client';

import { signInWithEmailAndPassword } from 'firebase/auth';
import { initializeFirebase } from './index';

/**
 * @fileOverview Централизованный модуль системной авторизации.
 * Предотвращает избыточные входы, если сессия уже активна.
 */

const SYSTEM_EMAIL = "system@internal.mobamanageronline.app";

/**
 * Аутентификация как системный аккаунт для привилегированных операций.
 * Проверяет текущую сессию перед попыткой входа.
 */
export async function authenticateAsSystem() {
  const { auth } = initializeFirebase();
  
  // Если пользователь уже вошел и это системный аккаунт - пропускаем вход
  if (auth.currentUser?.email === SYSTEM_EMAIL) {
    return;
  }

  const password = process.env.SYSTEM_ACCOUNT_PASSWORD;
  if (!password) {
    throw new Error("SYSTEM_AUTH_CRITICAL_ERROR: Password missing in environment");
  }

  try {
    await signInWithEmailAndPassword(auth, SYSTEM_EMAIL, password);
  } catch (e) {
    console.error("[SYSTEM AUTH FAILED]", e);
    throw new Error("SYSTEM_AUTH_FAILED");
  }
}
