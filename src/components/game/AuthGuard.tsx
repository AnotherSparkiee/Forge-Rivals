'use client';

import { useUser } from '@/firebase';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect, ReactNode, useState } from 'react';
import { LoadingScreen } from './LoadingScreen';
import { useGameState } from '@/app/lib/store';

/**
 * Route protection guard.
 * Manages redirects and ensures unauthenticated users start at registration.
 */
export function AuthGuard({ children }: { children: ReactNode }) {
  const { user, isUserLoading } = useUser();
  const { isLoaded, selectedLeagueId, country } = useGameState();
  const router = useRouter();
  const pathname = usePathname();
  
  const [isInitialCheckDone, setIsInitialCheckDone] = useState(false);

  useEffect(() => {
    if (isUserLoading) return;

    const isAuthPage = pathname?.startsWith('/auth');
    const isSetupPage = pathname === '/setup';

    // 1. Handle unauthenticated users
    if (!user) {
      if (!isAuthPage) {
        router.replace('/auth/register');
      }
      setIsInitialCheckDone(true);
      return;
    }

    // 2. Handle authenticated users (wait for profile load)
    if (isLoaded) {
      const isSetupComplete = !!(selectedLeagueId && country);
      
      if (!isSetupComplete) {
        // Must complete setup before playing
        if (!isSetupPage && !isAuthPage) {
          router.replace('/setup');
        }
      } else {
        // Setup is complete, don't allow auth/setup pages
        if (isAuthPage || isSetupPage) {
          router.replace('/');
        }
      }
      setIsInitialCheckDone(true);
    }
  }, [user, isUserLoading, isLoaded, selectedLeagueId, country, router, pathname]);

  // Prevent flicker or unauthorized content rendering
  if (isUserLoading || !isInitialCheckDone) {
    return <LoadingScreen />;
  }

  return (
    <div className="animate-in fade-in duration-500">
      {children}
    </div>
  );
}
