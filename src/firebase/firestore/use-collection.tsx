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
  fromCache: boolean;
}

/**
 * Hook for subscribing to Firestore collections.
 * Optimized to prevent flickering by waiting for server data if cache is empty.
 */
export function useCollection<T = any>(
    memoizedTargetRefOrQuery: (CollectionReference<DocumentData> | Query<DocumentData>) | null | undefined,
): UseCollectionResult<T> {
  const [data, setData] = useState<WithId<T>[] | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [fromCache, setFromCache] = useState<boolean>(true);
  const [error, setError] = useState<FirestoreError | Error | null>(null);

  useEffect(() => {
    if (!memoizedTargetRefOrQuery) {
      setData(null);
      setIsLoading(false);
      setFromCache(false);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    let active = true;

    const unsubscribe = onSnapshot(
      memoizedTargetRefOrQuery,
      { includeMetadataChanges: true },
      (snapshot: QuerySnapshot<DocumentData>) => {
        if (!active) return;
        
        const results: WithId<T>[] = [];
        snapshot.forEach((doc) => {
          results.push({ ...(doc.data() as T), id: doc.id });
        });
        
        const isFromCache = snapshot.metadata.fromCache;
        const isServerUpdatePending = snapshot.metadata.hasPendingWrites;
        
        // CRITICAL FIX: If we have 0 results from cache, keep loading true until server responds
        const isWaitingForServer = isFromCache && results.length === 0;

        setData(results);
        setFromCache(isFromCache);
        
        if (!isWaitingForServer) {
          setIsLoading(false);
        }
      },
      (fError: FirestoreError) => {
        if (!active) return;
        console.warn("Firestore Collection Stream Error:", fError.code, fError.message);
        setError(fError);
        setIsLoading(false);
      }
    );

    return () => {
      active = false;
      unsubscribe();
    };
  }, [memoizedTargetRefOrQuery]);

  return { data, isLoading, error, fromCache };
}
