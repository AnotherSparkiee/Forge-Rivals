'use client';

/**
 * @fileOverview Модуль интеграции Telegram Auth v1.4 (Secure Client Salt).
 */

import { Auth, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';

/**
 * Генерирует стабильный пароль на основе ID пользователя и системного секрета.
 */
function getDeterministicPassword(tgUserId: string | number) {
  // Используем публичный соль для клиента
  const salt = process.env.NEXT_PUBLIC_TELEGRAM_SALT || "lote_fallback_salt_2026";
  const input = `tg_${tgUserId}_${salt}`;
  
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return `pass_${Math.abs(hash).toString(16)}_${tgUserId}`;
}

export async function syncTelegramUser(auth: Auth, tgUser: any) {
  const email = `tg_${tgUser.id}@telegram.lote`;
  const password = getDeterministicPassword(tgUser.id);
  
  try {
    await signInWithEmailAndPassword(auth, email, password);
    return { status: 'logged_in' };
  } catch (error: any) {
    if (error.code === 'auth/user-not-found' || error.code === 'auth/invalid-credential') {
      try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        return { status: 'registered', userId: userCredential.user.uid };
      } catch (regError) {
        console.error("TG Deterministic Registration failed", regError);
        throw regError;
      }
    }
    throw error;
  }
}