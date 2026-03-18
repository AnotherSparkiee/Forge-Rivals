'use client';

import { useUser } from '@/firebase';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect, ReactNode } from 'react';
import { LoadingScreen } from './LoadingScreen';
import { useGameState } from '@/app/lib/store';

/**
 * Enhanced Route Guard for MOBA Tactics Online.
 * Ensures users are authenticated AND have completed their profile setup.
 * Uses the reactive GameState store as the single source of truth.
 */
export function AuthGuard({ children }: { children: ReactNode }) {
  const { user, isUserLoading } = useUser();
  const { isLoaded, selectedLeagueId, country } = useGameState();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // 1. Skip checks for auth-related pages (login/register)
    if (pathname?.startsWith('/auth')) return;

    // 2. If Auth check finished and no user, go to login
    if (!isUserLoading && !user) {
      router.replace('/auth/login');
      return;
    }

    // 3. Once auth is confirmed AND store has synchronized with Firestore
    if (user && isLoaded) {
      const isSetupComplete = !!(selectedLeagueId && country);

      // Redirect to setup if incomplete, otherwise redirect to home if they hit setup manually
      if (!isSetupComplete && pathname !== '/setup') {
        router.replace('/setup');
      } else if (isSetupComplete && pathname === '/setup') {
        router.replace('/');
      }
    }
  }, [user, isUserLoading, isLoaded, selectedLeagueId, country, router, pathname]);

  // Auth pages are always accessible
  if (pathname?.startsWith('/auth')) {
    return <>{children}</>;
  }

  // Show loading screen while auth is loading OR while game state is syncing from DB
  if (isUserLoading || !isLoaded) {
    return <LoadingScreen />;
  }

  // Final check to prevent content flicker if redirect is about to happen
  if (user && isLoaded) {
    const isSetupComplete = !!(selectedLeagueId && country);
    if (!isSetupComplete && pathname !== '/setup') {
      return <LoadingScreen />;
    }
  }

  return <>{children}</>;
}
