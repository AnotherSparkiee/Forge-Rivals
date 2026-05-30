
'use client';

import { useUser } from '@/firebase';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect, ReactNode, useState } from 'react';
import { LoadingScreen } from './LoadingScreen';
import { useGameState } from '@/app/lib/store';

/**
 * Route protection guard.
 * Manages redirects and conditional rendering of game-wide listeners.
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
      router.replace('/auth/register');
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

  const isAuthPage = pathname?.startsWith('/auth');
  const isSetupPage = pathname === '/setup';

  // If we are on an auth page, we only render the page content, NO matching listeners or top bars
  if (isAuthPage) {
    // Find the actual page content among children (it's the Suspense wrapped children in layout.tsx)
    // Actually, layout.tsx passes everything as children. We need to filter what to show.
    return <div className="animate-in fade-in duration-500">{children}</div>;
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
