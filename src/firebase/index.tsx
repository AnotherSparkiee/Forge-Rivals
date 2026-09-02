import { initializeApp, getApps, getApp, FirebaseApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore, initializeFirestore } from "firebase/firestore";
import { firebaseConfig } from "./config";

/**
 * Returns initialized Firebase services.
 * This function is isomorphic and can be called from both client and server (Server Actions).
 */
function getSdks(app: FirebaseApp) {
  let firestore;
  try {
    // В облачных средах принудительное включение long polling повышает стабильность
    firestore = initializeFirestore(app, {
      experimentalForceLongPolling: true,
    });
  } catch (e) {
    // Если Firestore уже инициализирован, просто получаем инстанс
    firestore = getFirestore(app);
  }

  return {
    firebaseApp: app,
    auth: getAuth(app),
    firestore,
  };
}

/**
 * Main initialization function.
 * Safe to call on the server in Next.js Server Actions.
 */
export function initializeFirebase() {
  if (getApps().length > 0) {
    return getSdks(getApp());
  }

  const app = initializeApp(firebaseConfig);
  return getSdks(app);
}

// Export all providers and hooks
export * from './provider';
export * from './client-provider';
export * from './firestore/use-collection';
export * from './firestore/use-doc';
export * from './non-blocking-updates';
export * from './non-blocking-login';
