import { initializeApp, getApps, getApp, FirebaseApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore, initializeFirestore } from "firebase/firestore";
import { firebaseConfig } from "./config";

/**
 * Returns initialized Firebase services.
 * This function is isomorphic and can be called from both client and server (Server Actions).
 */
function getSdks(app: FirebaseApp) {
  // Check if we need to initialize with specific settings
  // In cloud environments like Google Cloud Workstations, long polling is often more reliable
  let firestore;
  try {
    firestore = getFirestore(app);
  } catch (e) {
    // If not initialized, use specialized initialization
    firestore = initializeFirestore(app, {
      experimentalForceLongPolling: true,
    });
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
    const app = getApp();
    // Return existing instances
    return {
      firebaseApp: app,
      auth: getAuth(app),
      firestore: getFirestore(app),
    };
  }

  const app = initializeApp(firebaseConfig);
  // Initialize Firestore with long polling for reliability in proxied environments
  const firestore = initializeFirestore(app, {
    experimentalForceLongPolling: true,
  });

  return {
    firebaseApp: app,
    auth: getAuth(app),
    firestore,
  };
}

// Export all providers and hooks
export * from './provider';
export * from './client-provider';
export * from './firestore/use-collection';
export * from './firestore/use-doc';
export * from './non-blocking-updates';
export * from './non-blocking-login';
