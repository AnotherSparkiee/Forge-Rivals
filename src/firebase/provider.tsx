'use client';

import React, { createContext, useContext, ReactNode, useMemo, useState, useEffect } from 'react';
import { FirebaseApp } from 'firebase/app';
import { Firestore } from 'firebase/firestore';
import { Auth, User } from 'firebase/auth';

/**
 * ОФФЛАЙН-ПРОВАЙДЕР v2.0
 * Теперь Firebase полностью эмулируется для локальной разработки.
 */

interface UserAuthState {
  user: any | null;
  isUserLoading: boolean;
  userError: Error | null;
}

export interface FirebaseContextState {
  areServicesAvailable: boolean;
  firebaseApp: FirebaseApp | null;
  firestore: Firestore | null;
  auth: Auth | null;
  user: any | null;
  isUserLoading: boolean;
  userError: Error | null;
}

export const FirebaseContext = createContext<FirebaseContextState | undefined>(undefined);

export const FirebaseProvider: React.FC<{ children: ReactNode; firebaseApp: any; firestore: any; auth: any }> = ({
  children,
}) => {
  // Эмулируем постоянного авторизованного пользователя
  const [userAuthState] = useState<UserAuthState>({
    user: { uid: 'local-manager', displayName: 'Local Manager', email: 'local@lote.dev' },
    isUserLoading: false,
    userError: null,
  });

  const contextValue = useMemo((): FirebaseContextState => ({
    areServicesAvailable: true,
    firebaseApp: null,
    firestore: null,
    auth: null,
    user: userAuthState.user,
    isUserLoading: userAuthState.isUserLoading,
    userError: userAuthState.userError,
  }), [userAuthState]);

  return (
    <FirebaseContext.Provider value={contextValue}>
      {children}
    </FirebaseContext.Provider>
  );
};

export const useFirebase = (): any => {
  const context = useContext(FirebaseContext);
  return context;
};

export const useAuth = (): any => null;
export const useFirestore = (): any => null;
export const useFirebaseApp = (): any => null;
export const useMemoFirebase = (f: any) => useMemo(f, []);
export const useUser = () => {
  const { user, isUserLoading, userError } = useFirebase();
  return { user, isUserLoading, userError };
};
