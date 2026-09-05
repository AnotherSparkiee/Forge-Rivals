
import { initializeApp, getApps, cert, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';

/**
 * @fileOverview Инициализация Firebase Admin SDK v2.0.
 * Гарантирует единственный инстанс и безопасный доступ к БД на сервере.
 */

let adminApp: App | null = null;
let db: Firestore | null = null;

export function getAdminDb(): Firestore {
  if (db) return db;

  try {
    if (getApps().length === 0) {
      const serviceAccountJson = process.env.FIREBASE_ADMIN_SDK;
      
      if (serviceAccountJson && serviceAccountJson.trim().startsWith('{')) {
        adminApp = initializeApp({
          credential: cert(JSON.parse(serviceAccountJson)),
        });
      } else {
        // Режим для Firebase App Hosting / Cloud Functions (использует ADC)
        adminApp = initializeApp();
      }
    } else {
      adminApp = getApps()[0];
    }
    
    db = getFirestore(adminApp!);
    return db;
  } catch (error: any) {
    console.error("[FIREBASE ADMIN] Critical Initialization Failure:", error.message);
    throw new Error("SERVER_DATABASE_UNAVAILABLE");
  }
}

// Удаляем пустой экспорт adminDb для предотвращения ошибок импорта
