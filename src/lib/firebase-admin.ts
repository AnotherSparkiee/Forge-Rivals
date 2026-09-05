
import { initializeApp, getApps, cert, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';

/**
 * @fileOverview Инициализация Firebase Admin SDK v3.0.
 * Единственный источник истины для серверного доступа.
 */

let adminApp: App | null = null;

export function getAdminDb(): Firestore {
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
    
    return getFirestore(adminApp!);
  } catch (error: any) {
    console.error("[FIREBASE ADMIN] Initialization Failure:", error.message);
    throw new Error("SERVER_DATABASE_UNAVAILABLE");
  }
}
