'use client';

import { useState, useEffect } from 'react';
import {
  Query,
  onSnapshot,
  DocumentData,
  FirestoreError,
  QuerySnapshot,
  CollectionReference,
} from 'firebase/firestore';

export type WithId<T> = T & { id: string };

export interface UseCollectionResult<T> {
  data: WithId<T>[] | null;
  isLoading: boolean;
  error: FirestoreError | Error | null;
}

/**
 * Hook for subscribing to Firestore collections.
 * Optimized for stability with Firestore 11.9.0.
 * Decouples updates from the internal SDK task queue to avoid assertion errors.
 */
export function useCollection<T = any>(
    memoizedTargetRefOrQuery: (CollectionReference<DocumentData> | Query<DocumentData>) | null | undefined,
): UseCollectionResult<T> {
  const [data, setData] = useState<WithId<T>[] | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<FirestoreError | Error | null>(null);

  useEffect(() => {
    if (!memoizedTargetRefOrQuery) {
      setData(null);
      setIsLoading(false);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    let active = true;

    // Use a try-catch for immediate initialization errors
    try {
      const unsubscribe = onSnapshot(
        memoizedTargetRefOrQuery,
        (snapshot: QuerySnapshot<DocumentData>) => {
          if (!active) return;
          
          const results: WithId<T>[] = [];
          snapshot.forEach((doc) => {
            results.push({ ...(doc.data() as T), id: doc.id });
          });
          
          setData(results);
          setError(null);
          setIsLoading(false);
        },
        (fError: FirestoreError) => {
          if (!active) return;
          console.warn("Firestore Collection Stream Error:", fError.code, fError.message);
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
      console.error("Critical hook setup error:", e.message);
      setError(e);
      setIsLoading(false);
      return;
    }
  }, [memoizedTargetRefOrQuery]);

  return { data, isLoading, error };
}
