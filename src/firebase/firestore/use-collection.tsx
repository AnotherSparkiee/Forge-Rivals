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
import { FirestorePermissionError } from '@/firebase/errors';

export type WithId<T> = T & { id: string };

export interface UseCollectionResult<T> {
  data: WithId<T>[] | null;
  isLoading: boolean;
  error: FirestoreError | Error | null;
}

/**
 * Hook for subscribing to Firestore collections.
 * Simplified to prevent internal assertion failures in SDK 11.9.0.
 */
export function useCollection<T = any>(
    memoizedTargetRefOrQuery: (CollectionReference<DocumentData> | Query<DocumentData>) | null | undefined,
): UseCollectionResult<T> {
  const [data, setData] = useState<WithId<T>[] | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<FirestoreError | Error | null>(null);

  useEffect(() => {
    // Reset state if query is null
    if (!memoizedTargetRefOrQuery) {
      setData(null);
      setIsLoading(false);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    // active flag to prevent state updates on unmounted component
    let active = true;

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
        
        console.warn("Firestore stream error:", fError.code, fError.message);
        
        if (fError.code === 'permission-denied') {
          // Provide a safe error object without accessing private SDK properties
          setError(new FirestorePermissionError({ 
            operation: 'list', 
            path: 'market_v2' 
          }));
        } else {
          setError(fError);
        }
        
        setData(null);
        setIsLoading(false);
      }
    );

    return () => {
      active = false;
      unsubscribe();
    };
  }, [memoizedTargetRefOrQuery]);

  return { data, isLoading, error };
}