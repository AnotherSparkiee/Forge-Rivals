'use client';

import { initializeApp, getApps, getApp, FirebaseApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { firebaseConfig } from "./config";

/**
 * Returns initialized Firebase services.
 */
function getSdks(app: FirebaseApp) {
  return {
    firebaseApp: app,
    auth: getAuth(app),
    firestore: getFirestore(app),
  };
}

/**
 * Main initialization function for the client side.
 */
export function initializeFirebase() {
  if (getApps().length > 0) {
    return getSdks(getApp());
  }

  const app = initializeApp(firebaseConfig);
  return getSdks(app);
}

// Export all providers and hooks from centralized locations
export * from './provider';
export * from './client-provider';
export * from './firestore/use-collection';
export * from './firestore/use-doc';
export * from './non-blocking-updates';
export * from './non-blocking-login';
