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
  
  // Если пароль не задан в переменных окружения (например, при локальной разработке)
  // мы не выбрасываем критическую ошибку, а позволяем коду продолжить работу.
  // Это предотвращает падение Server Actions. Если правила БД отклонят запись - 
  // ошибка будет обработана на уровне Firestore.
  if (!password) {
    console.warn("SYSTEM_AUTH_WARNING: SYSTEM_ACCOUNT_PASSWORD missing in environment. Privileged operations might fail at DB level.");
    return;
  }

  try {
    await signInWithEmailAndPassword(auth, SYSTEM_EMAIL, password);
  } catch (e) {
    console.error("[SYSTEM AUTH FAILED] System service could not log in:", e);
    // Не выбрасываем ошибку, чтобы не блокировать основной поток выполнения
  }
}
