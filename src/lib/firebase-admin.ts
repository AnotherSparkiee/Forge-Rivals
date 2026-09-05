
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';

/**
 * @fileOverview Инициализация Firebase Admin SDK v1.8.
 * Единая точка доступа для всех Server Actions.
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
        // Режим для Firebase App Hosting / Cloud Functions
        initializeApp();
      }
    }
    db = getFirestore();
    return db;
  } catch (error: any) {
    console.error("[FIREBASE ADMIN] Critical Initialization Failure:", error.message);
    throw new Error("SERVER_DATABASE_UNAVAILABLE");
  }
}

// Константа для быстрого доступа в серверных модулях
export const adminDb = {} as Firestore; // Используйте getAdminDb() вместо этого
