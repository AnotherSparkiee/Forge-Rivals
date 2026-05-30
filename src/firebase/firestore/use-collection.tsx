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
 * Optimized for stability with Firestore 11.9.0 and React 19.
 * Uses a safe timeout to decouple SDK internals from React render cycles, 
 * preventing "Unexpected state (ID: ca9)" errors.
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
    let unsubscribe: (() => void) | null = null;

    // Small delay to ensure any previous unsubscriptions are processed by the SDK
    const timer = setTimeout(() => {
      try {
        if (!active) return;
        
        unsubscribe = onSnapshot(
          memoizedTargetRefOrQuery,
          (snapshot: QuerySnapshot<DocumentData>) => {
            if (!active) return;
            
            const results: WithId<T>[] = [];
            snapshot.forEach((doc) => {
              results.push({ ...(doc.data() as T), id: doc.id });
            });
            
            // Decouple state update from snapshot callback to avoid ID: ca9/b815
            setTimeout(() => {
              if (active) {
                setData(results);
                setError(null);
                setIsLoading(false);
              }
            }, 0);
          },
          (fError: FirestoreError) => {
            if (!active) return;
            console.warn("Firestore Collection Stream Error:", fError.code, fError.message);
            setError(fError);
            setData(null);
            setIsLoading(false);
          }
        );
      } catch (e: any) {
        if (active) {
          console.error("Critical hook setup error:", e.message);
          setError(e);
          setIsLoading(false);
        }
      }
    }, 20);

    return () => {
      active = false;
      clearTimeout(timer);
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [memoizedTargetRefOrQuery]);

  return { data, isLoading, error };
}
