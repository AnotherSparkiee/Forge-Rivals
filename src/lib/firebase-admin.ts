import { initializeApp, getApps, cert, App } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';

let adminApp: App;

if (getApps().length === 0) {
  const serviceAccountJson = process.env.FIREBASE_ADMIN_SDK;
  if (!serviceAccountJson) {
    throw new Error('FIREBASE_ADMIN_SDK environment variable is missing');
  }
  
  adminApp = initializeApp({
    credential: cert(JSON.parse(serviceAccountJson)),
  });
} else {
  adminApp = getApps()[0];
}

export const adminDb: Firestore = getFirestore(adminApp);
export { adminApp };
