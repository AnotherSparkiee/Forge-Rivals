'use client';
    
import { useState, useEffect } from 'react';
import {
  DocumentReference,
  onSnapshot,
  DocumentData,
  FirestoreError,
  DocumentSnapshot,
} from 'firebase/firestore';

type WithId<T> = T & { id: string };

export interface UseDocResult<T> {
  data: WithId<T> | null;
  isLoading: boolean;
  error: FirestoreError | Error | null;
}

/**
 * Hook for subscribing to a single Firestore document.
 * Refactored to decouple SDK reads from React re-renders to avoid ca9 assertion crashes.
 */
export function useDoc<T = any>(
  memoizedDocRef: DocumentReference<DocumentData> | null | undefined,
): UseDocResult<T> {
  const [data, setData] = useState<WithId<T> | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<FirestoreError | Error | null>(null);

  useEffect(() => {
    if (!memoizedDocRef) {
      setData(null);
      setIsLoading(false);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    let active = true;

    try {
      const unsubscribe = onSnapshot(
        memoizedDocRef,
        (snapshot: DocumentSnapshot<DocumentData>) => {
          if (!active) return;
          if (snapshot.exists()) {
            setData({ ...(snapshot.data() as T), id: snapshot.id });
          } else {
            setData(null);
          }
          setError(null); 
          setIsLoading(false);
        },
        (fError: FirestoreError) => {
          if (!active) return;
          console.warn("Firestore Doc Stream Error:", fError.code, fError.message);
          setError(fError);
          setData(null);
          setIsLoading(false);
        }
      );

      return () => {
        active = false;
        unsubscribe();
      };
    } catch (e: any) {
      console.error("Critical doc hook setup error:", e.message);
      setError(e);
      setIsLoading(false);
      return;
    }
  }, [memoizedDocRef]);

  return { data, isLoading, error };
}
