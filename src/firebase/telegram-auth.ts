'use client';

/**
 * @fileOverview Модуль интеграции Telegram Auth v1.2 (Safe Passwords).
 */

import { Auth, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';

function generateSecurePassword() {
  const array = new Uint32Array(8);
  window.crypto.getRandomValues(array);
  return Array.from(array, dec => dec.toString(16).padStart(8, '0')).join('');
}

export async function syncTelegramUser(auth: Auth, tgUser: any) {
  const email = `tg_${tgUser.id}@telegram.lote`;
  
  try {
    // Для существующих пользователей пробуем войти
    // Примечание: в реальной системе пароль должен храниться в защищенном месте
    // или использоваться Telegram Auth Token. Здесь упрощенная версия.
    const mockPass = `pass_tg_${tgUser.id}_secure_2026`;
    await signInWithEmailAndPassword(auth, email, mockPass);
    return { status: 'logged_in' };
  } catch (error: any) {
    if (error.code === 'auth/user-not-found' || error.code === 'auth/invalid-credential') {
      try {
        const securePass = generateSecurePassword();
        const userCredential = await createUserWithEmailAndPassword(auth, email, securePass);
        return { status: 'registered', userId: userCredential.user.uid };
      } catch (regError) {
        console.error("TG Registration failed", regError);
        throw regError;
      }
    }
    throw error;
  }
}
