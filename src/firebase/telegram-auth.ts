'use client';

/**
 * @fileOverview Модуль интеграции Telegram Auth v1.0.
 * Позволяет автоматически авторизовать пользователя на основе его Telegram ID.
 */

import { Auth, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { initializeFirebase } from './index';

/**
 * Генерирует детерминированные учетные данные для Telegram пользователя.
 * В продакшене рекомендуется использовать Custom Tokens через серверную часть.
 * Для прототипа используем фиксированный формат почты.
 */
export function getTelegramCredentials(tgId: number) {
  return {
    email: `tg_${tgId}@telegram.lote`,
    password: `pass_tg_${tgId}_lote_secure_2026`
  };
}

/**
 * Автоматически входит или регистрирует пользователя через Telegram.
 */
export async function syncTelegramUser(auth: Auth, tgUser: any) {
  const { firestore: db } = initializeFirebase();
  const { email, password } = getTelegramCredentials(tgUser.id);

  try {
    // 1. Попытка входа
    await signInWithEmailAndPassword(auth, email, password);
    return { status: 'logged_in' };
  } catch (error: any) {
    if (error.code === 'auth/user-not-found' || error.code === 'auth/invalid-credential') {
      // 2. Если пользователя нет, создаем его
      try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const userId = userCredential.user.uid;
        
        const displayName = tgUser.username || `${tgUser.first_name}${tgUser.last_name ? ' ' + tgUser.last_name : ''}` || "TG Manager";
        
        const profileData = {
          id: userId,
          displayName: displayName,
          email: email,
          tgId: tgUser.id,
          lastLoginDate: new Date().toISOString(),
          createdAt: new Date().toISOString(),
          lastProcessedSeason: 1
        };

        await setDoc(doc(db, 'players_v10', userId), profileData);
        return { status: 'registered', userId };
      } catch (regError) {
        console.error("TG Registration failed", regError);
        throw regError;
      }
    }
    throw error;
  }
}
