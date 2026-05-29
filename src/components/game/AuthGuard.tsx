'use client';

import { useUser } from '@/firebase';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect, ReactNode, useState } from 'react';
import { LoadingScreen } from './LoadingScreen';
import { useGameState } from '@/app/lib/store';

/**
 * Route protection guard.
 * Manages redirects to /auth/login or /setup based on user state.
 */
export function AuthGuard({ children }: { children: ReactNode }) {
  const { user, isUserLoading } = useUser();
  const { isLoaded, selectedLeagueId, country } = useGameState();
  const router = useRouter();
  const pathname = usePathname();
  
  const [isInitialCheckDone, setIsInitialCheckDone] = useState(false);

  useEffect(() => {
    if (isUserLoading) return;

    // Allow auth pages without redirect
    if (pathname?.startsWith('/auth')) {
      setIsInitialCheckDone(true);
      return;
    }

    if (!user) {
      router.replace('/auth/login');
      setIsInitialCheckDone(true);
      return;
    }

    // Wait for game store if user is logged in
    if (isLoaded) {
      const isSetupComplete = !!(selectedLeagueId && country);
      
      if (!isSetupComplete && pathname !== '/setup') {
        router.replace('/setup');
      } else if (isSetupComplete && pathname === '/setup') {
        router.replace('/');
      }
      setIsInitialCheckDone(true);
    }
  }, [user, isUserLoading, isLoaded, selectedLeagueId, country, router, pathname]);

  // Always render auth children immediately to avoid blank screens on login/register
  if (pathname?.startsWith('/auth')) {
    return <>{children}</>;
  }

  if (!isInitialCheckDone || isUserLoading || (user && !isLoaded)) {
    return <LoadingScreen />;
  }

  return (
    <div className="animate-in fade-in duration-500">
      {children}
    </div>
  );
}
