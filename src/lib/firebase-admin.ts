import { initializeApp, getApps, cert, App } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';

/**
 * @fileOverview Инициализация Firebase Admin SDK v1.5 (Safe Mode).
 * Предотвращает крах сервера при отсутствии учетных данных.
 */

let db: Firestore;

try {
  let adminApp: App;
  
  if (getApps().length === 0) {
    const serviceAccountJson = process.env.FIREBASE_ADMIN_SDK;
    
    if (serviceAccountJson && serviceAccountJson.trim() !== "") {
      try {
        adminApp = initializeApp({
          credential: cert(JSON.parse(serviceAccountJson)),
        });
      } catch (parseError) {
        console.error("[FIREBASE ADMIN] Invalid FIREBASE_ADMIN_SDK JSON format.");
        throw parseError;
      }
    } else {
      // Пытаемся инициализировать стандартными средствами GCP (работает в App Hosting)
      // Если и это не сработает, выбросит ошибку.
      adminApp = initializeApp();
    }
  } else {
    adminApp = getApps()[0];
  }
  
  db = getFirestore(adminApp);
} catch (initError: any) {
  console.error("[FIREBASE ADMIN] Critical Initialization Failure:", initError.message);
  
  // Создаем прокси, который выбросит ошибку только при попытке доступа к свойствам db.
  // Это предотвращает падение модуля при импорте в Server Actions.
  db = new Proxy({} as Firestore, {
    get: (_, prop) => {
      throw new Error(
        `Firebase Admin SDK is not properly configured. Check your FIREBASE_ADMIN_SDK environment variable. Details: ${initError.message}`
      );
    }
  });
}

export const adminDb = db;
