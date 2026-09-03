import { initializeApp, getApps, cert, App } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';

let adminApp: App;

if (getApps().length === 0) {
  const serviceAccountJson = process.env.FIREBASE_ADMIN_SDK;
  
  if (serviceAccountJson) {
    adminApp = initializeApp({
      credential: cert(JSON.parse(serviceAccountJson)),
    });
  } else {
    // Attempt to initialize with Application Default Credentials (works in App Hosting/GCP)
    adminApp = initializeApp();
  }
} else {
  adminApp = getApps()[0];
}

export const adminDb: Firestore = getFirestore(adminApp);
export { adminApp };
