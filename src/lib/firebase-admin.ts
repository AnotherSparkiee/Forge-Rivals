import { initializeApp, getApps, cert, getApp } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';

/**
 * @fileOverview Инициализация Firebase Admin SDK v1.6 (Ultra Safe).
 * Гарантирует, что сервер не упадет даже при полном отсутствии конфига.
 */

let db: Firestore;

try {
  if (getApps().length === 0) {
    const serviceAccountJson = process.env.FIREBASE_ADMIN_SDK;
    
    if (serviceAccountJson && serviceAccountJson.trim().startsWith('{')) {
      try {
        initializeApp({
          credential: cert(JSON.parse(serviceAccountJson)),
        });
      } catch (parseError) {
        console.error("[FIREBASE ADMIN] JSON Parse Error. Falling back to default.");
        initializeApp();
      }
    } else {
      // Пытаемся инициализироваться без ключа (работает в GCP/Firebase Hosting)
      initializeApp();
    }
  }
  db = getFirestore();
} catch (initError: any) {
  console.error("[FIREBASE ADMIN] Critical Initialization Failure:", initError.message);
  
  // Создаем прокси, который выбросит ошибку только при обращении к базе.
  // Это предотвращает крах модуля при импорте.
  db = new Proxy({} as Firestore, {
    get: (_, prop) => {
      if (prop === 'collection' || prop === 'runTransaction' || prop === 'batch') {
        return () => {
          throw new Error(`Firebase Admin SDK is not initialized. Please check FIREBASE_ADMIN_SDK env variable.`);
        };
      }
      return undefined;
    }
  });
}

export const adminDb = db;
