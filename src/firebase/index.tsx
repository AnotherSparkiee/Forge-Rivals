import { initializeApp, getApps, getApp, FirebaseApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { firebaseConfig } from "./config";

/**
 * Returns initialized Firebase services.
 * This function is isomorphic and can be called from both client and server (Server Actions).
 */
function getSdks(app: FirebaseApp) {
  return {
    firebaseApp: app,
    auth: getAuth(app),
    firestore: getFirestore(app),
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
// Note: Individual hook files must have 'use client' if they use browser-only features or React hooks.
export * from './provider';
export * from './client-provider';
export * from './firestore/use-collection';
export * from './firestore/use-doc';
export * from './non-blocking-updates';
export * from './non-blocking-login';
