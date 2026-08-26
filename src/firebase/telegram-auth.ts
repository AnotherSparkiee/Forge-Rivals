'use client';

/**
 * @fileOverview Модуль интеграции Telegram Auth v1.1.
 * Теперь только авторизует пользователя, не создавая игровой профиль автоматически.
 */

import { Auth, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { initializeFirebase } from './index';

/**
 * Генерирует детерминированные учетные данные для Telegram пользователя.
 */
export function getTelegramCredentials(tgId: number) {
  return {
    email: `tg_${tgId}@telegram.lote`,
    password: `pass_tg_${tgId}_lote_secure_2026`
  };
}

/**
 * Автоматически входит или регистрирует пользователя через Telegram.
 * Направляет пользователя на этап Setup, не создавая профиль в БД.
 */
export async function syncTelegramUser(auth: Auth, tgUser: any) {
  const { email, password } = getTelegramCredentials(tgUser.id);

  try {
    // 1. Попытка входа
    await signInWithEmailAndPassword(auth, email, password);
    return { status: 'logged_in' };
  } catch (error: any) {
    if (error.code === 'auth/user-not-found' || error.code === 'auth/invalid-credential' || error.code === 'auth/invalid-email') {
      // 2. Если пользователя нет, создаем только Auth-аккаунт
      try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        return { status: 'registered', userId: userCredential.user.uid };
      } catch (regError) {
        console.error("TG Registration failed", regError);
        throw regError;
      }
    }
    throw error;
  }
}
