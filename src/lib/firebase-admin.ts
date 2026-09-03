import { initializeApp, getApps, cert, getApp } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';

/**
 * @fileOverview Инициализация Firebase Admin SDK v1.7.
 * Использует функцию-геттер для предотвращения ошибок при импорте в разных средах.
 */

let db: Firestore | null = null;

export function getAdminDb(): Firestore {
  if (db) return db;

  try {
    if (getApps().length === 0) {
      const serviceAccountJson = process.env.FIREBASE_ADMIN_SDK;
      
      if (serviceAccountJson && serviceAccountJson.trim().startsWith('{')) {
        initializeApp({
          credential: cert(JSON.parse(serviceAccountJson)),
        });
      } else {
        // Пытаемся инициализироваться без ключа (работает в GCP/Firebase Hosting)
        initializeApp();
      }
    }
    db = getFirestore();
    return db;
  } catch (error: any) {
    console.error("[FIREBASE ADMIN] Critical Initialization Failure:", error.message);
    // Возвращаем пустой объект, который выбросит ошибку только при использовании
    return {} as Firestore;
  }
}

// Экспортируем для обратной совместимости, но рекомендуем использовать getAdminDb()
export const adminDb = {} as Firestore;
