'use client';

import { useUser } from '@/firebase';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect, ReactNode, useState } from 'react';
import { LoadingScreen } from './LoadingScreen';
import { useGameState } from '@/app/lib/store';

/**
 * Enhanced Route Guard for Lines of the Enmity.
 * Ensures users are authenticated, profile is setup, 
 * and handles the mandatory 5-second initial splash screen.
 */
export function AuthGuard({ children }: { children: ReactNode }) {
  const { user, isUserLoading } = useUser();
  const { isLoaded, selectedLeagueId, country } = useGameState();
  const router = useRouter();
  const pathname = usePathname();
  
  // State to manage the mandatory 5-second splash screen
  const [splashActive, setSplashActive] = useState(true);

  useEffect(() => {
    // Start 5-second timer on mount
    const timer = setTimeout(() => {
      setSplashActive(false);
    }, 5000);

    return () => clearTimeout(timer);
  }, []);

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

  // Show splash screen if still in initial 5s delay, OR if data is still loading
  if (splashActive || isUserLoading || !isLoaded) {
    return <LoadingScreen />;
  }

  // Final check to prevent content flicker if redirect is about to happen
  if (user && isLoaded) {
    const isSetupComplete = !!(selectedLeagueId && country);
    if (!isSetupComplete && pathname !== '/setup') {
      return <LoadingScreen />;
    }
  }

  return (
    <div className="animate-in fade-in duration-700">
      {children}
    </div>
  );
}
