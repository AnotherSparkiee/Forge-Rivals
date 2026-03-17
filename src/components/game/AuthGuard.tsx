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

    // 3. Once store is loaded, verify setup completion
    if (user && isLoaded) {
      const isSetupComplete = !!(selectedLeagueId && country);

      if (!isSetupComplete && pathname !== '/setup') {
        router.replace('/setup');
      } else if (isSetupComplete && pathname === '/setup') {
        router.replace('/');
      }
    }
  }, [user, isUserLoading, isLoaded, selectedLeagueId, country, router, pathname]);

  // Auth pages (login/register) are always accessible immediately
  if (pathname?.startsWith('/auth')) {
    return <>{children}</>;
  }

  // Show loading screen while auth or game state is initializing
  if (isUserLoading || !isLoaded) {
    return <LoadingScreen />;
  }

  // If user is logged in but setup is incomplete, prevent access to game screens
  if (user && pathname !== '/setup') {
    const isSetupComplete = !!(selectedLeagueId && country);
    if (!isSetupComplete) {
      return <LoadingScreen />;
    }
  }

  // Final catch-all: if no user and not on auth page, don't render children
  if (!user && !pathname?.startsWith('/auth')) {
    return null;
  }

  return <>{children}</>;
}
